/**
 * Canonical event names for the Adscan automation trigger.
 *
 * The trigger was originally registered as "New Competitor Ad Matches Filters"
 * (kept here as the legacy alias) and renamed to "New Competitor Ad" in
 * ADM-5914. Persisted automation rules created before the rename still hold
 * the legacy event string in their flow JSON, so dispatch/match/render code
 * accepts BOTH values via the helpers below.
 */

export const ADSCAN_SERVICE = "adscan" as const;

export const ADSCAN_NEW_COMPETITOR_AD_EVENT = "New Competitor Ad" as const;

/** Legacy event name persisted on rules created before ADM-5914. */
export const ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY = "New Competitor Ad Matches Filters" as const;

export const ADSCAN_NEW_COMPETITOR_AD_EVENT_NAMES: readonly string[] = [
  ADSCAN_NEW_COMPETITOR_AD_EVENT,
  ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY,
] as const;

/** True when `event` matches the canonical name or its legacy alias. */
export function isAdscanNewCompetitorAdEvent(event: string | null | undefined): boolean {
  if (!event) return false;
  return event === ADSCAN_NEW_COMPETITOR_AD_EVENT || event === ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY;
}

/** Canonical event for the advertiser-launch-volume trigger (ADM-5938). */
export const ADSCAN_ADVERTISER_LAUNCH_VOLUME_EVENT = "Advertiser Launch Volume" as const;

/**
 * Default rolling window (days) for the advertiser-launch-volume trigger.
 * Centralised here so the executor, summary helpers, and config form stay in
 * sync — see ADM-5938.
 */
export const ADSCAN_LAUNCH_VOLUME_DEFAULT_WINDOW_DAYS = 30 as const;

export function isAdscanAdvertiserLaunchVolumeEvent(event: string | null | undefined): boolean {
  return event === ADSCAN_ADVERTISER_LAUNCH_VOLUME_EVENT;
}

/**
 * Normalise an event string for display: legacy adscan rules render as the
 * new name. All other event strings are returned unchanged.
 */
export function normalizeAdscanEventForDisplay(event: string | null | undefined): string | null | undefined {
  if (event === ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY) return ADSCAN_NEW_COMPETITOR_AD_EVENT;
  return event;
}
