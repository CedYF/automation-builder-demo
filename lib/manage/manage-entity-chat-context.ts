import type { ComposerAttachment, ComposerDraft } from "@/app/chat/lib/suggestions";
import type {
  AdData,
  AdSetData,
  CampaignData,
  EntityData,
  EntityType,
  ManageChatEntityRequest,
} from "@/app/(dashboard)/manage/types";

export const MANAGE_ENTITY_DRAG_MIME = "application/x-admanage-manage-entity";

export type ManageEntityChatContext = ManageChatEntityRequest;

export interface ManageEntityDragPayload {
  readonly kind: "single" | "batch";
  readonly entities: readonly ManageEntityChatContext[];
  readonly entityTypeLabel?: string;
  readonly selectAllMode?: boolean;
  readonly totalSelectedCount?: number;
}

const ENTITY_TYPE_LABELS: Record<ManageEntityChatContext["entityType"], string> = {
  campaign: "Campaign",
  adset: "Ad set",
  ad: "Ad",
};

const ENTITY_TYPE_PLURAL_LABELS: Record<ManageEntityChatContext["entityType"], string> = {
  campaign: "Campaigns",
  adset: "Ad sets",
  ad: "Ads",
};

export const MANAGE_ENTITY_SINGLE_CONTEXT_HEADER = "Use this Manage entity as context:";
export const MANAGE_ENTITY_BATCH_CONTEXT_HEADER = "Use these Manage entities as context:";
export const MANAGE_ENTITY_CHANGE_SUFFIX = "Change: ";
export const MANAGE_ENTITY_COMPOSER_PLACEHOLDER = "Pause, edit, duplicate, or report on these items…";

export interface ManageEntityMessageDisplay {
  readonly attachment: ComposerAttachment;
  readonly instruction: string;
}

function buildEntityContextLines(entity: ManageEntityChatContext): string[] {
  const entityLabel = ENTITY_TYPE_LABELS[entity.entityType];
  return [
    `Entity type: ${entityLabel}`,
    `Entity name: ${entity.entityName}`,
    `${entityLabel} ID: ${entity.entityId}`,
    entity.accountId ? `Ad account ID: ${entity.accountId}` : null,
    entity.status ? `Status: ${entity.status}` : null,
    entity.parentCampaignName ? `Campaign: ${entity.parentCampaignName}` : null,
    entity.parentCampaignId ? `Campaign ID: ${entity.parentCampaignId}` : null,
    entity.parentAdsetName ? `Ad set: ${entity.parentAdsetName}` : null,
    entity.parentAdsetId ? `Ad set ID: ${entity.parentAdsetId}` : null,
  ].filter((line): line is string => Boolean(line));
}

function buildSingleEntityDraftText(entity: ManageEntityChatContext): string {
  return `${MANAGE_ENTITY_SINGLE_CONTEXT_HEADER}

${buildEntityContextLines(entity).join("\n")}

${MANAGE_ENTITY_CHANGE_SUFFIX}`;
}

function buildBatchEntityDraftText(options: {
  readonly entities: readonly ManageEntityChatContext[];
  readonly entityTypeLabel: string;
  readonly selectAllMode?: boolean;
  readonly totalSelectedCount?: number;
}): string {
  const { entities, entityTypeLabel, selectAllMode, totalSelectedCount } = options;
  const headerLines = [
    `Entity type: ${entityTypeLabel}`,
    entities[0]?.accountId ? `Ad account ID: ${entities[0].accountId}` : null,
    selectAllMode && totalSelectedCount
      ? `Selection mode: all pages (${totalSelectedCount} total). Loaded IDs below may be a subset — use list tools if you need the full set.`
      : `Selected count: ${entities.length}`,
  ].filter((line): line is string => Boolean(line));

  const entityBlocks = entities.map((entity, index) => {
    const lines = buildEntityContextLines(entity);
    return `[${index + 1}]\n${lines.join("\n")}`;
  });

  return `${MANAGE_ENTITY_BATCH_CONTEXT_HEADER}

${headerLines.join("\n")}

${entityBlocks.join("\n\n")}

${MANAGE_ENTITY_CHANGE_SUFFIX}`;
}

function buildEntityAttachment(entity: ManageEntityChatContext): ComposerAttachment {
  const entityLabel = ENTITY_TYPE_LABELS[entity.entityType];
  const subtitleParts = [
    entity.status ? `Status: ${entity.status}` : null,
    entity.parentCampaignName ? `Campaign: ${entity.parentCampaignName}` : null,
    entity.parentAdsetName ? `Ad set: ${entity.parentAdsetName}` : null,
    `ID: ${entity.entityId}`,
  ].filter((part): part is string => Boolean(part));

  return {
    id: `manage:${entity.entityType}:${entity.entityId}`,
    label: entityLabel,
    title: entity.entityName,
    subtitle: subtitleParts.join(" · ") || null,
    imageUrl: null,
  };
}

