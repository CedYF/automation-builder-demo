"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Hammer, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASSISTANT_PROSE_MARKDOWN_GATE } from "@/lib/chat/assistant-markdown-gate";
import type { AssistantToolCall, SuggestionBuildMetadata } from "../hooks/use-automation-assistant";

const BUILD_TOOL_LABELS: Record<string, string> = {
  automation_start_flow: "Start a fresh draft",
  automation_add_step: "Add step",
  automation_update_step: "Update step",
  automation_remove_step: "Remove step",
  create_automation: "Draft automation flow",
};

const ASSISTANT_MARKDOWN_COMPONENTS: Components = {
  // SEC-012b (ADM-10938): gated `img` renderer, paired with the `urlTransform` at the call site.
  ...ASSISTANT_PROSE_MARKDOWN_GATE.components,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
};

interface SuggestionBuildProgressCardProps {
  readonly suggestion: SuggestionBuildMetadata;
  readonly toolCalls: readonly AssistantToolCall[];
  readonly assistantText: string;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly onRetry?: () => void;
  readonly showSummary?: boolean;
}

export type BuildCompletionStatus = "building" | "error" | "awaiting_input" | "on_canvas" | "incomplete";

/** Resolve the post-build status once tool steps finish (or when the stream errors). */
export function resolveBuildCompletionStatus(
  buildSteps: readonly AssistantToolCall[],
  isLoading: boolean,
  hasError: boolean,
  assistantText: string,
): BuildCompletionStatus {
  if (isLoading) return "building";
  if (hasError) return "error";

  const allStepsComplete =
    buildSteps.length === 0 || buildSteps.every((call) => call.status === "done" || call.status === "approved");

  if (buildSteps.some((call) => call.status === "error")) return "error";
  if (!allStepsComplete) return "incomplete";

  if (detectBuildAwaitingUserInput(assistantText)) return "awaiting_input";
  if (buildSteps.some((call) => call.name !== "automation_start_flow")) return "on_canvas";
  return "incomplete";
}

/** Header label above the suggestion title — reflects live build state. */
export function resolveBuildHeaderLabel(status: BuildCompletionStatus): string {
  switch (status) {
    case "on_canvas":
      return "Draft updated";
    case "error":
      return "Build failed";
    case "incomplete":
      return "Build incomplete";
    case "awaiting_input":
      return "Waiting for your answer";
    case "building":
    default:
      return "Building on canvas";
  }
}

/** User-facing build session card shown instead of the raw suggestion prompt. */
export function SuggestionBuildProgressCard({
  suggestion,
  toolCalls,
  assistantText,
  isLoading,
  hasError,
  onRetry,
  showSummary = true,
}: SuggestionBuildProgressCardProps): React.ReactElement {
  const buildSteps = filterBuildToolCalls(toolCalls);
  const questionReady = toolCalls.some((call) => call.name === "ask_user" && call.status === "done");
  const completionStatus = questionReady
    ? "awaiting_input"
    : resolveBuildCompletionStatus(buildSteps, isLoading, hasError, assistantText);
  const awaitingUserInput = completionStatus === "awaiting_input";
  const statusText = resolveBuildStatusText(
    buildSteps,
    isLoading,
    hasError,
    undefined,
    awaitingUserInput,
    buildSteps.length,
    completionStatus,
  );
  const headerLabel = resolveBuildHeaderLabel(completionStatus);

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white shadow-sm">
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
            {suggestion.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                <Hammer className="h-3 w-3 shrink-0" />
                {headerLabel}
              </p>
              <BuildCompletionBadge status={completionStatus} />
            </div>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{suggestion.title}</p>
            {suggestion.subtitle && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{suggestion.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-violet-100 px-3 py-2.5">
        <p
          className={cn(
            "text-xs font-medium",
            hasError || completionStatus === "incomplete" ? "text-destructive" : "text-violet-800",
          )}
        >
          {statusText}
        </p>

        {buildSteps.length > 0 && (
          <ul className="space-y-1 pt-1">
            {buildSteps.map((call) => (
              <BuildStepRow key={call.id} call={call} />
            ))}
          </ul>
        )}

        {showSummary && assistantText.trim().length > 0 && <BuildAssistantSummary text={assistantText} />}

        {completionStatus === "incomplete" && onRetry && (
          <Button type="button" size="sm" variant="outline" className="mt-1 h-8 gap-1.5" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry build
          </Button>
        )}
      </div>
    </div>
  );
}

function BuildCompletionBadge({ status }: { status: BuildCompletionStatus }): React.ReactElement | null {
  if (status === "awaiting_input") {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
        Needs your input
      </span>
    );
  }

  if (status === "on_canvas") {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
        On canvas
      </span>
    );
  }

  if (status === "incomplete") {
    return (
      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
        No canvas steps
      </span>
    );
  }

  return null;
}

function BuildStepRow({ call }: { call: AssistantToolCall }): React.ReactElement {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs ring-1 ring-violet-100">
      <BuildStepStatusIcon status={call.status} />
      <span className="min-w-0 flex-1 font-medium text-slate-800">{humanizeBuildToolName(call.name)}</span>
      {call.status === "error" && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">Failed</span>
      )}
    </li>
  );
}

function BuildStepStatusIcon({ status }: { status: AssistantToolCall["status"] }): React.ReactElement {
  if (status === "error") return <X className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (status === "done" || status === "approved") return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />;
}

