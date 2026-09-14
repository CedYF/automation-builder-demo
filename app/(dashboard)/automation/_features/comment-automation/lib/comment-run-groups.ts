/**
 * One builder "Run" on a multi-page comment automation starts one run per
 * page (an automation is stored as one rule per page), and CommentsServer
 * stamps them with a shared `runGroupId`. History shows those as a single
 * entry. Realtime runs, runs from before the id existed, and a group with
 * only one run loaded (a page filter is on, or the rest sit past "Load
 * more") stay plain rows.
 */

import type { AccountRun } from "@/app/(dashboard)/comments/lib/api/automation";

export type RunListItem =
  | { readonly kind: "run"; readonly run: AccountRun }
  | { readonly kind: "group"; readonly runGroupId: string; readonly runs: readonly AccountRun[] };

/** The loaded runs as History lists them, each group placed where its newest run sits. */
export function groupRunsForDisplay(runs: readonly AccountRun[]): RunListItem[] {
  const sizeByGroup = new Map<string, number>();
  for (const run of runs) {
    if (run.runGroupId) sizeByGroup.set(run.runGroupId, (sizeByGroup.get(run.runGroupId) ?? 0) + 1);
  }

  const items: RunListItem[] = [];
  const membersByGroup = new Map<string, AccountRun[]>();
  for (const run of runs) {
    const groupId = run.runGroupId;
    if (!groupId || (sizeByGroup.get(groupId) ?? 0) < 2) {
      items.push({ kind: "run", run });
      continue;
    }
    const members = membersByGroup.get(groupId);
    if (members) {
      members.push(run);
      continue;
    }
    const firstMembers = [run];
    membersByGroup.set(groupId, firstMembers);
    items.push({ kind: "group", runGroupId: groupId, runs: firstMembers });
  }
  return items;
}

export type RunGroupSummary = Pick<
  AccountRun,
  | "status"
  | "totalProcessed"
  | "successCount"
  | "failedCount"
  | "unavailableCount"
  | "pendingCount"
  | "discardedCount"
  | "startedAt"
  | "triggerType"
>;

function sumOf(runs: readonly AccountRun[], pick: (run: AccountRun) => number | undefined): number {
  return runs.reduce((total, run) => total + (pick(run) ?? 0), 0);
}

/**
 * A group's combined progress: every count adds up across its pages. It is
 * running while any page is; once all have stopped it reports the worst
 * ending (failed, then interrupted or cancelled, else completed).
 */
export function summarizeRunGroup(runs: readonly AccountRun[]): RunGroupSummary {
  const status = runs.some((run) => run.status === "running")
    ? "running"
    : runs.some((run) => run.status === "failed")
      ? "failed"
      : (runs.find((run) => run.status === "interrupted" || run.status === "cancelled")?.status ?? "completed");
  const startedAt = runs.reduce(
    (earliest, run) => (new Date(run.startedAt).getTime() < new Date(earliest).getTime() ? run.startedAt : earliest),
    runs[0].startedAt,
  );
  return {
    status,
    triggerType: runs[0].triggerType,
    startedAt,
    totalProcessed: sumOf(runs, (run) => run.totalProcessed),
    successCount: sumOf(runs, (run) => run.successCount),
    failedCount: sumOf(runs, (run) => run.failedCount),
    unavailableCount: sumOf(runs, (run) => run.unavailableCount),
    pendingCount: sumOf(runs, (run) => run.pendingCount),
    discardedCount: sumOf(runs, (run) => run.discardedCount),
  };
}
