import type { AutomationNode } from "../contexts/automation-context";
import {
  DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY,
  DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY,
  getPerformanceMonitoringComparisonLabel,
  normalizePerformanceMonitoringComparisonWindow,
  normalizePerformanceMonitoringWeekday,
} from "@/lib/automation/performance-monitoring-date-range";
import { criteriaUsesConversionEvent } from "@/lib/automation/criteria-groups";
import { AD_AGE_METRIC, formatAdAgeValue } from "@/types/automation-metrics";
import {
  ADSCAN_LAUNCH_VOLUME_DEFAULT_WINDOW_DAYS,
  ADSCAN_SERVICE,
  isAdscanAdvertiserLaunchVolumeEvent,
  isAdscanNewCompetitorAdEvent,
} from "./adscan-events";
import { summarizePollingSchedule } from "./polling-run-time";
import { MODERATION_LABEL } from "@/app/(dashboard)/comments/_features/automation/utils/moderation-labels";
import { intentLabel } from "@/app/(dashboard)/comments/_features/automation/utils/intent-labels";
import {
  formatCommentScheduleBadge,
  isCommentsScheduledTriggerEvent,
  readCommentScheduleFields,
} from "./comment-flow-mapper";
import {
  getToneValueLabel,
  inferToneValue,
  isToneConditionActive,
  type ToneConditionValue,
} from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";

export interface SummaryBadge {
  label: string;
  tone?: "primary" | "muted" | "warning";
  /** Full list of selected options a collapsed count label (e.g. "3 categories") stands in for. Shown on hover. */
  details?: string[];
}

export interface NodeSummary {
  /** Human-readable one-line subtitle (e.g. "Daily 9am · Campaign level"). */
  subtitle?: string;
  /** Short badges rendered on the flow-card / preview (e.g. "ROAS drops >20%", "All campaigns", "min £50"). */
  badges: SummaryBadge[];
  /** Level scope ("Account level", "Campaign level", "Ad set level", "Ad level") if applicable. */
  levelLabel?: string;
  /** Primary condition summary line (e.g. "ROAS drops >20% vs prior period"). */
  conditionSummary?: string;
  /** Scope summary (e.g. "All campaigns", "Summer Sale", "Contains: Scaling"). */
  scopeSummary?: string;
  /** Recipient / destination summary ("Email + In-app · ced@admanage.ai"). */
  destinationSummary?: string;
  /** Human-readable run cadence ("Daily 9am", "Hourly", "Every 5 minutes"). */
  frequencyLabel?: string;
}

const METRIC_LABELS: Record<string, string> = {
  spend: "Spend",
  cpa: "CPA",
  roas: "ROAS",
  cpm: "CPM",
  cpc: "CPC",
  ctr: "CTR",
  impressions: "Impressions",
  conversions: "Conversions",
  appInstalls: "App Installs",
  cost_per_subscriber: "CPS",
  adAge: "Ad Age",
  adName: "Ad name",
};

// Performance Monitoring's "cpa" resolves to Meta's `cost_per_result` (objective-dependent),
// which is distinct from Performance Threshold's purchase-based CPA. Label it accurately on the
// monitoring node card so the two triggers don't look identical (ADM-7527).
const MONITORING_METRIC_LABELS: Record<string, string> = {
  ...METRIC_LABELS,
  cpa: "Cost per Result",
};

const DIRECTION_SYMBOLS: Record<string, string> = {
  increases: "rises >",
  decreases: "drops >",
  changes: "changes >",
  above: "above",
  below: "below",
};

const TEXT_OPERATOR_LABELS: Record<string, string> = {
  contains: "contains",
  not_contains: "doesn't contain",
  equals: "equals",
  starts_with: "starts with",
  ends_with: "ends with",
};

const LEVEL_LABELS: Record<string, string> = {
  account: "Account level",
  campaign: "Campaign level",
  adset: "Ad set level",
  ad: "Ad level",
};

/**
 * Labels for cadences with no per-rule slot. Daily/weekly/monthly are omitted
 * on purpose: their label depends on the rule's own run hour, weekdays and day
 * of month, so it is computed by {@link summarizePollingSchedule} instead of
 * hardcoded here (this table used to claim "Daily 9am" / "Weekly Mon" for every
 * rule, which stopped being true with ADM-9818 and ADM-10118).
 */
const FREQUENCY_LABELS: Record<string, string> = {
  manual: "Manual",
  "every-5-min": "Every 5 min",
  hourly: "Hourly",
  "one-time": "One-time",
};

/**
 * Short "when does this run" label for a trigger node's config.
 *
 * @returns The label, or undefined when the config carries no cadence at all.
 */
function describeFrequencyBadge(config: Record<string, unknown>): string | undefined {
  const checkFrequency = config.checkFrequency ?? config.frequency;
  return (
    summarizePollingSchedule({ ...config, checkFrequency }) ?? FREQUENCY_LABELS[checkFrequency as string] ?? undefined
  );
}

