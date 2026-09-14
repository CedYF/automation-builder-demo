/**
 * Which schedule fields a given automation frequency actually uses.
 *
 * ADM-11225: the trigger config panel renders "Scheduled Date" only for
 * one-time rules, but switching Frequency never cleared the value. The stale
 * date stayed in the node config, was sent on every save, and the PUT route
 * stored it as the rule's real `scheduledDate` — so a weekly *Tuesday* rule sat
 * queued for a *Friday* and the cron (which matches `scheduledDate == today`)
 * never ran it.
 *
 * Normalising at save time rather than clearing on each dropdown change keeps
 * the fix independent of how the config got into that state (templates, the
 * public API, chat-built automations) and avoids throwing away a user's day
 * selection when they flick back and forth through the frequency options.
 */

export const SCHEDULE_FIELD_KEYS = [
  "scheduledDate",
  "scheduledTime",
  "dayOfWeek",
  "dayOfMonth",
  "startDate",
  "endDate",
] as const;

export type ScheduleFieldKey = (typeof SCHEDULE_FIELD_KEYS)[number];

/** The frequency assumed when a scheduled trigger has none set — what the panel displays. */
export const DEFAULT_FREQUENCY = "one-time";

const FIELDS_BY_FREQUENCY: Readonly<Record<string, readonly ScheduleFieldKey[]>> = Object.freeze({
  "one-time": ["scheduledDate", "scheduledTime"],
  daily: ["scheduledTime", "startDate", "endDate"],
  weekly: ["scheduledTime", "dayOfWeek", "startDate", "endDate"],
  monthly: ["scheduledTime", "dayOfMonth", "startDate", "endDate"],
});

/** Normalise a possibly-absent frequency to the one the config panel shows. */
export function resolveFrequency(frequency: unknown): string {
  return typeof frequency === "string" && frequency.trim() !== "" ? frequency : DEFAULT_FREQUENCY;
}

/**
 * The schedule fields that apply to `frequency`, or `null` when the frequency is
 * not one we recognise — callers must then leave the config untouched rather
 * than guess.
 */
export function scheduleFieldsForFrequency(frequency: unknown): readonly ScheduleFieldKey[] | null {
  return FIELDS_BY_FREQUENCY[resolveFrequency(frequency)] ?? null;
}

export function isScheduleFieldApplicable(frequency: unknown, field: ScheduleFieldKey): boolean {
  const fields = scheduleFieldsForFrequency(frequency);
  return fields === null || fields.includes(field);
}

/**
 * Remove schedule fields that the config's own frequency does not use.
 *
 * Only the keys in {@link SCHEDULE_FIELD_KEYS} are ever touched; every other
 * config value is passed through untouched. Returns the original object when
 * there is nothing to strip, so callers can rely on reference equality to detect
 * a no-op.
 */
export function stripInapplicableScheduleFields<T extends Record<string, unknown>>(config: T): T {
  const applicable = scheduleFieldsForFrequency(config.frequency);
  if (applicable === null) return config;

  const removable = SCHEDULE_FIELD_KEYS.filter((key) => !applicable.includes(key) && key in config);
  if (removable.length === 0) return config;

  const next: Record<string, unknown> = { ...config };
  for (const key of removable) delete next[key];
  return next as T;
}
