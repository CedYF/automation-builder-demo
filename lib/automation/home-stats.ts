/**
 * Aggregates the four tiles on the Automate home stats strip.
 *
 * Two of them are counted, two are estimated:
 *  - Runs completed and Ads actioned come from real execution records.
 *  - Time saved and Manual clicks avoided are derived from the documented
 *    constants in `effort-model.ts` and must be rendered as estimates.
 *
 * Pure and clock-injected, so the month boundaries and the trend comparison are
 * testable without touching a database or the wall clock.
 */

import {
  calculateTrendPercent,
  summariseExecutionEffort,
  sumAutomationEffort,
  toSavedHours,
  type AutomationEffortTotals,
} from "./effort-model";

const SECONDS_PER_HOUR = 3600;

/** Execution status that counts as a completed run. */
const COMPLETED_STATUS = "completed";

/** One execution as the home route reads it. */
export interface HomeStatsExecutionInput {
  readonly automationRuleId: number | null;
  readonly executedAt: string;
  readonly status: string;
  readonly stepResults: unknown;
}

export interface AutomationHomeStats {
  /** Window the tiles cover, e.g. "last 30 days". */
  readonly periodLabel: string;
  /** Estimated. Hours of manual work avoided in the window. */
  readonly savedHours: number;
  /** Estimated. Change against the preceding window, or null with no baseline. */
  readonly savedHoursTrendPercent: number | null;
  /** Counted. Executions that finished successfully in the window. */
  readonly runsCompleted: number;
  /** Counted. Entities acted on in the window: ads, budgets, comments, all of it. */
  readonly actionsTaken: number;
  /** Estimated. Ads Manager interactions avoided in the window. */
  readonly manualClicksAvoided: number;
  /** True when the execution sample hit its cap and the estimates undercount. */
  readonly sampleTruncated: boolean;
}

export interface AutomationHomeStatsResult {
  readonly stats: AutomationHomeStats;
  /** Estimated hours saved in the window, per automation rule id. */
  readonly savedHoursByRuleId: Readonly<Record<number, number>>;
}

/** Days the stats strip reports on, and compares against the days before. */
export const STATS_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The reporting window and the equal-length window before it. */
export interface StatsWindow {
  readonly currentStart: Date;
  readonly previousStart: Date;
  readonly label: string;
}

/**
 * Boundaries the stats strip reports against.
 *
 * A rolling 30 days rather than the calendar month: on the 2nd of a month a
 * month-to-date figure collapses to almost nothing and the trend against a full
 * previous month is meaningless. Rolling keeps both halves the same length, so
 * the comparison is always like for like, and the label says exactly what the
 * numbers cover.
 */
export function getStatsWindow(now: Date): StatsWindow {
  return {
    currentStart: new Date(now.getTime() - STATS_WINDOW_DAYS * DAY_MS),
    previousStart: new Date(now.getTime() - 2 * STATS_WINDOW_DAYS * DAY_MS),
    label: `Last ${STATS_WINDOW_DAYS} days`,
  };
}

function isInCurrentWindow(execution: HomeStatsExecutionInput, window: StatsWindow): boolean {
  const executedAt = Date.parse(execution.executedAt);
  return !Number.isNaN(executedAt) && executedAt >= window.currentStart.getTime();
}

function isInPreviousWindow(execution: HomeStatsExecutionInput, window: StatsWindow): boolean {
  const executedAt = Date.parse(execution.executedAt);
  if (Number.isNaN(executedAt)) return false;
  return executedAt >= window.previousStart.getTime() && executedAt < window.currentStart.getTime();
}

function accumulateSavedHours(
  target: Record<number, number>,
  ruleId: number | null,
  effort: AutomationEffortTotals,
): void {
  if (ruleId === null) return;
  target[ruleId] = (target[ruleId] ?? 0) + effort.secondsSaved;
}

/**
 * Builds the stats strip and the per-rule saved-hours map from one execution
 * sample spanning the current and preceding windows.
 *
 * @param executions Finished executions ordered newest first, already capped.
 * @param now Clock used for the window boundaries.
 * @param sampleTruncated Whether the caller's query hit its row cap.
 */
export function buildAutomationHomeStats(
  executions: readonly HomeStatsExecutionInput[],
  now: Date,
  sampleTruncated: boolean,
): AutomationHomeStatsResult {
  const window = getStatsWindow(now);
  const currentEffort: AutomationEffortTotals[] = [];
  const previousEffort: AutomationEffortTotals[] = [];
  const savedSecondsByRuleId: Record<number, number> = {};
  let runsCompleted = 0;

  for (const execution of executions) {
    const isCurrent = isInCurrentWindow(execution, window);
    if (!isCurrent && !isInPreviousWindow(execution, window)) continue;

    const effort = summariseExecutionEffort(execution.stepResults);
    if (!isCurrent) {
      previousEffort.push(effort);
      continue;
    }

    currentEffort.push(effort);
    accumulateSavedHours(savedSecondsByRuleId, execution.automationRuleId, effort);
    if (execution.status === COMPLETED_STATUS) runsCompleted += 1;
  }

  const current = sumAutomationEffort(currentEffort);
  const previous = sumAutomationEffort(previousEffort);

  return {
    stats: {
      periodLabel: window.label,
      savedHours: toSavedHours(current.secondsSaved),
      savedHoursTrendPercent: calculateTrendPercent(current.secondsSaved, previous.secondsSaved),
      runsCompleted,
      actionsTaken: current.actionsTaken,
      manualClicksAvoided: current.manualClicksAvoided,
      sampleTruncated,
    },
    // Unrounded: a rule that saved 45 seconds is not a rule that saved nothing,
    // and rounding to a tenth of an hour here would erase it before display.
    savedHoursByRuleId: Object.fromEntries(
      Object.entries(savedSecondsByRuleId).map(([ruleId, seconds]) => [Number(ruleId), seconds / SECONDS_PER_HOUR]),
    ),
  };
}
