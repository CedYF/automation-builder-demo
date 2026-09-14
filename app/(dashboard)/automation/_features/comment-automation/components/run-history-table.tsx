"use client";

/**
 * A comment automation's runs as a dense log: one line per run, grouped under
 * sticky day headers that carry that day's totals.
 *
 * Runs used to render as cards, which showed six entries on a screen for a
 * history that runs to thousands — most of them realtime runs that acted on a
 * single comment. A line per run scans, compares and skims; the detail that
 * used to sit inline (the whole comment, the error, the rest of a batch) moves
 * into the drawer the row opens.
 *
 * A manual Run across several pages arrives as one run per page sharing a run
 * group. Those collapse into a single line that expands to its pages, so one
 * click on Run reads as one entry however many pages it covered.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCount, PageAvatar, pageLabel } from "./run-page-filter";
import { describeSentimentTone } from "../../../lib/sentiment-tone-badge";
import { summarizeRunGroup, type RunListItem } from "../lib/comment-run-groups";
import { commentRunTriggerLabel } from "../lib/comment-run-display";
import {
  bucketForDate,
  GROUP_LABEL,
  GROUP_ORDER,
  type GroupBucket,
} from "@/app/(dashboard)/comments/_features/history/lib/run-status";
import { describeRunBadge } from "../lib/run-badge";
import type { AccountRun, CommentActionType } from "@/app/(dashboard)/comments/lib/api/automation";

/** What a success reads as in a day's summary, per action. */
const SENTIMENT_SCORE_MAX = 100;

const SUCCESS_VERB: Readonly<Record<CommentActionType, string>> = {
  hide: "hidden",
  delete: "deleted",
  like: "liked",
  reply: "sent",
};

interface RunHistoryTableProps {
  readonly items: readonly RunListItem[];
  readonly actionType: CommentActionType;
  /** Pages are named per row only when the automation spans more than one. */
  readonly showPage: boolean;
  /** The run whose drawer is open, so its row reads as selected. */
  readonly selectedRunId: number | null;
  readonly onOpenRun: (run: AccountRun) => void;
  /**
   * Stops a run that is still going. A run keeps going on the server after the
   * builder is closed, so this is the only way to stop one you did not start in
   * this session. Omitted where stopping makes no sense.
   */
  readonly onStopRun?: (run: AccountRun) => void;
  /** Runs whose stop is in flight, so the button cannot be pressed twice. */
  readonly stoppingRunIds?: ReadonlySet<number>;
  /** Injected so tests can pin "Today" without freezing the clock. */
  readonly now?: Date;
}

interface DaySection {
  readonly bucket: GroupBucket;
  readonly label: string;
  readonly items: RunListItem[];
}

function itemPlacedAt(item: RunListItem): string {
  if (item.kind === "run") return item.run.startedAt;
  return item.runs.reduce(
    (newest, run) => (new Date(run.startedAt).getTime() > new Date(newest).getTime() ? run.startedAt : newest),
    item.runs[0].startedAt,
  );
}

function itemRuns(item: RunListItem): readonly AccountRun[] {
  return item.kind === "run" ? [item.run] : item.runs;
}

/** Sections in the order the runs arrived (newest first), never reordered. */
function sectionize(items: readonly RunListItem[], now: Date): DaySection[] {
  const byBucket = new Map<GroupBucket, RunListItem[]>();
  for (const item of items) {
    const bucket = bucketForDate(new Date(itemPlacedAt(item)), now);
    const existing = byBucket.get(bucket);
    if (existing) existing.push(item);
    else byBucket.set(bucket, [item]);
  }
  return GROUP_ORDER.filter((bucket) => byBucket.has(bucket)).map((bucket) => ({
    bucket,
    label: GROUP_LABEL[bucket],
    items: byBucket.get(bucket) as RunListItem[],
  }));
}

/** "312 hidden · 4 failed · 2 unavailable" — what a day actually came to. */
function describeDay(items: readonly RunListItem[], actionType: CommentActionType): string {
  let success = 0;
  let failed = 0;
  let unavailable = 0;
  for (const item of items) {
    for (const run of itemRuns(item)) {
      success += run.successCount;
      failed += run.failedCount;
      unavailable += run.unavailableCount ?? 0;
    }
  }
  const parts = [`${formatCount(success)} ${SUCCESS_VERB[actionType]}`];
  if (failed > 0) parts.push(`${formatCount(failed)} failed`);
  if (unavailable > 0) parts.push(`${formatCount(unavailable)} unavailable`);
  return parts.join(" · ");
}

/**
 * "902 hidden · 218 failed · 116 unavailable of 19,763" — a batch's outcome in
 * one line, whether it is still going or already done.
 */