const ADSCAN_PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
};

const ADSCAN_FORMAT_LABELS: Record<string, string> = {
  video: "Video",
  image: "Image",
  carousel: "Carousel",
  dco: "Dynamic creative",
  dpa: "Catalog",
  other: "Other",
};

const ADSCAN_SEARCH_QUERY_MAX_CHARS = 24;

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatCompactNumber(n: number): string {
  return COMPACT_NUMBER_FORMATTER.format(n);
}

function formatViewsRange(min: number | null | undefined, max: number | null | undefined): string | null {
  const hasMin = typeof min === "number" && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `${formatCompactNumber(min)}–${formatCompactNumber(max)} views`;
  if (hasMin) return `≥${formatCompactNumber(min)} views`;
  if (hasMax) return `≤${formatCompactNumber(max)} views`;
  return null;
}

function formatSpendRange(min: number | null | undefined, max: number | null | undefined): string | null {
  const hasMin = typeof min === "number" && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `$${formatCompactNumber(min)}–$${formatCompactNumber(max)} spend`;
  if (hasMin) return `≥$${formatCompactNumber(min)} spend`;
  if (hasMax) return `≤$${formatCompactNumber(max)} spend`;
  return null;
}

/**
 * Render the US-rank cutoff badge for the `us_ranking` criterion (ADM-5955).
 * Mirrors `formatViewsRange` shape — returns `null` when no bound is set so
 * the caller can skip pushing an empty badge.
 *
 * Examples: `min=1, max=1` → `"#1 US"`; `min=1, max=10` → `"Top 10 US"`;
 * `min=5, max=20` → `"#5–20 US"`.
 */
function formatUsRankRange(min: number | null | undefined, max: number | null | undefined): string | null {
  const hasMin = typeof min === "number" && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) {
    if (min === max) return `#${min} US`;
    if (min === 1) return `Top ${max} US`;
    return `#${min}–${max} US`;
  }
  if (hasMax) return max === 1 ? "#1 US" : `Top ${max} US`;
  if (hasMin) return `≥#${min} US`;
  return null;
}

function joinList(items: readonly string[], maxInline: number): string | null {
  const filtered = items.filter((s) => typeof s === "string" && s.trim() !== "");
  if (filtered.length === 0) return null;
  if (filtered.length <= maxInline) return filtered.join(", ");
  return `${filtered.slice(0, maxInline).join(", ")} +${filtered.length - maxInline}`;
}

function formatCondition(c: { metric?: string; direction?: string; percentage?: number | null }): string | null {
  if (!c.metric || !c.direction) return null;
  const metric = MONITORING_METRIC_LABELS[c.metric] ?? c.metric;
  const direction = DIRECTION_SYMBOLS[c.direction] ?? c.direction;
  const pct = c.percentage;
  if (pct == null || Number.isNaN(pct)) return `${metric} ${direction}`;
  return `${metric} ${direction}${pct}%`;
}

function getCurrencySymbol(currency: string | undefined): string {
  switch (currency) {
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "USD":
    default:
      return "$";
  }
}

function formatCriteriaOperator(operator: string, isTextMetric: boolean): string {
  if (!isTextMetric) return operator;
  return TEXT_OPERATOR_LABELS[operator] ?? operator;
}

function getScopeLabel(config: Record<string, any> | undefined): string | null {
  if (!config) return null;
  const level: string | undefined = config.monitoringLevel;
  if (!level || level === "account") {
    const ids: string[] = config.accountIds || (config.accountId ? [config.accountId] : []);
    if (ids.length > 1) return `${ids.length} accounts`;
    return config.accountName ? `Account: ${config.accountName}` : "Entire account";
  }
  const levelNoun = level === "campaign" ? "campaigns" : level === "adset" ? "ad sets" : "ads";
  const filterType = config.campaignNameFilterType;
  if (filterType === "specific") {
    return config.monitoringCampaignName || `1 ${levelNoun.slice(0, -1)}`;
  }
  if (filterType === "contains" && config.campaignNameFilter) {
    return `Contains "${config.campaignNameFilter}"`;
  }
  if (filterType === "equals" && config.campaignNameFilter) {
    return `Equals "${config.campaignNameFilter}"`;
  }
  return `All ${levelNoun}`;
}

/**
 * Optional context passed to summarize* — currently used to resolve workspace
 * custom metric IDs into friendly names. Caller fetches via React hooks; the
 * summary functions stay pure.
 */
export interface NodeSummaryContext {
  /** Map of `custom_<id>` → display name. Anything not in here falls back to the raw id. */
  customMetricsById?: Record<string, string>;
}

interface AdscanAdvertiser {
  id?: string;
  name?: string;
}

/**
 * Pushes the badges that summarise an Adscan "New Competitor Ad" trigger
 * config onto the provided list. Mutates `badges` in place to mirror the
 * sibling trigger branches in `summarizeTrigger`.
 */
