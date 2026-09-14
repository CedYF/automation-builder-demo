/**
 * Human cadence label for the Automate home list sub-line.
 *
 * Reads the same fields the cron matches on: a polling trigger keeps its cadence
 * in the trigger node's `checkFrequency`, while scheduled rules keep theirs in
 * the rule columns. Event-driven triggers have no cadence at all and are
 * described by what fires them instead.
 */

import { formatCustomIntervalLabel, isCustomCheckFrequency } from "./custom-interval";

/** Trigger-service ids whose rules react to an event rather than a clock. */
const EVENT_TRIGGER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "media-library": "On upload",
  admanage: "On ad launch",
  "google-drive": "On new file",
  "google-sheets": "On sheet change",
  notion: "On Notion change",
  monday: "On Monday change",
  adscan: "On competitor ad",
});

const WEEKDAY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
});

export interface AutomationCadenceInput {
  /** Rule-level frequency column. */
  readonly frequency: string | null;
  /** Trigger node's `checkFrequency`, which wins when present. */
  readonly checkFrequency: string | null;
  /** Custom-interval count, read only when `checkFrequency` is "custom" (ADM-11829). */
  readonly intervalValue?: number | string | null;
  /** Custom-interval unit, paired with `intervalValue`. */
  readonly intervalUnit?: string | null;
  readonly scheduledTime: string | null;
  readonly checkTime: string | null;
  readonly dayOfWeek: string | null;
  readonly checkDays: readonly string[] | null;
  readonly dayOfMonth: string | null;
  readonly checkDayOfMonth: string | null;
  readonly triggerService: string | null;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeWeekday(dayOfWeek: string | null, checkDays: readonly string[] | null): string | null {
  const day = checkDays?.[0] ?? dayOfWeek;
  if (!day) return null;
  return WEEKDAY_LABELS[day.toLowerCase()] ?? capitalise(day);
}

function describeDayOfMonth(dayOfMonth: string | null, checkDayOfMonth: string | null): string | null {
  const day = checkDayOfMonth ?? dayOfMonth;
  if (!day) return null;
  return day === "last" ? "last day" : `day ${day}`;
}

function appendTime(label: string, time: string | null): string {
  return time ? `${label} ${time}` : label;
}

/**
 * Builds the cadence label, or null when the rule runs only on the Run button
 * so the caller can omit the segment rather than print "Manual".
 */
export function formatAutomationCadence(input: AutomationCadenceInput): string | null {
  const cadence = input.checkFrequency ?? input.frequency;
  const time = input.checkTime ?? input.scheduledTime;

  if (isCustomCheckFrequency(cadence)) {
    return formatCustomIntervalLabel({ intervalValue: input.intervalValue, intervalUnit: input.intervalUnit });
  }

  switch (cadence) {
    case "every-5-min":
      return "Every 5 minutes";
    case "hourly":
      return "Every hour";
    case "daily":
      return appendTime("Daily", time);
    case "weekly": {
      const day = describeWeekday(input.dayOfWeek, input.checkDays);
      return appendTime(day ? `Weekly on ${day}` : "Weekly", time);
    }
    case "monthly": {
      const day = describeDayOfMonth(input.dayOfMonth, input.checkDayOfMonth);
      return appendTime(day ? `Monthly on ${day}` : "Monthly", time);
    }
    case "continuous":
      return "Continuous";
    // Comment automations fire on the comment webhook as it arrives. "Realtime"
    // is the word the builder's trigger uses, so the list says the same thing.
    case "realtime":
      return "Realtime";
    case "one-time":
      return appendTime("One-time", time);
    case "manual":
      return "Manual only";
    case "event":
    default:
      break;
  }

  if (input.triggerService) {
    const eventLabel = EVENT_TRIGGER_LABELS[input.triggerService];
    if (eventLabel) return eventLabel;
  }

  return cadence === "event" ? "On event" : null;
}
