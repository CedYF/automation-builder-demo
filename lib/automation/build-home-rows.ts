import { AUTO_PAUSED_STATUS, AUTO_PAUSED_REASON } from "./failure-streak";
/**
 * Assembles the Automate home list rows from the four things that decide an
 * automation's live state: the rule itself, any in-flight execution, any
 * approval waiting on the user, and any delayed execution due to resume.
 *
 * Pure and clock-injected so the API route stays a thin I/O boundary and the
 * ordering, labels and state resolution can be tested without a database.
 */

import { mapRuleStatusToUiStatus, isRuleToggleDisabled } from "./rule-status";
import { pickHumanAccountName } from "./automation-table-account-display";
import { isExecutionFailure } from "./execution-outcome";
import {
  buildAutomationDisplayId,
  buildOwnerInitials,
  buildRowSubtitle,
  calculateRunProgressPercent,
  formatRunCount,
  resolveAutomationHomeState,
  sortAutomationHomeRows,
  type AutomationHomeRow,
  type AutomationRightNow,
} from "./home-summary";

const RATE_LIMIT_LOCK_REASON =
  "Paused after hitting Meta's rate limit. It unlocks automatically within 24h — contact Admanage to re-enable sooner.";
const ARCHIVED_LOCK_REASON = "Archived automations are turned on again from the Archive menu.";
const NO_PERMISSION_LOCK_REASON = "Your role cannot turn automations on or off.";

/** A rule as the home route reads it, flattened out of Prisma and the flow JSON. */
export interface HomeRuleInput {
  readonly id: number;
  readonly source: "flow" | "comment";
  /**
   * Comment automations only: the id shared by their per-page rules. Actions on
   * the row address every page through it, instead of only the member whose id
   * the row happens to carry.
   */
  readonly groupId?: string | null;
  readonly name: string;
  /** Persisted DB status: active, paused, draft, archived, or a transient value. */
  readonly status: string;
  /** Raw ad-account id, used to resolve a human name on the client. */
  readonly accountId?: string | null;
  readonly accountName: string | null;
  readonly runCount: number;
  readonly rateLimited: boolean;
  /** Human cadence for the sub-line, e.g. "Every hour". */
  readonly cadenceLabel: string | null;
  /**
   * Whether a cron, sweep or event trigger will run this without the Run button.
   * Decides "Active" versus "Manual" in the State column.
   */
  readonly runsUnattended: boolean;
  /** Extra sub-line segment, e.g. "31 pages" for a grouped comment automation. */
  readonly detailLabel?: string | null;
  /** Steps in the flow, used to size the running-progress bar. */
  readonly flowStepCount: number;
  readonly lastRunAt: string | null;
  /** Latest terminal execution; absent for comment rules and rules with no runs. */
  readonly latestExecution?: {
    readonly id: number;
    readonly status: string;
    readonly errorMessage: string | null;
  } | null;
  readonly updatedAt: string | null;
  /**
   * Concrete next run for scheduled rules, resolved by the caller (which owns
   * the clock). Absent for comment automations and polling rules.
   */
  readonly nextRunLabel?: string | null;
  /** Set when the queued date disagrees with the cadence, or has passed. */
  readonly nextRunWarning?: string | null;
  /** Service ids of the configured steps, in flow order, for the icon chips. */
  readonly stepServices: readonly string[];
  /** Pages this automation runs on. Empty for rules that run on an ad account. */
  readonly pageIds?: readonly string[];
  /** Email of the user who owns the rule, for the avatar column. */
  readonly ownerEmail: string | null;
}

/** An execution currently mid-flight for a rule. */
export interface HomeRunningExecutionInput {
  readonly automationRuleId: number;
  readonly startedAt: string;
  /** Steps already recorded in `stepResults`. */
  readonly completedSteps: number;
  /** Entities touched so far, when the steps reported a count. */
  readonly entitiesTouched: number;
}