function summarizeAdscanCompetitorTrigger(config: Record<string, any>, badges: SummaryBadge[]): void {
  const advertisers: AdscanAdvertiser[] = Array.isArray(config.adscanAdvertisers) ? config.adscanAdvertisers : [];
  const advertiserNames = advertisers.map((a) => a?.name).filter((n): n is string => typeof n === "string" && n !== "");
  if (advertiserNames.length === 1) {
    badges.push({ label: advertiserNames[0], tone: "primary" });
  } else if (advertiserNames.length > 1) {
    badges.push({
      label: `${advertiserNames[0]} +${advertiserNames.length - 1}`,
      tone: "primary",
      details: advertiserNames,
    });
  }

  const platforms: string[] = Array.isArray(config.adscanPlatforms) ? config.adscanPlatforms : [];
  const platformLabel = joinList(
    platforms.map((p) => ADSCAN_PLATFORM_LABELS[p] ?? p),
    2,
  );
  if (platformLabel) badges.push({ label: platformLabel, tone: "primary" });

  const formats: string[] = Array.isArray(config.adscanFormats) ? config.adscanFormats : [];
  const formatLabel = joinList(
    formats.map((f) => ADSCAN_FORMAT_LABELS[f] ?? f),
    3,
  );
  if (formatLabel) badges.push({ label: formatLabel, tone: "primary" });

  // ADM-5955: criterion is mutually exclusive — only render the active tab's
  // bound badges. `views_spend` (UK/EU) and `us_ranking` (US-only) bind to
  // different upstream filters; mixing badges would mislead the user about
  // what the rule actually fires on. Default to `views_spend` for legacy
  // configs without the discriminator field.
  const criterion = config.adscanCriterion === "us_ranking" ? "us_ranking" : "views_spend";
  if (criterion === "us_ranking") {
    const usRankLabel = formatUsRankRange(config.adscanUsRankMin, config.adscanUsRankMax);
    if (usRankLabel) badges.push({ label: usRankLabel, tone: "primary" });
  } else {
    const viewsLabel = formatViewsRange(config.adscanViewsMin, config.adscanViewsMax);
    if (viewsLabel) badges.push({ label: viewsLabel, tone: "primary" });

    const spendLabel = formatSpendRange(config.adscanSpendMin, config.adscanSpendMax);
    if (spendLabel) badges.push({ label: spendLabel, tone: "primary" });
  }

  const languages: string[] = Array.isArray(config.adscanLanguages) ? config.adscanLanguages : [];
  const langLabel = joinList(languages, 3);
  if (langLabel) badges.push({ label: langLabel, tone: "primary" });

  const ctas: string[] = Array.isArray(config.adscanCtaTypes) ? config.adscanCtaTypes : [];
  const ctaLabel = joinList(ctas, 2);
  if (ctaLabel) badges.push({ label: `CTA: ${ctaLabel}`, tone: "primary" });

  const query = typeof config.adscanSearchQuery === "string" ? config.adscanSearchQuery.trim() : "";
  if (query) {
    const truncated =
      query.length > ADSCAN_SEARCH_QUERY_MAX_CHARS ? `${query.slice(0, ADSCAN_SEARCH_QUERY_MAX_CHARS)}…` : query;
    badges.push({ label: `Search: "${truncated}"`, tone: "primary" });
  }

  const freqLabel = describeFrequencyBadge(config);
  if (freqLabel) badges.push({ label: freqLabel, tone: "muted" });
}

/**
 * Pushes the badges that summarise an Adscan "Advertiser Launch Volume"
 * trigger config (ADM-5938). Mirrors `summarizeAdscanCompetitorTrigger` —
 * leading advertiser badge, threshold badge, frequency badge.
 */
function summarizeAdscanLaunchVolumeTrigger(config: Record<string, any>, badges: SummaryBadge[]): void {
  const advertisers: AdscanAdvertiser[] = Array.isArray(config.adscanLaunchVolumeAdvertisers)
    ? config.adscanLaunchVolumeAdvertisers
    : [];
  const advertiserNames = advertisers.map((a) => a?.name).filter((n): n is string => typeof n === "string" && n !== "");
  if (advertiserNames.length === 1) {
    badges.push({ label: advertiserNames[0], tone: "primary" });
  } else if (advertiserNames.length > 1) {
    badges.push({
      label: `${advertiserNames[0]} +${advertiserNames.length - 1}`,
      tone: "primary",
      details: advertiserNames,
    });
  }

  const minCount = config.adscanLaunchVolumeMinCount;
  const windowDays = config.adscanLaunchVolumeWindowDays;
  if (typeof minCount === "number" && minCount > 0) {
    const days =
      typeof windowDays === "number" && windowDays > 0 ? windowDays : ADSCAN_LAUNCH_VOLUME_DEFAULT_WINDOW_DAYS;
    badges.push({ label: `≥${minCount} ads / ${days}d`, tone: "primary" });
  }

  const freqLabel = describeFrequencyBadge(config);
  if (freqLabel) badges.push({ label: freqLabel, tone: "muted" });
}

