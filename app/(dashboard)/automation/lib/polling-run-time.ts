/**
 * Schedule helpers for polling-based automation triggers (daily / weekly / monthly).
 *
 * The cron service ticks once an hour and fires the rules whose configured slot
 * matches, so the picker only offers whole hours. Rules with no run time keep
 * the historical 09:00 slot (ADM-9818), and weekly rules with no days keep
 * Monday — where the Monday-pinned weekly cron used to put all of them
 * (ADM-10118).
 *
 * These constants mirror `apps/budgeting-cron/automation/run-time.ts`. The two
 * services deploy separately and share no code, so any change here needs the
 * same change there.
 */

import { addOrdinalSuffix } from "@/lib/functions/date/formatDate";
import { formatCustomIntervalLabel, isCustomCheckFrequency } from "@/lib/automation/custom-interval";

/** Run time applied when a rule has none. Mirrors DEFAULT_POLLING_RUN_HOUR in the cron. */
export const DEFAULT_POLLING_RUN_TIME = "09:00";

/** Timezone the cron interprets every run time in. */
export const POLLING_RUN_TIME_ZONE_LABEL = "BST (Europe/London)";

/** Seconds per hour — the `step` that keeps the native time input on whole hours. */
export const POLLING_RUN_TIME_STEP_SECONDS = 3600;

/**
 * Helper copy shown under the run-time picker.
 *
 * Pulled out as a constant (rather than left inline in the picker's JSX) so a
 * caller that condenses the picker's helper text into a tooltip — see
 * `condensedHourlyHint` on `PollingScheduleField` — can reuse the exact same
 * copy instead of a second hand-typed copy that could drift from this one.
 */
export const RUN_TIME_HELP_TEXT = `Runs on the hour. Times are ${POLLING_RUN_TIME_ZONE_LABEL}, not your local timezone. Leave empty to use ${DEFAULT_POLLING_RUN_TIME}.`;

/** Cadences that support a per-rule run time. */
const HOUR_GATED_FREQUENCIES: ReadonlySet<string> = new Set(["daily", "weekly", "monthly"]);

/** Whether a check frequency runs on a per-rule hour rather than continuously. */
export function isHourGatedFrequency(checkFrequency: unknown): boolean {
  return typeof checkFrequency === "string" && HOUR_GATED_FREQUENCIES.has(checkFrequency);
}

/** Whether a check frequency runs on per-rule weekdays. */
export function isWeekdayGatedFrequency(checkFrequency: unknown): boolean {
  return checkFrequency === "weekly";
}

/** Whether a check frequency runs on a per-rule day of month. */
export function isDayOfMonthGatedFrequency(checkFrequency: unknown): boolean {
  return checkFrequency === "monthly";
}

/** A weekday a weekly rule can be scheduled on. */
export interface WeekdayOption {
  /** Stored value — lowercase, matching the cron's WEEKDAY_NAMES. */
  readonly value: string;
  /** Full name, for the schedule description. */
  readonly label: string;
  /** One or two letters, for the day toggles. */
  readonly shortLabel: string;
}

/**
 * Weekdays in the order they are offered, Monday first.
 *
 * The stored values are lowercase to match `WEEKDAY_NAMES` in the cron and the
 * Scheduled trigger's existing `dayOfWeek` options, so all three schedulers
 * share one vocabulary.
 */
export const WEEKDAY_OPTIONS: readonly WeekdayOption[] = [
  { value: "monday", label: "Monday", shortLabel: "M" },
  { value: "tuesday", label: "Tuesday", shortLabel: "T" },
  { value: "wednesday", label: "Wednesday", shortLabel: "W" },
  { value: "thursday", label: "Thursday", shortLabel: "Th" },
  { value: "friday", label: "Friday", shortLabel: "F" },
  { value: "saturday", label: "Saturday", shortLabel: "S" },
  { value: "sunday", label: "Sunday", shortLabel: "Su" },
];

/** Weekday a weekly rule runs on when it has none. Mirrors DEFAULT_CHECK_DAYS in the cron. */
export const DEFAULT_CHECK_DAYS: readonly string[] = ["monday"];

/** Sentinel day-of-month meaning "whatever the final day of the month is". */
export const LAST_DAY_OF_MONTH = "last";

