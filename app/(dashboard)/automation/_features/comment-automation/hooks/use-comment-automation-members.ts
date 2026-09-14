"use client";

import { useQuery } from "@tanstack/react-query";
import { usePendingReplies } from "@/app/(dashboard)/comments/_features/pending-replies/hooks/usePendingReplies";
import type { CommentActionType } from "@/app/(dashboard)/comments/lib/api/automation";

/** Members change on save only, so a short cache spares a round-trip per open. */
const MEMBERS_STALE_MS = 60_000;
/** Only the total is read; one row is the smallest page CommentsServer accepts. */
const COUNT_PROBE_PAGE_SIZE = 1;

/**
 * The per-page rules that make up one comment automation.
 *
 * CommentsServer stores an automation as one rule per page, and its drafted
 * replies hang off whichever page rule drafted them. Reading the queue by the
 * one id the builder opened would miss every other page's drafts, so both the
 * review sheet and the count resolve the whole membership first (ADM-11260).
 */
export interface CommentAutomationMembers {
  /** The automation's group id; null for automations that predate grouping. */
  readonly groupId: string | null;
  readonly memberIds: readonly number[];
  /**
   * Each per-page rule with the page it watches. `memberIds` and `pageIds` are
   * de-duplicated separately, so only this says which rule to start for a given
   * page — which is what running a chosen subset of pages needs.
   */
  readonly members: readonly CommentAutomationMember[];
  readonly pageIds: readonly string[];
  /** Page names as CommentsServer stores them, keyed by page id. */
  readonly pageNames: Readonly<Record<string, string>>;
  /**
   * The opened member rule, as far as a surface outside the builder needs it.
   * The history view titles itself with this, so it never has to hydrate the
   * whole flow (or wait for the builder to) just to name the automation.
   */
  readonly rule: CommentAutomationRuleOverview | null;
}

/** One per-page rule, paired with the page it watches. */
export interface CommentAutomationMember {
  readonly id: number;
  readonly pageId: string;
  readonly pageName: string | null;
  readonly platform: "facebook" | "instagram";
}

/** Enough of a member rule to title and describe the automation it belongs to. */
export interface CommentAutomationRuleOverview {
  readonly id: number;
  readonly name: string;
  readonly actionType: CommentActionType;
  readonly status: string;
  readonly triggerType: string;
}

interface CommentAutomationRulePayload {
  readonly groupId?: string | null;
  readonly memberIds?: number[];
  readonly members?: Array<Record<string, unknown>>;
  readonly pageIds?: string[];
  readonly pageNames?: Record<string, string>;
  readonly rule?: Record<string, unknown> | null;
}

const COMMENT_ACTION_TYPES: readonly CommentActionType[] = ["hide", "delete", "reply", "like"];

/** An unknown action reads as "hide": the safest label, and what the server defaults to. */
function toCommentActionType(value: unknown): CommentActionType {
  return COMMENT_ACTION_TYPES.find((action) => action === value) ?? "hide";
}

/** Drops anything without both a rule id and a page: neither half is optional here. */
function toMembers(members: Array<Record<string, unknown>> | undefined): CommentAutomationMember[] {
  if (!Array.isArray(members)) return [];
  const parsed: CommentAutomationMember[] = [];
  for (const member of members) {
    const id = Number(member?.id);
    const pageId = member?.pageId;
    if (!Number.isSafeInteger(id) || id <= 0 || typeof pageId !== "string" || !pageId) continue;
    parsed.push({
      id,
      pageId,
      pageName: typeof member.pageName === "string" && member.pageName.trim() ? member.pageName : null,
      platform: member.platform === "instagram" ? "instagram" : "facebook",
    });
  }
  return parsed;
}

function toRuleOverview(rule: Record<string, unknown> | null | undefined): CommentAutomationRuleOverview | null {
  if (!rule || typeof rule.id !== "number") return null;
  return {
    id: rule.id,
    name: typeof rule.name === "string" && rule.name.trim() ? rule.name : "Comment automation",
    actionType: toCommentActionType(rule.actionType),
    status: typeof rule.status === "string" ? rule.status : "unknown",
    triggerType: typeof rule.triggerType === "string" ? rule.triggerType : "realtime",
  };
}

/** The queue read for one automation: its group when it has one, else its member rules. */
export function toPendingRepliesScope(members: CommentAutomationMembers | undefined): {
  readonly groupId?: string;
  readonly ruleIds?: readonly number[];
} {
  if (!members) return {};
  return members.groupId ? { groupId: members.groupId } : { ruleIds: members.memberIds };
}

/** The BFF's error body, when it managed to say why. */
interface CommentAutomationRuleFailure {
  readonly error?: string;
  readonly message?: string;
}

async function describeFailure(response: Response, ruleId: number): Promise<string> {
  const failure: CommentAutomationRuleFailure = await response.json().catch(() => ({}));
  const reason = failure.message || failure.error;
  const base = `Could not load comment automation ${ruleId}`;
  return reason ? `${base}: ${reason}` : `${base} (${response.status})`;
}

async function fetchCommentAutomationMembers(ruleId: number): Promise<CommentAutomationMembers> {
  const response = await fetch(`/api/comment-automation-rules?id=${ruleId}`);
  if (!response.ok) {
    throw new Error(await describeFailure(response, ruleId));
  }
  const payload: CommentAutomationRulePayload = await response.json();
  const memberIds = payload.memberIds?.filter((id) => Number.isInteger(id) && id > 0) ?? [];
  return {
    groupId: typeof payload.groupId === "string" && payload.groupId ? payload.groupId : null,
    // The opened rule is always a member, even if the group lookup came back empty.
    memberIds: memberIds.length > 0 ? memberIds : [ruleId],
    members: toMembers(payload.members),
    pageIds: payload.pageIds ?? [],
    pageNames: payload.pageNames ?? {},
    rule: toRuleOverview(payload.rule),
  };
}

export function useCommentAutomationMembers(ruleId: number | null, enabled = true) {
  return useQuery<CommentAutomationMembers>({
    queryKey: ["automation", "commentMembers", ruleId] as const,
    queryFn: () => fetchCommentAutomationMembers(ruleId as number),
    enabled: enabled && ruleId !== null,
    staleTime: MEMBERS_STALE_MS,
  });
}

/**
 * How many drafted replies are waiting on one comment automation, across all
 * of its pages. Null while unknown, so a caller can tell "0" from "not loaded".
 */
export function useCommentPendingReplyCount(ruleId: number | null, enabled = true): number | null {
  const members = useCommentAutomationMembers(ruleId, enabled);
  const replies = usePendingReplies({
    ...toPendingRepliesScope(members.data),
    page: 1,
    limit: COUNT_PROBE_PAGE_SIZE,
    enabled: enabled && members.data !== undefined,
  });
  return replies.data?.total ?? null;
}