function summarizeTrigger(node: AutomationNode, ctx: NodeSummaryContext = {}): NodeSummary {
  const config = node.config || {};
  const badges: SummaryBadge[] = [];
  let conditionSummary: string | undefined;
  let scopeSummary: string | undefined;
  let levelLabel: string | undefined;

  if (node.service === "meta-ads" && node.event === "Performance Monitoring") {
    levelLabel = LEVEL_LABELS[config.monitoringLevel || "account"];
    const conditions = (config.monitoringConditions as any[] | undefined) || [];
    const primary = conditions[0] || {
      metric: config.monitoringMetric,
      direction: config.monitoringDirection,
      percentage: config.monitoringPercentage,
    };
    const primaryTxt = formatCondition(primary);
    if (primaryTxt) {
      conditionSummary = `${primaryTxt}${conditions.length > 1 ? ` +${conditions.length - 1}` : ""} vs prior period`;
      badges.push({ label: primaryTxt, tone: "primary" });
    }
    const scope = getScopeLabel(config);
    if (scope) {
      scopeSummary = scope;
      badges.push({ label: scope, tone: "primary" });
    }
    const minSpend = config.minDailySpend ?? config.minimumSpend ?? config.minSpend;
    if (minSpend != null && minSpend !== "") {
      const sym = getCurrencySymbol(config.accountCurrency);
      badges.push({ label: `min ${sym}${minSpend}`, tone: "primary" });
    }
    const comparisonWindow = normalizePerformanceMonitoringComparisonWindow(config.monitoringComparisonWindow);
    const compareWindow =
      comparisonWindow === "day"
        ? "Day over Day"
        : comparisonWindow === "week"
          ? "Week over Week"
          : getPerformanceMonitoringComparisonLabel(
              comparisonWindow,
              normalizePerformanceMonitoringWeekday(
                config.monitoringCustomRangeStartDay,
                DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY,
              ),
              normalizePerformanceMonitoringWeekday(
                config.monitoringCustomRangeEndDay,
                DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY,
              ),
            );
    badges.push({ label: compareWindow, tone: "muted" });
    // Check frequency badge — surfaces how often this trigger runs
    const freqLabel = describeFrequencyBadge(config);
    if (freqLabel) {
      badges.push({ label: freqLabel, tone: "muted" });
    }
  } else if (node.service === "meta-ads" && node.event === "Performance Threshold") {
    const criteria = (config.criteria as any) || {};
    const conditions: any[] = Array.isArray(criteria.conditions) ? criteria.conditions : [];
    const logic: string = criteria.logic || "AND";
    const lookback = criteria.lookbackDays;
    const sym = getCurrencySymbol(config.accountCurrency);

    if (lookback != null) badges.push({ label: `Last ${lookback} days`, tone: "primary" });

    // Campaign / ad-set / ad scope
    const campaignScope = (() => {
      const t = config.campaignNameFilterType;
      if (!t || t === "all") return "All campaigns";
      if (t === "specific" && config.monitoringCampaignName) return config.monitoringCampaignName;
      if (config.campaignNameFilter) return `Campaign ${t}: ${config.campaignNameFilter}`;
      return null;
    })();
    const adSetScope = (() => {
      const t = config.adSetFilterType;
      if (!t || t === "all") return "All ad sets";
      if (t === "contains" && config.adSetNameFilter) return `Ad sets contain "${config.adSetNameFilter}"`;
      if (t === "not_contains" && config.adSetNameFilter) return `Ad sets do not contain "${config.adSetNameFilter}"`;
      return null;
    })();
    const adScope = (() => {
      const t = config.adNameFilterType;
      if (!t || t === "all") return "All ads";
      if (config.adNameFilter) return `Ads ${t}: ${config.adNameFilter}`;
      return null;
    })();
    if (campaignScope) badges.push({ label: campaignScope, tone: "primary" });
    if (adSetScope) badges.push({ label: adSetScope, tone: "primary" });
    if (adScope) badges.push({ label: adScope, tone: "primary" });

    // Condition list (e.g. "CPA > 1.1", or "ROAS < avg × 70%" in average mode)
    const criteriaAggregation = criteria.aggregation;
    if (criteriaAggregation === "top_per_adset") {
      const rankMetric = typeof criteria.rankMetric === "string" ? criteria.rankMetric : "roas";
      const rankMetricLabel = METRIC_LABELS[rankMetric] ?? ctx.customMetricsById?.[rankMetric] ?? rankMetric;
      badges.push({ label: `Top ${rankMetricLabel} per ad set`, tone: "primary" });
    }
    const conditionParts: string[] = [];
    for (const c of conditions) {
      if (!c?.metric || !c?.operator) continue;
      const metricLabel = METRIC_LABELS[c.metric] ?? ctx.customMetricsById?.[c.metric] ?? c.metric;
      const isTextMetric = c.metric === "adName";
      const operatorLabel = formatCriteriaOperator(String(c.operator), isTextMetric);
      const isAvgMode =
        !isTextMetric &&
        (criteriaAggregation === "average" || (criteriaAggregation === "mixed" && c.aggregation === "average"));
      let valueLabel: string;
      if (isAvgMode) {
        const pct = c.averageThresholdPercent;
        valueLabel = typeof pct === "number" ? `avg × ${pct}%` : "avg";
      } else if (isTextMetric) {
        valueLabel = `"${c.value ?? ""}"`;
      } else if (c.metric === AD_AGE_METRIC) {
        // Ad Age stores canonical days; render in the saved display unit ("6 months").
        valueLabel = formatAdAgeValue(Number(c.value), c.valueUnit);
      } else {
        const value = c.value;
        const valueIsCurrency = c.metric === "cpa" || c.metric === "cpm" || c.metric === "cpc" || c.metric === "spend";
        valueLabel = valueIsCurrency && typeof value === "number" ? `${sym}${value}` : `${value}`;
      }
      const part = `${metricLabel} ${operatorLabel} ${valueLabel}`;
      conditionParts.push(part);
      badges.push({ label: part, tone: "primary" });
    }
    if (conditionParts.length > 0) {
      conditionSummary = conditionParts.join(` ${logic} `);
    }

    if (criteria.conversionEvent && criteria.conversionEvent !== "purchase" && criteriaUsesConversionEvent(criteria)) {
      badges.push({ label: criteria.conversionEvent, tone: "muted" });
    }
  } else if (node.service === "tiktok-ads" && node.event === "Performance Threshold") {
    const criteria = (config.criteria as any) || {};
    const conditions: any[] = Array.isArray(criteria.conditions) ? criteria.conditions : [];
    const logic: string = criteria.logic || "AND";
    const lookback = criteria.lookbackDays;
    const sym = getCurrencySymbol(config.accountCurrency);

    if (config.advertiserName) {
      badges.push({ label: String(config.advertiserName), tone: "primary" });
    } else if (config.advertiserId) {
      badges.push({ label: String(config.advertiserId), tone: "muted" });
    }

    if (lookback != null) badges.push({ label: `Last ${lookback} days`, tone: "primary" });

    const campaignScope = (() => {
      const t = config.campaignNameFilterType;
      if (!t || t === "all") return "All campaigns";
      if (config.campaignNameFilter) return `Campaign ${t}: ${config.campaignNameFilter}`;
      return null;
    })();
    const adGroupScope = (() => {
      const t = config.adGroupNameFilterType;
      if (!t || t === "all") return "All ad groups";
      if (config.adGroupNameFilter) return `Ad groups ${t}: ${config.adGroupNameFilter}`;
      return null;
    })();
    if (campaignScope) badges.push({ label: campaignScope, tone: "primary" });
    if (adGroupScope) badges.push({ label: adGroupScope, tone: "primary" });

    if (config.includeZeroDeliveryAds === true || config.includeZeroDeliveryAds === "true") {
      badges.push({ label: "Include no delivery", tone: "muted" });
    }

    const conditionParts: string[] = [];
    for (const c of conditions) {
      if (!c?.metric || !c?.operator) continue;
      const metricLabel = METRIC_LABELS[c.metric] ?? ctx.customMetricsById?.[c.metric] ?? c.metric;
      const isTextMetric = c.metric === "adName";
      const operatorLabel = formatCriteriaOperator(String(c.operator), isTextMetric);
      const value = c.value;
      const valueIsCurrency = c.metric === "cpa" || c.metric === "cpm" || c.metric === "cpc" || c.metric === "spend";
      const valueLabel = isTextMetric
        ? `"${c.value ?? ""}"`
        : valueIsCurrency && typeof value === "number"
          ? `${sym}${value}`
          : `${value}`;
      const part = `${metricLabel} ${operatorLabel} ${valueLabel}`;
      conditionParts.push(part);
      badges.push({ label: part, tone: "primary" });
    }
    if (conditionParts.length > 0) {
      conditionSummary = conditionParts.join(` ${logic} `);
    }
  } else if (node.service === "meta-ads" && node.event === "Best Performing Organic Post") {
    const metricLabels: Record<string, string> = {
      engagement: "Engagement",
      reactions: "Reactions",
      comments: "Comments",
      shares: "Shares",
      reach: "Reach",
      impressions: "Impressions",
      video_views: "Video Views",
    };
    const metricLabel = metricLabels[(config.metric as string) || "engagement"] ?? "Engagement";
    badges.push({ label: metricLabel, tone: "primary" });
    conditionSummary = `Best organic post by ${metricLabel.toLowerCase()}`;

    const lookback = config.lookbackDays;
    if (typeof lookback === "number" && lookback > 0) {
      badges.push({ label: `Last ${lookback} ${lookback === 1 ? "day" : "days"}`, tone: "primary" });
    }

    const topN = config.topN;
    if (typeof topN === "number" && topN > 1) {
      badges.push({ label: `Top ${topN}`, tone: "primary" });
    }

    const minMetric = config.minMetricValue;
    if (typeof minMetric === "number" && minMetric > 0) {
      badges.push({ label: `Min ${minMetric}`, tone: "muted" });
      conditionSummary = `${metricLabel} >= ${minMetric}`;
    }

    if (config.pageId) badges.push({ label: "Facebook", tone: "muted" });
    if (config.instaId) badges.push({ label: "Instagram", tone: "muted" });
  } else if (node.service === "meta-ads" && node.event === "Ad Approved") {
    if (config.accountName) badges.push({ label: config.accountName, tone: "primary" });
  } else if (node.service === "meta-ads" && node.event === "Campaign Status Change") {
    if (config.watchedStatus) badges.push({ label: `Status → ${config.watchedStatus}`, tone: "primary" });
  } else if (node.service === "scheduled") {
    const freq = config.frequency;
    if (freq === "weekly" && config.dayOfWeek) badges.push({ label: `Weekly · ${config.dayOfWeek}`, tone: "primary" });
    else if (freq === "monthly" && config.dayOfMonth)
      badges.push({ label: `Monthly · day ${config.dayOfMonth}`, tone: "primary" });
    else if (freq === "daily") badges.push({ label: "Daily", tone: "primary" });
    else if (freq === "hourly") badges.push({ label: "Hourly", tone: "primary" });
    else if (freq === "one-time" && config.scheduledDate)
      badges.push({ label: `${config.scheduledDate} ${config.scheduledTime || ""}`.trim(), tone: "primary" });
  } else if (node.service === "manual") {
    if (config.description) badges.push({ label: config.description, tone: "muted" });
  } else if (node.service === ADSCAN_SERVICE && isAdscanNewCompetitorAdEvent(node.event)) {
    summarizeAdscanCompetitorTrigger(config, badges);
  } else if (node.service === ADSCAN_SERVICE && isAdscanAdvertiserLaunchVolumeEvent(node.event)) {
    summarizeAdscanLaunchVolumeTrigger(config, badges);
  } else if (node.service === "comments") {
    summarizeCommentsTrigger(node.event, config, badges);
  }

  const commentSchedule = isCommentsScheduledTriggerEvent(node.event) ? readCommentScheduleFields(config) : null;
  const frequencyLabel = commentSchedule
    ? formatCommentScheduleBadge(commentSchedule.frequency, commentSchedule.scheduledTime)
    : describeFrequencyBadge(config);

  const subtitleParts = [frequencyLabel, levelLabel].filter(Boolean);

  return {
    subtitle: subtitleParts.join(" · ") || undefined,
    badges,
    levelLabel,
    conditionSummary,
    scopeSummary,
    frequencyLabel,
  };
}

