import type { AutomationConditions } from "../../../lib/api/automation";

/**
 * Tone-condition mapping for the automation recipe builder.
 *
 * The builder lets a user filter on comment sentiment in two ways:
 *  - a preset word ("positive" / "neutral" / "negative" / "anything"), or
 *  - a raw score range (greater than / less than / between) on the 0-100
 *    sentiment scale.
 *
 * Both ultimately persist as `sentimentMin` / `sentimentMax` on the rule, which
 * the Comments service already evaluates. These helpers translate between the
 * builder's UI value and those persisted fields, and back again when editing.
 */

export type ToneSlot = "anything" | "positive" | "neutral" | "negative";
export type ScoreOperator = "gt" | "lt" | "between";

export type ToneConditionValue =
  | { mode: "preset"; preset: ToneSlot }
  | { mode: "score"; operator: ScoreOperator; min: number; max: number };

type ScoreToneValue = Extract<ToneConditionValue, { mode: "score" }>;
type ToneSentiment = Pick<AutomationConditions, "sentimentMin" | "sentimentMax">;

export const TONE_LABEL: Record<ToneSlot, string> = {
  anything: "anything",
  positive: "positive",
  neutral: "neutral",
  negative: "negative",
};

export const SCORE_OPERATOR_LABEL: Record<ScoreOperator, string> = {
  gt: "greater than",
  lt: "less than",
  between: "between",
};

/** Sentiment scores run 0 (very negative) to 100 (very positive). */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/**
 * Preset score signatures. These exact values are also used to reverse-map a
 * saved rule back to a preset word when editing — a rule whose range matches a
 * signature loads as that preset, anything else loads as a raw score range.
 */
const PRESET_POSITIVE_MIN = 61;
const PRESET_NEUTRAL_MIN = 41;
const PRESET_NEUTRAL_MAX = 60;
const PRESET_NEGATIVE_MAX = 40;

/** Defaults applied the first time a user switches a tone condition into score mode. */
const DEFAULT_SCORE_GT_MIN = 61;
const DEFAULT_SCORE_LT_MAX = 40;
const DEFAULT_SCORE_BETWEEN_MIN = 40;
const DEFAULT_SCORE_BETWEEN_MAX = 70;

/** Dropdown key that switches the tone value from a preset word to a raw score range. */
export const TONE_VALUE_SCORE_KEY = "score";

export const TONE_VALUE_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  ...(Object.keys(TONE_LABEL) as ToneSlot[]).map((slot) => ({ key: slot, label: TONE_LABEL[slot] })),
  { key: TONE_VALUE_SCORE_KEY, label: "a score" },
];

/** Clamps a raw input to the valid 0-100 sentiment scale, rounding to an integer. */
export function clampScore(value: number): number {
  if (Number.isNaN(value)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(value)));
}

/**
 * Which preset band a raw sentiment score falls into. Used to label an
 * individual processed comment (e.g. in a live run feed) with the same bands
 * the preset dropdowns and rule conditions use, so "negative" always means the
 * same range everywhere it appears.
 */
export function scoreToToneSlot(score: number): Exclude<ToneSlot, "anything"> {
  const clamped = clampScore(score);
  if (clamped <= PRESET_NEGATIVE_MAX) return "negative";
  if (clamped >= PRESET_POSITIVE_MIN) return "positive";
  return "neutral";
}

/** A tone condition only filters anything when it is a score range or a non-"anything" preset. */
export function isToneConditionActive(value: ToneConditionValue): boolean {
  return value.mode === "score" || value.preset !== "anything";
}

/** Label shown on the tone value dropdown trigger. */
export function getToneValueLabel(value: ToneConditionValue): string {
  return value.mode === "score" ? "a score" : TONE_LABEL[value.preset];
}

/**
 * Plain-language definition of what a tone preset actually matches, in terms of
 * the persisted 0–100 sentiment score. Shown next to the preset dropdowns so
 * "positive" is a defined range rather than a vibe (ADM-10709).
 */
export const TONE_PRESET_DESCRIPTION: Record<ToneSlot, string> = {
  anything: "No sentiment filter — comments match regardless of tone.",
  positive: `Positive = sentiment score ${PRESET_POSITIVE_MIN}–${SCORE_MAX} (0 = very negative, ${SCORE_MAX} = very positive).`,
  neutral: `Neutral = sentiment score ${PRESET_NEUTRAL_MIN}–${PRESET_NEUTRAL_MAX} (0 = very negative, ${SCORE_MAX} = very positive).`,
  negative: `Negative = sentiment score ${SCORE_MIN}–${PRESET_NEGATIVE_MAX} (0 = very negative, ${SCORE_MAX} = very positive).`,
};

