import { ACTIONS, TRIGGERS, type ConfigField } from "./automation-registry";
import { isMetaTargetAdSetMissing } from "../components/config-sections/target-ad-set-validation";
import { describeStepAccountPlatformMismatch } from "./step-account-platform-gap";

const SERVICES_WITHOUT_REQUIRED_EVENT = new Set([
  "media-library",
  "google-drive",
  "google-sheets",
  "delay",
  "approval",
  "notification",
  "report",
  "manual",
]);

const CRITERIA_ALIASED_FIELD_NAMES = new Set(["metricType", "operator", "threshold", "lookbackDays"]);

const CHOOSE_EVENT_MESSAGE = "To continue, choose an event";
const TARGET_AD_SET_MESSAGE = "Add a target ad set to continue";
const EVENT_SLOT_LABEL = "Event";
const TARGET_AD_SET_SLOT_LABEL = "Target ad set";
const TARGET_AD_SET_SPECIFIC_MATCH_TYPE = "specific";
const TARGET_AD_SET_ID_FIELD_NAME = "targetAdSetId";
const TARGET_AD_SET_NAME_FILTER_FIELD_NAME = "targetAdSetNameFilter";

export interface ConfigPanelPreviewInput {
  readonly service: string;
  readonly event: string;
  readonly nodeType?: string;
  readonly config: Record<string, unknown>;
  readonly flowAccountId?: string | null;
  readonly requiredFields?: ReadonlyArray<Pick<ConfigField, "name" | "label" | "type" | "required" | "defaultValue">>;
}

export type StepConfigGapKind = "event" | "field" | "service" | "target-ad-set" | "account-platform";

/**
 * One unresolved Setup requirement on a step. `message` is the copy the canvas and
 * config panel already show, so the agent's clarifying question and the UI blocker
 * cannot describe the same gap differently.
 */
export interface StepConfigGap {
  readonly kind: StepConfigGapKind;
  /**
   * What fills the gap, which is not always a config field: a registry config field
   * name for `"field"` and `"target-ad-set"`, the node property for `"service"`, and
   * empty for `"event"`. Consumers that resolve `fieldName` against the registry must
   * check `kind` first, since `"service"` has no registry entry.
   */
  readonly fieldName: string;
  readonly label: string;
  readonly message: string;
}

export function isAutomationEventMissing(service: string, event: string): boolean {
  return event.trim().length === 0 && !SERVICES_WITHOUT_REQUIRED_EVENT.has(service);
}

/**
 * Every Setup gap on a step, most important first. An unchosen event short-circuits:
 * without it there is no definition to read required fields from.
 */
export function listStepConfigGaps(input: ConfigPanelPreviewInput): readonly StepConfigGap[] {
  if (isAutomationEventMissing(input.service, input.event)) {
    return [{ kind: "event", fieldName: "", label: EVENT_SLOT_LABEL, message: CHOOSE_EVENT_MESSAGE }];
  }

  // Highest priority: an account from the wrong platform makes every other
  // field on the step meaningless, since the step cannot read that account at all.
  const platformMismatch = describeStepAccountPlatformMismatch({
    service: input.service,
    config: input.config,
    flowAccountId: input.flowAccountId,
  });
  if (platformMismatch) {
    return [{ kind: "account-platform", fieldName: "accountId", label: "Ad account", message: platformMismatch }];
  }

  const requiredFields = input.requiredFields ?? findRequiredConfigFields(input);
  const fieldGaps = requiredFields
    .filter((field) => !isRequiredFieldFilled(field, input))
    .map(
      (field): StepConfigGap => ({
        kind: "field",
        fieldName: field.name,
        label: field.label,
        message: `Fill in ${field.label} to continue`,
      }),
    );

  const replySettings = input.config.actionConfig;
  if (
    input.service === "comments" &&
    input.event === "Reply to Comment" &&
    isPlainObject(replySettings) &&
    replySettings.useAI === false &&
    !isNonEmptyString(replySettings.replyTemplate)
  ) {
    fieldGaps.push({
      kind: "field",
      fieldName: "actionConfig.replyTemplate",
      label: "Reply text",
      message: "Add your exact reply text to continue",
    });
  }

  if (isMetaTargetAdSetMissing(input.service, input.event, input.config)) {
    return [
      ...fieldGaps,
      {
        kind: "target-ad-set",
        fieldName: targetAdSetGapFieldName(input.config),
        label: TARGET_AD_SET_SLOT_LABEL,
        message: TARGET_AD_SET_MESSAGE,
      },
    ];
  }
  return fieldGaps;
}