function readCommentsToneValue(config: Record<string, unknown>): ToneConditionValue {
  const stored = config.toneValue;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const tone = stored as Partial<ToneConditionValue> & { mode?: string };
    if (tone.mode === "preset" && typeof (tone as { preset?: unknown }).preset === "string") {
      return tone as ToneConditionValue;
    }
    if (
      tone.mode === "score" &&
      typeof (tone as { operator?: unknown }).operator === "string" &&
      typeof (tone as { min?: unknown }).min === "number" &&
      typeof (tone as { max?: unknown }).max === "number"
    ) {
      return tone as ToneConditionValue;
    }
  }

  const conditions =
    config.conditions && typeof config.conditions === "object" && !Array.isArray(config.conditions)
      ? (config.conditions as { sentimentMin?: number; sentimentMax?: number })
      : undefined;
  return inferToneValue(conditions);
}

function formatCommentsToneBadge(tone: ToneConditionValue): string | null {
  if (!isToneConditionActive(tone)) return null;
  if (tone.mode === "preset") {
    return `Sentiment: ${getToneValueLabel(tone)}`;
  }
  if (tone.operator === "gt") return `Sentiment > ${tone.min}`;
  if (tone.operator === "lt") return `Sentiment < ${tone.max}`;
  return `Sentiment ${tone.min}–${tone.max}`;
}

