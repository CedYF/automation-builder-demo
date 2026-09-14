/**
 * Maps comment-automation rules into the home list's rule shape.
 *
 * Comment rules live behind the comments service rather than our own tables, so
 * the home API cannot include them. They are fetched alongside and mapped here,
 * then run through the same `buildAutomationHomeRows` helper as flow rules so
 * both sources resolve state, ordering and labels identically.
 */

import type { HomeRuleInput } from "@/lib/automation/build-home-rows";
import { formatAutomationCadence } from "@/lib/automation/format-cadence";
import { COMMENT_AUTOMATION_SERVICE, COMMENT_AUTOMATION_SOURCE } from "./map-comment-automation-to-table-row";
import { formatPageCount, type GroupedCommentAutomation } from "./group-comment-automations";
import { DEFAULT_COMMENT_SCHEDULE_FREQUENCY } from "./comment-flow-mapper";

/**
 * Normalises the comments service's statuses onto the ones `rule-status` knows.
 *
 * "executing" is that service's word for an active rule mid-run; left as-is it
 * would fall through to the "off" default and render a live rule as switched off.
 */
function normalizeCommentStatus(status: string): string {
  return status === "executing" ? "active" : status;
}

function resolveCommentHomeCadence(rule: GroupedCommentAutomation): {
  readonly frequency: string;
  readonly scheduledTime: string | null;
} {
  const triggerType = rule.triggerType ?? "realtime";
  if (triggerType === "scheduled") {
    return {
      frequency: rule.frequency ?? DEFAULT_COMMENT_SCHEDULE_FREQUENCY,
      scheduledTime: rule.scheduledTime ?? null,
    };
  }
  if (triggerType === "manual") {
    return { frequency: "manual", scheduledTime: null };
  }
  return { frequency: "realtime", scheduledTime: null };
}

export function mapCommentAutomationToHomeRule(rule: GroupedCommentAutomation): HomeRuleInput {
  const { frequency, scheduledTime } = resolveCommentHomeCadence(rule);

  return {
    id: rule.id,
    source: COMMENT_AUTOMATION_SOURCE,
    // Every page of the automation is toggled and deleted through this id.
    groupId: rule.groupId,
    name: rule.name,
    status: normalizeCommentStatus(rule.status),
    accountId: rule.adAccountId ?? null,
    accountName: rule.accountName ?? null,
    runCount: rule.processedCount ?? 0,
    // Comment rules are not subject to the Meta ad-publish rate limit that locks
    // flow rules, so their toggle is never held shut by one.
    rateLimited: false,
    cadenceLabel: formatAutomationCadence({
      frequency,
      checkFrequency: null,
      scheduledTime,
      checkTime: null,
      dayOfWeek: null,
      checkDays: null,
      dayOfMonth: null,
      checkDayOfMonth: null,
      triggerService: null,
    }),
    // Realtime and scheduled comment rules are fired by the comments service;
    // a manual rule only moves when someone presses Run.
    runsUnattended: frequency !== "manual",
    // CommentsServer keeps one rule per page, so say how many this row covers.
    detailLabel: formatPageCount(rule.pageCount),
    // Trigger plus one moderation action: enough to size a progress bar, though
    // comment rules never report an in-flight execution to this surface.
    flowStepCount: 2,
    // Comment rules are always a comments trigger plus a comments action, so the
    // icon chips read the same as they do in the full automations table.
    stepServices: [COMMENT_AUTOMATION_SERVICE, COMMENT_AUTOMATION_SERVICE],
    // Comment rules run on pages, so the account column shows those instead of
    // the bare `act_...` id behind them.
    pageIds: rule.pageIds,
    // CommentsServer does not report an owner on the list endpoint.
    ownerEmail: null,
    lastRunAt: rule.lastRunAt,
    updatedAt: rule.updatedAt ?? null,
  };
}
