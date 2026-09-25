"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Eye, Hash, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAutomation, type AutomationNode } from "../contexts/automation-context";
import { getServiceInfo } from "../lib/service-icons";
import { getNodeSummary } from "../lib/node-summary";
import { useCustomMetricsById } from "../lib/use-custom-metrics-by-id";
import { nodeTypeBadgeStyles } from "../lib/service-themes";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";

interface FullPreviewPanelProps {
  onClose: () => void;
}

function getStepHeadline(node: AutomationNode): string {
  if (node.type === "trigger") return "Trigger fires when…";
  if (node.type === "action") return "Action sends…";
  if (node.type === "filter") return "Filter evaluates…";
  if (node.type === "delay") return "Waits…";
  if (node.type === "approval") return "Waits for approval…";
  return "Runs…";
}

function StepCard({ node, index }: { node: AutomationNode; index: number }) {
  const info = node.service ? getServiceInfo(node.service) : null;
  const customMetricsById = useCustomMetricsById();
  const summary = getNodeSummary(node, { customMetricsById });
  const typeBadge = nodeTypeBadgeStyles[node.type];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Head */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
            typeBadge.bg,
            typeBadge.text,
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{getStepHeadline(node)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.subtitle ||
              (info?.label ? `${info.label} · ${normalizeAdscanEventForDisplay(node.event) || "—"}` : "Not configured")}
          </p>
        </div>
      </div>

      {/* Body — condition / matching */}
      {(summary.conditionSummary || summary.destinationSummary) && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          {summary.conditionSummary && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Condition</p>
              <p className="mt-0.5 text-sm font-medium text-primary">{summary.conditionSummary}</p>
            </>
          )}
          {summary.destinationSummary && !summary.conditionSummary && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sends</p>
              <p className="mt-0.5 text-sm font-medium text-blue-800">{summary.destinationSummary}</p>
            </>
          )}
          {summary.badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {summary.badges.map((b, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                    b.tone === "muted"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mocked email preview for a notification action. Uses real recipients / rule text when available.
 */
function EmailPreview({
  recipients,
  ruleText,
  triggerConditionText,
}: {
  recipients: string[];
  ruleText: string;
  triggerConditionText?: string;
}) {
  const toLine = recipients.length > 0 ? recipients[0] : "you@example.com";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[36px_1fr] gap-3 border-b border-border px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          AM
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">the app Alert</p>
          <p className="text-[11px] text-muted-foreground">to {toLine} · Mon 9:00am</p>
          <p className="mt-1 text-xs font-medium text-foreground">{ruleText}</p>
        </div>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your rule <span className="font-medium text-primary">{triggerConditionText || "—"}</span> was triggered:
        </p>
        <div className="mt-2.5 overflow-hidden rounded-md bg-muted/50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
            <div>
              <p className="font-medium text-foreground">Summer Sale — UK</p>
              <p className="text-[11px] text-muted-foreground">ROAS 3.2 → 2.1</p>
            </div>
            <span className="font-semibold text-red-600">▼ 34%</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <div>
              <p className="font-medium text-foreground">Retargeting — All</p>
              <p className="text-[11px] text-muted-foreground">ROAS 4.8 → 3.5</p>
            </div>
            <span className="font-semibold text-red-600">▼ 27%</span>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-primary px-3.5 py-2 text-center">
          <span className="text-xs font-medium text-primary-foreground">Review in the app →</span>
        </div>
      </div>
    </div>
  );
}

function SlackPreview({
  channelName,
  ruleText,
  customMessage,
}: {
  channelName: string;
  ruleText: string;
  customMessage?: string;
}) {
  const body = customMessage?.trim() || `Your the app rule *${ruleText}* was triggered.`;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2 text-xs">
        <img src="/slack-logo.svg" alt="" className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">#{channelName}</span>
        <span className="text-muted-foreground">· Slack</span>
      </div>
      <div className="px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
            AM
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-foreground">the app</span>
              <span className="rounded bg-muted px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                APP
              </span>
              <span className="text-[10px] text-muted-foreground">9:00 AM</span>
            </div>
            <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-foreground">{body}</p>
            <div className="mt-2 rounded-md border-l-4 border-primary bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-medium text-foreground">Live run details are added automatically</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Matched count · rule and window · top ad metrics · direct links
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FullPreviewPanel({ onClose }: FullPreviewPanelProps) {
  const { flow } = useAutomation();
  const customMetricsById = useCustomMetricsById();

  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  const notificationNode = flow.nodes.find((n) => n.type === "action" && n.service === "notification");

  const triggerSummary = triggerNode ? getNodeSummary(triggerNode, { customMetricsById }) : null;

  const recipients: string[] = useMemo(() => notificationNode?.config?.emailRecipients || [], [notificationNode]);

  const method: string = notificationNode?.config?.notificationMethod || "email";
  const hasEmail = method === "email" || method === "both";
  const hasSlack = method === "slack" || method === "both";
  const slackChannelName: string = notificationNode?.config?.slackChannelOverride?.name || "app-alerts";
  const customMessage: string = notificationNode?.config?.customMessage || "";

  const availableChannels: ("email" | "slack")[] = [];
  if (hasEmail) availableChannels.push("email");
  if (hasSlack) availableChannels.push("slack");
  const [channel, setChannel] = useState<"email" | "slack">(availableChannels[0] || "email");
  useEffect(() => {
    if (availableChannels.length > 0 && !availableChannels.includes(channel)) {
      setChannel(availableChannels[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const ruleText = triggerSummary?.conditionSummary
    ? `${triggerSummary.conditionSummary.replace(/ vs prior period$/, "")} detected`
    : "Rule triggered";

  const showNotificationPreview = !!notificationNode && availableChannels.length > 0;

  return (
    <div className="flex h-full max-h-[85vh] min-h-0 flex-col bg-card md:max-h-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Eye className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold md:text-[15px]">Full preview</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">End-to-end view of how this runs</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
        {flow.nodes.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Add steps to see the full preview.
          </p>
        )}

        {flow.nodes.length > 0 && (
          <>
            <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
              Trigger fires, action sends. This is the complete output when this automation runs.
            </p>

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              How this runs
            </p>

            <div className="space-y-0">
              {flow.nodes.map((node, i) => (
                <div key={node.id}>
                  <StepCard node={node} index={i} />
                  {i < flow.nodes.length - 1 && (
                    <div className="flex justify-center py-1.5 text-muted-foreground/50">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showNotificationPreview && (
              <>
                <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What you&apos;d receive
                </p>
                {availableChannels.length > 1 && (
                  <div className="mb-3 flex gap-1.5">
                    {availableChannels.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChannel(c)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          channel === c
                            ? "border-transparent bg-primary/10 text-primary"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c === "email" ? <Mail className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                        {c === "email" ? "Email" : "Slack"}
                      </button>
                    ))}
                  </div>
                )}

                {channel === "email" && hasEmail ? (
                  <EmailPreview
                    recipients={recipients}
                    ruleText={ruleText}
                    triggerConditionText={triggerSummary?.conditionSummary?.replace(/ vs prior period$/, "")}
                  />
                ) : channel === "slack" && hasSlack ? (
                  <SlackPreview channelName={slackChannelName} ruleText={ruleText} customMessage={customMessage} />
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 md:px-5 md:py-3.5">
        <Button variant="outline" className="w-full" onClick={onClose}>
          ← Back to editor
        </Button>
      </div>
    </div>
  );
}
