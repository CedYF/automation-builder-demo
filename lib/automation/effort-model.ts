/**
 * Manual-effort model behind the Automate home stats strip.
 *
 * "Runs completed" and "Ads actioned" are counted from real execution records.
 * "Time saved" and "Manual clicks avoided" are NOT tracked anywhere — nothing in
 * AdManage measures how long a human would have taken. They are estimates,
 * derived here from real action counts multiplied by the per-entity constants
 * below, and every surface that renders them must label them as estimates.
 *
 * The constants are keyed by the action `event` names declared in the automation
 * registry (`app/(dashboard)/automation/lib/automation-registry.ts`), which is
 * the same vocabulary persisted into `AutomationExecution.stepResults`. Adding a
 * new action there without adding it here is safe: it falls back to
 * `DEFAULT_MANUAL_EFFORT`.
 */

/** What one entity of a given action would have cost a human doing it by hand. */
export interface ManualEffortPerEntity {
  /** UI interactions (clicks, field edits, confirmations) in Ads Manager. */
  readonly clicks: number;
  /** Wall-clock seconds including navigation and verification. */
  readonly seconds: number;
}

/**
 * What one run of any automation replaces before it changes anything: opening
 * the account, applying the filters, reading the numbers and deciding nothing
 * needs doing. Charged once per execution.
 *
 * Without this, the most valuable automations score zero. A rule that checks
 * spend every hour and finds nothing to pause did the whole job a human would
 * have done, and took no action precisely because it was watching.
 */
export const PER_RUN_MONITORING_EFFORT: ManualEffortPerEntity = Object.freeze({ clicks: 6, seconds: 150 });

/**
 * Reviewing one more entity inside that check — reading a row's spend, ROAS and
 * status and deciding it is fine. Charged per entity a trigger evaluated.
 */
export const PER_ENTITY_REVIEW_EFFORT: ManualEffortPerEntity = Object.freeze({ clicks: 1, seconds: 6 });

/** Applied to any action event with no explicit entry in the model. */
export const DEFAULT_MANUAL_EFFORT: ManualEffortPerEntity = Object.freeze({ clicks: 8, seconds: 75 });

/**
 * Per-entity manual effort by action event name (lowercased at lookup time).
 *
 * Calibrated against the whole round trip each action replaces, not the final
 * click: finding the entity, changing it, confirming, and checking it took. A
 * status flip is a minute once you have navigated to the row, a budget edit adds
 * a confirmation step, a duplicate walks a wizard, and a launch adds creative
 * upload, copy entry and a review pass.
 */
export const AUTOMATION_EFFORT_MODEL: Readonly<Record<string, ManualEffortPerEntity>> = Object.freeze({
  // Launch — creative upload, copy, targeting review, publish.
  "launch ad": { clicks: 45, seconds: 900 },
  "launch ad set": { clicks: 38, seconds: 720 },
  "launch campaign": { clicks: 42, seconds: 780 },
  "launch on google ads": { clicks: 45, seconds: 900 },
  "launch template ads": { clicks: 34, seconds: 660 },
  "create media from templates": { clicks: 24, seconds: 480 },
  "swap creative from shortlist": { clicks: 20, seconds: 300 },
  "push creatives to ad group": { clicks: 22, seconds: 360 },
  "upload to media library": { clicks: 10, seconds: 120 },

  // Duplicate — wizard with naming, budget and schedule review.
  "duplicate ad": { clicks: 24, seconds: 300 },
  "duplicate ad set": { clicks: 30, seconds: 480 },
  "duplicate ad group": { clicks: 30, seconds: 480 },
  "duplicate campaign": { clicks: 36, seconds: 600 },
  "duplicate ad set from sheet row": { clicks: 32, seconds: 540 },

  // Status flips — find the row, toggle, confirm.
  "pause ad": { clicks: 8, seconds: 60 },
  "pause ad set": { clicks: 8, seconds: 60 },
  "pause ad group": { clicks: 8, seconds: 60 },
  "pause campaign": { clicks: 8, seconds: 60 },
  "pause creative set": { clicks: 8, seconds: 60 },
  "enable ad": { clicks: 8, seconds: 60 },
  "enable ad set": { clicks: 8, seconds: 60 },
  "enable ad group": { clicks: 8, seconds: 60 },
  "enable campaign": { clicks: 8, seconds: 60 },
  "enable creative set": { clicks: 8, seconds: 60 },

  // Budget and bidding — edit plus confirmation dialog.
  "change budget": { clicks: 10, seconds: 90 },
  "set minimum spend": { clicks: 10, seconds: 90 },
  "update target cpa/roas": { clicks: 11, seconds: 110 },
  "update value rules": { clicks: 14, seconds: 180 },

  // Rules.
  "create rule": { clicks: 26, seconds: 480 },
  "update rule": { clicks: 14, seconds: 180 },
  "toggle rule": { clicks: 4, seconds: 40 },
  "apply existing rule": { clicks: 9, seconds: 90 },

  // Comments — moderation in the post view.
  "hide comment": { clicks: 5, seconds: 45 },
  "delete comment": { clicks: 6, seconds: 50 },
  "like comment": { clicks: 3, seconds: 25 },
  "reply to comment": { clicks: 9, seconds: 150 },

  // Reporting and hand-offs.
  "generate report link": { clicks: 18, seconds: 420 },
  "send notification": { clicks: 7, seconds: 120 },
  "send webhook": { clicks: 6, seconds: 90 },
  "create item": { clicks: 11, seconds: 180 },
  "update item": { clicks: 9, seconds: 120 },
});

/**
 * Output keys the execute route writes when a step touches many entities at once.
 * Ordered by specificity — the first present positive integer wins.
 */
