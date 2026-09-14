import { normalizeAssistantCriteria } from "@/lib/automation/criteria-groups";
import { normalizeRunTimeToHour } from "./polling-run-time";
import { normalizePerformanceMonitoringConfig } from "./normalize-performance-monitoring-config";
import type { NodeType } from "../contexts/automation-context";
import { COMMENT_ACTION_EVENTS, COMMENT_TRIGGER_EVENTS, COMMENTS_SERVICE } from "./comment-flow-mapper";
import { toneValueToConditions } from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";

const PERFORMANCE_MONITORING_EVENT = "Performance Monitoring";

/**
 * Canonical Meta/TikTok/Snapchat action event labels used by the builder Select.
 * Models often emit near-misses ("Pause Ads", "pause") that leave the dropdown empty.
 */
const EVENT_ALIASES: Readonly<Record<string, string>> = {
  pause: "Pause Ad",
  "pause ad": "Pause Ad",
  "pause ads": "Pause Ad",
  "enable ad": "Enable Ad",
  "enable ads": "Enable Ad",
  "pause ad set": "Pause Ad Set",
  "pause adsets": "Pause Ad Set",
  "pause campaign": "Pause Campaign",
  "pause campaigns": "Pause Campaign",
  "duplicate ad": "Duplicate Ad",
  "duplicate ads": "Duplicate Ad",
  "performance threshold": "Performance Threshold",
  "send notification": "Send Notification",
  approve: "Approval Required",
  approval: "Approval Required",
  "approval required": "Approval Required",
  "launch on chatgpt": "Launch on ChatGPT",
  "launch on tiktok": "Launch on TikTok",
  "launch on snapchat": "Launch on Snapchat",
  "launch on pinterest": "Launch on Pinterest",
  "launch on axon": "Launch on Axon",
  "launch on x": "Launch on X",
  "launch on twitter": "Launch on X",
  "update value rules": "Update Value Rules",
  "apply value rules": "Update Value Rules",
  slack: "Send Notification",
  notify: "Send Notification",
  notification: "Send Notification",
  "send slack notification": "Send Notification",
  "send slack": "Send Notification",
  "hide comment": "Hide Comment",
  "hide comments": "Hide Comment",
  "new comment": "New Comment",
  "new comments": "New Comment",
  "delete comment": "Delete Comment",
  "delete comments": "Delete Comment",
  "like comment": "Like Comment",
  "like comments": "Like Comment",
  "reply to comment": "Reply to Comment",
  "reply to comments": "Reply to Comment",
};

const APPROVAL_SERVICE = "approval";
const APPROVAL_EVENT = "Approval Required";
const DELAY_SERVICE = "delay";
const DELAY_EVENT = "Wait for Duration";
const NOTIFICATION_SERVICE = "notification";
const NOTIFICATION_EVENT = "Send Notification";
const NOTIFICATION_METHODS: ReadonlySet<string> = new Set(["email", "slack", "both"]);
const DEFAULT_PAUSE_TARGET_IDS = "{{node-trigger-1.qualifyingAdIds}}";
const DEFAULT_APPROVAL_EXPIRATION_DAYS = 3;
const META_ADS_SERVICE = "meta-ads";
const COMMENT_EVENTS: ReadonlySet<string> = new Set([
  ...Object.values(COMMENT_TRIGGER_EVENTS),
  ...Object.values(COMMENT_ACTION_EVENTS),
]);

/**
 * Meta pause actions do not share the cross-channel `targetIds` field. The config
 * panel, the registry and the executor (`meta-pause.ts`) each key off a per-event
 * name, so a step left on `targetIds` renders an empty "Ads to Pause" input and
 * stays stuck on "Fill in Ad IDs to Pause to continue" — even though the pill the
 * agent chose was correct. Each event also operates on its own entity level, and so
 * defaults to that level's trigger output rather than the generic ad-level one.
 */
const META_PAUSE_TARGET_BY_EVENT: Readonly<Record<string, { readonly field: string; readonly triggerOutput: string }>> =
  {
    "Pause Ad": { field: "adIdsToPause", triggerOutput: "qualifyingAdIds" },
    "Pause Ad Set": { field: "targetAdSetIds", triggerOutput: "qualifyingAdSetIds" },
    "Pause Campaign": { field: "targetCampaignIds", triggerOutput: "qualifyingCampaignIds" },
  };

