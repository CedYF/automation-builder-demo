import type { AutomationConditions, CommentIntent, ModerationCategory } from "../../../lib/api/automation";
import { commentSourceFromIsAdOnly, isAdOnlyFromCommentSource, type CommentSourceFilter } from "./comment-source";
import {
  inferToneValue,
  isToneConditionActive,
  toneValueToConditions,
  type ToneConditionValue,
} from "./tone-condition";

export type HistorySlot = "returning" | "new";
export type LengthSlot = "short" | "medium" | "long";
export type TargetSlot = "comment" | "reply";
export type CommentSourceSlot = Exclude<CommentSourceFilter, "all">;

export type ConditionType =
  | "contains"
  | "doesntContain"
  | "tone"
  | "moderation"
  | "intent"
  | "history"
  | "length"
  | "target"
  | "commentSource"
  | "campaign"
  | "adset";

/**
 * Verdicts a rule can act on. `clean` is excluded — a rule that fires on
 * "nothing is wrong with this comment" is never what anyone means, and offering
 * it would make hide-everything a two-click mistake.
 */
export const SELECTABLE_MODERATION_CATEGORIES = [
  "sexual",
  "hate_speech",
  "violence",
  "scam",
  "harassment",
  "profanity",
  "anti_ai",
  "self_harm",
] as const satisfies readonly ModerationCategory[];

/**
 * Built-in intents a rule can act on. `other` and `unknown` are excluded: the
 * first is the classifier's "none of the above" bucket and the second means it
 * has not run yet, so neither is something anyone means to automate on.
 */
export const SELECTABLE_INTENTS = [
  "purchase",
  "price_question",
  "product_question",
  "availability_question",
  "support_request",
  "complaint",
  "praise",
  "tag_friend",
  "spam_promo",
] as const satisfies readonly CommentIntent[];

export type SelectableIntent = (typeof SELECTABLE_INTENTS)[number];

/**
 * One "intent is any of" row: built-in verdicts plus ids of the workspace's
 * custom intents. Both lists live on one row because the server treats them as
 * one condition (a comment matches when either list hits).
 */
export interface IntentConditionValue {
  intents: CommentIntent[];
  customIntents: string[];
}

export const EMPTY_INTENT_CONDITION: IntentConditionValue = { intents: [], customIntents: [] };

export function isIntentConditionEmpty(value: IntentConditionValue): boolean {
  return value.intents.length === 0 && value.customIntents.length === 0;
}

/** A single IF-row in the recipe builder. Campaign/ad-set rows hold the selected ids. */
export type Condition =
  | { id: string; type: "contains"; value: string[] }
  | { id: string; type: "doesntContain"; value: string[] }
  | { id: string; type: "tone"; value: ToneConditionValue }
  | { id: string; type: "moderation"; value: ModerationCategory[] }
  | { id: string; type: "intent"; value: IntentConditionValue }
  | { id: string; type: "history"; value: HistorySlot }
  | { id: string; type: "length"; value: LengthSlot }
  | { id: string; type: "target"; value: TargetSlot }
  | { id: string; type: "commentSource"; value: CommentSourceSlot }
  | { id: string; type: "campaign"; value: string[] }
  | { id: string; type: "adset"; value: string[] };

/**
 * Collapse the builder's IF-rows into the persisted `AutomationConditions`
 * shape the CommentsServer rule matcher consumes. Empty keyword/campaign/ad-set
 * selections are dropped so they never become inert "match nothing" filters.
 *
 * `matchMode` has no IF-row of its own, so it is carried over from the rule
 * being edited: this builder reads as an AND sentence and only ever authors
 * "all", but a rule authored elsewhere may combine with "any", and rebuilding
 * from rows alone would silently narrow it back down on save.
 */
export function buildConditions(
  conditionsState: Condition[],
  matchMode?: AutomationConditions["matchMode"],
): AutomationConditions {
  const conditions: AutomationConditions = matchMode ? { matchMode } : {};
  for (const cond of conditionsState) {
    if (cond.type === "contains" && cond.value.length > 0) {
      conditions.keywords = cond.value;
    } else if (cond.type === "doesntContain" && cond.value.length > 0) {
      conditions.excludeKeywords = cond.value;
    } else if (cond.type === "tone") {
      Object.assign(conditions, toneValueToConditions(cond.value));
    } else if (cond.type === "moderation" && cond.value.length > 0) {
      conditions.moderationCategories = cond.value;
    } else if (cond.type === "intent" && !isIntentConditionEmpty(cond.value)) {
      // Each list is written only when non-empty so a rule never persists an
      // inert `customIntents: []` beside its built-in picks (or vice versa).
      if (cond.value.intents.length > 0) conditions.intents = cond.value.intents;
      if (cond.value.customIntents.length > 0) conditions.customIntents = cond.value.customIntents;
    } else if (cond.type === "history") {
      conditions.commenterHistory = cond.value;
    } else if (cond.type === "length") {
      conditions.commentLength = cond.value;
    } else if (cond.type === "target") {
      conditions.targetType = cond.value;
    } else if (cond.type === "commentSource") {
      conditions.isAdOnly = isAdOnlyFromCommentSource(cond.value);
    } else if (cond.type === "campaign" && cond.value.length > 0) {
      conditions.campaignIds = cond.value;
    } else if (cond.type === "adset" && cond.value.length > 0) {
      conditions.adsetIds = cond.value;
    }
  }
  return conditions;
}

/**
 * Rehydrate persisted `AutomationConditions` back into builder IF-rows so an
 * existing (or seeded/cloned) rule opens with its conditions pre-filled. Inverse
 * of {@link buildConditions}.
 */
export function conditionRowsFromConditions(c: AutomationConditions): Condition[] {
  const rows: Condition[] = [];
  if (c.keywords && c.keywords.length > 0) {
    rows.push({ id: "kw", type: "contains", value: c.keywords });
  }
  if (c.excludeKeywords && c.excludeKeywords.length > 0) {
    rows.push({ id: "ex", type: "doesntContain", value: c.excludeKeywords });
  }
  const tone = inferToneValue(c);
  if (isToneConditionActive(tone)) {
    rows.push({ id: "tone", type: "tone", value: tone });
  }
  if (c.moderationCategories && c.moderationCategories.length > 0) {
    rows.push({ id: "moderation", type: "moderation", value: c.moderationCategories });
  }
  const intents = c.intents ?? [];
  const customIntents = c.customIntents ?? [];
  if (intents.length > 0 || customIntents.length > 0) {
    rows.push({ id: "intent", type: "intent", value: { intents, customIntents } });
  }
  if (c.commenterHistory) {
    rows.push({ id: "history", type: "history", value: c.commenterHistory });
  }
  if (c.commentLength) {
    rows.push({ id: "length", type: "length", value: c.commentLength });
  }
  if (c.targetType === "comment" || c.targetType === "reply") {
    rows.push({ id: "target", type: "target", value: c.targetType });
  }
  const commentSource = commentSourceFromIsAdOnly(c.isAdOnly);
  if (commentSource !== "all") {
    rows.push({ id: "commentSource", type: "commentSource", value: commentSource });
  }
  if (c.campaignIds && c.campaignIds.length > 0) {
    rows.push({ id: "campaign", type: "campaign", value: c.campaignIds });
  }
  if (c.adsetIds && c.adsetIds.length > 0) {
    rows.push({ id: "adset", type: "adset", value: c.adsetIds });
  }
  return rows;
}
