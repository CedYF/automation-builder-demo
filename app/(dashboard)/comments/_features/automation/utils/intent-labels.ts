import { SELECTABLE_INTENTS } from "./recipe-conditions";

/**
 * Plain-language names for the built-in intent verdicts, for people who aren't
 * reading the enum.
 *
 * Shared by both rule builders — the `/comments` recipe modal and the
 * `/automation` flow trigger — so an intent never reads differently on the two
 * screens (same precedent as {@link MODERATION_LABEL}).
 *
 * Typed against the tuple rather than `CommentIntent` on purpose: that is what
 * makes tsc fail when an intent is added to {@link SELECTABLE_INTENTS} without
 * a label here.
 */
export const INTENT_LABEL: Record<(typeof SELECTABLE_INTENTS)[number], string> = {
  purchase: "Wants to buy / asks how to order",
  price_question: "Asks about price or discounts",
  product_question: "Asks about the product",
  availability_question: "Asks about shipping or availability",
  support_request: "Needs help with an order",
  complaint: "Complains",
  praise: "Praises",
  tag_friend: "Tags a friend / reacts only",
  spam_promo: "Spam or self-promotion",
};

/**
 * Widened lookup for verdicts that arrive from the server but are not in the
 * selectable tuple (`other`, `unknown`, or one added server-side first). Such a
 * verdict is still a real filter, so it falls back to its raw key rather than
 * vanishing from a summary.
 */
const INTENT_LABEL_BY_KEY: Readonly<Record<string, string>> = INTENT_LABEL;

export function intentLabel(intent: string): string {
  return INTENT_LABEL_BY_KEY[intent] ?? intent;
}

/**
 * Name for a custom intent id, from the workspace's list. Falls back to the id
 * when the list is not loaded (or the intent was deleted after the rule was
 * saved) so the condition is never rendered as blank.
 */
export function customIntentLabel(id: string, names?: Readonly<Record<string, string>> | null): string {
  return names?.[id] ?? id;
}
