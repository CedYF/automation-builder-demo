import { flattenNotionProperties } from "./flatten-properties";
import { readNotionPropertyValue } from "./read-property-value";

/** Stable service/event identifiers persisted in Notion automation flows. */
export const NOTION_AUTOMATION_TRIGGER = Object.freeze({
  service: "notion",
  event: "Status Changed",
  defaultStatusProperty: "Status",
  defaultTemplateProperty: "Template",
});
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv"]);

/** A persisted automation rule containing the fields required for event dispatch. */
export interface NotionAutomationRuleRecord {
  readonly id: number;
  readonly name: string;
  readonly flow: unknown;
  readonly actionType: string;
  readonly targetId: string | null;
  readonly accountId: string;
  readonly newName: string | null;
  readonly userEmail: string | null;
  readonly company: string | null;
  readonly workspaceId: string | null;
}

/** Organization and workspace boundary used to select eligible Notion rules. */
export interface NotionAutomationScope {
  readonly company: string;
  readonly workspaceId: string | null;
  readonly fallbackUserEmail: string;
}

/** A file property included in a Notion database automation webhook. */
export interface NotionTriggerAsset {
  readonly name: string;
  readonly url: string;
  readonly propertyName: string;
}

/** Boundary dependencies for finding and executing matching automation rules. */
export interface NotionAutomationTriggerDependencies {
  readonly fetchActiveRules: (scope: NotionAutomationScope) => Promise<ReadonlyArray<NotionAutomationRuleRecord>>;
  readonly executeRule: (input: {
    readonly rule: NotionAutomationRuleRecord;
    readonly userEmail: string;
    readonly triggerOutput: Readonly<Record<string, unknown>>;
  }) => Promise<{ readonly ok: boolean; readonly error?: string }>;
}

/** Summary of a single Notion webhook event's automation dispatches. */
export interface NotionAutomationDispatchSummary {
  readonly matched: number;
  readonly executed: number;
  readonly failures: ReadonlyArray<{ readonly ruleId: number; readonly error: string }>;
}

interface NotionAutomationTriggerOptions {
  readonly event: unknown;
  readonly assets: ReadonlyArray<NotionTriggerAsset>;
  readonly scope: NotionAutomationScope;
  readonly dependencies: NotionAutomationTriggerDependencies;
}

interface MatchingRule {
  readonly rule: NotionAutomationRuleRecord;
  readonly triggerOutput: Readonly<Record<string, unknown>>;
}

/**
 * Selects active Notion status rules for a webhook payload and executes each
 * match independently so one failing rule cannot prevent the others from firing.
 */
export async function triggerNotionStatusAutomations(
  options: NotionAutomationTriggerOptions,
): Promise<NotionAutomationDispatchSummary> {
  const rules = await options.dependencies.fetchActiveRules(options.scope);
  const matchingRules = rules.flatMap((rule) => findMatchingRule(rule, options.event, options.assets));
  const results = await Promise.all(
    matchingRules.map((match) => executeMatchingRule(match, options.scope, options.dependencies)),
  );
  const failures = results.flatMap((result) =>
    result.error === null ? [] : [{ ruleId: result.ruleId, error: result.error }],
  );

  return {
    matched: matchingRules.length,
    executed: results.length - failures.length,
    failures,
  };
}

async function executeMatchingRule(
  match: MatchingRule,
  scope: NotionAutomationScope,
  dependencies: NotionAutomationTriggerDependencies,
): Promise<{ readonly ruleId: number; readonly error: string | null }> {
  try {
    const execution = await dependencies.executeRule({
      rule: match.rule,
      userEmail: match.rule.userEmail || scope.fallbackUserEmail,
      triggerOutput: match.triggerOutput,
    });
    return { ruleId: match.rule.id, error: execution.ok ? null : execution.error || "Automation execution failed" };
  } catch (error) {
    return { ruleId: match.rule.id, error: error instanceof Error ? error.message : String(error) };
  }
}

function findMatchingRule(
  rule: NotionAutomationRuleRecord,
  event: unknown,
  assets: ReadonlyArray<NotionTriggerAsset>,
): MatchingRule[] {
  const triggerNode = findNotionTriggerNode(rule.flow);
  if (!triggerNode) return [];

  const config = readRecord(triggerNode.config) ?? {};
  const statusProperty =
    readNonEmptyString(config.notionStatusProperty) ?? NOTION_AUTOMATION_TRIGGER.defaultStatusProperty;
  const templateProperty =
    readNonEmptyString(config.notionTemplateProperty) ?? NOTION_AUTOMATION_TRIGGER.defaultTemplateProperty;
  const triggerOutput = buildTriggerOutput({ event, assets, statusProperty, templateProperty });
  if (!doesDatabaseMatch(config, triggerOutput.databaseId)) return [];
  if (!doesStatusMatch(config, triggerOutput.status)) return [];

  return [{ rule, triggerOutput }];
}