function summarizeCommentsTrigger(
  event: string | undefined,
  config: Record<string, unknown>,
  badges: SummaryBadge[],
): void {
  const isScheduled = isCommentsScheduledTriggerEvent(event);
  if (isScheduled) {
    const schedule = readCommentScheduleFields(config);
    badges.push({ label: formatCommentScheduleBadge(schedule.frequency, schedule.scheduledTime), tone: "primary" });
  }
  const pageIds = Array.isArray(config.pageIds)
    ? config.pageIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (pageIds.length === 1) {
    badges.push({ label: "1 page", tone: "primary" });
  } else if (pageIds.length > 1) {
    badges.push({ label: `${pageIds.length} pages`, tone: "primary" });
  }

  if (config.platform === "instagram" || config.platform === "facebook") {
    badges.push({
      label: config.platform === "instagram" ? "Instagram" : "Facebook",
      tone: "muted",
    });
  }

  const conditions =
    config.conditions && typeof config.conditions === "object" && !Array.isArray(config.conditions)
      ? (config.conditions as Record<string, unknown>)
      : {};

  const keywords = Array.isArray(conditions.keywords)
    ? conditions.keywords.filter((k): k is string => typeof k === "string")
    : [];
  if (keywords.length === 1) {
    badges.push({ label: `Contains "${keywords[0]}"`, tone: "primary" });
  } else if (keywords.length > 1) {
    badges.push({ label: `Contains ${keywords.length} keywords`, tone: "primary", details: keywords });
  }

  const excludeKeywords = Array.isArray(conditions.excludeKeywords)
    ? conditions.excludeKeywords.filter((k): k is string => typeof k === "string")
    : [];
  if (excludeKeywords.length > 0) {
    badges.push({
      label:
        excludeKeywords.length === 1
          ? `Excludes "${excludeKeywords[0]}"`
          : `Excludes ${excludeKeywords.length} keywords`,
      tone: "muted",
      details: excludeKeywords.length > 1 ? excludeKeywords : undefined,
    });
  }

  const toneBadge = formatCommentsToneBadge(readCommentsToneValue(config));
  if (toneBadge) {
    badges.push({ label: toneBadge, tone: "primary" });
  }

  // Moderation verdicts are editable in /comments as well as here, so a rule
  // can arrive carrying one this card never set. Without a badge the collapsed
  // step under-describes what the rule actually matches.
  const moderationCategories = Array.isArray(conditions.moderationCategories)
    ? conditions.moderationCategories.filter((category): category is string => typeof category === "string")
    : [];
  if (moderationCategories.length === 1) {
    const label = MODERATION_LABEL[moderationCategories[0] as keyof typeof MODERATION_LABEL];
    badges.push({ label: `Flagged as ${label ?? moderationCategories[0]}`, tone: "primary" });
  } else if (moderationCategories.length > 1) {
    const categoryLabels = moderationCategories.map(
      (category) => MODERATION_LABEL[category as keyof typeof MODERATION_LABEL] ?? category,
    );
    badges.push({
      label: `Flagged as ${moderationCategories.length} categories`,
      tone: "primary",
      details: categoryLabels,
    });
  }

  // Intent is editable in /comments as well, and — like moderation — a rule can
  // carry only this condition, so it needs a badge of its own. Built-in and
  // custom picks are one "any of" list; custom ids have no name resolver here,
  // so they show as their id (the slug of the name).
  const intents = Array.isArray(conditions.intents)
    ? conditions.intents.filter((intent): intent is string => typeof intent === "string")
    : [];
  const customIntents = Array.isArray(conditions.customIntents)
    ? conditions.customIntents.filter((id): id is string => typeof id === "string")
    : [];
  const intentLabels = [...intents.map(intentLabel), ...customIntents];
  if (intentLabels.length === 1) {
    badges.push({ label: `Intent: ${intentLabels[0]}`, tone: "primary" });
  } else if (intentLabels.length > 1) {
    badges.push({ label: `${intentLabels.length} intents`, tone: "primary", details: intentLabels });
  }

  if (conditions.targetType === "comment") {
    badges.push({ label: "Top-level comments", tone: "muted" });
  } else if (conditions.targetType === "reply") {
    badges.push({ label: "Replies only", tone: "muted" });
  }

  const campaignIds = Array.isArray(conditions.campaignIds)
    ? conditions.campaignIds.filter((id): id is string => typeof id === "string")
    : [];
  if (campaignIds.length === 1) {
    badges.push({ label: "1 campaign", tone: "muted" });
  } else if (campaignIds.length > 1) {
    badges.push({ label: `${campaignIds.length} campaigns`, tone: "muted" });
  }

  const adsetIds = Array.isArray(conditions.adsetIds)
    ? conditions.adsetIds.filter((id): id is string => typeof id === "string")
    : [];
  if (adsetIds.length === 1) {
    badges.push({ label: "1 ad set", tone: "muted" });
  } else if (adsetIds.length > 1) {
    badges.push({ label: `${adsetIds.length} ad sets`, tone: "muted" });
  }

  // Preview uses badges to decide whether the step looks configured. Always
  // surface a baseline chip for realtime Comments triggers so an empty Setup
  // does not show the generic "Configure this step" placeholder after the trigger is chosen.
  if (!isScheduled && badges.length === 0) {
    badges.push({ label: "New comment trigger", tone: "muted" });
  }
}