/** Performance Threshold outputs that each name one entity level. */
const ENTITY_LEVEL_TRIGGER_OUTPUTS: ReadonlyArray<string> = [
  "qualifyingAdIds",
  "qualifyingAdSetIds",
  "qualifyingCampaignIds",
];

/** Cross-channel services use "Launch on …", not Meta-style "Launch Ad". */
const CROSS_CHANNEL_LAUNCH_BY_SERVICE: Readonly<Record<string, string>> = {
  "chatgpt-ads": "Launch on ChatGPT",
  "tiktok-ads": "Launch on TikTok",
  "snapchat-ads": "Launch on Snapchat",
  "pinterest-ads": "Launch on Pinterest",
  "axon-ads": "Launch on Axon",
  "x-ads": "Launch on X",
  "google-ads": "Launch on Google Ads",
};

export interface NormalizeAssistantStepInput {
  readonly type?: NodeType;
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
  /** Header account platform — rewrites mis-aimed meta-ads steps when Snap/TikTok is selected. */
  readonly selectedAccountPlatform?: string | null;
  readonly selectedAccountId?: string | null;
}

export interface NormalizedAssistantStepFields {
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
}

/**
 * Normalize builder-tool service/event/config so canvas Selects match the
 * automation registry (exact labels, approval/delay wiring, cross-channel launch).
 */
export function normalizeAssistantStepFields(input: NormalizeAssistantStepInput): NormalizedAssistantStepFields {
  const service = resolveCanonicalService(input);
  const event = resolveCanonicalEvent({ ...input, service });
  const config = normalizeStepConfig({ ...input, service, event, rawEvent: input.event });
  const platformAligned = alignStepWithSelectedAccountPlatform({
    type: input.type,
    service,
    event,
    config,
    selectedAccountPlatform: input.selectedAccountPlatform,
    selectedAccountId: input.selectedAccountId,
  });
  return {
    ...(platformAligned.service ? { service: platformAligned.service } : {}),
    ...(platformAligned.event ? { event: platformAligned.event } : {}),
    ...(platformAligned.config ? { config: platformAligned.config } : {}),
  };
}

const SNAPCHAT_ADS_SERVICE = "snapchat-ads";
const TIKTOK_ADS_SERVICE = "tiktok-ads";
const X_ADS_SERVICE = "x-ads";

/** Meta-shaped pause/threshold events that have a same-named counterpart on Snap/TikTok. */
const CROSS_PLATFORM_PERF_EVENTS = new Set(["Performance Threshold", "Pause Ad", "Enable Ad"]);

