import { isExecutionFailure } from "./execution-outcome";
import { isMissingTabConfigurationError } from "@/lib/google-sheets/tab-errors";
import { isSheetsPermissionFailure } from "./sheets-permission-failure";

export const AUTOMATION_FAILURE_LIMIT = 3;
export const AUTO_PAUSED_STATUS = "auto_paused";
export const AUTO_PAUSED_REASON =
  "Automatically paused after 3 consecutive failed runs. Fix the error, then turn the automation back on.";
export const FAILURE_RESET_KEY = "_failureStreakResetAt";

export function failureResetDate(flow: unknown): Date | null {
  const value = flow && typeof flow === "object" ? (flow as Record<string, unknown>)[FAILURE_RESET_KEY] : null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Execution history predates structured failure categories. Only recognise local
 * configuration validation and contextualized Sheets permission messages here; unknown/platform failures must keep
 * their scheduled retry. They still count as failures in history and alerts.
 */
function isConfigurationFailure(execution: { status: string; errorMessage?: string | null }): boolean {
  if (!isExecutionFailure(execution) || !execution.errorMessage) return false;
  if (isMissingTabConfigurationError(execution.errorMessage.trim())) return true;
  if (isSheetsPermissionFailure(execution.errorMessage)) return true;
  return /^(?:Invalid trigger configuration - [^\r\n]+|No [^\r\n]+ trigger found|No spreadsheet ID specified|No column mappings configured for (?:Add|Update) Row action)$/.test(
    execution.errorMessage.trim(),
  );
}

/** Transient/unknown errors and non-failures break the configuration-failure streak. */
export function hasFailureStreak(executions: readonly { status: string; errorMessage?: string | null }[]): boolean {
  return (
    executions.length >= AUTOMATION_FAILURE_LIMIT &&
    executions.slice(0, AUTOMATION_FAILURE_LIMIT).every(isConfigurationFailure)
  );
}