function describeRunProgress(
  counts: Pick<AccountRun, "successCount" | "failedCount" | "unavailableCount" | "totalProcessed">,
  actionType: CommentActionType,
): string {
  const parts = [`${formatCount(counts.successCount)} ${SUCCESS_VERB[actionType]}`];
  if (counts.failedCount > 0) parts.push(`${formatCount(counts.failedCount)} failed`);
  if ((counts.unavailableCount ?? 0) > 0) parts.push(`${formatCount(counts.unavailableCount ?? 0)} unavailable`);
  return `${parts.join(" · ")} of ${formatCount(counts.totalProcessed)}`;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** The comment a run acted on, or its counts when it kept no snapshot. */
function runSummaryText(run: AccountRun): string {
  if (run.totalProcessed === 0) return "No matching comments";
  const message = run.firstComment?.message?.trim();
  if (!message) {
    return `${formatCount(run.totalProcessed)} comment${run.totalProcessed === 1 ? "" : "s"} processed`;
  }
  const author = run.firstComment?.authorName?.trim();
  const rest = run.totalProcessed - 1;
  const tail = rest > 0 ? `  +${formatCount(rest)} more` : "";
  return `${author ? `${author}: ` : ""}${message}${tail}`;
}

/**
 * Stops still-running work: one run on a row, every running page on a group.
 *
 * A sibling of the row's button rather than a child of it — a button inside a
 * button is invalid, and the nesting made the row's own click fire too.
 */
function StopRunButton({
  label,
  title,
  isStopping,
  onStop,
}: {
  label: string;
  title: string;
  isStopping: boolean;
  onStop: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onStop}
      disabled={isStopping}
      aria-label={label}
      title={title}
      className="h-6 flex-shrink-0 gap-1 px-1.5 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      {isStopping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3 fill-current" />}
      {isStopping ? "Stopping…" : "Stop"}
    </Button>
  );
}