const ENTITY_COUNT_OUTPUT_KEYS: readonly string[] = [
  "totalAds",
  "adCount",
  "pausedCount",
  "matchedCount",
  "processedCount",
  "successCount",
];

/** Aggregated manual effort avoided, plus the real counts it was derived from. */
export interface AutomationEffortTotals {
  /**
   * Real: entities an automation acted on — ads, ad sets, campaigns, budgets,
   * comments. Deliberately not ad-specific: comment automations action comments,
   * and counting only ads reported the busiest of them as doing nothing.
   */
  readonly actionsTaken: number;
  /** Estimated: manual UI interactions avoided. */
  readonly manualClicksAvoided: number;
  /** Estimated: seconds of manual work avoided. */
  readonly secondsSaved: number;
}

export const EMPTY_AUTOMATION_EFFORT: AutomationEffortTotals = Object.freeze({
  actionsTaken: 0,
  manualClicksAvoided: 0,
  secondsSaved: 0,
});

/** Returns the model entry for an action event, falling back to the default. */
export function resolveManualEffort(event: string | null | undefined): ManualEffortPerEntity {
  if (typeof event !== "string") return DEFAULT_MANUAL_EFFORT;
  return AUTOMATION_EFFORT_MODEL[event.trim().toLowerCase()] ?? DEFAULT_MANUAL_EFFORT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInteger(source: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return null;
}

function countResourcesOfType(step: Record<string, unknown>, type: string | null): number {
  const resources = step.resources;
  if (!Array.isArray(resources)) return 0;
  if (type === null) return resources.length;
  return resources.filter((resource) => isRecord(resource) && resource.type === type).length;
}

/**
 * How many entities a single action step touched.
 *
 * Batch steps report a count in their outputs; single-entity steps only link the
 * resource they produced. A step that reports neither still did one unit of work.
 */
export function countStepEntities(step: unknown): number {
  if (!isRecord(step)) return 0;
  const outputs = isRecord(step.outputs) ? step.outputs : {};
  const fromOutputs = readPositiveInteger(outputs, ENTITY_COUNT_OUTPUT_KEYS);
  if (fromOutputs !== null) return fromOutputs;
  const resourceCount = countResourcesOfType(step, null);
  return resourceCount > 0 ? resourceCount : 1;
}

function isStepSuccessful(step: Record<string, unknown>): boolean {
  if (step.success === false) return false;
  return step.status !== "failed";
}

/** A check that ran: the monitoring an automation does before it acts. */
function isSuccessfulTriggerStep(step: unknown): step is Record<string, unknown> {
  if (!isRecord(step)) return false;
  if (step.stepType !== "trigger") return false;
  return isStepSuccessful(step);
}

function isSuccessfulActionStep(step: unknown): step is Record<string, unknown> {
  if (!isRecord(step)) return false;
  if (step.stepType !== "action") return false;
  return isStepSuccessful(step);
}

/**
 * Totals the effort avoided by one execution, from its persisted `stepResults`.
 *
 * Three parts, because an automation replaces more than its final action:
 *  1. One monitoring charge per run — the check itself.
 *  2. Per-entity review for whatever the trigger evaluated.
 *  3. The modelled cost of every action it actually took.
 *
 * Failed steps are skipped: they saved nobody anything.
 */
export function summariseExecutionEffort(stepResults: unknown): AutomationEffortTotals {
  if (!Array.isArray(stepResults) || stepResults.length === 0) return EMPTY_AUTOMATION_EFFORT;

  let actionsTaken = 0;
  // Every run replaces one manual check, whether or not it changed anything.
  let manualClicksAvoided = PER_RUN_MONITORING_EFFORT.clicks;
  let secondsSaved = PER_RUN_MONITORING_EFFORT.seconds;

  for (const step of stepResults) {
    if (isSuccessfulTriggerStep(step)) {
      // Reviewing the entities this check looked at, one by one.
      const reviewed = countStepEntities(step);
      manualClicksAvoided += reviewed * PER_ENTITY_REVIEW_EFFORT.clicks;
      secondsSaved += reviewed * PER_ENTITY_REVIEW_EFFORT.seconds;
      continue;
    }

    if (!isSuccessfulActionStep(step)) continue;
    const entities = countStepEntities(step);
    const effort = resolveManualEffort(typeof step.event === "string" ? step.event : null);
    actionsTaken += entities;
    manualClicksAvoided += entities * effort.clicks;
    secondsSaved += entities * effort.seconds;
  }

  return { actionsTaken, manualClicksAvoided, secondsSaved };
}

/** Adds up per-execution totals into one figure for the stats strip. */
export function sumAutomationEffort(totals: readonly AutomationEffortTotals[]): AutomationEffortTotals {
  return totals.reduce<AutomationEffortTotals>(
    (accumulator, current) => ({
      actionsTaken: accumulator.actionsTaken + current.actionsTaken,
      manualClicksAvoided: accumulator.manualClicksAvoided + current.manualClicksAvoided,
      secondsSaved: accumulator.secondsSaved + current.secondsSaved,
    }),
    EMPTY_AUTOMATION_EFFORT,
  );
}

/** Rounds seconds to the one-decimal hour figure the stats strip renders. */
export function toSavedHours(secondsSaved: number): number {
  if (!Number.isFinite(secondsSaved) || secondsSaved <= 0) return 0;
  return Math.round((secondsSaved / 3600) * 10) / 10;
}

/**
 * Percentage change between two periods, for the strip's trend pill.
 *
 * Returns null when the previous period has no baseline to compare against, so
 * callers render nothing rather than a meaningless "+100%".
 */
export function calculateTrendPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
