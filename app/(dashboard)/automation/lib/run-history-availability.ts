/**
 * Whether the "Run history" entry points can be opened, and — when they can't —
 * the reason to show the user.
 *
 * Run history was previously disabled with no explanation at all: on a draft
 * that has never been saved the button, the menu item and the run-menu entry
 * all went grey and said nothing, which reads as a broken button rather than
 * "there is nothing to show yet".
 */

export type RunHistoryStatus = "loading" | "ready" | "error";

export interface RunHistoryAvailabilityInput {
  /** Persisted automation id — null while the automation is still a draft. */
  readonly existingRuleId: number | null;
  /** Editor identity status; history can't resolve a rule id until it is ready. */
  readonly identityStatus: RunHistoryStatus;
  /** Identity load error, surfaced verbatim so the user sees the real problem. */
  readonly identityError?: string;
}

export interface RunHistoryAvailability {
  readonly isAvailable: boolean;
  /** Null when available; otherwise a complete sentence explaining why not. */
  readonly blockedReason: string | null;
}

const LOADING_REASON = "Still loading this automation. Run history opens as soon as it has finished loading.";
const UNSAVED_REASON =
  "Save this automation first. Run history starts once it has been saved, so a draft has none yet.";

/** Resolve whether run history can be opened, with a user-facing reason when it can't. */
export function getRunHistoryAvailability(input: RunHistoryAvailabilityInput): RunHistoryAvailability {
  if (input.identityStatus === "error") {
    return {
      isAvailable: false,
      blockedReason: input.identityError || "This automation could not be loaded, so its run history is unavailable.",
    };
  }
  if (input.identityStatus === "loading") {
    return { isAvailable: false, blockedReason: LOADING_REASON };
  }
  if (input.existingRuleId === null) {
    return { isAvailable: false, blockedReason: UNSAVED_REASON };
  }
  return { isAvailable: true, blockedReason: null };
}

/** Tooltip/title text for a run-history control — the blocker if there is one, otherwise the plain label. */
export function getRunHistoryTitle(availability: RunHistoryAvailability, label = "Run history"): string {
  return availability.blockedReason ?? label;
}