/** A flow approval blocking a rule until the user answers it inline. */
export interface HomeFlowApprovalInput {
  readonly kind: "flow";
  readonly automationRuleId: number;
  readonly approvalId: number;
  readonly approvalToken: string;
  readonly pendingActionCount: number;
  readonly createdAt: string;
  /**
   * When the approval stopped being answerable. An expired approval is still
   * listed — silently dropping it left users wondering where the request went —
   * but it is shown as a dead note rather than live Approve/Review buttons,
   * because neither call can succeed once it has expired.
   */
  readonly expiresAt?: string | null;
}

/**
 * Drafted comment replies waiting on a human.
 *
 * No approval token: these live in CommentsServer and are answered in the
 * drafted-replies review sheet, never through `/api/automation/approval`
 * (ADM-11260).
 */
export interface HomeCommentReviewInput {
  readonly kind: "comment-review";
  readonly automationRuleId: number;
  readonly pendingCount: number;
  /** Oldest waiting draft, ISO — also what the row sorts on. */
  readonly createdAt: string;
  /** Pages with a draft waiting. */
  readonly pageIds: readonly string[];
}

/**
 * Something blocking a rule until the user answers it.
 *
 * A union rather than a second builder input so `indexByRuleId`,
 * `resolveAutomationHomeState` and `pickLastActivity` keep working unchanged —
 * which is why both variants name their timestamp `createdAt`.
 */
export type HomeApprovalInput = HomeFlowApprovalInput | HomeCommentReviewInput;

/** A paused-mid-flow execution waiting for its delay to elapse. */
export interface HomeDelayInput {
  readonly automationRuleId: number;
  readonly resumeAt: string;
}

export interface BuildAutomationHomeRowsInput {
  readonly rules: readonly HomeRuleInput[];
  readonly runningExecutions: readonly HomeRunningExecutionInput[];
  readonly approvals: readonly HomeApprovalInput[];
  readonly delays: readonly HomeDelayInput[];
  /** Estimated hours saved per rule id, from the effort model. */
  readonly savedHoursByRuleId: Readonly<Record<number, number>>;
  /** False for roles that may view but not manage automations. */
  readonly canManage: boolean;
  /** Admanage staff can clear a rate-limit lock; customers wait it out. */
  readonly isStaff: boolean;
  readonly now: Date;
}

