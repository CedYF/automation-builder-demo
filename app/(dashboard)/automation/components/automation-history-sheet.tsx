"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, ExternalLink, Clock, FlaskConical, RefreshCw } from "lucide-react";
import { HistoryDetailDialog } from "./history-detail-dialog";
import { CommentRunHistory } from "../_features/comment-automation/components/comment-run-history";
import type { CommentActionType, RunPageCount } from "@/app/(dashboard)/comments/lib/api/automation";
import { formatRunPagesLabel, type CommentActionRuleSummary } from "../lib/comment-action-setup-summary";

interface HistoryRule {
  id: number;
  name: string;
  actionType: string;
  targetId: string | null;
  accountId: string;
  status: string;
  effectiveStatus?: string;
  batchStatus?: string | null;
  batchProcessed?: boolean | null;
  executed: boolean;
  executedAt: string | null;
  resultId: string | null;
  errorMessage: string | null;
  executionLogs: string[] | null;
  stepResults?: any[] | null;
  userEmail: string | null;
  scheduledDate: string;
  scheduledTime: string;
  duration: number | null;
  automationRuleId: number | null;
}

interface AutomationHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationRuleId: number | null;
  automationName: string;
  /**
   * Comment automations execute on CommentsServer, so their history comes from
   * that service's runs — not the Prisma automation history. The id spaces also
   * overlap, so fetching Prisma history with a CommentsServer rule id could
   * show an unrelated automation's rows.
   */
  isCommentAutomation?: boolean;
  commentActionType?: CommentActionType;
  /**
   * Which page(s)/tone/cadence the comment rule runs against. A run's page
   * selection is a property of the rule, not of any one past execution, so
   * this is shown once above the run list rather than repeated per row —
   * the same context execution-panel.tsx leads its run screen with.
   */
  commentRuleSummary?: CommentActionRuleSummary | null;
}