function buildBatchAttachment(options: {
  readonly entities: readonly ManageEntityChatContext[];
  readonly entityTypeLabel: string;
}): ComposerAttachment {
  const { entities, entityTypeLabel } = options;
  const firstEntity = entities[0];
  const title =
    entities.length === 1 && firstEntity
      ? firstEntity.entityName
      : `${entities.length} ${entityTypeLabel.toLowerCase()}`;

  return {
    id: `manage:batch:${entities.map((entity) => entity.entityId).join(",")}`,
    label: entityTypeLabel,
    title,
    subtitle:
      entities.length === 1 && firstEntity ? `ID: ${firstEntity.entityId}` : `${entities.length} selected from Manage`,
    imageUrl: null,
  };
}

/**
 * Builds a composer draft for a single Manage entity (campaign, ad set, or ad).
 */
export function buildManageEntityComposerDraft(entity: ManageEntityChatContext): ComposerDraft {
  return {
    text: buildSingleEntityDraftText(entity),
    attachment: buildEntityAttachment(entity),
  };
}

/**
 * Builds a composer draft for a bulk Manage selection.
 */
export function buildManageEntityBatchComposerDraft(options: {
  readonly entities: readonly ManageEntityChatContext[];
  readonly entityTypeLabel: string;
  readonly selectAllMode?: boolean;
  readonly totalSelectedCount?: number;
}): ComposerDraft {
  const { entities, entityTypeLabel, selectAllMode, totalSelectedCount } = options;

  return {
    text: buildBatchEntityDraftText({ entities, entityTypeLabel, selectAllMode, totalSelectedCount }),
    attachment: buildBatchAttachment({ entities, entityTypeLabel }),
  };
}

/**
 * Returns true when the composer draft carries hidden Manage entity MCP context.
 */
export function isManageEntityComposerDraft(draft: ComposerDraft): boolean {
  return (
    draft.attachment?.id.startsWith("manage:") === true &&
    (draft.text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER) ||
      draft.text.startsWith(MANAGE_ENTITY_BATCH_CONTEXT_HEADER))
  );
}

/**
 * Manage entity drafts keep MCP context in draft.text but leave the input empty for the user's instruction.
 */
export function getManageEntityComposerInputValue(): string {
  return "";
}

/**
 * Combines hidden Manage entity context with the user's composer instruction.
 */
export function mergeManageEntityComposerMessage(contextText: string, userInstruction: string): string {
  const trimmedInstruction = userInstruction.trim();
  if (contextText.endsWith(MANAGE_ENTITY_CHANGE_SUFFIX)) {
    return `${contextText}${trimmedInstruction}`;
  }

  if (!trimmedInstruction) return contextText;
  return `${contextText}\n\n${trimmedInstruction}`;
}

/** Returns true when persisted chat text carries hidden Manage entity MCP context. */
export function isManageEntityMessageText(text: string): boolean {
  return text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER) || text.startsWith(MANAGE_ENTITY_BATCH_CONTEXT_HEADER);
}

/** Returns the user's visible instruction from a merged Manage entity message. */
export function extractManageEntityUserInstruction(text: string): string {
  if (!isManageEntityMessageText(text)) return text.trim();

  const changeIndex = text.lastIndexOf(MANAGE_ENTITY_CHANGE_SUFFIX);
  if (changeIndex === -1) return "";
  return text.slice(changeIndex + MANAGE_ENTITY_CHANGE_SUFFIX.length).trim();
}

function parseContextLineValue(lines: readonly string[], prefix: string): string | null {
  const line = lines.find((entry) => entry.startsWith(`${prefix}: `));
  return line ? line.slice(prefix.length + 2).trim() : null;
}

function entityTypeFromLabel(label: string): ManageEntityChatContext["entityType"] | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "campaign") return "campaign";
  if (normalized === "ad set") return "adset";
  if (normalized === "ad") return "ad";
  return null;
}

