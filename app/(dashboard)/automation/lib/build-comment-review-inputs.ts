/**
 * Attaches drafted-reply counts to the home rows they belong to.
 *
 * CommentsServer stores one rule per page, so `pending_replies.ruleId` names a
 * single page's rule, while the home list shows one row per automation keyed by
 * the lowest member id. Reading the summaries by the row's own id alone would
 * miss every draft sitting on the automation's other pages, which for a 31-page
 * automation is almost all of them (ADM-11260).
 *
 * Pure so the fan-in can be tested without the network.
 */

import type { HomeCommentReviewInput } from "@/lib/automation/build-home-rows";
import type { CommentApprovalSummary } from "@/lib/comments/comment-approval-summary";
import type { GroupedCommentAutomation } from "./group-comment-automations";

interface MergedSummary {
  readonly pendingCount: number;
  readonly oldestCreatedAt: string | null;
  readonly pageIds: readonly string[];
}

const EMPTY_MERGE: MergedSummary = { pendingCount: 0, oldestCreatedAt: null, pageIds: [] };

function earlier(left: string | null, right: string): string {
  if (!left) return right;
  return Date.parse(right) < Date.parse(left) ? right : left;
}

/** Sums every page rule of one automation into a single waiting-drafts figure. */
function mergeMemberSummaries(
  memberIds: readonly number[],
  byRuleId: ReadonlyMap<number, CommentApprovalSummary>,
): MergedSummary {
  let merged = EMPTY_MERGE;

  for (const memberId of memberIds) {
    const summary = byRuleId.get(memberId);
    if (!summary || summary.pendingCount <= 0) continue;
    merged = {
      pendingCount: merged.pendingCount + summary.pendingCount,
      oldestCreatedAt: earlier(merged.oldestCreatedAt, summary.oldestCreatedAt),
      pageIds: [...merged.pageIds, ...summary.pageIds.filter((pageId) => !merged.pageIds.includes(pageId))],
    };
  }

  return merged;
}

/**
 * Builds one review input per automation that has drafts waiting, keyed by the
 * id the home row carries — the same id the review sheet opens on. Automations with nothing waiting are omitted so they
 * stay out of "needs you", and summaries for rules the list does not show (a
 * deleted page, say) are dropped rather than becoming orphan rows.
 */
export function buildCommentReviewInputs(
  automations: readonly GroupedCommentAutomation[],
  summaries: readonly CommentApprovalSummary[],
): HomeCommentReviewInput[] {
  const byRuleId = new Map(summaries.map((summary) => [summary.ruleId, summary]));
  const inputs: HomeCommentReviewInput[] = [];

  for (const automation of automations) {
    const merged = mergeMemberSummaries(automation.memberIds, byRuleId);
    if (merged.pendingCount <= 0 || !merged.oldestCreatedAt) continue;
    inputs.push({
      kind: "comment-review",
      automationRuleId: automation.id,
      pendingCount: merged.pendingCount,
      createdAt: merged.oldestCreatedAt,
      pageIds: merged.pageIds,
    });
  }

  return inputs;
}