export function AutomationHistorySheet({
  open,
  onOpenChange,
  automationRuleId,
  automationName,
  isCommentAutomation = false,
  commentActionType = "hide",
  commentRuleSummary = null,
}: AutomationHistorySheetProps) {
  const [history, setHistory] = useState<HistoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRule, setSelectedRule] = useState<HistoryRule | null>(null);
  // Every page the comment automation covers, as CommentsServer reports it
  // with the runs. The builder config often has no stored page names, which
  // left the header at "6 pages (names not loaded yet)".
  const [runPages, setRunPages] = useState<readonly RunPageCount[]>([]);
  useEffect(() => {
    setRunPages([]);
  }, [automationRuleId]);
  const commentPagesLabel = formatRunPagesLabel(runPages) ?? commentRuleSummary?.pagesLabel;

  const fetchHistory = async (showRefreshIndicator = false) => {
    if (!automationRuleId || isCommentAutomation) {
      setLoading(false);
      return;
    }
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const response = await fetch(`/api/automation-rules?history=true&automationRuleId=${automationRuleId}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.rules || []);
      }
    } catch (error) {
      console.error("Failed to fetch automation history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (open && automationRuleId && !isCommentAutomation) {
      setLoading(true);
      fetchHistory();
    }
  }, [open, automationRuleId, isCommentAutomation]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const formatActionType = (type: string) => {
    const labels: Record<string, string> = {
      "duplicate-adset": "Duplicate Ad Set",
      "duplicate-campaign": "Duplicate Campaign",
      "duplicate-ad": "Duplicate Ad",
      "launch-campaign": "Launch",
      "launch-ad": "Launch Ad",
      "pause-campaign": "Pause",
    };
    return labels[type] || type;
  };

  const getStatusInfo = (rule: HistoryRule) => {
    const status = rule.effectiveStatus || rule.status;

    if (status === "test") {
      return {
        label: "Test Run",
        variant: "outline" as const,
        icon: FlaskConical,
        isProcessing: false,
      };
    }
    if (status === "processing") {
      return {
        label: "Processing",
        variant: "secondary" as const,
        icon: RefreshCw,
        isProcessing: true,
      };
    }
    if (status === "completed" || (rule.executed && !rule.errorMessage)) {
      return {
        label: "Success",
        variant: "success" as const,
        icon: CheckCircle2,
        isProcessing: false,
      };
    }
    if (status === "failed" || rule.errorMessage) {
      return {
        label: "Failed",
        variant: "destructive" as const,
        icon: XCircle,
        isProcessing: false,
      };
    }
    return {
      label: "Pending",
      variant: "secondary" as const,
      icon: Clock,
      isProcessing: false,
    };
  };

  const getAdsManagerUrl = (rule: HistoryRule) => {
    if (!rule.resultId) return null;
    const accountId = rule.accountId != null ? String(rule.accountId).replace("act_", "") : undefined;
    if (rule.actionType === "duplicate-adset") {
      return `https://www.facebook.com/adsmanager/manage/adsets?act=${accountId}&selected_adset_ids=${rule.resultId}`;
    }
    return `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${rule.resultId}`;
  };

  const getUserInitials = (email: string | null) => {
    if (!email) return "?";
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">📜</span>
              <span>History: {automationName}</span>
              {automationRuleId != null && (
                <span className="text-xs text-muted-foreground font-normal" title="Automation ID for debugging">
                  #{automationRuleId}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {isCommentAutomation && (
            <div className="mt-6">
              {/* Which page(s) these runs watched — stated once, up front, so
                  it never has to be reconstructed from the rule's config
                  before the run list below can be read. */}
              {commentRuleSummary && (
                <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <p
                    className={
                      commentRuleSummary.hasPages || runPages.length > 0
                        ? "text-foreground"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {commentPagesLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {commentRuleSummary.triggerLabel} · {commentRuleSummary.toneLabel}
                  </p>
                </div>
              )}
              {automationRuleId !== null ? (
                <CommentRunHistory
                  ruleId={automationRuleId}
                  actionType={commentActionType}
                  onPagesLoaded={setRunPages}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <span className="text-xl">📜</span>
                  </div>
                  <h3 className="mb-1 text-sm font-semibold">No execution history</h3>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Save the automation first to track execution history
                  </p>
                </div>
              )}
            </div>
          )}

          {!isCommentAutomation && (
            <div className="mt-6">
              {/* Refresh button */}
              {history.length > 0 && (
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchHistory(true)}
                    disabled={refreshing}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-4">
                    <span className="text-xl">📜</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">No execution history</h3>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {automationRuleId
                      ? "This automation hasn't been run yet"
                      : "Save the automation first to track execution history"}
                  </p>
                </div>
              )}

              {/* History list */}
              {!loading && history.length > 0 && (
                <div className="space-y-3">
                  {history.map((rule) => {
                    const statusInfo = getStatusInfo(rule);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <div
                        key={rule.id}
                        className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedRule(rule)}
                      >
                        {/* Top row: ID, Status, Time */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">#{rule.id}</span>
                            <Badge variant={statusInfo.variant} className="gap-1">
                              <StatusIcon className={`h-3 w-3 ${statusInfo.isProcessing ? "animate-spin" : ""}`} />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(rule.executedAt)}</span>
                        </div>

                        {/* Middle row: Action type */}
                        <div className="text-sm text-muted-foreground mb-2">{formatActionType(rule.actionType)}</div>

                        {/* Bottom row: User + Result/Error */}
                        <div className="flex items-center justify-between">
                          {/* User who ran it */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    {getUserInitials(rule.userEmail)}
                                  </div>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                    {rule.userEmail || "Unknown"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Run by: {rule.userEmail || "Unknown"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Result or Error */}
                          <div className="text-xs">
                            {rule.resultId ? (
                              <a
                                href={getAdsManagerUrl(rule) || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View result
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : rule.status === "test" ? (
                              <span className="text-muted-foreground italic">Test run</span>
                            ) : rule.errorMessage ? (
                              <span className="text-destructive truncate max-w-[100px] block">Error</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Count */}
              {!loading && history.length > 0 && (
                <div className="mt-4 text-xs text-muted-foreground text-center">
                  {history.length} execution{history.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Detail Dialog */}
      <HistoryDetailDialog
        rule={selectedRule}
        open={!!selectedRule}
        onOpenChange={(open) => {
          if (!open) setSelectedRule(null);
        }}
        modal={false}
      />
    </>
  );
}
