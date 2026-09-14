/**
 * Rebuilds the Execution Results panel's log entries for a comment
 * automation's most recent run.
 *
 * Comment automations run on CommentsServer, not the Prisma automation
 * executor, so their evidence (outcome, processed comments) only ever reached
 * the panel via the live `onLog` callback fired while `runCommentAutomationFlow`
 * polled the run. Close the tab, refresh, or reopen the automation later and
 * that in-memory trail is gone even though CommentsServer still has it — the
 * panel would show "hasn't run yet" for a rule that has, in fact, run and
 * matched comments. This turns a fetched run + its comments back into the same
 * shape of log entries so reopening the panel looks the same as watching the
 * run live did.
 */

import type { AutomationRun, ProcessedComment } from "@/app/(dashboard)/comments/lib/api/automation";
import { mapTerminalRun } from "../../../lib/run-comment-automation";
import type { ExecutionLog } from "../../../contexts/automation-context";

export interface RehydrateCommentRunOptions {
  readonly triggerNodeId: string;
  readonly actionNodeId: string;
  readonly run: AutomationRun;
  readonly comments: readonly ProcessedComment[];
}

/**
 * `undefined` when the fetched run is still "running" — there is no active
 * poll loop behind a rehydrated panel, so a "running" log would leave the
 * spinner and Cancel button showing forever instead of reflecting a live run.
 * The rule's next completed run is what gets shown instead.
 */
export function buildRehydratedCommentRunLogs(options: RehydrateCommentRunOptions): ExecutionLog[] | undefined {
  const { triggerNodeId, actionNodeId, run, comments } = options;
  if (run.status === "running") return undefined;

  const terminal = mapTerminalRun(run);
  const startedAt = new Date(run.startedAt);
  const finishedAt = run.completedAt ? new Date(run.completedAt) : startedAt;

  return [
    {
      id: `log-rehydrate-${run.id}-trigger`,
      nodeId: triggerNodeId,
      status: "success",
      message: "Loaded from the automation's last run.",
      timestamp: startedAt,
    },
    {
      id: `log-rehydrate-${run.id}-action`,
      nodeId: actionNodeId,
      status: terminal.status,
      message: terminal.message,
      timestamp: finishedAt,
      data: { comments },
    },
  ];
}
