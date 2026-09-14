/**
 * Terminal outcomes of an automation execution.
 *
 * A reviewer rejecting an approval is a deliberate decision, not a fault, so it
 * gets its own terminal status instead of riding on "failed". Anything that
 * counts, charts, or badges failures must classify through here rather than
 * comparing `status` to "failed" directly.
 *
 * Executions written before the status existed are still stored as "failed"
 * with a `Rejected by <email>` message, so the classifier recognises that shape
 * too and the dashboards read correctly without a data backfill.
 */

/** Execution finished successfully. */
export const EXECUTION_STATUS_COMPLETED = "completed";
/** Execution finished with a fault worth investigating. */
export const EXECUTION_STATUS_FAILED = "failed";
/** Execution stopped because a reviewer rejected its approval step. */
export const EXECUTION_STATUS_REJECTED = "rejected";

/** Terminal statuses. A rejected run is finished, so it is a real last run. */
export const FINISHED_EXECUTION_STATUSES = [
  EXECUTION_STATUS_COMPLETED,
  EXECUTION_STATUS_FAILED,
  EXECUTION_STATUS_REJECTED,
] as const;

/**
 * Shape the approval route writes into `errorMessage` on rejection:
 * `Rejected by <reviewer email>` with an optional `: <comment>` suffix.
 *
 * Deliberately anchored on an email address. Platform review failures use the
 * same verb ("Rejected by AppLovin/Axon content review") and must keep counting
 * as failures.
 */
const LEGACY_REJECTION_MESSAGE = /^Rejected by \S+@\S+\.\S+(:|$)/;

/** The subset of an execution record needed to classify its outcome. */
export interface ExecutionOutcomeInput {
  readonly status: string | null | undefined;
  readonly errorMessage?: string | null;
}

/** True when the run stopped because a reviewer rejected its approval step. */
export function isApprovalRejection(execution: ExecutionOutcomeInput): boolean {
  if (execution.status === EXECUTION_STATUS_REJECTED) return true;
  if (execution.status !== EXECUTION_STATUS_FAILED) return false;
  return typeof execution.errorMessage === "string" && LEGACY_REJECTION_MESSAGE.test(execution.errorMessage);
}

/**
 * The status a surface should display and count on, with legacy rejections
 * normalised off "failed".
 */
export function resolveExecutionStatus(execution: ExecutionOutcomeInput): string {
  if (isApprovalRejection(execution)) return EXECUTION_STATUS_REJECTED;
  return execution.status ?? "";
}

/** True only for genuine faults, so rejected approvals never inflate failure counts. */
export function isExecutionFailure(execution: ExecutionOutcomeInput): boolean {
  return execution.status === EXECUTION_STATUS_FAILED && !isApprovalRejection(execution);
}

/** Outcome counts for a set of executions, with rejections held apart. */
export interface ExecutionOutcomeCounts {
  /** Every execution in the set, whatever its status. */
  readonly total: number;
  readonly completed: number;
  /** Genuine faults only. */
  readonly failed: number;
  /** Approvals a reviewer declined. */
  readonly rejected: number;
  /** Executions the success rate is measured over: `total` minus `rejected`. */
  readonly rated: number;
  /** Percentage of rated executions that completed. */
  readonly successRate: number;
}

/**
 * Counts outcomes across a set of executions.
 *
 * Rejections are reported on their own and leave the success-rate denominator:
 * a reviewer declining is a decision about the run, not a result the rule can
 * be scored on, so it should neither count as a failure nor drag the rate down.
 *
 * @param executions Execution records carrying at least `status` and `errorMessage`.
 * @param decimalPlaces Precision for `successRate`.
 */
export function countExecutionOutcomes(
  executions: readonly ExecutionOutcomeInput[],
  decimalPlaces = 0,
): ExecutionOutcomeCounts {
  let completed = 0;
  let failed = 0;
  let rejected = 0;

  for (const execution of executions) {
    if (isApprovalRejection(execution)) rejected += 1;
    else if (execution.status === EXECUTION_STATUS_COMPLETED) completed += 1;
    else if (execution.status === EXECUTION_STATUS_FAILED) failed += 1;
  }

  const total = executions.length;
  const rated = total - rejected;
  const factor = 10 ** decimalPlaces;

  return {
    total,
    completed,
    failed,
    rejected,
    rated,
    successRate: rated > 0 ? Math.round((completed / rated) * 100 * factor) / factor : 0,
  };
}
