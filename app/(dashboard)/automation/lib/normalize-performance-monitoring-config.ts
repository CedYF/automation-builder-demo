/**
 * Normalizes assistant/MCP Performance Monitoring trigger config into the
 * canonical builder shape (`monitoringMetric`, `monitoringConditions`, etc.).
 * Models often emit Performance Threshold-style `criteria` or uppercase labels
 * like "CPC" that leave the metric Select empty in the UI.
 */

export interface PerformanceMonitoringCondition {
  readonly metric: string;
  readonly direction: string;
  readonly percentage: number | undefined;
}

const MONITORING_METRIC_ALIASES: Readonly<Record<string, string>> = {
  spend: "spend",
  cpa: "cpa",
  "cost per result": "cpa",
  cost_per_result: "cpa",
  costperresult: "cpa",
  roas: "roas",
  "purchase roas": "roas",
  cpm: "cpm",
  cpc: "cpc",
  "cost per click": "cpc",
  cost_per_click: "cpc",
  ctr: "ctr",
  impressions: "impressions",
  conversions: "conversions",
  cost_per_subscriber: "cost_per_subscriber",
  "cost per subscriber": "cost_per_subscriber",
};

const MONITORING_LEVEL_ALIASES: Readonly<Record<string, string>> = {
  account: "account",
  campaign: "campaign",
  adset: "adset",
  "ad set": "adset",
  ad_set: "adset",
  ad: "ad",
  ads: "ad",
};

const COMPARISON_WINDOW_ALIASES: Readonly<Record<string, string>> = {
  day: "day",
  daily: "day",
  "day over day": "day",
  dod: "day",
  week: "week",
  weekly: "week",
  "week over week": "week",
  wow: "week",
  "7 days": "week",
  "7d": "week",
  "last 7 days": "week",
  custom: "custom",
};

const DIRECTION_ALIASES: Readonly<Record<string, string>> = {
  increases: "increases",
  increase: "increases",
  increased: "increases",
  rises: "increases",
  rise: "increases",
  up: "increases",
  decreases: "decreases",
  decrease: "decreases",
  decreased: "decreases",
  drops: "decreases",
  drop: "decreases",
  down: "decreases",
  changes: "changes",
  change: "changes",
  changed: "changes",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeAlias(value: unknown, aliases: Readonly<Record<string, string>>): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return aliases[trimmed.toLowerCase()] ?? trimmed.toLowerCase();
}

/** Maps display labels and aliases to the lowercase metric values the UI Select expects. */
export function normalizePerformanceMonitoringMetric(value: unknown): string | undefined {
  const aliased = normalizeAlias(value, MONITORING_METRIC_ALIASES);
  if (!aliased) return undefined;
  return MONITORING_METRIC_ALIASES[aliased] ?? aliased;
}

function normalizeMonitoringLevel(value: unknown): string | undefined {
  return normalizeAlias(value, MONITORING_LEVEL_ALIASES);
}

function normalizeComparisonWindow(value: unknown): string | undefined {
  return normalizeAlias(value, COMPARISON_WINDOW_ALIASES);
}

function normalizeDirection(value: unknown): string | undefined {
  return normalizeAlias(value, DIRECTION_ALIASES);
}

function coercePercentage(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/%/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function directionFromOperator(operator: unknown): string | undefined {
  if (typeof operator !== "string") return undefined;
  const op = operator.trim();
  if (op === ">" || op === ">=") return "increases";
  if (op === "<" || op === "<=") return "decreases";
  return "changes";
}

function conditionFromCriteriaEntry(entry: Record<string, unknown>): PerformanceMonitoringCondition | null {
  const metric = normalizePerformanceMonitoringMetric(entry.metric);
  if (!metric) return null;

  const direction =
    normalizeDirection(entry.direction) ??
    normalizeDirection(entry.monitoringDirection) ??
    directionFromOperator(entry.operator) ??
    "changes";

  const percentage =
    coercePercentage(entry.percentage) ??
    coercePercentage(entry.monitoringPercentage) ??
    coercePercentage(entry.threshold) ??
    coercePercentage(entry.value);

  return { metric, direction, percentage };
}

function conditionsFromCriteria(criteria: unknown): PerformanceMonitoringCondition[] | undefined {
  if (!isRecord(criteria)) return undefined;

  const rawConditions = criteria.conditions;
  const entries = Array.isArray(rawConditions)
    ? rawConditions.filter(isRecord)
    : isRecord(rawConditions)
      ? [rawConditions]
      : [];

  const normalized = entries
    .map((entry) => conditionFromCriteriaEntry(entry))
    .filter((entry): entry is PerformanceMonitoringCondition => entry !== null);

  return normalized.length > 0 ? normalized : undefined;
}

function singleConditionFromFlatFields(config: Record<string, unknown>): PerformanceMonitoringCondition | null {
  const metric = normalizePerformanceMonitoringMetric(
    config.monitoringMetric ?? config.metric ?? config.monitoring_metric,
  );
  if (!metric) return null;

  const direction = normalizeDirection(config.monitoringDirection) ?? normalizeDirection(config.direction) ?? "changes";

  const percentage =
    coercePercentage(config.monitoringPercentage) ??
    coercePercentage(config.percentage) ??
    coercePercentage(config.threshold);

  return { metric, direction, percentage };
}

function resolveMonitoringConditions(config: Record<string, unknown>): PerformanceMonitoringCondition[] | undefined {
  const fromArray = config.monitoringConditions;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    const normalized = fromArray
      .filter(isRecord)
      .map((entry) => conditionFromCriteriaEntry(entry))
      .filter((entry): entry is PerformanceMonitoringCondition => entry !== null);
    if (normalized.length > 0) return normalized;
  }

  const fromCriteria = conditionsFromCriteria(config.criteria);
  if (fromCriteria) return fromCriteria;

  const flat = singleConditionFromFlatFields(config);
  return flat ? [flat] : undefined;
}

function resolveComparisonWindow(config: Record<string, unknown>): string | undefined {
  const explicit =
    normalizeComparisonWindow(config.monitoringComparisonWindow) ?? normalizeComparisonWindow(config.comparisonWindow);
  if (explicit) return explicit;

  const lookbackDays = config.lookbackDays ?? (isRecord(config.criteria) ? config.criteria.lookbackDays : undefined);
  if (lookbackDays === 7 || lookbackDays === "7") return "week";
  if (lookbackDays === 1 || lookbackDays === "1") return "day";

  return undefined;
}

/**
 * Converts assistant/MCP Performance Monitoring config into builder fields.
 */
export function normalizePerformanceMonitoringConfig(config: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...config };
  const conditions = resolveMonitoringConditions(next);

  if (conditions?.length) {
    next.monitoringConditions = conditions;
    const first = conditions[0]!;
    next.monitoringMetric = first.metric;
    next.monitoringDirection = first.direction;
    if (first.percentage != null) next.monitoringPercentage = first.percentage;
  }

  const level =
    normalizeMonitoringLevel(next.monitoringLevel) ??
    normalizeMonitoringLevel(next.entityLevel) ??
    normalizeMonitoringLevel(next.level);
  if (level) next.monitoringLevel = level;

  const comparisonWindow = resolveComparisonWindow(next);
  if (comparisonWindow) next.monitoringComparisonWindow = comparisonWindow;

  delete next.metric;
  delete next.direction;
  delete next.percentage;
  delete next.threshold;
  delete next.level;
  delete next.entityLevel;
  delete next.comparisonWindow;
  delete next.lookbackDays;
  delete next.criteria;

  return next;
}