function summarizeAction(node: AutomationNode): NodeSummary {
  const config = node.config || {};
  const badges: SummaryBadge[] = [];
  let destinationSummary: string | undefined;

  if (node.service === "notification") {
    const method = config.notificationMethod || "email";
    const channels: string[] = [];
    if (method === "email" || method === "both") channels.push("Email");
    if (method === "slack" || method === "both") channels.push("Slack");

    const recipients: string[] = config.emailRecipients || [];
    const hasEmail = method === "email" || method === "both";
    const hasSlack = method === "slack" || method === "both";

    const recipientLabel = hasEmail
      ? recipients.length === 0
        ? "no recipients"
        : recipients.length === 1
          ? recipients[0]
          : `${recipients.length} recipients`
      : "";
    const slackLabel = hasSlack
      ? config.slackChannelOverride?.name
        ? `#${config.slackChannelOverride.name}`
        : ""
      : "";

    destinationSummary = [channels.join(" + "), recipientLabel || slackLabel].filter(Boolean).join(" · ");
    if (destinationSummary) badges.push({ label: destinationSummary, tone: "primary" });
  } else if (node.service === "comments") {
    if (node.event) badges.push({ label: node.event, tone: "primary" });
    const actionConfig =
      config.actionConfig && typeof config.actionConfig === "object" && !Array.isArray(config.actionConfig)
        ? (config.actionConfig as Record<string, unknown>)
        : {};
    if (node.event === "Reply to Comment") {
      if (actionConfig.useAI === true) {
        badges.push({
          label: actionConfig.autoSend === true ? "AI reply · auto-send" : "AI reply · needs approval",
          tone: "muted",
        });
      } else {
        badges.push({ label: "Fixed reply", tone: "muted" });
      }
    }
  } else if (node.service === "meta-ads") {
    if (node.event === "Duplicate Ad Set from Sheet Row" || node.event === "Prepare Dynamic Ad Set from Sheet Row") {
      badges.push({ label: "Sheet location -> ad set", tone: "primary" });
    } else if (node.event === "Create Media from Templates" || node.event === "Create Dynamic Media from Templates") {
      badges.push({ label: "Render /create templates", tone: "primary" });
    } else if (node.event === "Launch Template Ads" || node.event === "Create Media + Launch Ads from Templates") {
      badges.push({ label: "Launch into new ad set", tone: "primary" });
    } else if (node.event) {
      badges.push({ label: node.event, tone: "primary" });
    }
    if (node.event === "Duplicate Ad Set" && config.targetName) {
      badges.push({ label: config.targetName, tone: "muted" });
    }
    if (node.event === "Duplicate Ad Set" && config.newName) {
      badges.push({ label: config.newName, tone: "muted" });
    }
    if (node.event === "Duplicate Ad" && config.useExistingPost) {
      badges.push({ label: "Use Post ID", tone: "muted" });
    }
    if (node.event === "Duplicate Ad" && config.pauseSourceAdSets) {
      badges.push({ label: "Pause source ad sets", tone: "muted" });
    }
    if (node.event === "Set Minimum Spend") {
      if (config.minimumSpendAction === "RESET") {
        badges.push({ label: "Reset min spend to 0", tone: "muted" });
      } else if (config.minimumSpendAmount != null && config.minimumSpendAmount !== "") {
        const amount =
          config.minimumSpendType === "PERCENT" ? `${config.minimumSpendAmount}%` : `$${config.minimumSpendAmount}`;
        badges.push({ label: `Min spend ${amount}`, tone: "muted" });
      }
    }
    if (
      (node.event === "Create Media from Templates" ||
        node.event === "Create Dynamic Media from Templates" ||
        node.event === "Launch Template Ads" ||
        node.event === "Create Media + Launch Ads from Templates") &&
      Array.isArray(config.templateIds)
    ) {
      badges.push({ label: `${config.templateIds.length} templates`, tone: "muted" });
    }
    if (
      (node.event === "Duplicate Ad Set from Sheet Row" ||
        node.event === "Prepare Dynamic Ad Set from Sheet Row" ||
        node.event === "Launch Template Ads" ||
        node.event === "Create Media + Launch Ads from Templates") &&
      config.campaignName
    ) {
      badges.push({ label: config.campaignName, tone: "muted" });
    }
    if (config.accountName) badges.push({ label: config.accountName, tone: "muted" });
    if (config.templateName) badges.push({ label: config.templateName, tone: "muted" });
  } else if (node.service === "webhook") {
    if (config.url) badges.push({ label: new URL(config.url).host, tone: "primary" });
  } else if (node.service === "report") {
    if (config.reportName) badges.push({ label: config.reportName, tone: "primary" });
  }

  return {
    subtitle: destinationSummary,
    badges,
    destinationSummary,
  };
}

export function getNodeSummary(node: AutomationNode, ctx: NodeSummaryContext = {}): NodeSummary {
  if (node.type === "trigger") return summarizeTrigger(node, ctx);
  if (node.type === "action") return summarizeAction(node);
  return { badges: [] };
}