function RunRow({
  run,
  actionType,
  showPage,
  selected,
  indented,
  onOpen,
  onStopRun,
  stoppingRunIds,
}: {
  run: AccountRun;
  actionType: CommentActionType;
  showPage: boolean;
  selected: boolean;
  indented?: boolean;
  onOpen: (run: AccountRun) => void;
  onStopRun?: (run: AccountRun) => void;
  stoppingRunIds?: ReadonlySet<number>;
}) {
  const badge = describeRunBadge(run, actionType);
  const pageName = run.pageId ? pageLabel({ pageId: run.pageId, pageName: run.pageName }) : null;
  // The sentiment that made this comment match, shown as the Comments tab does.
  const tone = describeSentimentTone(run.firstComment?.sentiment);

  return (
    <div
      className={cn(
        "flex w-full items-center border-b border-border/60 pr-3 transition-colors last:border-b-0 hover:bg-muted/50",
        selected && "bg-muted",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(run)}
        aria-label={`Run ${run.id}`}
        className={cn("flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left", indented && "pl-9")}
      >
        <span className="flex w-11 flex-shrink-0 items-center gap-2">
          <span aria-hidden className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", badge.dotClass)} />
          <span className="text-xs tabular-nums text-muted-foreground">{formatClock(run.startedAt)}</span>
        </span>

        {showPage &&
          (pageName ? (
            <span className="flex w-36 flex-shrink-0 items-center gap-1.5" title={pageName}>
              <PageAvatar
                pageId={run.pageId as string}
                name={pageName}
                picture={run.pagePicture}
                className="h-4 w-4 text-[8px]"
              />
              <span className="truncate text-xs text-muted-foreground">{pageName}</span>
            </span>
          ) : (
            <span aria-hidden className="w-36 flex-shrink-0" />
          ))}

        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{runSummaryText(run)}</span>

        {tone && (
          <span
            className={cn("flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", tone.className)}
            aria-label={`Sentiment score: ${run.firstComment?.sentiment} out of ${SENTIMENT_SCORE_MAX}`}
          >
            {tone.label}
          </span>
        )}

        {/* A batch says how far it got right on the row — a running one moves as
            it goes, and a finished one shows what it could not act on. */}
        {run.totalProcessed > 1 ? (
          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {describeRunProgress(run, actionType)}
          </span>
        ) : (
          run.failedCount > 0 &&
          badge.status !== "failed" && (
            <span className="flex-shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400">
              {formatCount(run.failedCount)} failed
            </span>
          )
        )}
        <RunStatusBadge
          status={badge.status}
          label={badge.label}
          className={badge.badgeClass}
          error={run.errorMessage}
        />
      </button>

      {onStopRun && badge.status === "running" && (
        <StopRunButton
          label={`Stop run ${run.id}`}
          title="Stop this run"
          isStopping={stoppingRunIds?.has(run.id) ?? false}
          onStop={() => onStopRun(run)}
        />
      )}
      <ChevronRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </div>
  );
}

/**
 * The run's outcome, and — when it recorded one — the error behind it on hover.
 * `title` carries the same text so it survives touch and copy/paste.
 */
function RunStatusBadge({
  status,
  label,
  className,
  error,
}: {
  status: string;
  label: string;
  className: string;
  error?: string | null;
}) {
  const badge = (
    <Badge variant="outline" className={cn("flex-shrink-0 gap-1 border text-[11px]", className)}>
      {status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </Badge>
  );
  if (!error) return badge;
  return (
    <Tooltip>
      {/* asChild + span: the row itself is a button, so this must not be one. */}
      <TooltipTrigger asChild>
        <span title={error} className="flex-shrink-0">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-sm whitespace-pre-wrap text-xs">
        {error}
      </TooltipContent>
    </Tooltip>
  );
}

/** One click on Run, across every page it covered. */
function RunGroupRow({
  runs,
  actionType,
  showPage,
  selectedRunId,
  onOpenRun,
  onStopRun,
  stoppingRunIds,
}: {
  runs: readonly AccountRun[];
  actionType: CommentActionType;
  showPage: boolean;
  selectedRunId: number | null;
  onOpenRun: (run: AccountRun) => void;
  onStopRun?: (run: AccountRun) => void;
  stoppingRunIds?: ReadonlySet<number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeRunGroup(runs);
  const badge = describeRunBadge(summary, actionType);
  // One click on Run started every page, so one Stop has to reach all of them.
  const runningRuns = runs.filter((run) => run.status === "running");
  const stoppingAll = runningRuns.length > 0 && runningRuns.every((run) => stoppingRunIds?.has(run.id));
  const pageCount = new Set(runs.map((run) => run.pageId).filter(Boolean)).size || runs.length;
  const title = `${commentRunTriggerLabel(summary.triggerType)} across ${pageCount} pages`;

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex w-full items-center pr-3 transition-colors hover:bg-muted/50">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-label={title}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
        >
          <span className="flex w-11 flex-shrink-0 items-center gap-2">
            <span aria-hidden className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", badge.dotClass)} />
            <span className="text-xs tabular-nums text-muted-foreground">{formatClock(summary.startedAt)}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {describeRunProgress(summary, actionType)}
          </span>
          <Badge variant="outline" className={cn("flex-shrink-0 gap-1 border text-[11px]", badge.badgeClass)}>
            {badge.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
            {badge.label}
          </Badge>
        </button>

        {onStopRun && runningRuns.length > 0 && (
          <StopRunButton
            label={`Stop all ${runningRuns.length} running ${runningRuns.length === 1 ? "page" : "pages"}`}
            title="Stop every page still running in this run"
            isStopping={stoppingAll}
            onStop={() => runningRuns.forEach((run) => onStopRun(run))}
          />
        )}
      </div>

      {expanded && (
        <div className="bg-muted/20">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              actionType={actionType}
              showPage={showPage}
              selected={selectedRunId === run.id}
              indented
              onOpen={onOpenRun}
              onStopRun={onStopRun}
              stoppingRunIds={stoppingRunIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RunHistoryTable({
  items,
  actionType,
  showPage,
  selectedRunId,
  onOpenRun,
  onStopRun,
  stoppingRunIds,
  now,
}: RunHistoryTableProps) {
  const sections = sectionize(items, now ?? new Date());

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sections.map((section) => (
          <section key={section.bucket}>
            <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-border bg-muted/60 px-3 py-1.5 backdrop-blur">
              <h3 className="text-xs font-semibold text-foreground">{section.label}</h3>
              <p className="text-xs text-muted-foreground">{describeDay(section.items, actionType)}</p>
            </div>
            {section.items.map((item) =>
              item.kind === "group" ? (
                <RunGroupRow
                  key={`group-${item.runGroupId}`}
                  runs={item.runs}
                  actionType={actionType}
                  showPage={showPage}
                  selectedRunId={selectedRunId}
                  onOpenRun={onOpenRun}
                  onStopRun={onStopRun}
                  stoppingRunIds={stoppingRunIds}
                />
              ) : (
                <RunRow
                  key={item.run.id}
                  run={item.run}
                  actionType={actionType}
                  showPage={showPage}
                  selected={selectedRunId === item.run.id}
                  onOpen={onOpenRun}
                  onStopRun={onStopRun}
                  stoppingRunIds={stoppingRunIds}
                />
              ),
            )}
          </section>
        ))}
      </div>
    </TooltipProvider>
  );
}
