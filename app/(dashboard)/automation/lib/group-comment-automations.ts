/**
 * Collapses per-page comment rules into one automation per name and ad account.
 *
 * CommentsServer stores one rule per Facebook Page or Instagram account, so
 * "Like positive comments" across 31 connected pages is 31 rules with the same
 * name. Listing them raw buries every other automation under near-identical
 * rows and makes the count meaningless. The user set up one automation and
 * should see one row, with the page count and the combined run total on it.
 *
 * Rules created since CommentsServer gained `group_id` carry the id of the
 * automation they belong to, and that is authoritative. The older
 * name + ad account + trigger heuristic remains as the fallback for rows the
 * backfill has not reached, so nothing regresses to 31 look-alike rows.
 */

import type { CommentAutomationApiRule } from "./map-comment-automation-to-table-row";

/** One automation, with every per-page rule that makes it up. */
export interface GroupedCommentAutomation {
  /** Lowest member id — the one the row opens, and a stable key. */
  readonly id: number;
  /**
   * The automation's group id, when its rules carry one. Editing, toggling and
   * deleting address the whole automation through this rather than through the
   * lowest member, which would leave the other pages untouched.
   */
  readonly groupId: string | null;
  readonly name: string;
  readonly status: string;
  readonly triggerType?: string;
  readonly frequency?: string | null;
  readonly scheduledTime?: string | null;
  /** hide / delete / like / reply — decides the per-comment effort estimate. */
  readonly actionType?: string;
  readonly adAccountId?: string | null;
  readonly accountName?: string | null;
  /** Combined processed count across every page. */
  readonly processedCount: number;
  /** Most recent run across every page. */
  readonly lastRunAt: string | null;
  readonly updatedAt?: string;
  /** How many pages this automation covers. 1 means it was never grouped. */
  readonly pageCount: number;
  /**
   * Page ids covered by this automation, in the order the service returned
   * them. The home list resolves these to a profile and name, because a comment
   * automation runs on a page rather than on the ad account behind it.
   */
  readonly pageIds: readonly string[];
  /** Every member rule id, so callers can act on the whole group. */
  readonly memberIds: readonly number[];
}

/** A rule counts as on if any of its pages is on. */
const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["active", "executing"]);

function buildGroupKey(rule: CommentAutomationApiRule): string {
  if (rule.groupId) return `group:${rule.groupId}`;
  return [rule.name.trim().toLowerCase(), rule.adAccountId ?? "", rule.triggerType ?? ""].join("||");
}

function pickLater(left: string | null, right: string | null | undefined): string | null {
  if (!right) return left;
  if (!left) return right;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function mergeInto(group: GroupedCommentAutomation, rule: CommentAutomationApiRule): GroupedCommentAutomation {
  return {
    ...group,
    // The lowest id is the oldest page rule — stable across refreshes, unlike
    // whichever the service happened to return first.
    id: Math.min(group.id, rule.id),
    groupId: group.groupId ?? rule.groupId ?? null,
    status: ACTIVE_STATUSES.has(group.status) ? group.status : rule.status,
    processedCount: group.processedCount + (rule.processedCount ?? 0),
    lastRunAt: pickLater(group.lastRunAt, rule.lastRunAt),
    updatedAt: pickLater(group.updatedAt ?? null, rule.updatedAt) ?? undefined,
    pageCount: group.pageCount + 1,
    pageIds: rule.pageId && !group.pageIds.includes(rule.pageId) ? [...group.pageIds, rule.pageId] : group.pageIds,
    memberIds: [...group.memberIds, rule.id],
  };
}

function toGroup(rule: CommentAutomationApiRule): GroupedCommentAutomation {
  return {
    id: rule.id,
    groupId: rule.groupId ?? null,
    name: rule.name,
    status: rule.status,
    triggerType: rule.triggerType,
    frequency: rule.frequency ?? null,
    scheduledTime: rule.scheduledTime ?? null,
    actionType: rule.actionType,
    adAccountId: rule.adAccountId,
    accountName: rule.accountName ?? null,
    processedCount: rule.processedCount ?? 0,
    lastRunAt: rule.lastRunAt ?? null,
    updatedAt: rule.updatedAt,
    pageCount: 1,
    pageIds: rule.pageId ? [rule.pageId] : [],
    memberIds: [rule.id],
  };
}

/**
 * Groups per-page comment rules, preserving the order in which each automation
 * was first seen so the caller's own sort decides the final order.
 */
export function groupCommentAutomationsForHome(rules: readonly CommentAutomationApiRule[]): GroupedCommentAutomation[] {
  const groups = new Map<string, GroupedCommentAutomation>();

  for (const rule of rules) {
    const key = buildGroupKey(rule);
    const existing = groups.get(key);
    groups.set(key, existing ? mergeInto(existing, rule) : toGroup(rule));
  }

  return [...groups.values()];
}

/** "31 pages" for a grouped automation, or null when it covers just one. */
export function formatPageCount(pageCount: number): string | null {
  return pageCount > 1 ? `${pageCount.toLocaleString("en-US")} pages` : null;
}