function parseEntityBlock(blockText: string): ManageEntityChatContext | null {
  const lines = blockText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entityTypeLabel = parseContextLineValue(lines, "Entity type");
  if (!entityTypeLabel) return null;

  const entityType = entityTypeFromLabel(entityTypeLabel);
  if (!entityType) return null;

  const entityName = parseContextLineValue(lines, "Entity name");
  if (!entityName) return null;

  const entityId = parseContextLineValue(lines, `${ENTITY_TYPE_LABELS[entityType]} ID`);
  if (!entityId) return null;

  const parentCampaignId = parseContextLineValue(lines, "Campaign ID");
  const parentAdsetId = parseContextLineValue(lines, "Ad set ID");

  return {
    entityType,
    entityId,
    entityName,
    ...(parseContextLineValue(lines, "Ad account ID")
      ? { accountId: parseContextLineValue(lines, "Ad account ID")! }
      : {}),
    ...(parseContextLineValue(lines, "Status") ? { status: parseContextLineValue(lines, "Status")! } : {}),
    ...(parseContextLineValue(lines, "Campaign")
      ? { parentCampaignName: parseContextLineValue(lines, "Campaign")! }
      : {}),
    ...(parentCampaignId && entityType !== "campaign" ? { parentCampaignId } : {}),
    ...(parseContextLineValue(lines, "Ad set") ? { parentAdsetName: parseContextLineValue(lines, "Ad set")! } : {}),
    ...(parentAdsetId && entityType === "ad" ? { parentAdsetId } : {}),
  };
}

function splitBatchEntityBlocks(contextBody: string): readonly string[] {
  const blocksSectionMatch = contextBody.match(/\n\[1\]\n([\s\S]*)$/);
  if (!blocksSectionMatch?.[1]) return [];

  return blocksSectionMatch[1]
    .split(/\n\n(?=\[\d+\]\n)/)
    .map((block) => block.replace(/^\[\d+\]\n/, "").trim())
    .filter(Boolean);
}

function parseBatchEntityTypeLabel(contextBody: string): string {
  const headerEnd = contextBody.search(/\n\[1\]\n/);
  const headerSection = headerEnd === -1 ? contextBody : contextBody.slice(0, headerEnd);
  return parseContextLineValue(headerSection.split("\n"), "Entity type") ?? "Entities";
}

/**
 * Derives transcript-friendly chip + instruction from a persisted Manage entity message.
 * Returns null for regular chat messages.
 */
export function parseManageEntitiesFromMessage(text: string): ManageEntityChatContext[] {
  if (!isManageEntityMessageText(text)) return [];

  const changeIndex = text.lastIndexOf(MANAGE_ENTITY_CHANGE_SUFFIX);
  if (changeIndex === -1) return [];

  const contextBody = text
    .slice(
      text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER)
        ? MANAGE_ENTITY_SINGLE_CONTEXT_HEADER.length
        : MANAGE_ENTITY_BATCH_CONTEXT_HEADER.length,
      changeIndex,
    )
    .trim();

  if (text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER)) {
    const entity = parseEntityBlock(contextBody);
    return entity ? [entity] : [];
  }

  return splitBatchEntityBlocks(contextBody)
    .map(parseEntityBlock)
    .filter((entity): entity is ManageEntityChatContext => entity !== null);
}

/** True when the message carries explicit Manage entity IDs (not select-all mode). */
export function hasAuthoritativeManageEntitySelection(text: string): boolean {
  if (!isManageEntityMessageText(text)) return false;
  if (text.includes("Selection mode: all pages")) return false;
  return parseManageEntitiesFromMessage(text).length > 0;
}

/**
 * Derives transcript-friendly chip + instruction from a persisted Manage entity message.
 * Returns null for regular chat messages.
 */
export function parseManageEntityMessageForDisplay(text: string): ManageEntityMessageDisplay | null {
  if (!isManageEntityMessageText(text)) return null;

  const instruction = extractManageEntityUserInstruction(text);
  const entities = parseManageEntitiesFromMessage(text);
  if (entities.length === 0) return null;

  if (entities.length === 1 && entities[0] && text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER)) {
    return { attachment: buildEntityAttachment(entities[0]), instruction };
  }

  const changeIndex = text.lastIndexOf(MANAGE_ENTITY_CHANGE_SUFFIX);
  if (changeIndex === -1) return null;

  const contextBody = text
    .slice(
      text.startsWith(MANAGE_ENTITY_SINGLE_CONTEXT_HEADER)
        ? MANAGE_ENTITY_SINGLE_CONTEXT_HEADER.length
        : MANAGE_ENTITY_BATCH_CONTEXT_HEADER.length,
      changeIndex,
    )
    .trim();

  const entityTypeLabel = parseBatchEntityTypeLabel(contextBody);

  return {
    attachment: buildBatchAttachment({ entities, entityTypeLabel }),
    instruction,
  };
}

