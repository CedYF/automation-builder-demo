/**
 * Display helpers for CommentsServer automation runs shown inside the
 * /automation builder (Run progress panel and History sheet).
 */

import type { AutomationRun } from "@/app/(dashboard)/comments/lib/api/automation";

export type CommentRunCounts = Pick<
  AutomationRun,
  "totalProcessed" | "successCount" | "failedCount" | "unavailableCount"
>;

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

/**
 * e.g. "3 comments processed (3 succeeded, 0 failed)".
 *
 * `totalProcessed` is the number of comments the run matched, fixed when it
 * starts; the success/failed counters tick as it works through them. Until
 * they add up the run is still going (or was stopped), so the text says how
 * far it got — "290 of 19,763" — instead of claiming all 19,763 were done.
 * Comments Meta would not show the action (deleted, or access lost) are
 * listed as "unavailable" when there are any.
 */
export function describeCommentRunCounts(run: CommentRunCounts): string {
  if (run.totalProcessed === 0) return "no matching comments to process";
  const noun = run.totalProcessed === 1 ? "comment" : "comments";
  const unavailable = run.unavailableCount ?? 0;
  const parts = [`${formatCount(run.successCount)} succeeded`, `${formatCount(run.failedCount)} failed`];
  if (unavailable > 0) parts.push(`${formatCount(unavailable)} unavailable`);
  const outcome = `(${parts.join(", ")})`;
  const done = run.successCount + run.failedCount + unavailable;
  if (done < run.totalProcessed) {
    return `${formatCount(done)} of ${formatCount(run.totalProcessed)} ${noun} processed ${outcome}`;
  }
  return `${formatCount(run.totalProcessed)} ${noun} processed ${outcome}`;
}

const TRIGGER_TYPE_LABELS: Readonly<Record<string, string>> = {
  manual: "Manual run",
  scheduled: "Scheduled scan",
  realtime: "Realtime",
};

/** Human label for a run's trigger type; falls back to the raw value. */
export function commentRunTriggerLabel(triggerType: string): string {
  return TRIGGER_TYPE_LABELS[triggerType] ?? triggerType;
}
