/**
 * Backoff ladder for a retryable automation upload: 30m, 60m, 2h, 4h, then stop.
 *
 * Roughly a day of patience for a transient problem, and none at all for a
 * permanent one. Each step writes `nextAttemptAt` forward — unlike
 * `DelayedExecution`, whose `attemptCount` increments without ever moving
 * `resumeAt`, so its "retry" fires again on the very next cron tick.
 */
const LADDER_MS = [30 * 60_000, 60 * 60_000, 120 * 60_000, 240 * 60_000] as const;

/** Attempts allowed in total: every rung of the ladder, plus the first try. */
export const MAX_UPLOAD_ATTEMPTS = LADDER_MS.length + 1;

/**
 * Delay before the next attempt.
 *
 * @param attemptsMade - Attempts already made, including the one that just failed.
 * @returns Milliseconds to wait, or null when no attempts remain.
 */
export function nextAttemptDelayMs(attemptsMade: number): number | null {
  const rung = attemptsMade - 1;
  if (!Number.isInteger(rung) || rung < 0 || rung >= LADDER_MS.length) return null;
  return LADDER_MS[rung];
}

/**
 * Absolute time of the next attempt.
 *
 * @param attemptsMade - Attempts already made, including the one that just failed.
 * @param now - Current time.
 * @returns When to retry, or null when the ladder is exhausted.
 */
export function computeNextAttemptAt(attemptsMade: number, now: Date): Date | null {
  const delay = nextAttemptDelayMs(attemptsMade);
  if (delay === null) return null;
  return new Date(now.getTime() + delay);
}