/**
 * Converts a ManageChatEntityRequest from the context menu into chat context.
 */
export function manageChatEntityRequestToContext(request: ManageChatEntityRequest): ManageEntityChatContext {
  return request;
}

/**
 * Returns a human-readable plain-text fallback for drag payloads.
 */
export function buildManageEntityDragPlainText(entity: ManageEntityChatContext): string {
  const entityLabel = ENTITY_TYPE_LABELS[entity.entityType];
  return `${entityLabel}: ${entity.entityName} (ID: ${entity.entityId})`;
}

/**
 * Returns a human-readable plain-text fallback for batch drag payloads.
 */
export function buildManageEntityBatchDragPlainText(options: {
  readonly entities: readonly ManageEntityChatContext[];
  readonly entityTypeLabel: string;
}): string {
  const { entities, entityTypeLabel } = options;
  if (entities.length === 1 && entities[0]) {
    return buildManageEntityDragPlainText(entities[0]);
  }

  const preview = entities
    .slice(0, 3)
    .map((entity) => `${entity.entityName} (${entity.entityId})`)
    .join(", ");

  const suffix = entities.length > 3 ? `, +${entities.length - 3} more` : "";
  return `${entities.length} ${entityTypeLabel}: ${preview}${suffix}`;
}

/**
 * Serializes a Manage entity drag payload for dataTransfer.
 */
export function serializeManageEntityDragPayload(payload: ManageEntityDragPayload): string {
  return JSON.stringify(payload);
}

/**
 * Parses a Manage entity drag payload from dataTransfer.
 */