function isNonEmptyAdAccountId(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function alignStepWithSelectedAccountPlatform(input: {
  readonly type?: NodeType;
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
  readonly selectedAccountPlatform?: string | null;
  readonly selectedAccountId?: string | null;
}): { readonly service?: string; readonly event?: string; readonly config?: Record<string, unknown> } {
  const platform = input.selectedAccountPlatform?.trim().toLowerCase();
  const headerAccountId = input.selectedAccountId?.trim() ?? "";

  if (platform === "snapchat" && input.service === SNAPCHAT_ADS_SERVICE && headerAccountId) {
    const nextConfig: Record<string, unknown> = { ...(input.config ?? {}) };
    if (!isNonEmptyAdAccountId(nextConfig.adAccountId)) {
      nextConfig.adAccountId = headerAccountId;
    }
    delete nextConfig.accountId;
    return { service: input.service, event: input.event, config: nextConfig };
  }

  // X reads `accountId` (the base36 X ad-account id); a Meta-shaped Performance
  // Threshold aimed at an X account is re-homed onto the x-ads trigger.
  if (platform === "x" && input.service === X_ADS_SERVICE && headerAccountId) {
    const nextConfig: Record<string, unknown> = { ...(input.config ?? {}) };
    if (!isNonEmptyAdAccountId(nextConfig.accountId)) nextConfig.accountId = headerAccountId;
    delete nextConfig.adAccountId;
    return { service: input.service, event: input.event, config: nextConfig };
  }
  if (
    platform === "x" &&
    input.service === META_ADS_SERVICE &&
    input.event === "Performance Threshold" &&
    input.type === "trigger"
  ) {
    const nextConfig: Record<string, unknown> = { ...(input.config ?? {}) };
    const accountId =
      (typeof nextConfig.accountId === "string" && nextConfig.accountId.trim()) ||
      (typeof nextConfig.adAccountId === "string" && nextConfig.adAccountId.trim()) ||
      headerAccountId;
    if (accountId) nextConfig.accountId = accountId;
    delete nextConfig.adAccountId;
    return { service: X_ADS_SERVICE, event: input.event, config: nextConfig };
  }

  if (!platform || input.service !== META_ADS_SERVICE || !input.event) {
    return { service: input.service, event: input.event, config: input.config };
  }
  if (!CROSS_PLATFORM_PERF_EVENTS.has(input.event)) {
    return { service: input.service, event: input.event, config: input.config };
  }

  const targetService =
    platform === "snapchat" ? SNAPCHAT_ADS_SERVICE : platform === "tiktok" ? TIKTOK_ADS_SERVICE : null;
  if (!targetService) {
    return { service: input.service, event: input.event, config: input.config };
  }

  const nextConfig: Record<string, unknown> = { ...(input.config ?? {}) };
  const accountId =
    (typeof nextConfig.adAccountId === "string" && nextConfig.adAccountId.trim()) ||
    (typeof nextConfig.accountId === "string" && nextConfig.accountId.trim()) ||
    input.selectedAccountId?.trim() ||
    "";

  if (targetService === SNAPCHAT_ADS_SERVICE && accountId) {
    nextConfig.adAccountId = accountId;
    delete nextConfig.accountId;
  }

  if (input.event === "Pause Ad" && nextConfig.adIdsToPause != null && nextConfig.targetIds == null) {
    nextConfig.targetIds = nextConfig.adIdsToPause;
    delete nextConfig.adIdsToPause;
  }

  return { service: targetService, event: input.event, config: nextConfig };
}

function resolveCanonicalService(input: NormalizeAssistantStepInput): string | undefined {
  if (input.type === "approval") return APPROVAL_SERVICE;
  if (input.type === "delay") return DELAY_SERVICE;
  if (isNotificationAction(input)) return NOTIFICATION_SERVICE;
  if (isCommentsEvent(canonicalizeEventLabel(input.event))) return COMMENTS_SERVICE;
  return input.service;
}

function isNotificationAction(input: NormalizeAssistantStepInput): boolean {
  if (input.type !== "action") return false;
  if (input.service === NOTIFICATION_SERVICE || input.service === "slack") return true;
  const eventLower = (input.event ?? "").trim().toLowerCase();
  if (eventLower.includes("notification") || eventLower.includes("notify") || eventLower === "slack") {
    return true;
  }
  const actionType = typeof input.config?.actionType === "string" ? input.config.actionType.trim().toLowerCase() : "";
  return actionType === "notify";
}

function resolveCanonicalEvent(input: NormalizeAssistantStepInput & { service?: string }): string | undefined {
  if (input.type === "approval") {
    const fromEvent = canonicalizeEventLabel(input.event);
    return fromEvent === APPROVAL_EVENT || !fromEvent ? APPROVAL_EVENT : fromEvent;
  }

  if (input.type === "delay") {
    return canonicalizeEventLabel(input.event) ?? DELAY_EVENT;
  }

  if (isNotificationAction(input)) {
    return NOTIFICATION_EVENT;
  }

  let event = canonicalizeEventLabel(input.event);
  if (!event && input.type === "action") {
    const actionType = typeof input.config?.actionType === "string" ? input.config.actionType.trim().toLowerCase() : "";
    if (actionType === "pause") event = "Pause Ad";
    else if (actionType === "enable") event = "Enable Ad";
    else if (actionType === "duplicate") event = "Duplicate Ad";
    else if (actionType === "notify") event = "Send Notification";
  }

  if (input.type === "action" && input.service && event === "Launch Ad") {
    const crossChannelEvent = CROSS_CHANNEL_LAUNCH_BY_SERVICE[input.service];
    if (crossChannelEvent) return crossChannelEvent;
  }

  return event;
}

function canonicalizeEventLabel(event: string | undefined): string | undefined {
  if (!event) return undefined;
  const trimmed = event.trim();
  if (!trimmed) return undefined;
  const alias = EVENT_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function coerceTargetIdsPill(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.item === "string") return value.item;
  return value;
}

function normalizeCriteriaConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!("criteria" in config)) return config;
  const criteria = normalizeAssistantCriteria(config.criteria);
  if (!criteria) {
    const { criteria: _dropped, ...rest } = config;
    return rest;
  }
  return { ...config, criteria };
}

