/**
 * Time-of-day greeting for the Automate empty state.
 *
 * Clock is injected so the greeting is testable and the caller decides which
 * zone it reads — the user's own, not the server's.
 */

const MORNING_ENDS_AT_HOUR = 12;
const AFTERNOON_ENDS_AT_HOUR = 18;

export function getTimeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < MORNING_ENDS_AT_HOUR) return "Good morning";
  if (hour < AFTERNOON_ENDS_AT_HOUR) return "Good afternoon";
  return "Good evening";
}

/**
 * First name for the greeting, or null when we only have an opaque identifier.
 *
 * Falls back to the local part of an email address, but only when it reads like
 * a name — "Good morning, sales.eu.team1!" is worse than no name at all.
 */
export function getGreetingName(fullName: string | null | undefined, email: string | null | undefined): string | null {
  const firstName = fullName?.trim().split(/\s+/)[0];
  if (firstName && /^[\p{L}'-]{2,}$/u.test(firstName)) return firstName;

  const localPart = email?.split("@")[0]?.trim();
  if (localPart && /^[\p{L}'-]{2,}$/u.test(localPart)) {
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  return null;
}

/** "Good morning, Dan!" or "Good morning!" when no usable name is available. */
export function buildGreeting(
  now: Date,
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = getGreetingName(fullName, email);
  return name ? `${getTimeOfDayGreeting(now)}, ${name}!` : `${getTimeOfDayGreeting(now)}!`;
}
