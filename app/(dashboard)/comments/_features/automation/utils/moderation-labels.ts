import { SELECTABLE_MODERATION_CATEGORIES } from "./recipe-conditions";

/**
 * Plain-language names for the moderation verdicts, for people who aren't
 * reading the enum.
 *
 * Shared by both rule builders — the `/comments` recipe modal and the
 * `/automation` flow trigger — because two copies would let a verdict read
 * "Negative opinions about AI" on one screen and "Anti Ai" on the other.
 *
 * Typed against the tuple rather than `ModerationCategory` on purpose: that is
 * what makes tsc fail when a category is added to
 * {@link SELECTABLE_MODERATION_CATEGORIES} without a label here.
 */
export const MODERATION_LABEL: Record<(typeof SELECTABLE_MODERATION_CATEGORIES)[number], string> = {
  sexual: "Sexual / objectifying",
  hate_speech: "Hate speech",
  violence: "Violence or threats",
  scam: "Scam or phishing",
  harassment: "Harassment",
  profanity: "Profanity",
  anti_ai: "Negative opinions about AI",
  self_harm: "Self-harm",
};
