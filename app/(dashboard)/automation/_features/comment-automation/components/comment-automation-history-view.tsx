"use client";

/**
 * One comment automation's run history, as a view of its own at
 * `/automation?automationId=comment:<id>&view=history`.
 *
 * This used to be a right-hand sheet over the builder, which capped the run
 * list at a narrow column and hid it behind a dialog that no link could reach.
 * A view keeps the URL shareable, the back button working, and the full page
 * width for what is a dense, multi-page list.
 *
 * Scope is the automation, not the opened rule: CommentsServer stores an
 * automation as one rule per page tied together by a group id, so the header
 * describes the whole group (its pages and member rules) and the list below
 * reads runs for every member. Opening any member's id lands on the same
 * history.
 *
 * The filters and Refresh live here, in the header, rather than above the list:
 * they describe the whole history, and the header already carries the
 * automation's identity they qualify.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, Layers, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CommentRunHistory } from "./comment-run-history";
import { RunPageFilter } from "./run-page-filter";
import { RunOutcomeFilter } from "./run-outcome-filter";
import { useCommentAutomationMembers } from "../hooks/use-comment-automation-members";
import type { RunOutcome, RunOutcomeCount, RunPageCount } from "@/app/(dashboard)/comments/lib/api/automation";

interface CommentAutomationHistoryViewProps {
  /** Any member rule of the automation; the whole group is resolved from it. */
  readonly ruleId: number;
  /** Back to the builder for the same automation. */
  readonly onBack: () => void;
}

/** Paused and error states earn a visible badge; a healthy automation doesn't. */
function statusBadge(status: string): { label: string; variant: "secondary" | "destructive" | "success" } | null {
  const normalized = status.toLowerCase();
  if (normalized === "active") return { label: "Active", variant: "success" };
  if (normalized === "executing") return { label: "Running", variant: "secondary" };
  if (normalized === "paused" || normalized === "inactive") return { label: "Paused", variant: "secondary" };
  if (normalized === "error" || normalized === "auto_disabled") {
    return { label: "Needs attention", variant: "destructive" };
  }
  return null;
}

/** "6 rules · 6 pages" — how many per-page rules this one automation is made of. */
function describeMembership(memberCount: number, pageCount: number): string {
  const rules = `${memberCount} rule${memberCount === 1 ? "" : "s"}`;
  const pages = `${pageCount} page${pageCount === 1 ? "" : "s"}`;
  return `${rules} · ${pages}`;
}

/** Sits left of the title rather than above it, so it costs no extra row. */
function BackToBuilderButton({ onBack }: { onBack: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-2 h-8 w-8 flex-shrink-0"
      onClick={onBack}
      aria-label="Back to builder"
      title="Back to builder"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}

export function CommentAutomationHistoryView({ ruleId, onBack }: CommentAutomationHistoryViewProps) {
  const members = useCommentAutomationMembers(ruleId);
  /**
   * Every page of the automation with its run count, reported up by the list.
   * The rule config often stores no page names, so these — not the config —
   * are what the filter names its options with.
   */
  const [runPages, setRunPages] = useState<readonly RunPageCount[]>([]);
  const [runOutcomes, setRunOutcomes] = useState<readonly RunOutcomeCount[]>([]);
  const [pageFilter, setPageFilter] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<RunOutcome | null>(null);
  /** Bumped by Refresh; the list re-reads whenever it changes. */
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // A different automation starts unfiltered; its pages are not this one's.
  useEffect(() => {
    setPageFilter(null);
    setOutcomeFilter(null);
    setRunPages([]);
    setRunOutcomes([]);
  }, [ruleId]);

  const rule = members.data?.rule ?? null;
  const groupId = members.data?.groupId ?? null;
  const memberCount = members.data?.memberIds.length ?? 0;
  const pageIds = members.data?.pageIds ?? [];
  const badge = rule ? statusBadge(rule.status) : null;
  const pageCount = runPages.length || pageIds.length;
  // Runs across the whole history, for the outcome filter's "All outcomes" row.
  // Page counts are never narrowed by either filter, so this stays put as they
  // are used.
  const totalRuns = runPages.reduce((sum, page) => sum + page.runCount, 0);
  // Nothing loaded, so the controls would act on an empty list.
  const canFilter = !members.error;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border px-4 pb-4 pt-4 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          {members.isLoading ? (
            <div className="flex items-center gap-2">
              <BackToBuilderButton onBack={onBack} />
              <Skeleton className="h-7 w-64" />
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <BackToBuilderButton onBack={onBack} />
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {rule?.name ?? "Comment automation"}
                </h1>
                <span className="text-xs text-muted-foreground" title="Automation ID for debugging">
                  #{ruleId}
                </span>
                {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                {canFilter && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="ml-auto h-8 w-8"
                    onClick={() => setRefreshToken((token) => token + 1)}
                    disabled={refreshing}
                    aria-label="Refresh run history"
                    title="Refresh run history"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  </Button>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {canFilter && runPages.length > 1 && (
                  <RunPageFilter pages={runPages} selectedPageId={pageFilter} onSelect={setPageFilter} />
                )}
                {canFilter && runOutcomes.length > 0 && (
                  <RunOutcomeFilter
                    outcomes={runOutcomes}
                    selectedOutcome={outcomeFilter}
                    actionType={rule?.actionType ?? "hide"}
                    totalRuns={totalRuns}
                    onSelect={setOutcomeFilter}
                  />
                )}
                {memberCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    {describeMembership(memberCount, pageCount)}
                  </span>
                )}
                {groupId && (
                  <span
                    className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-5 text-muted-foreground"
                    title="Group key — every page's rule in this automation shares it"
                  >
                    {groupId}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          {members.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {members.error.message}
            </div>
          ) : (
            <CommentRunHistory
              ruleId={ruleId}
              actionType={rule?.actionType ?? "hide"}
              pageFilter={pageFilter}
              outcome={outcomeFilter}
              refreshToken={refreshToken}
              onPagesLoaded={setRunPages}
              onOutcomesLoaded={setRunOutcomes}
              onRefreshingChange={setRefreshing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