/**
 * Field that actually clears the target-ad-set gap, which differs by match type: a name-filter
 * mode is cleared only by `targetAdSetNameFilter`. `isMetaTargetAdSetMissing` treats an absent
 * or empty match type as "specific", so this must resolve the default the same way or the gap
 * would name a field that cannot fill it.
 */
function targetAdSetGapFieldName(config: Record<string, unknown>): string {
  const matchType =
    (typeof config.targetAdSetMatchType === "string" && config.targetAdSetMatchType) ||
    TARGET_AD_SET_SPECIFIC_MATCH_TYPE;
  return matchType === TARGET_AD_SET_SPECIFIC_MATCH_TYPE
    ? TARGET_AD_SET_ID_FIELD_NAME
    : TARGET_AD_SET_NAME_FILTER_FIELD_NAME;
}

function findRequiredConfigFields(
  input: ConfigPanelPreviewInput,
): ReadonlyArray<Pick<ConfigField, "name" | "label" | "type" | "required" | "defaultValue">> {
  const definition = findDefinition(input.service, input.event, input.nodeType);
  if (!definition) return [];
  return definition.config.filter((field) => field.required);
}

function findDefinition(service: string, event: string, nodeType?: string) {
  const catalogs = catalogsForNodeType(nodeType);
  if (event.trim().length > 0) {
    for (const catalog of catalogs) {
      const exact = catalog.find((entry) => entry.service === service && entry.event === event);
      if (exact) return exact;
    }
  }

  const matches = catalogs.flatMap((catalog) => catalog.filter((entry) => entry.service === service));
  return matches.length === 1 ? matches[0] : undefined;
}

function catalogsForNodeType(nodeType?: string): ReadonlyArray<typeof TRIGGERS | typeof ACTIONS> {
  if (nodeType === "trigger") return [TRIGGERS];
  if (nodeType === "action" || nodeType === "filter") return [ACTIONS];
  return [TRIGGERS, ACTIONS];
}

function isRequiredFieldFilled(
  field: Pick<ConfigField, "name" | "defaultValue">,
  input: ConfigPanelPreviewInput,
): boolean {
  const fieldName = field.name;
  if (fieldName === "accountIds") {
    return isAccountIdsFilled(input);
  }
  if (fieldName === "accountId") {
    return isNonEmptyString(input.config.accountId) || isNonEmptyString(input.flowAccountId);
  }
  if (fieldName === "adAccountId") {
    return isNonEmptyString(input.config.adAccountId) || isNonEmptyString(input.flowAccountId);
  }
  // Setup shows Email until the user picks Slack / both; the executor uses the same default.
  if (fieldName === "notificationMethod") {
    return true;
  }
  if (isConfigValueFilled(input.config[fieldName])) {
    return true;
  }
  if (field.defaultValue !== undefined) {
    return true;
  }
  return CRITERIA_ALIASED_FIELD_NAMES.has(fieldName) && isNestedCriteriaFilled(input.config, fieldName);
}

function isAccountIdsFilled(input: ConfigPanelPreviewInput): boolean {
  const accountIds = input.config.accountIds;
  if (Array.isArray(accountIds) && accountIds.length > 0) return true;
  return isNonEmptyString(input.config.accountId) || isNonEmptyString(input.flowAccountId);
}

function isNestedCriteriaFilled(config: Record<string, unknown>, fieldName: string): boolean {
  const criteria = config.criteria;
  // Config panels persist DEFAULT_CRITERIA on mount. Unset criteria is still previewable.
  if (!isPlainObject(criteria)) return true;
  if (fieldName === "lookbackDays") {
    return criteria.lookbackDays == null || isLookbackDaysFilled(criteria.lookbackDays);
  }
  if (criteria.conditions == null) return true;
  return hasValidCriteriaCondition(criteria.conditions);
}

function hasValidCriteriaCondition(conditions: unknown): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.some((condition) => {
    if (!isPlainObject(condition)) return false;
    return isNonEmptyString(condition.metric) && isNonEmptyString(condition.operator);
  });
}

function isLookbackDaysFilled(lookbackDays: unknown): boolean {
  if (typeof lookbackDays === "number") {
    return Number.isFinite(lookbackDays) && lookbackDays >= 0;
  }
  return isConfigValueFilled(lookbackDays);
}

function isConfigValueFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
