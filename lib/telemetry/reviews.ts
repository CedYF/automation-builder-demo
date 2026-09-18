"use client";

/** Review labels a product engineer attaches to a dashboard attempt (separate from raw events). */

export type ReviewLabel = "looks_fine" | "friction" | "bug" | "needs_eval";

export interface AttemptReview {
  readonly attemptId: string;
  readonly label: ReviewLabel;
  readonly note: string;
  readonly convertedToEval: boolean;
  readonly reviewedAt: string;
}

const STORAGE_KEY = "automation_telemetry_reviews_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function listReviews(): Record<string, AttemptReview> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AttemptReview>) : {};
  } catch {
    return {};
  }
}

export function saveReview(review: AttemptReview): void {
  if (!isBrowser()) return;
  const all = listReviews();
  all[review.attemptId] = review;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // best effort
  }
}

export function clearReviews(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best effort
  }
}