function BuildAssistantSummary({ text }: { text: string }): React.ReactElement {
  const shownText = text.trim();

  if (!shownText) return <div className="hidden" />;

  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={ASSISTANT_MARKDOWN_COMPONENTS}
          urlTransform={ASSISTANT_PROSE_MARKDOWN_GATE.urlTransform}
        >
          {shownText}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function filterBuildToolCalls(toolCalls: readonly AssistantToolCall[]): AssistantToolCall[] {
  return toolCalls.filter((call) => call.isBuilderStep || call.isFlowProposal || call.name in BUILD_TOOL_LABELS);
}

export function humanizeBuildToolName(name: string): string {
  return BUILD_TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

const TOOL_STATUS_PROGRESS: Record<AssistantToolCall["status"], number> = {
  done: 100,
  approved: 100,
  running: 55,
  pending: 45,
  queued: 20,
  discarded: 0,
  error: 0,
};

/** Per-step progress weight used for averaging (0–100). */
export function getToolCallProgressWeight(status: AssistantToolCall["status"]): number {
  return TOOL_STATUS_PROGRESS[status] ?? 0;
}

/** Estimate how many builder tool calls this suggestion likely needs (start + trigger + actions). */
export function estimateExpectedBuildSteps(suggestion: SuggestionBuildMetadata): number {
  const blob = `${suggestion.details} ${suggestion.subtitle ?? ""}`.toLowerCase();
  let count = 1;
  if (/\btrigger\b/.test(blob)) count += 1;
  if (/\baction\b/.test(blob)) count += 1;
  if (/\b(email|notify|slack|alert)\b/.test(blob)) count += 1;
  return Math.max(count, 3);
}

const BUILD_COMPLETE_SIGNALS: readonly RegExp[] = [
  /\bon the canvas\b/i,
  /\bnodes are on\b/i,
  /\bnext steps for you\b/i,
  /\bready to review\b/i,
  /\bautomation is ready\b/i,
  /\bclick .*(?:save|preview|turn it on)\b/i,
  /\bpreview result\b/i,
  /\bflow built\b/i,
];

/** Patterns that mean the build is blocked until the user answers. */
const BLOCKING_USER_INPUT_PATTERNS: readonly RegExp[] = [
  /drop the .+ here/i,
  /need (?:an?|your) .*(?:address|email)/i,
  /do you want (?:it|them|this|me to send)/i,
  /which (?:one|email)/i,
  /reply (?:with|in|below|here)/i,
  /send (?:it|them) to/i,
];

/** True when the assistant paused the build to ask the user for missing info. */
export function detectBuildAwaitingUserInput(assistantText: string): boolean {
  const trimmed = assistantText.trim();
  if (!trimmed) return false;

  const hasCompletionSignal = BUILD_COMPLETE_SIGNALS.some((pattern) => pattern.test(trimmed));
  if (hasCompletionSignal) return false;

  return BLOCKING_USER_INPUT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Average progress across all builder tool calls (partial credit for in-flight steps). */
export function computeBuildProgressPercent(
  buildSteps: readonly AssistantToolCall[],
  isLoading: boolean,
  expectedStepCount = Math.max(buildSteps.length, 3),
  awaitingUserInput = false,
): number {
  if (buildSteps.length === 0) {
    return isLoading ? 5 : 0;
  }

  const totalProgress = buildSteps.reduce((sum, call) => sum + getToolCallProgressWeight(call.status), 0);
  const denominator = Math.max(expectedStepCount, buildSteps.length);
  const averageProgress = totalProgress / denominator;
  const allComplete = buildSteps.every((call) => call.status === "done" || call.status === "approved");
  const hasInFlight = buildSteps.some(
    (call) => call.status === "running" || call.status === "pending" || call.status === "queued",
  );

  if (awaitingUserInput) {
    return Math.min(Math.round(averageProgress), 90);
  }

  if (!isLoading && allComplete) {
    return 100;
  }

  if (isLoading && allComplete && !hasInFlight) {
    return Math.min(Math.round(averageProgress), 95);
  }

  return Math.round(Math.min(averageProgress, isLoading ? 92 : 100));
}

export function resolveBuildStatusText(
  buildSteps: readonly AssistantToolCall[],
  isLoading: boolean,
  hasError: boolean,
  _progressPercent?: number,
  awaitingUserInput = false,
  _expectedStepCount = Math.max(buildSteps.length, 3),
  completionStatus?: BuildCompletionStatus,
): string {
  if (hasError) {
    return "Build hit an error. Check the steps below or try again.";
  }

  if (completionStatus === "incomplete") {
    return "The draft is incomplete. Review the current steps, then retry or describe what is missing.";
  }

  if (awaitingUserInput) {
    return "Waiting for your input to finish the build…";
  }

  const runningStep = [...buildSteps].reverse().find((call) => call.status === "running" || call.status === "pending");
  const completedCount = buildSteps.filter((call) => call.status === "done" || call.status === "approved").length;

  if (isLoading && runningStep) {
    return `${humanizeBuildToolName(runningStep.name)} · ${completedCount} changes completed…`;
  }

  if (isLoading && buildSteps.length > 0) {
    return `Building on canvas · ${completedCount} changes completed…`;
  }

  if (isLoading) {
    return "Starting build on canvas…";
  }

  if (buildSteps.length > 0) {
    return "Added to canvas";
  }

  return isLoading ? "Starting build on canvas…" : "Build incomplete";
}
