"use client";

import { useMemo } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationFlow } from "../contexts/automation-context";
import { listCanvasOpenSlots } from "../lib/canvas-open-slots";
import { getNodeSummary } from "../lib/node-summary";
import { getServiceInfo } from "../lib/service-icons";

interface Props {
  flow: AutomationFlow;
  busy: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onOpenStep?: (id: string, tab: "setup" | "preview") => void;
}

/** Always describes the actual draft, never the model's claims about what it built. */
export function AssistantDraftSummary({ flow, busy, canUndo, onUndo, onOpenStep }: Props) {
  const gaps = useMemo(() => listCanvasOpenSlots(flow), [flow]);
  const missingCount =
    gaps.steps.reduce((sum, step) => sum + step.slots.length, 0) +
    Number(gaps.isTriggerMissing) +
    Number(gaps.isActionMissing);
  const firstGap = gaps.steps[0]?.stepId;
  if (!flow.nodes.length)
    return canUndo ? (
      <div className="border-b p-3">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onUndo}>
          Undo draft changes
        </Button>
      </div>
    ) : null;

  return (
    <section aria-label="Your automation draft" className="border-b bg-muted/20 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your automation</p>
          <p className="break-words text-sm font-semibold">{flow.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {flow.selectedAccountName || (flow.selectedAccountId ? "Selected account" : "Account not selected")}
          </p>
        </div>
        <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-[11px]">Draft changes</span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium">
          {flow.nodes.length} steps · {missingCount ? `${missingCount} setup items remaining` : "Ready for preview"}
        </summary>
        <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
          {flow.nodes.map((node, index) => {
            const summary = getNodeSummary(node);
            const nodeGaps = gaps.steps.find((step) => step.stepId === node.id)?.slots ?? [];
            const actionConfig = node.config?.actionConfig;
            const fixedReply =
              actionConfig?.useAI === false && typeof actionConfig.replyTemplate === "string"
                ? actionConfig.replyTemplate
                : null;
            return (
              <div key={node.id} className="rounded-lg border bg-background p-2.5">
                <button
                  type="button"
                  disabled={busy || !onOpenStep}
                  onClick={() => onOpenStep?.(node.id, "setup")}
                  className="flex w-full items-center gap-2 text-left text-xs disabled:opacity-60"
                  aria-label={`Edit step ${index + 1}: ${node.event || "Choose an app"}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {node.event || "Choose an app"}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {node.service ? getServiceInfo(node.service).label : "Needs setup"}
                    </span>
                  </span>
                  <Pencil className="h-3 w-3 shrink-0" />
                </button>
                {[summary.scopeSummary, summary.conditionSummary, summary.destinationSummary, summary.frequencyLabel]
                  .filter(Boolean)
                  .map((text, i) => (
                    <p key={i} className="mt-1 break-words text-xs text-muted-foreground">
                      {text}
                    </p>
                  ))}
                {fixedReply !== null && (
                  <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-2 text-xs">
                    {fixedReply || "Reply text is missing"}
                  </blockquote>
                )}
                {nodeGaps.map((gap) => (
                  <button
                    key={`${gap.kind}-${gap.fieldName}`}
                    type="button"
                    disabled={busy || !onOpenStep}
                    onClick={() => onOpenStep?.(node.id, "setup")}
                    className="mt-1 flex w-full items-start gap-1.5 text-left text-xs text-amber-700 dark:text-amber-400"
                  >
                    <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {gap.message}
                  </button>
                ))}
              </div>
            );
          })}
          {gaps.isTriggerMissing && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Add a trigger to choose when this runs.</p>
          )}
          {gaps.isActionMissing && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Add an action to choose what happens.</p>
          )}
        </div>
      </details>
      {missingCount > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Needs setup:{" "}
          {gaps.steps
            .flatMap((step) => step.slots.map((slot) => slot.label))
            .slice(0, 3)
            .join(", ") || (gaps.isTriggerMissing ? "Trigger" : "Action")}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {onOpenStep && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-7 gap-1 text-xs"
            onClick={() => onOpenStep(firstGap || flow.nodes[0].id, missingCount ? "setup" : "preview")}
          >
            {missingCount ? <Pencil className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {missingCount ? "Finish setup" : "Preview matches"}
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        )}
        {canUndo && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            className="h-7 gap-1 text-xs"
            onClick={onUndo}
          >
            <RotateCcw className="h-3 w-3" />
            Undo draft changes
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Preview checks the draft. Saving and enabling are separate actions.
      </p>
    </section>
  );
}