export function parseManageEntityDragPayload(raw: string): ManageEntityDragPayload | null {
  if (!raw.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    if (record.kind !== "single" && record.kind !== "batch") return null;
    if (!Array.isArray(record.entities) || record.entities.length === 0) return null;

    const entities = record.entities
      .map(parseManageEntityChatContext)
      .filter((entity): entity is ManageEntityChatContext => entity !== null);

    if (entities.length === 0) return null;

    return {
      kind: record.kind,
      entities,
      ...(typeof record.entityTypeLabel === "string" ? { entityTypeLabel: record.entityTypeLabel } : {}),
      ...(record.selectAllMode === true ? { selectAllMode: true as const } : {}),
      ...(typeof record.totalSelectedCount === "number" ? { totalSelectedCount: record.totalSelectedCount } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Builds a ComposerDraft from a parsed drag payload.
 */
export function buildComposerDraftFromDragPayload(payload: ManageEntityDragPayload): ComposerDraft {
  if (payload.kind === "single" && payload.entities.length === 1 && payload.entities[0]) {
    return buildManageEntityComposerDraft(payload.entities[0]);
  }

  const entityTypeLabel =
    payload.entityTypeLabel ??
    (payload.entities[0] ? ENTITY_TYPE_PLURAL_LABELS[payload.entities[0].entityType] : "Entities");

  return buildManageEntityBatchComposerDraft({
    entities: payload.entities,
    entityTypeLabel,
    selectAllMode: payload.selectAllMode,
    totalSelectedCount: payload.totalSelectedCount,
  });
}

function parseManageEntityChatContext(value: unknown): ManageEntityChatContext | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (record.entityType !== "campaign" && record.entityType !== "adset" && record.entityType !== "ad") {
    return null;
  }
  if (typeof record.entityId !== "string" || !record.entityId.trim()) return null;
  if (typeof record.entityName !== "string" || !record.entityName.trim()) return null;

  return {
    entityType: record.entityType,
    entityId: record.entityId,
    entityName: record.entityName,
    ...(typeof record.accountId === "string" ? { accountId: record.accountId } : {}),
    ...(typeof record.status === "string" ? { status: record.status } : {}),
    ...(typeof record.parentCampaignId === "string" ? { parentCampaignId: record.parentCampaignId } : {}),
    ...(typeof record.parentCampaignName === "string" ? { parentCampaignName: record.parentCampaignName } : {}),
    ...(typeof record.parentAdsetId === "string" ? { parentAdsetId: record.parentAdsetId } : {}),
    ...(typeof record.parentAdsetName === "string" ? { parentAdsetName: record.parentAdsetName } : {}),
  };
}

/**
 * Sets structured Manage entity drag data on a DataTransfer object.
 */
export function setManageEntityDragData(dataTransfer: DataTransfer, payload: ManageEntityDragPayload): void {
  dataTransfer.setData(MANAGE_ENTITY_DRAG_MIME, serializeManageEntityDragPayload(payload));
  dataTransfer.setData(
    "text/plain",
    payload.kind === "single" && payload.entities[0]
      ? buildManageEntityDragPlainText(payload.entities[0])
      : buildManageEntityBatchDragPlainText({
          entities: payload.entities,
          entityTypeLabel:
            payload.entityTypeLabel ??
            (payload.entities[0] ? ENTITY_TYPE_PLURAL_LABELS[payload.entities[0].entityType] : "Entities"),
        }),
  );
  dataTransfer.effectAllowed = "copy";
}

/**
 * Returns true when a drag event carries Manage entity context.
 */
export function hasManageEntityDragPayload(dataTransfer: Pick<DataTransfer, "types">): boolean {
  return Array.from(dataTransfer.types).includes(MANAGE_ENTITY_DRAG_MIME);
}

export function buildCampaignChatContext(campaign: CampaignData, accountId: string | null): ManageEntityChatContext {
  return {
    entityType: "campaign",
    entityId: campaign.campaignId,
    entityName: campaign.campaignName?.trim() || campaign.campaignId,
    accountId,
    status: campaign.status ?? campaign.effective_status ?? null,
  };
}

export function buildAdsetChatContext(adset: AdSetData, accountId: string | null): ManageEntityChatContext {
  return {
    entityType: "adset",
    entityId: adset.adsetId,
    entityName: adset.adsetName?.trim() || adset.adsetId,
    accountId,
    status: adset.status ?? null,
    parentCampaignId: adset.campaignId ?? null,
    parentCampaignName: adset.campaignName ?? null,
  };
}

export function buildAdChatContext(ad: AdData, accountId: string | null): ManageEntityChatContext {
  return {
    entityType: "ad",
    entityId: ad.adId,
    entityName: ad.adName?.trim() || ad.adId,
    accountId,
    status: ad.status ?? null,
    parentCampaignId: ad.campaignId ?? null,
    parentCampaignName: ad.campaignName ?? null,
    parentAdsetId: ad.adsetId ?? null,
    parentAdsetName: ad.adsetName ?? null,
  };
}

function entityTypeLabelForTab(activeTab: EntityType): string {
  switch (activeTab) {
    case "campaigns":
      return "Campaigns";
    case "adsets":
      return "Ad sets";
    case "ads":
      return "Ads";
    default:
      return "Entities";
  }
}

/**
 * Maps the current Manage tab selection to structured chat contexts.
 */
export function resolveSelectedManageEntities(options: {
  readonly activeTab: EntityType;
  readonly rowSelection: Readonly<Record<string, boolean>>;
  readonly data: readonly EntityData[];
  readonly accountId: string | null;
}): ManageEntityChatContext[] {
  const selectedIds = new Set(
    Object.entries(options.rowSelection)
      .filter(([, isSelected]) => isSelected)
      .map(([entityId]) => entityId),
  );

  if (selectedIds.size === 0) return [];

  return options.data
    .filter((entity) => {
      if ("campaignId" in entity && options.activeTab === "campaigns") {
        return selectedIds.has(entity.campaignId);
      }
      if ("adsetId" in entity && options.activeTab === "adsets") {
        return selectedIds.has(entity.adsetId);
      }
      if ("adId" in entity && options.activeTab === "ads") {
        return selectedIds.has(entity.adId);
      }
      return false;
    })
    .map((entity) => {
      if ("campaignId" in entity && options.activeTab === "campaigns") {
        return buildCampaignChatContext(entity, options.accountId);
      }
      if ("adsetId" in entity && options.activeTab === "adsets") {
        return buildAdsetChatContext(entity, options.accountId);
      }
      return buildAdChatContext(entity as AdData, options.accountId);
    });
}

/**
 * Builds a composer draft for the current Manage tab selection.
 */
export function buildManageSelectionComposerDraft(options: {
  readonly activeTab: EntityType;
  readonly rowSelection: Readonly<Record<string, boolean>>;
  readonly data: readonly EntityData[];
  readonly accountId: string | null;
  readonly selectAllMode?: boolean;
  readonly totalSelectedCount?: number;
}): ComposerDraft | null {
  const entities = resolveSelectedManageEntities(options);
  if (entities.length === 0) return null;

  if (entities.length === 1 && entities[0] && !options.selectAllMode) {
    return buildManageEntityComposerDraft(entities[0]);
  }

  return buildManageEntityBatchComposerDraft({
    entities,
    entityTypeLabel: entityTypeLabelForTab(options.activeTab),
    selectAllMode: options.selectAllMode,
    totalSelectedCount: options.totalSelectedCount,
  });
}
