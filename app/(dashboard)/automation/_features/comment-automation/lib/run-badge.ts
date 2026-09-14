/**
 * The badge a run wears in History.
 *
 * `deriveRunStatus` answers with the action's own label — "Hidden", "Deleted" —
 * as soon as a run has a single success, so a batch that hid 1,944 comments and
 * failed 2,335 read as plainly "Hidden". A run that did not do what it set out
 * to do for most of its comments must not look like one that did: mixed runs
 * get their own "Partial" badge, and the row's counts say how it split.
 */

import {
  deriveRunStatus,
  STATUS_VISUAL,
  type RunStatus,
} from "@/app/(dashboard)/comments/_features/history/lib/run-status";
import type { AccountRun, CommentActionType } from "@/app/(dashboard)/comments/lib/api/automation";

/** Statuses that claim the run did its job; only these can turn out partial. */
const SUCCESS_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>(["sent", "hidden", "deleted", "liked"]);

const PARTIAL_BADGE_CLASS =
  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900";
const PARTIAL_DOT_CLASS = "bg-amber-500";

export interface RunBadge {
  /** The derived status, unchanged — callers still key behaviour off it. */
  readonly status: RunStatus;
  readonly label: string;
  readonly badgeClass: string;
  readonly dotClass: string;
  /** True when the run both succeeded and failed (or hit unavailable comments). */
  readonly isPartial: boolean;
}

type RunCounts = Pick<
  AccountRun,
  "status" | "totalProcessed" | "successCount" | "failedCount" | "unavailableCount" | "pendingCount" | "discardedCount"
>;

export function describeRunBadge(run: RunCounts, actionType: CommentActionType): RunBadge {
  const status = deriveRunStatus({ ...run, actionType });
  const visual = STATUS_VISUAL[status];
  const missed = run.failedCount + (run.unavailableCount ?? 0);
  const isPartial = SUCCESS_STATUSES.has(status) && run.successCount > 0 && missed > 0;

  if (!isPartial) {
    return { status, label: visual.label, badgeClass: visual.badgeClass, dotClass: visual.dotClass, isPartial: false };
  }
  return {
    status,
    label: "Partial",
    badgeClass: PARTIAL_BADGE_CLASS,
    dotClass: PARTIAL_DOT_CLASS,
    isPartial: true,
  };
}
