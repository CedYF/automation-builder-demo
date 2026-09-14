/**
 * Estimated hours a comment automation has saved.
 *
 * Comment rules run in CommentsServer and never write an `AutomationExecution`
 * row, so the home API's saved-hours map — which is built from those rows — has
 * nothing for them. Left alone, the busiest automation on the page ("Thank kind
 * comments", thousands of comments handled) reports a dash while a flow rule
 * that paused four ads reports hours.
 *
 * The service does give a lifetime `processedCount`, which is a count of
 * comments actually actioned. Multiplying it by the same per-comment effort
 * constants the rest of the strip uses gives a comparable figure.
 *
 * Note the difference in period: flow rules report the reporting window, these
 * report lifetime, because per-day history is not available from the service.
 * Callers must caveat it rather than present the two as the same measure.
 */

import { resolveManualEffort } from "@/lib/automation/effort-model";
import { COMMENT_ACTION_EVENTS } from "./comment-flow-mapper";
import type { GroupedCommentAutomation } from "./group-comment-automations";

/** Used when the service reports an action type we have no constant for. */
const FALLBACK_COMMENT_EVENT = COMMENT_ACTION_EVENTS.hide;

function resolveCommentEvent(actionType: string | undefined): string {
  if (!actionType) return FALLBACK_COMMENT_EVENT;
  const known = COMMENT_ACTION_EVENTS[actionType as keyof typeof COMMENT_ACTION_EVENTS];
  return known ?? FALLBACK_COMMENT_EVENT;
}

const SECONDS_PER_HOUR = 3600;

/**
 * Lifetime hours saved by one grouped comment automation.
 *
 * Unrounded, so an automation that has handled a single comment still reports a
 * real figure rather than collapsing to zero and rendering as "no time saved".
 */
export function estimateCommentSavedHours(automation: GroupedCommentAutomation): number {
  const processed = automation.processedCount;
  if (!Number.isFinite(processed) || processed <= 0) return 0;
  return (processed * resolveManualEffort(resolveCommentEvent(automation.actionType)).seconds) / SECONDS_PER_HOUR;
}

/** Saved-hours map keyed by rule id, in the shape `buildAutomationHomeRows` wants. */
export function buildCommentSavedHoursByRuleId(
  automations: readonly GroupedCommentAutomation[],
): Record<number, number> {
  return Object.fromEntries(
    automations
      .map((automation) => [automation.id, estimateCommentSavedHours(automation)] as const)
      .filter(([, hours]) => hours > 0),
  );
}
