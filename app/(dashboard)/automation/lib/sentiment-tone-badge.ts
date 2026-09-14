/**
 * Turns a processed comment's raw sentiment score into the small colored badge
 * shown next to it in a run's comment feed (live or in History) — "Negative ·
 * 18" rather than a bare number, using the same tone bands the rule's own
 * condition is built from.
 */

import { TONE_LABEL, scoreToToneSlot } from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";

export interface SentimentToneBadge {
  readonly label: string;
  readonly className: string;
}

const TONE_BADGE_CLASS: Readonly<Record<"negative" | "neutral" | "positive", string>> = {
  negative: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/** Null when the comment carries no sentiment score to badge. */
export function describeSentimentTone(score: number | undefined): SentimentToneBadge | null {
  if (score === undefined || Number.isNaN(score)) return null;
  const slot = scoreToToneSlot(score);
  return { label: `${capitalize(TONE_LABEL[slot])} · ${score}`, className: TONE_BADGE_CLASS[slot] };
}