const DEFAULT_VALUE_RULES_TARGET_AD_SETS = "{{node-trigger-1.qualifyingAdSetIds}}";

const AGGREGATION_ALIASES: Readonly<Record<string, string>> = {
  ad_set: "adset_total",
  adset: "adset_total",
  ad_set_total: "adset_total",
  "ad set total": "adset_total",
  campaign: "campaign_total",
  campaign_total: "campaign_total",
  average: "average",
  adset_average: "adset_average",
};

function coerceScheduleTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (twentyFourHour) {
    const normalized = normalizeRunTimeToHour(`${twentyFourHour[1]!.padStart(2, "0")}:${twentyFourHour[2]}`);
    return normalized || undefined;
  }

  const twelveHour = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(trimmed.replace(/\s+/g, " "));
  if (!twelveHour) return undefined;

  let hour = Number.parseInt(twelveHour[1]!, 10);
  const minute = twelveHour[2] ?? "00";
  const meridiem = twelveHour[3]!.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const normalized = normalizeRunTimeToHour(`${String(hour).padStart(2, "0")}:${minute}`);
  return normalized || undefined;
}

function coerceCheckDays(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const days = value
      .filter((day): day is string => typeof day === "string" && day.trim().length > 0)
      .map((day) => day.trim().toLowerCase());
    return days.length > 0 ? days : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim().toLowerCase()];
  }

  if (isRecord(value) && typeof value.item === "string" && value.item.trim()) {
    return [value.item.trim().toLowerCase()];
  }

  return undefined;
}

function normalizePollingScheduleFields(config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config };

  if (!next.checkFrequency && typeof next.frequency === "string") {
    const frequency = next.frequency.trim().toLowerCase();
    if (frequency && frequency !== "one-time" && frequency !== "manual") {
      next.checkFrequency = frequency;
    }
    delete next.frequency;
  }

  if (!next.checkTime) {
    const coerced = coerceScheduleTime(next.scheduledTime ?? next.checkTime);
    if (coerced) next.checkTime = coerced;
    delete next.scheduledTime;
  }

  const coercedCheckDays =
    coerceCheckDays(next.checkDays) ??
    (typeof next.dayOfWeek === "string" && next.dayOfWeek.trim()
      ? coerceCheckDays(next.dayOfWeek)
      : coerceCheckDays(next.dayOfWeek));
  if (coercedCheckDays) {
    next.checkDays = [...coercedCheckDays];
  }
  delete next.dayOfWeek;

  return next;
}

function normalizePerformanceThresholdCriteria(config: Record<string, unknown>): Record<string, unknown> {
  if (!("criteria" in config)) return config;
  const criteria = normalizeAssistantCriteria(config.criteria);
  if (!criteria) return config;

  const nextCriteria = { ...criteria };
  const aggregationRaw = nextCriteria.aggregation;
  if (typeof aggregationRaw === "string") {
    const mapped = AGGREGATION_ALIASES[aggregationRaw.trim().toLowerCase()];
    if (mapped) nextCriteria.aggregation = mapped;
  }

  const entityLevelSource =
    typeof config.entityLevel === "string"
      ? config.entityLevel
      : typeof nextCriteria.entityLevel === "string"
        ? nextCriteria.entityLevel
        : "";
  const entityLevel = entityLevelSource.trim().toLowerCase();
  if (!nextCriteria.aggregation && entityLevel) {
    const mapped = AGGREGATION_ALIASES[entityLevel];
    if (mapped) nextCriteria.aggregation = mapped;
  }

  delete nextCriteria.entityLevel;
  const nextConfig: Record<string, unknown> = { ...config, criteria: nextCriteria };
  delete nextConfig.entityLevel;
  return nextConfig;
}