function findNotionTriggerNode(flow: unknown): Readonly<Record<string, unknown>> | null {
  const flowRecord = readRecord(flow);
  if (!flowRecord || !Array.isArray(flowRecord.nodes)) return null;

  for (const candidate of flowRecord.nodes) {
    const node = readRecord(candidate);
    if (
      node?.type === "trigger" &&
      node.service === NOTION_AUTOMATION_TRIGGER.service &&
      node.event === NOTION_AUTOMATION_TRIGGER.event
    ) {
      return node;
    }
  }
  return null;
}

function buildTriggerOutput(input: {
  readonly event: unknown;
  readonly assets: ReadonlyArray<NotionTriggerAsset>;
  readonly statusProperty: string;
  readonly templateProperty: string;
}): Readonly<Record<string, unknown>> {
  const data = readRecord(readRecord(input.event)?.data) ?? {};
  const properties = readNotionProperties(data);
  const flattened = flattenNotionProperties(properties, input.templateProperty);
  const firstAsset = input.assets[0];
  const pageId = readNonEmptyString(data.id) ?? readEntityId(input.event) ?? "";
  const pageTitle = readPageTitle(properties) ?? firstAsset?.name ?? pageId;

  return {
    provider: NOTION_AUTOMATION_TRIGGER.service,
    eventType: NOTION_AUTOMATION_TRIGGER.event,
    pageId,
    databaseId: readDatabaseId(data),
    pageUrl: readNonEmptyString(data.url) ?? "",
    pageTitle,
    statusProperty: input.statusProperty,
    status: readStatusProperty(properties, input.statusProperty) ?? "",
    assetId: pageId,
    assetName: flattened.aliases.adName ?? firstAsset?.name ?? pageTitle,
    mediaUrl: firstAsset?.url ?? "",
    fileUrl: firstAsset?.url ?? "",
    mediaType: inferMediaType(firstAsset?.url),
    assets: input.assets.map((asset, index) => ({
      assetId: `${pageId}:${index + 1}`,
      assetName: asset.name,
      assetUrl: asset.url,
      mediaUrl: asset.url,
      propertyName: asset.propertyName,
    })),
    notionProperties: properties,
    mapped: flattened.mapped,
    ...flattened.camelCase,
    ...flattened.aliases,
  };
}

function readNotionProperties(data: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return readRecord(data.properties_value) ?? readRecord(data.propertiesValue) ?? readRecord(data.properties) ?? {};
}

function readDatabaseId(data: Readonly<Record<string, unknown>>): string {
  const parent = readRecord(data.parent);
  return readNonEmptyString(parent?.database_id) ?? readNonEmptyString(parent?.data_source_id) ?? "";
}

function readEntityId(event: unknown): string | null {
  const entity = readRecord(readRecord(event)?.entity);
  return readNonEmptyString(entity?.id);
}

function readStatusProperty(properties: Readonly<Record<string, unknown>>, propertyName: string): string | null {
  return readNotionPropertyValue(findPropertyValue(properties, propertyName));
}

function findPropertyValue(properties: Readonly<Record<string, unknown>>, propertyName: string): unknown {
  if (properties[propertyName] !== undefined) return properties[propertyName];
  const normalizedName = propertyName.trim().toLocaleLowerCase();
  return Object.entries(properties).find(([name]) => name.trim().toLocaleLowerCase() === normalizedName)?.[1];
}

function readPageTitle(properties: Readonly<Record<string, unknown>>): string | null {
  for (const propertyValue of Object.values(properties)) {
    const property = readRecord(propertyValue);
    if (!property || property.type !== "title" || !Array.isArray(property.title)) continue;
    const title = property.title.map(readRichText).filter(Boolean).join("").trim();
    if (title) return title;
  }
  return null;
}

function readRichText(value: unknown): string {
  const richText = readRecord(value);
  const text = readRecord(richText?.text);
  return readNonEmptyString(richText?.plain_text) ?? readNonEmptyString(text?.content) ?? "";
}

function doesDatabaseMatch(config: Readonly<Record<string, unknown>>, actualDatabaseId: unknown): boolean {
  const configuredDatabaseId = readNonEmptyString(config.notionDatabaseId);
  if (!configuredDatabaseId) return true;
  const databaseId = readNonEmptyString(actualDatabaseId);
  return databaseId !== null && normalizeIdentifier(databaseId) === normalizeIdentifier(configuredDatabaseId);
}

function doesStatusMatch(config: Readonly<Record<string, unknown>>, actualStatus: unknown): boolean {
  const configuredStatus = readNonEmptyString(config.notionStatusValue);
  if (!configuredStatus) return true;
  const status = readNonEmptyString(actualStatus);
  return status !== null && status.toLocaleLowerCase() === configuredStatus.toLocaleLowerCase();
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replaceAll("-", "").trim().toLocaleLowerCase();
}

function inferMediaType(url: string | undefined): "video" | "image" | "" {
  if (!url) return "";
  const pathname = url.split("?", 1)[0];
  const extension = pathname.split(".").pop()?.toLocaleLowerCase();
  return extension && VIDEO_FILE_EXTENSIONS.has(extension) ? "video" : "image";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return isRecord(value) ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}
