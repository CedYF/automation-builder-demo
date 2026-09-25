"use client";

import { useMemo } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, ChevronDown, Pencil, RotateCcw } from "lucide-react";
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

  const triggerPageIds = flow.nodes[0].config?.pageIds;
  const pageCount = Array.isArray(triggerPageIds) ? triggerPageIds.length : 0;
  const triggerScope = pageCount
    ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}`
    : getNodeSummary(flow.nodes[0]).scopeSummary;

  return (
    <section aria-label="Your automation draft" className="border-b bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${missingCount ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {missingCount ? <CircleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{missingCount ? "Needs setup" : "Ready to review"}</p>
            <p className="text-xs text-muted-foreground">
              {flow.nodes.length} {flow.nodes.length === 1 ? "step" : "steps"}
              {triggerScope ? ` · ${triggerScope}` : ""}
            </p>
          </div>
        </div>
        {onOpenStep && (
          <Button
            type="button"
            size="sm"
            variant={missingCount ? "outline" : "default"}
            disabled={busy}
            className="h-8 gap-1.5 text-xs"
            onClick={() => onOpenStep(firstGap || flow.nodes[0].id, missingCount ? "setup" : "preview")}
          >
            {missingCount ? "Finish setup" : "Preview matches"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {missingCount > 0 && (
        <p className="mt-2 pl-9 text-xs text-amber-700 dark:text-amber-400">
          Add {gaps.steps.flatMap((step) => step.slots.map((slot) => slot.label)).slice(0, 3).join(", ") || (gaps.isTriggerMissing ? "a trigger" : "an action")} to continue.
        </p>
      )}
      <details className="group mt-2 pl-9">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          Review steps <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
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
      {canUndo && (
        <div className="mt-2 pl-9">
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
        </div>
      )}
    </section>
  );
}