function normalizeValueRulesActionConfig(
  config: Record<string, unknown>,
  event: string | undefined,
): Record<string, unknown> {
  if (event !== "Update Value Rules") return config;

  const next = { ...config };
  if (!next.valueRulesOperation && typeof next.operation === "string") {
    next.valueRulesOperation = next.operation.trim().toUpperCase();
    delete next.operation;
  }

  const hasTargetAdSetIds =
    (typeof next.targetAdSetIds === "string" && next.targetAdSetIds.trim().length > 0) ||
    (Array.isArray(next.selectedAdSetIds) && next.selectedAdSetIds.length > 0);
  if (!hasTargetAdSetIds) {
    next.targetAdSetIds = DEFAULT_VALUE_RULES_TARGET_AD_SETS;
  }

  return next;
}

function normalizeStepConfig(
  input: NormalizeAssistantStepInput & { service?: string; event?: string; rawEvent?: string },
): Record<string, unknown> | undefined {
  const needsNotificationDefaults = isNotificationAction(input);
  if (!input.config && !needsPauseTargetIds(input) && input.type !== "approval" && !needsNotificationDefaults) {
    return input.config;
  }

  const next: Record<string, unknown> = normalizeCriteriaConfig({ ...(input.config || {}) });
  const withSchedule =
    input.type === "trigger" || input.event === "Performance Threshold" || input.event === PERFORMANCE_MONITORING_EVENT
      ? normalizePollingScheduleFields(next)
      : next;
  const withCriteria =
    input.event === "Performance Threshold" ? normalizePerformanceThresholdCriteria(withSchedule) : withSchedule;
  const withMonitoring =
    input.event === PERFORMANCE_MONITORING_EVENT ? normalizePerformanceMonitoringConfig(withCriteria) : withCriteria;
  const withValueRules = normalizeValueRulesActionConfig(withMonitoring, input.event);
  const withComments =
    input.service === COMMENTS_SERVICE && input.type === "trigger"
      ? normalizeCommentTriggerConfig(withValueRules)
      : withValueRules;

  if ("targetIds" in withComments) {
    withComments.targetIds = coerceTargetIdsPill(withComments.targetIds);
  }

  if (needsPauseTargetIds({ ...input, config: withComments })) {
    withComments.targetIds = resolveDefaultPauseTargetIds(input);
  }

  if (input.type === "approval") {
    if (typeof withComments.approvalMessage === "string" && !withComments.customMessage) {
      withComments.customMessage = withComments.approvalMessage;
    }
    delete withComments.approvalMessage;
    delete withComments.targetIds;
    if (!withComments.notificationMethod) withComments.notificationMethod = "email";
    if (withComments.expirationDays === undefined) withComments.expirationDays = DEFAULT_APPROVAL_EXPIRATION_DAYS;
  }

  if (needsNotificationDefaults) {
    withComments.notificationMethod = resolveNotificationMethod(withComments, input);
    if (typeof withComments.message === "string" && !withComments.customMessage) {
      withComments.customMessage = withComments.message;
    }
    delete withComments.message;
    delete withComments.notifyVia;
    delete withComments.channel;
  }

  if (
    input.type === "action" &&
    input.service &&
    input.event &&
    CROSS_CHANNEL_LAUNCH_BY_SERVICE[input.service] === input.event
  ) {
    delete withComments.crossLaunchFromMeta;
    delete withComments.adSource;
    delete withComments.targetIds;
  }

  // Models sometimes put position inside config; the builder reads top-level position only.
  delete withComments.position;

  // actionType is create_performance_threshold vocabulary, not a canvas node field.
  delete withComments.actionType;

  return moveMetaPauseTargetToCanonicalField(withComments, input);
}