/** Day of month a monthly rule runs on when it has none. */
export const DEFAULT_CHECK_DAY_OF_MONTH = "1";

/**
 * Highest fixed day of month offered.
 *
 * Capped at 28 because every month has one: offering the 29th-31st would let a
 * customer pick a day that does not exist in February. The cron clamps such a
 * value onto the month's last day rather than skipping, but the picker should
 * not create the ambiguity in the first place — "last" covers that intent.
 */
const MAX_FIXED_DAY_OF_MONTH = 28;

/** A day a monthly rule can be scheduled on. */
export interface DayOfMonthOption {
  readonly value: string;
  readonly label: string;
}

/** Day-of-month choices: the 1st through the 28th, then "Last day of month". */
export const DAY_OF_MONTH_OPTIONS: readonly DayOfMonthOption[] = [
  ...Array.from({ length: MAX_FIXED_DAY_OF_MONTH }, (_, index) => {
    const day = index + 1;
    return { value: String(day), label: addOrdinalSuffix(day) };
  }),
  { value: LAST_DAY_OF_MONTH, label: "Last day of month" },
];

/** Matches a 24-hour "HH:mm" clock time. */
const RUN_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_VALUES: ReadonlySet<string> = new Set(WEEKDAY_OPTIONS.map((day) => day.value));

/**
 * Snaps a "HH:mm" value to the top of its hour.
 *
 * Browsers let users type minutes even with `step=3600`, and the cron only ever
 * fires on the hour, so a stored "00:37" would silently never run. Snapping at
 * the input boundary keeps what is saved equal to what will happen.
 *
 * @returns The normalized "HH:00", or an empty string when the value is unusable.
 */