function indexByRuleId<T extends { readonly automationRuleId: number }>(items: readonly T[]): Map<number, T> {
  const index = new Map<number, T>();
  for (const item of items) {
    if (!index.has(item.automationRuleId)) index.set(item.automationRuleId, item);
  }
  return index;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "2m", "3h", "5d" — the compact spans the list sub-lines use. */
export function formatCompactDuration(milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  if (absolute < HOUR_MS) return `${Math.max(1, Math.round(absolute / MINUTE_MS))}m`;
  if (absolute < DAY_MS) return `${Math.round(absolute / HOUR_MS)}h`;
  return `${Math.round(absolute / DAY_MS)}d`;
}

function formatElapsedSince(isoTimestamp: string, now: Date): string | null {
  const timestamp = Date.parse(isoTimestamp);
  if (Number.isNaN(timestamp)) return null;
  return formatCompactDuration(now.getTime() - timestamp);
}

function buildRunningRightNow(execution: HomeRunningExecutionInput, rule: HomeRuleInput): AutomationRightNow {
  const totalSteps = Math.max(rule.flowStepCount, execution.completedSteps + 1);
  const currentStep = Math.min(execution.completedSteps + 1, totalSteps);
  const entityNote = execution.entitiesTouched > 0 ? `${execution.entitiesTouched.toLocaleString("en-US")} ads` : null;
  return {
    kind: "progress",
    label: buildRowSubtitle([`Step ${currentStep} of ${totalSteps}`, entityNote]),
    percent: calculateRunProgressPercent(execution.completedSteps, totalSteps),
  };
}

/** True once the approval's expiry has passed, so it can no longer be answered. */
export function isFlowApprovalExpired(approval: HomeFlowApprovalInput, now: Date): boolean {
  if (!approval.expiresAt) return false;
  const expiresAt = Date.parse(approval.expiresAt);
  return !Number.isNaN(expiresAt) && expiresAt <= now.getTime();
}

function buildFlowApprovalRightNow(approval: HomeFlowApprovalInput, now: Date): AutomationRightNow {
  const waiting = formatElapsedSince(approval.createdAt, now);
  if (isFlowApprovalExpired(approval, now)) {
    return {
      kind: "note",
      label: buildRowSubtitle(["Approval expired", waiting ? `waited ${waiting}` : null]),
      attention: "approval-expired",
      muted: true,
    };
  }

  const actions =
    approval.pendingActionCount > 0
      ? `${approval.pendingActionCount} action${approval.pendingActionCount === 1 ? "" : "s"}`
      : "Review";
  return {
    kind: "approval",
    label: buildRowSubtitle([actions, waiting ? `waiting ${waiting}` : null]),
    approvalId: approval.approvalId,
    approvalToken: approval.approvalToken,
  };
}

/**
 * Wording is deliberately distinct from the flow variant's "3 actions": these
 * are drafted replies that will be posted publicly, not paused ad changes.
 */
function buildCommentReviewRightNow(review: HomeCommentReviewInput, now: Date): AutomationRightNow {
  const waiting = formatElapsedSince(review.createdAt, now);
  const replies = `${review.pendingCount.toLocaleString("en-US")} ${review.pendingCount === 1 ? "reply" : "replies"}`;
  return {
    kind: "review",
    label: buildRowSubtitle([`${replies} to review`, waiting ? `oldest ${waiting}` : null]),
    pendingCount: review.pendingCount,
  };
}

function buildRightNowForApproval(approval: HomeApprovalInput, now: Date): AutomationRightNow {
  return approval.kind === "flow"
    ? buildFlowApprovalRightNow(approval, now)
    : buildCommentReviewRightNow(approval, now);
}

function buildQuietRightNow(rule: HomeRuleInput, delay: HomeDelayInput | undefined, now: Date): AutomationRightNow {
  if (delay) {
    const remaining = Date.parse(delay.resumeAt) - now.getTime();
    const label = Number.isNaN(remaining)
      ? "Resuming soon"
      : remaining <= 0
        ? "Resuming soon"
        : `Resumes in ${formatCompactDuration(remaining)}`;
    return { kind: "note", label, muted: false };
  }

  if (rule.status === AUTO_PAUSED_STATUS) {
    return rule.latestExecution
      ? {
          kind: "failure",
          label: "Paused after 3 failed runs",
          reason: [
            AUTO_PAUSED_REASON,
            isExecutionFailure(rule.latestExecution) ? rule.latestExecution.errorMessage : null,
          ]
            .filter(Boolean)
            .join(" "),
          executionId: rule.latestExecution.id,
        }
      : { kind: "note", label: AUTO_PAUSED_REASON, muted: false };
  }

  if (rule.latestExecution && isExecutionFailure(rule.latestExecution)) {
    const elapsed = rule.lastRunAt ? formatElapsedSince(rule.lastRunAt, now) : null;
    return {
      kind: "failure",
      label: elapsed ? `Failed ${elapsed} ago` : "Latest run failed",
      reason: rule.latestExecution.errorMessage?.trim() || "The latest run failed without an error message.",
      executionId: rule.latestExecution.id,
    };
  }

  if (!rule.lastRunAt) {
    return { kind: "note", label: "Not run yet", muted: true };
  }

  const elapsed = formatElapsedSince(rule.lastRunAt, now);
  return { kind: "note", label: elapsed ? `Last run ${elapsed} ago` : "Last run recorded", muted: true };
}

function resolveToggleLock(
  rule: HomeRuleInput,
  options: { readonly canManage: boolean; readonly isStaff: boolean },
): { readonly locked: boolean; readonly reason: string | null } {
  const uiStatus = mapRuleStatusToUiStatus(rule.status);
  if (!options.canManage) return { locked: true, reason: NO_PERMISSION_LOCK_REASON };
  if (isRuleToggleDisabled(uiStatus)) return { locked: true, reason: ARCHIVED_LOCK_REASON };
  if (rule.rateLimited && !options.isStaff) return { locked: true, reason: RATE_LIMIT_LOCK_REASON };
  return { locked: false, reason: null };
}

function pickLastActivity(
  rule: HomeRuleInput,
  running: HomeRunningExecutionInput | undefined,
  approval: HomeApprovalInput | undefined,
): string | null {
  return running?.startedAt ?? approval?.createdAt ?? rule.lastRunAt ?? rule.updatedAt ?? null;
}

function buildRow(rule: HomeRuleInput, context: BuildAutomationHomeRowsInput, lookups: RowLookups): AutomationHomeRow {
  const running = lookups.running.get(rule.id);
  const approval = lookups.approvals.get(rule.id);
  const delay = lookups.delays.get(rule.id);
  const enabled = mapRuleStatusToUiStatus(rule.status) === "on";
  // An expired approval no longer blocks anyone, so it must not hold the row
  // in "needs-you" — that state means "a human still has to answer this".
  const hasAnswerableApproval =
    approval !== undefined && (approval.kind !== "flow" || !isFlowApprovalExpired(approval, context.now));
  const state = resolveAutomationHomeState({
    enabled,
    hasPendingApproval: hasAnswerableApproval,
    hasRunningExecution: Boolean(running),
    runsUnattended: rule.runsUnattended,
  });

  const rightNow: AutomationRightNow = approval
    ? buildRightNowForApproval(approval, context.now)
    : running
      ? buildRunningRightNow(running, rule)
      : buildQuietRightNow(rule, delay, context.now);

  const toggle = resolveToggleLock(rule, context);
  const accountName = pickHumanAccountName([rule.accountName], rule.accountId);
  // Comment automations run on pages, not on an ad account, so their sub-line
  // names the page count and leaves the account out. The account is still kept
  // on the row for the surfaces that group or filter by it.
  const subtitleAccountName = rule.source === "comment" ? null : accountName;
  const isArchived = mapRuleStatusToUiStatus(rule.status) === "archived";

  return {
    // Mirrors `buildAutomationRowKey` in the automations table so both surfaces
    // identify the same automation by the same key.
    rowKey: `${rule.source}:${rule.id}`,
    id: rule.id,
    source: rule.source,
    groupId: rule.groupId ?? null,
    name: rule.name,
    state,
    accountId: rule.accountId ?? null,
    accountName,
    subtitle: buildRowSubtitle([
      rule.cadenceLabel,
      subtitleAccountName,
      rule.detailLabel,
      formatRunCount(rule.runCount),
    ]),
    rightNow,
    savedHours: context.savedHoursByRuleId[rule.id] ?? 0,
    enabled,
    toggleLocked: toggle.locked,
    toggleLockReason: toggle.reason,
    isArchived,
    lastActivityAt: pickLastActivity(rule, running, approval),
    runsUnattended: rule.runsUnattended,
    displayId: buildAutomationDisplayId(rule.source, rule.id),
    stepServices: rule.stepServices,
    pageIds: rule.pageIds ?? [],
    nextRunLabel: rule.nextRunLabel ?? null,
    nextRunWarning: rule.nextRunWarning ?? null,
    lastRunAt: rule.lastRunAt,
    runCount: rule.runCount,
    updatedAt: rule.updatedAt,
    ownerEmail: rule.ownerEmail,
    ownerInitials: buildOwnerInitials(rule.ownerEmail),
  };
}

interface RowLookups {
  readonly running: Map<number, HomeRunningExecutionInput>;
  readonly approvals: Map<number, HomeApprovalInput>;
  readonly delays: Map<number, HomeDelayInput>;
}

/** Builds every home row and returns them already in home order. */
export function buildAutomationHomeRows(input: BuildAutomationHomeRowsInput): AutomationHomeRow[] {
  const lookups: RowLookups = {
    running: indexByRuleId(input.runningExecutions),
    approvals: indexByRuleId(input.approvals),
    delays: indexByRuleId(input.delays),
  };
  return sortAutomationHomeRows(input.rules.map((rule) => buildRow(rule, input, lookups)));
}