/** Definition line for the currently selected tone value (presets and raw score ranges). */
export function getToneValueDescription(value: ToneConditionValue): string {
  if (value.mode === "preset") return TONE_PRESET_DESCRIPTION[value.preset];
  if (value.operator === "gt") {
    return `Matches comments with a sentiment score above ${clampScore(value.min)} (0 = very negative, ${SCORE_MAX} = very positive).`;
  }
  if (value.operator === "lt") {
    return `Matches comments with a sentiment score below ${clampScore(value.max)} (0 = very negative, ${SCORE_MAX} = very positive).`;
  }
  const min = Math.min(clampScore(value.min), clampScore(value.max));
  const max = Math.max(clampScore(value.min), clampScore(value.max));
  return `Matches comments with a sentiment score between ${min} and ${max} (0 = very negative, ${SCORE_MAX} = very positive).`;
}

/** Seed value for a freshly chosen score operator. */
export function defaultScoreValue(operator: ScoreOperator): ScoreToneValue {
  if (operator === "gt") return { mode: "score", operator, min: DEFAULT_SCORE_GT_MIN, max: SCORE_MAX };
  if (operator === "lt") return { mode: "score", operator, min: SCORE_MIN, max: DEFAULT_SCORE_LT_MAX };
  return { mode: "score", operator, min: DEFAULT_SCORE_BETWEEN_MIN, max: DEFAULT_SCORE_BETWEEN_MAX };
}

/** Resolves the tone value when a user picks an entry from the value dropdown. */
export function toneValueFromKey(key: string, current: ToneConditionValue): ToneConditionValue {
  if (key !== TONE_VALUE_SCORE_KEY) return { mode: "preset", preset: key as ToneSlot };
  return current.mode === "score" ? current : defaultScoreValue("gt");
}

/** Translates a builder tone value into the persisted sentiment range. */
export function toneValueToConditions(value: ToneConditionValue): ToneSentiment {
  return value.mode === "preset" ? presetToConditions(value.preset) : scoreToConditions(value);
}

function presetToConditions(preset: ToneSlot): ToneSentiment {
  if (preset === "positive") return { sentimentMin: PRESET_POSITIVE_MIN };
  if (preset === "negative") return { sentimentMax: PRESET_NEGATIVE_MAX };
  if (preset === "neutral") return { sentimentMin: PRESET_NEUTRAL_MIN, sentimentMax: PRESET_NEUTRAL_MAX };
  return {};
}

function scoreToConditions(value: ScoreToneValue): ToneSentiment {
  const min = clampScore(value.min);
  const max = clampScore(value.max);
  if (value.operator === "gt") return { sentimentMin: min };
  if (value.operator === "lt") return { sentimentMax: max };
  return { sentimentMin: Math.min(min, max), sentimentMax: Math.max(min, max) };
}

/** Reverse-maps a saved rule's sentiment range back to a builder tone value. */
export function inferToneValue(conditions?: AutomationConditions): ToneConditionValue {
  const min = conditions?.sentimentMin;
  const max = conditions?.sentimentMax;
  if (min === undefined && max === undefined) return { mode: "preset", preset: "anything" };
  const preset = matchPreset(min, max);
  if (preset) return { mode: "preset", preset };
  return inferScoreValue(min, max);
}

function matchPreset(min?: number, max?: number): ToneSlot | null {
  if (min === PRESET_POSITIVE_MIN && max === undefined) return "positive";
  if (max === PRESET_NEGATIVE_MAX && min === undefined) return "negative";
  if (min === PRESET_NEUTRAL_MIN && max === PRESET_NEUTRAL_MAX) return "neutral";
  return null;
}

function inferScoreValue(min?: number, max?: number): ScoreToneValue {
  if (min !== undefined && max !== undefined) return { mode: "score", operator: "between", min, max };
  if (min !== undefined) return { mode: "score", operator: "gt", min, max: SCORE_MAX };
  return { mode: "score", operator: "lt", min: SCORE_MIN, max: max as number };
}