export function normalizeRunTimeToHour(value: string): string {
  const trimmed = value.trim();
  if (!RUN_TIME_PATTERN.test(trimmed)) return "";
  return `${trimmed.slice(0, 2)}:00`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parses assistant/MCP schedule payloads into weekday strings before display-order sorting. */
function parseCheckDaysInput(checkDays: unknown): readonly string[] {
  if (Array.isArray(checkDays)) {
    return checkDays
      .filter((day): day is string => typeof day === "string")
      .map((day) => day.trim().toLowerCase())
      .filter((day) => WEEKDAY_VALUES.has(day));
  }

  if (typeof checkDays === "string" && checkDays.trim()) {
    const day = checkDays.trim().toLowerCase();
    return WEEKDAY_VALUES.has(day) ? [day] : [];
  }

  // Models sometimes emit data-pill shapes for a single weekday.
  if (isRecord(checkDays) && typeof checkDays.item === "string" && checkDays.item.trim()) {
    const day = checkDays.item.trim().toLowerCase();
    return WEEKDAY_VALUES.has(day) ? [day] : [];
  }

  return [];
}

/**
 * Normalizes a stored `checkDays` value into known weekday values, in display order.
 *
 * Mirrors `normalizeCheckDays` in the cron: an absent or unusable value falls
 * back to Monday, so a weekly rule saved before ADM-10118 keeps the slot it has
 * always run in rather than silently never firing.
 */
export function normalizeCheckDays(checkDays: unknown): readonly string[] {
  const parsed = parseCheckDaysInput(checkDays);
  if (parsed.length === 0) return DEFAULT_CHECK_DAYS;

  const recognised = new Set(parsed);

  // Sort by WEEKDAY_OPTIONS so "Thursday, Monday" always reads "Monday and Thursday".
  return WEEKDAY_OPTIONS.filter((day) => recognised.has(day.value)).map((day) => day.value);
}

/**
 * Applies a weekday selection, keeping at least one day selected.
 *
 * Clearing the last day would leave a weekly rule with no day at all, which the
 * cron reads as "Monday" — a silent jump onto a day the customer did not pick.
 * The empty selection is refused instead.
 *
 * @returns The next `checkDays` value, in display order.
 */
export function applyCheckDaysSelection(nextDays: unknown, currentDays: unknown): readonly string[] {
  if (Array.isArray(nextDays) && nextDays.length === 0) return normalizeCheckDays(currentDays);
  return normalizeCheckDays(nextDays);
}

/** Normalizes a stored `checkDayOfMonth` into an offered option value. */
export function normalizeCheckDayOfMonth(checkDayOfMonth: unknown): string {
  const raw = typeof checkDayOfMonth === "number" ? String(checkDayOfMonth) : String(checkDayOfMonth ?? "").trim();
  if (raw.toLowerCase() === LAST_DAY_OF_MONTH) return LAST_DAY_OF_MONTH;
  return DAY_OF_MONTH_OPTIONS.some((option) => option.value === raw) ? raw : DEFAULT_CHECK_DAY_OF_MONTH;
}

/** The stored trigger-config fields that decide when a polling rule runs. */
export interface PollingScheduleConfig {
  checkFrequency?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  checkTime?: unknown;
  checkDays?: unknown;
  checkDayOfMonth?: unknown;
}

/** Formats the selected weekdays as "Monday", "Monday and Thursday", "Monday, Thursday and Friday". */
function describeCheckDays(checkDays: unknown): string {
  const selected = normalizeCheckDays(checkDays);
  const labels = WEEKDAY_OPTIONS.filter((day) => selected.includes(day.value)).map((day) => day.label);
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(labels);
}

/** Formats the selected day of month as "the 15th" or "the last day". */
function describeCheckDayOfMonth(checkDayOfMonth: unknown): string {
  const normalized = normalizeCheckDayOfMonth(checkDayOfMonth);
  return normalized === LAST_DAY_OF_MONTH ? "the last day" : `the ${addOrdinalSuffix(Number(normalized))}`;
}

/** Describes the calendar part of a cadence: "once per day", "every Monday", "the 15th of each month". */
function describeCadence(config: PollingScheduleConfig): string {
  if (isWeekdayGatedFrequency(config.checkFrequency)) return `every ${describeCheckDays(config.checkDays)}`;
  if (isDayOfMonthGatedFrequency(config.checkFrequency)) {
    return `on ${describeCheckDayOfMonth(config.checkDayOfMonth)} of each month`;
  }
  return "once per day";
}

/**
 * Human-readable description of when a polling rule will run.
 *
 * Reads the whole stored schedule rather than individual fields so the sentence
 * cannot drift out of step with what the cron will actually do.
 */
export function describePollingSchedule(config: PollingScheduleConfig): string {
  if (config.checkFrequency === "hourly") return "This automation will automatically run every hour.";
  if (isCustomCheckFrequency(config.checkFrequency)) {
    return `This automation will automatically run ${formatCustomIntervalLabel(config).toLowerCase()}.`;
  }
  if (!isHourGatedFrequency(config.checkFrequency)) {
    return "This automation will only run when you press the Run button.";
  }

  const runTime =
    typeof config.checkTime === "string" && RUN_TIME_PATTERN.test(config.checkTime.trim())
      ? config.checkTime.trim()
      : null;
  const effectiveTime = runTime ?? DEFAULT_POLLING_RUN_TIME;
  const defaultNote = runTime ? "" : " (default)";

  return `This automation will automatically run ${describeCadence(config)} at ${effectiveTime} ${POLLING_RUN_TIME_ZONE_LABEL}${defaultNote}.`;
}

/** Compact schedule label for summary badges, e.g. "Weekly Mon, Thu 14:00". */
export function summarizePollingSchedule(config: PollingScheduleConfig): string | null {
  if (isCustomCheckFrequency(config.checkFrequency)) return formatCustomIntervalLabel(config);
  if (!isHourGatedFrequency(config.checkFrequency)) return null;

  const time =
    typeof config.checkTime === "string" && RUN_TIME_PATTERN.test(config.checkTime.trim())
      ? config.checkTime.trim()
      : DEFAULT_POLLING_RUN_TIME;

  if (isWeekdayGatedFrequency(config.checkFrequency)) {
    const selected = normalizeCheckDays(config.checkDays);
    const days = WEEKDAY_OPTIONS.filter((day) => selected.includes(day.value))
      .map((day) => day.label.slice(0, 3))
      .join(", ");
    return `Weekly ${days} ${time}`;
  }

  if (isDayOfMonthGatedFrequency(config.checkFrequency)) {
    const normalized = normalizeCheckDayOfMonth(config.checkDayOfMonth);
    const day = normalized === LAST_DAY_OF_MONTH ? "last" : addOrdinalSuffix(Number(normalized));
    return `Monthly ${day} ${time}`;
  }

  return `Daily ${time}`;
}
