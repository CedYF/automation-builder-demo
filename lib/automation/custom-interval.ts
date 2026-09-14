/**
 * Custom check-frequency intervals for polling automation triggers (ADM-11829).
 *
 * The fixed cadences (every-5-min / hourly / daily / weekly / monthly) each map
 * to a cron tick. A customer who needs "once every 4 days" fits none of them,
 * so a trigger can instead store `checkFrequency: "custom"` alongside an
 * `intervalValue` + `intervalUnit` pair. The cron ticks every five minutes and
 * fires a custom rule once `intervalValue × intervalUnit` has elapsed since the
 * last run it stamped on the rule.
 *
 * These helpers are the single source of truth on the app side: the builder's
 * interval fields, the node summary ("Every 4 days"), the home-list cadence
 * label and the poll route all read through them. The cron deploys separately
 * and shares no code with this app, so `apps/budgeting-cron/automation/
 * custom-interval.ts` mirrors the parsing and clamping here — any change to
 * the bounds or the config keys needs the same change there.
 */

/** `checkFrequency` value that turns the interval fields on. */
export const CUSTOM_CHECK_FREQUENCY = "custom";

/** Units a custom interval can be expressed in. */
export type CustomIntervalUnit = "minutes" | "hours" | "days";

/** Minutes in one unit, in the order the picker offers them. */
export const CUSTOM_INTERVAL_UNIT_MINUTES: Readonly<Record<CustomIntervalUnit, number>> = Object.freeze({
  minutes: 1,
  hours: 60,
  days: 24 * 60,
});

export const CUSTOM_INTERVAL_UNITS: readonly CustomIntervalUnit[] = ["minutes", "hours", "days"];

/**
 * Shortest interval accepted. The cron that fires custom rules ticks every five
 * minutes, so anything shorter would silently run at five minutes anyway.
 */
export const MIN_CUSTOM_INTERVAL_MINUTES = 5;

/** Longest interval accepted: 30 days. Beyond that a rule looks dead rather than slow. */
export const MAX_CUSTOM_INTERVAL_MINUTES = 30 * CUSTOM_INTERVAL_UNIT_MINUTES.days;

/** A parsed, unit-aware interval. */
export interface CustomInterval {
  readonly intervalValue: number;
  readonly intervalUnit: CustomIntervalUnit;
}

/** Interval a custom rule falls back to when its fields are missing or unusable. */
export const DEFAULT_CUSTOM_INTERVAL: CustomInterval = Object.freeze({ intervalValue: 1, intervalUnit: "days" });

/** The trigger-config keys a custom interval lives in. */
export interface CustomIntervalConfig {
  checkFrequency?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
}

/** Whether a stored `checkFrequency` selects the custom interval. */
export function isCustomCheckFrequency(checkFrequency: unknown): boolean {
  return checkFrequency === CUSTOM_CHECK_FREQUENCY;
}

function isCustomIntervalUnit(value: unknown): value is CustomIntervalUnit {
  return typeof value === "string" && (CUSTOM_INTERVAL_UNITS as readonly string[]).includes(value);
}

/**
 * Reads the interval fields without applying the bounds.
 *
 * Accepts a numeric string for the value because the builder's number input
 * hands strings back and assistant/MCP payloads sometimes do too.
 *
 * @returns The interval, or null when either field is absent or unusable.
 */
export function parseCustomInterval(config: CustomIntervalConfig | null | undefined): CustomInterval | null {
  if (!config) return null;
  const raw = config.intervalValue;
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value <= 0) return null;
  if (!isCustomIntervalUnit(config.intervalUnit)) return null;
  return { intervalValue: value, intervalUnit: config.intervalUnit };
}

/** Total minutes an interval spans, before clamping. */
export function customIntervalToMinutes(interval: CustomInterval): number {
  return interval.intervalValue * CUSTOM_INTERVAL_UNIT_MINUTES[interval.intervalUnit];
}

/** Applies the 5-minute floor and 30-day ceiling. */
export function clampCustomIntervalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_CUSTOM_INTERVAL_MINUTES;
  return Math.min(MAX_CUSTOM_INTERVAL_MINUTES, Math.max(MIN_CUSTOM_INTERVAL_MINUTES, minutes));
}

/**
 * The interval, in minutes, a custom rule actually runs at.
 *
 * Unusable fields fall back to {@link DEFAULT_CUSTOM_INTERVAL} rather than
 * disabling the rule: a customer who picked "Custom" and saved expects it to
 * run, and once a day is the least surprising cadence to land on.
 *
 * @returns Clamped minutes, or null when `checkFrequency` is not "custom".
 */
export function resolveCustomIntervalMinutes(config: CustomIntervalConfig | null | undefined): number | null {
  if (!isCustomCheckFrequency(config?.checkFrequency)) return null;
  const interval = parseCustomInterval(config) ?? DEFAULT_CUSTOM_INTERVAL;
  return clampCustomIntervalMinutes(customIntervalToMinutes(interval));
}

/**
 * Validation message for the builder, or null when the fields are acceptable.
 *
 * Judged on the *unclamped* interval so the customer sees why "2 minutes" or
 * "60 days" will not do what they typed, instead of the cron quietly moving it.
 */
export function describeCustomIntervalProblem(config: CustomIntervalConfig | null | undefined): string | null {
  if (!isCustomCheckFrequency(config?.checkFrequency)) return null;
  const interval = parseCustomInterval(config);
  if (!interval) return "Enter a whole number of minutes, hours or days.";
  const minutes = customIntervalToMinutes(interval);
  if (minutes < MIN_CUSTOM_INTERVAL_MINUTES) return `The shortest interval is ${MIN_CUSTOM_INTERVAL_MINUTES} minutes.`;
  if (minutes > MAX_CUSTOM_INTERVAL_MINUTES) return "The longest interval is 30 days.";
  return null;
}

/**
 * Human label for an interval: "Every 4 days", "Every hour", "Every 90 minutes".
 *
 * Reads the stored fields as typed (unclamped) so the badge matches what the
 * customer entered; the bounds are enforced at input and again by the cron.
 */
export function formatCustomIntervalLabel(config: CustomIntervalConfig | null | undefined): string {
  const interval = parseCustomInterval(config) ?? DEFAULT_CUSTOM_INTERVAL;
  const singular = interval.intervalUnit.slice(0, -1);
  if (interval.intervalValue === 1) return `Every ${singular}`;
  return `Every ${interval.intervalValue} ${interval.intervalUnit}`;
}

/**
 * When a custom rule next runs.
 *
 * @param lastRunAt - The last run the cron stamped, or null when it has never run.
 * @param intervalMinutes - Clamped interval from {@link resolveCustomIntervalMinutes}.
 * @param now - Clock to judge against; injected so callers stay deterministic.
 * @returns `now` for a rule that has never run (it is due immediately),
 *   otherwise the last run plus the interval.
 */
export function computeCustomIntervalNextRunAt(lastRunAt: Date | null, intervalMinutes: number, now: Date): Date {
  if (lastRunAt === null || Number.isNaN(lastRunAt.getTime())) return now;
  return new Date(lastRunAt.getTime() + intervalMinutes * 60_000);
}
