/**
 * Types and constants for the AppLovin/Axon Reporting API.
 *
 * Docs: https://support.axon.ai/en/growth/promoting-your-apps/api/reporting-api
 *
 * Two concepts here:
 *   - "Raw row" mirrors the wire shape (snake_case, all fields optional because
 *     we request a subset of columns each call).
 *   - "Normalized row" is what callers consume (camelCase, numeric fields
 *     coerced to `number`, missing fields collapsed to `null` / 0).
 */

export const AXON_REPORT_BASE_URL = "https://r.applovin.com/report" as const;
export const AXON_REPORT_FORMAT = "json" as const;
export const AXON_REPORT_TYPE_ADVERTISER = "advertiser" as const;
export const AXON_MAX_WINDOW_DAYS = 45;
export const AXON_REPORT_DEFAULT_DAYS = 30;
export const AXON_REPORT_DEFAULT_TIMEOUT_MS = 30_000;

export const AXON_REPORT_COLUMNS = {
  day: "day",
  campaign: "campaign",
  campaignIdExternal: "campaign_id_external",
  campaignType: "campaign_type",
  creativeSet: "creative_set",
  creativeSetId: "creative_set_id",
  ad: "ad",
  impressions: "impressions",
  clicks: "clicks",
  ctr: "ctr",
  conversions: "conversions",
  conversionRate: "conversion_rate",
  cost: "cost",
  averageCpa: "average_cpa",
  averageCpc: "average_cpc",
  roas7d: "roas_7d",
  adRoas7d: "ad_roas_7d",
  iapRoas7d: "iap_roas_7d",
  roas0d: "roas_0d",
  ncD0Roas: "nc_d0_roas",
  ncPercentD0Checkouts: "nc_percent_d0_checkouts",
  cpp7d: "cpp_7d",
  costPerTargetEvent7d: "cost_per_target_event_7d",
} as const;

export type AxonReportColumnKey = keyof typeof AXON_REPORT_COLUMNS;
export type AxonReportColumn = (typeof AXON_REPORT_COLUMNS)[AxonReportColumnKey];

/**
 * AppLovin `campaign_type` values. See docs §"Allowed advertiser columns".
 * The literal strings come straight from the API and include a space in
 * "ad ROAS" / "IAP ROAS", so we keep them verbatim.
 */
export const AXON_CAMPAIGN_TYPES = {
  CPP: "CPP",
  CPE: "CPE",
  AD_ROAS: "ad ROAS",
  IAP_ROAS: "IAP ROAS",
  ROAS: "ROAS",
} as const;

export type AxonCampaignType = (typeof AXON_CAMPAIGN_TYPES)[keyof typeof AXON_CAMPAIGN_TYPES];

/**
 * Raw row from AppLovin. All fields optional — only the columns we request
 * in the query come back populated. Numeric fields arrive as numbers in JSON.
 */
export interface AxonReportRawRow {
  day?: string;
  campaign?: string;
  campaign_id_external?: string;
  campaign_type?: string;
  creative_set?: string;
  creative_set_id?: string;
  ad?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  conversions?: number;
  conversion_rate?: number;
  cost?: number;
  average_cpa?: number;
  average_cpc?: number;
  roas_7d?: number;
  ad_roas_7d?: number;
  iap_roas_7d?: number;
  roas_0d?: number;
  nc_d0_roas?: number;
  nc_percent_d0_checkouts?: number;
  cpp_7d?: number;
  cost_per_target_event_7d?: number;
}

/**
 * Normalized row used inside admanage. Missing string fields become `null`,
 * missing numeric counters become `0` (so summing is safe), missing rate-style
 * metrics stay `null` so callers can distinguish "no data" from "zero".
 */
export interface AxonReportRow {
  day: string | null;
  campaign: string | null;
  campaignIdExternal: string | null;
  campaignType: AxonCampaignType | null;
  creativeSet: string | null;
  creativeSetId: string | null;
  ad: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  averageCpc: number | null;
  roas7d: number | null;
  adRoas7d: number | null;
  iapRoas7d: number | null;
  roas0d: number | null;
  ncD0Roas: number | null;
  ncPercentD0Checkouts: number | null;
  cpp7d: number | null;
  costPerTargetEvent7d: number | null;
}

/**
 * Aggregated KPI metrics for a single entity (campaign, creative set, etc.).
 * `ctr` and `averageCpa` are computed from sums (weighted by impressions /
 * conversions respectively), never averaged-of-averages.
 *
 * `roas7d` is cost-weighted across rows and picked from the appropriate column
 * for the entity's `campaignType` (see `pickRoasColumnForCampaignType`).
 */
export interface AxonKpiMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  averageCpa: number | null;
  roas7d: number | null;
}

/**
 * Extended KPI surface that adds the four new Axon Reporting API columns plus
 * the derived `cpm` field on top of `AxonKpiMetrics`. Used by campaign and
 * creative-set KPIs so the manage UI can render the wider column set.
 *
 * Field semantics:
 *  - `cpc`: sum-derived (`totals.cost / totals.clicks`), NOT a cost-weighted
 *    mean of per-row CPCs. Matches the convention used for CTR / CPA.
 *  - `cpm`: sum-derived (`totals.cost / totals.impressions * 1000`).
 *  - `d0Roas`, `ncD0Roas`, `ncPercentD0Checkouts`, `costPerTargetEvent7d`:
 *    cost-weighted across rows, mirroring the existing `roas7d` aggregation.
 */
export interface AxonKpiExtendedMetrics extends AxonKpiMetrics {
  cpc: number | null;
  cpm: number | null;
  d0Roas: number | null;
  ncD0Roas: number | null;
  ncPercentD0Checkouts: number | null;
  /** Cost per 7-day target event (the campaign's optimization event, e.g. a trial). Cost-weighted. */
  costPerTargetEvent7d: number | null;
}

export interface AxonCampaignKpi extends AxonKpiExtendedMetrics {
  campaignIdExternal: string;
  campaignName: string;
  campaignType: AxonCampaignType | null;
}

export interface AxonCreativeSetKpi extends AxonKpiExtendedMetrics {
  creativeSetId: string;
  creativeSetName: string;
  campaignIdExternal: string | null;
  campaignName: string | null;
  campaignType: AxonCampaignType | null;
}

export type AxonReportingErrorCode =
  | "WINDOW_TOO_LARGE"
  | "INVALID_DATE"
  | "MISSING_REPORT_KEY"
  | "REQUEST_FAILED"
  | "PARSE_ERROR"
  | "TIMEOUT";

export class AxonReportingError extends Error {
  public readonly code: AxonReportingErrorCode;
  public readonly context: Readonly<Record<string, unknown>>;
  public readonly cause?: Error;

  constructor(message: string, code: AxonReportingErrorCode, context: Record<string, unknown> = {}, cause?: Error) {
    super(message);
    this.name = "AxonReportingError";
    this.code = code;
    this.context = Object.freeze({ ...context });
    this.cause = cause;
  }
}