function isCommentsEvent(event: string | undefined): boolean {
  return Boolean(event && COMMENT_EVENTS.has(event));
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function readCommentPageIds(config: Record<string, unknown>): string[] {
  const fromList = readStringList(config.pageIds);
  const pageId = typeof config.pageId === "string" ? config.pageId.trim() : "";
  if (pageId && !fromList.includes(pageId)) return [...fromList, pageId];
  return fromList;
}

function readSentimentPreset(
  config: Record<string, unknown>,
  conditions: Record<string, unknown>,
): "positive" | "neutral" | "negative" | undefined {
  const raw = config.sentimentFilter ?? conditions.sentimentFilter;
  if (raw === "positive" || raw === "neutral" || raw === "negative") return raw;
  return undefined;
}

function hasSentimentBounds(conditions: Record<string, unknown>): boolean {
  return conditions.sentimentMin !== undefined || conditions.sentimentMax !== undefined;
}

function normalizeCommentTriggerConfig(config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config };
  const pageIds = readCommentPageIds(next);
  if (pageIds.length > 0) next.pageIds = pageIds;
  delete next.pageId;

  const conditions = isRecord(next.conditions) ? { ...next.conditions } : {};
  const preset = readSentimentPreset(next, conditions);
  if (preset && !hasSentimentBounds(conditions)) {
    Object.assign(conditions, toneValueToConditions({ mode: "preset", preset }));
  }
  delete conditions.sentimentFilter;
  delete next.sentimentFilter;
  if (Object.keys(conditions).length > 0) next.conditions = conditions;
  return next;
}

/**
 * Meta pause steps default to the trigger output for the entity level they act on.
 * Other services share one generic `targetIds` field and keep the ad-level default.
 */
function resolveDefaultPauseTargetIds(input: { readonly service?: string; readonly event?: string }): string {
  if (input.service !== META_ADS_SERVICE || !input.event) return DEFAULT_PAUSE_TARGET_IDS;
  const target = META_PAUSE_TARGET_BY_EVENT[input.event];
  return target ? `{{node-trigger-1.${target.triggerOutput}}}` : DEFAULT_PAUSE_TARGET_IDS;
}

/**
 * Re-key a Meta pause step's target pill from the cross-channel `targetIds` onto the
 * field its config panel and executor actually read, so the pill is visible in Setup
 * and the step reports ready.
 */
function moveMetaPauseTargetToCanonicalField(
  config: Record<string, unknown>,
  input: { readonly service?: string; readonly event?: string },
): Record<string, unknown> {
  if (input.service !== META_ADS_SERVICE || !input.event) return config;
  const target = META_PAUSE_TARGET_BY_EVENT[input.event];
  if (!target) return config;

  const next = { ...config };
  const crossChannelPill = next.targetIds;
  delete next.targetIds;

  if (isFilledPill(next[target.field]) || !isFilledPill(crossChannelPill)) return next;
  // A pill aimed at a different entity level (ad set ids on a Pause Campaign step) is
  // dropped rather than re-aimed: re-aiming would silently widen what gets paused, and
  // accepting it would pass readiness only to fail at the Meta API. Leaving the field
  // empty surfaces the step as "Needs setup" so the user picks the level they meant.
  if (isPillForOtherEntityLevel(crossChannelPill, target.triggerOutput)) return next;
  next[target.field] = crossChannelPill;
  return next;
}

function isPillForOtherEntityLevel(pill: unknown, triggerOutput: string): boolean {
  if (typeof pill !== "string") return false;
  return ENTITY_LEVEL_TRIGGER_OUTPUTS.some((output) => output !== triggerOutput && pill.includes(`.${output}}}`));
}

function isFilledPill(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function needsPauseTargetIds(input: NormalizeAssistantStepInput & { event?: string }): boolean {
  if (input.type !== "action") return false;
  if (input.event !== "Pause Ad" && input.event !== "Pause Ad Set" && input.event !== "Pause Campaign") {
    return false;
  }
  const existing = input.config?.targetIds;
  return existing === undefined || existing === null || existing === "";
}

function resolveNotificationMethod(
  config: Record<string, unknown>,
  input: NormalizeAssistantStepInput & { rawEvent?: string },
): string {
  const fromConfig = coerceNotificationMethod(
    config.notificationMethod ?? config.notifyVia ?? config.channel ?? config.method,
  );
  if (fromConfig) return fromConfig;

  const eventLower = (input.rawEvent ?? input.event ?? "").trim().toLowerCase();
  if (eventLower.includes("slack") || input.service === "slack") return "slack";
  if (eventLower.includes("both")) return "both";
  if (eventLower.includes("email")) return "email";

  return "email";
}

function coerceNotificationMethod(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (NOTIFICATION_METHODS.has(normalized)) return normalized;
  if (normalized.includes("slack") && normalized.includes("email")) return "both";
  if (normalized.includes("slack")) return "slack";
  if (normalized.includes("email")) return "email";
  return undefined;
}
