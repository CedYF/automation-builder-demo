/**
 * The mono line under the automation name: "#2507 · saved 2m ago".
 *
 * The builder autosaves nothing, so "did my last edit stick?" is a real
 * question. Showing the rule id next to a save recency answers it without a
 * toast the user has to catch.
 *
 * `now` is injected so the formatter stays pure and testable.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const UNSAVED_LABEL = "Unsaved draft";
const JUST_NOW_LABEL = "just now";
const SEPARATOR = " · ";

/**
 * Compact recency: "just now", "2m ago", "3h ago", "4d ago". Clock skew that
 * puts the timestamp in the future reads as "just now" rather than "-1m ago".
 */
export function formatCompactAgo(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MS_PER_MINUTE) return JUST_NOW_LABEL;
  if (elapsedMs < MS_PER_HOUR) return `${Math.floor(elapsedMs / MS_PER_MINUTE)}m ago`;
  if (elapsedMs < MS_PER_DAY) return `${Math.floor(elapsedMs / MS_PER_HOUR)}h ago`;
  return `${Math.floor(elapsedMs / MS_PER_DAY)}d ago`;
}

export interface BuilderIdentityLineInput {
  /** Saved automation id, or null while the flow is still a draft. */
  readonly ruleId: number | null;
  /** When this session last saved, or null if it has not saved yet. */
  readonly savedAt: Date | null;
  readonly now: Date;
}

export function buildBuilderIdentityLine(input: BuilderIdentityLineInput): string {
  const idLabel = input.ruleId === null ? UNSAVED_LABEL : `#${input.ruleId}`;
  if (!input.savedAt) return idLabel;
  const elapsedMs = input.now.getTime() - input.savedAt.getTime();
  return `${idLabel}${SEPARATOR}saved ${formatCompactAgo(elapsedMs)}`;
}
