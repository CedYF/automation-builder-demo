/**
 * Bidirectional mapping between /automation flow nodes (service: "comments")
 * and CommentsServer comment-automation rules.
 */

import type {
  AutomationActionConfig,
  AutomationConditions,
  CommentPlatform,
  CreateRuleParams,
  SyncGroupParams,
  UpdateRuleParams,
} from "@/app/(dashboard)/comments/lib/api/automation";
import { inferToneValue } from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";
import { readCommentPageNames } from "./comment-page-selection";

export const COMMENTS_SERVICE = "comments";

export {
  commentSourceFromIsAdOnly,
  isAdOnlyFromCommentSource,
  type CommentSourceFilter,
} from "@/app/(dashboard)/comments/_features/automation/utils/comment-source";

export const COMMENT_TRIGGER_EVENTS = {
  realtime: "New Comment",
  scheduled: "Scheduled scan",
  manual: "Manual Run",
} as const;

/** Legacy event string persisted before the scheduled trigger was renamed. */
const LEGACY_SCHEDULED_COMMENT_TRIGGER_EVENT = "Scheduled";

export const COMMENT_ACTION_EVENTS = {
  hide: "Hide Comment",
  delete: "Delete Comment",
  reply: "Reply to Comment",
  like: "Like Comment",
} as const;

export type CommentTriggerType = keyof typeof COMMENT_TRIGGER_EVENTS;
export type CommentActionType = keyof typeof COMMENT_ACTION_EVENTS;

export interface CommentFlowNode {
  readonly id: string;
  readonly type: "trigger" | "action" | "filter" | "delay" | "approval";
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
  readonly position: number;
}

export interface CommentAutomationRuleSnapshot {
  readonly id: number;
  readonly name: string;
  readonly status?: string;
  readonly platform?: CommentPlatform;
  readonly triggerType: CommentTriggerType | string;
  readonly conditions?: AutomationConditions;
  readonly actionType: CommentActionType | string;
  readonly actionConfig?: AutomationActionConfig;
  readonly frequency?: string;
  readonly scheduledTime?: string;
  readonly adAccountId?: string | null;
  readonly pageId?: string | null;
  /**
   * Every page the automation covers. CommentsServer stores one rule per page,
   * so a grouped automation hydrates from its members rather than from the
   * single `pageId` of whichever member was opened.
   */
  readonly pageIds?: readonly string[];
  readonly pagePlatforms?: Readonly<Record<string, CommentPlatform>>;
  /** Display name per page, as CommentsServer knows it; pages it cannot name are absent. */
  readonly pageNames?: Readonly<Record<string, string>>;
  /** Ties the per-page rules together; absent only on rules predating the column. */
  readonly groupId?: string | null;
}

export interface CommentFlowSavePayload {
  readonly name: string;
  readonly platform: CommentPlatform;
  readonly pagePlatforms: Readonly<Record<string, CommentPlatform>>;
  readonly triggerType: CommentTriggerType;
  readonly conditions: AutomationConditions;
  readonly actionType: CommentActionType;
  readonly actionConfig: AutomationActionConfig;
  readonly pageIds: string[];
  /** Set when editing an existing automation, so the save updates every page. */
  readonly groupId?: string;
  readonly adAccountId?: string;
  readonly frequency?: string;
  readonly scheduledTime?: string;
  /** Create-only: also run the new rule once over already-stored comments. */
  readonly processExisting?: boolean;
}

/**
 * Result of validating a comment flow.
 *
 * `nodeId` is set whenever a single step is at fault, so the canvas can highlight
 * that exact card instead of leaving the user to match a step number against the
 * toast (ADM-10141). It stays undefined for flow-level problems such as a missing
 * trigger, where no existing node is to blame.
 */
export type CommentFlowSaveResult =
  | { ok: true; value: CommentFlowSavePayload }
  | { ok: false; error: string; nodeId?: string };

export const DEFAULT_COMMENT_SCHEDULE_FREQUENCY = "hourly";
export const DEFAULT_COMMENT_SCHEDULE_TIME = "00:00";

const DEFAULT_SCHEDULE_FREQUENCY = DEFAULT_COMMENT_SCHEDULE_FREQUENCY;
const DEFAULT_SCHEDULE_TIME = DEFAULT_COMMENT_SCHEDULE_TIME;

export function isCommentAutomationFlow(nodes: ReadonlyArray<CommentFlowNode>): boolean {
  return nodes.some((node) => node.service === COMMENTS_SERVICE);
}

export function buildCommentAutomationId(ruleId: number): string {
  return `comment:${ruleId}`;
}

export function parseCommentAutomationId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^comment:(\d+)$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isCommentTriggerType(value: string): value is CommentTriggerType {
  return value in COMMENT_TRIGGER_EVENTS;
}

function isCommentActionType(value: string): value is CommentActionType {
  return value in COMMENT_ACTION_EVENTS;
}

export function triggerEventToType(event: string | undefined): CommentTriggerType {
  if (event === COMMENT_TRIGGER_EVENTS.scheduled || event === LEGACY_SCHEDULED_COMMENT_TRIGGER_EVENT) {
    return "scheduled";
  }
  if (event === COMMENT_TRIGGER_EVENTS.manual) return "manual";
  return "realtime";
}

export function isCommentsScheduledTriggerEvent(event: string | undefined): boolean {
  return event === COMMENT_TRIGGER_EVENTS.scheduled || event === LEGACY_SCHEDULED_COMMENT_TRIGGER_EVENT;
}

export function readCommentScheduleFields(config: Record<string, unknown>): {
  readonly frequency: string;
  readonly scheduledTime: string;
} {
  return {
    frequency:
      typeof config.frequency === "string" && config.frequency.trim()
        ? config.frequency
        : DEFAULT_COMMENT_SCHEDULE_FREQUENCY,
    scheduledTime:
      typeof config.scheduledTime === "string" && config.scheduledTime.trim()
        ? config.scheduledTime
        : DEFAULT_COMMENT_SCHEDULE_TIME,
  };
}

/** Compact schedule badge for node summaries and lists, e.g. "Hourly at 00:00". */
export function formatCommentScheduleBadge(frequency: string, scheduledTime: string): string {
  const time = scheduledTime.trim() || DEFAULT_COMMENT_SCHEDULE_TIME;
  switch (frequency) {
    case "hourly":
      return `Hourly at ${time}`;
    case "daily":
      return `Daily at ${time}`;
    case "weekly":
      return `Weekly (Sun) at ${time}`;
    default:
      return `Daily at ${time}`;
  }
}

/** Recipe-builder trigger phrase for a scheduled comment scan. */
export function formatCommentScheduleTriggerLabel(frequency: string, scheduledTime: string): string {
  const time = scheduledTime.trim() || DEFAULT_COMMENT_SCHEDULE_TIME;
  switch (frequency) {
    case "hourly":
      return `every hour at ${time}, scan recent comments`;
    case "daily":
      return `daily at ${time}, scan recent comments`;
    case "weekly":
      return `weekly on Sunday at ${time}, scan recent comments`;
    default:
      return `daily at ${time}, scan recent comments`;
  }
}

export function actionEventToType(event: string | undefined): CommentActionType {
  if (event === COMMENT_ACTION_EVENTS.delete) return "delete";
  if (event === COMMENT_ACTION_EVENTS.reply) return "reply";
  if (event === COMMENT_ACTION_EVENTS.like) return "like";
  return "hide";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asPagePlatforms(
  value: unknown,
  pageIds: readonly string[],
  fallback: CommentPlatform,
): Record<string, CommentPlatform> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.fromEntries(pageIds.map((pageId) => [pageId, fallback]));
  }

  const platformEntries = pageIds.map((pageId) => {
    const platform = Object.entries(value).find(([candidatePageId]) => candidatePageId === pageId)?.[1];
    return [pageId, platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : fallback] as const;
  });
  return Object.fromEntries(platformEntries);
}

function asConditions(value: unknown): AutomationConditions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AutomationConditions;
}

function asActionConfig(value: unknown): AutomationActionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AutomationActionConfig;
}

/**
 * True for a step that genuinely belongs to another service and would be dropped
 * on save.
 *
 * A node is only "foreign" once it has an `event`. The editor seeds an empty
 * trigger node, and picking an app without picking an event leaves `service` set
 * with no `event` (rendered as e.g. "Meta · Select an event"). Such a placeholder
 * contributes nothing to the payload, so treating it as a real step blocked every
 * comment automation the user built on top of the seeded flow (ADM-10141).
 */
function isConfiguredForeignStep(node: CommentFlowNode): boolean {
  if (node.type === "delay") return false;
  if (!node.service || node.service === COMMENTS_SERVICE) return false;
  return Boolean(node.event);
}

/** Names the offending step using the same 1-based numbering the canvas shows. */
function describeForeignStep(node: CommentFlowNode, index: number): string {
  return (
    `Step ${index + 1} ("${node.event}") is not a Comments step. ` +
    "Comment automations can only use Comments trigger and action steps for now, so remove it before saving."
  );
}

/**
 * Validates and extracts a CommentsServer create/update payload from flow nodes.
 */
/**
 * The Comments trigger node in a comment automation flow, if present.
 */
export function findCommentTriggerNode(nodes: ReadonlyArray<CommentFlowNode>): CommentFlowNode | undefined {
  return nodes.find((node) => node.type === "trigger" && node.service === COMMENTS_SERVICE);
}

/**
 * The Comments action node in a comment automation flow, if present.
 */
export function findCommentActionNode(nodes: ReadonlyArray<CommentFlowNode>): CommentFlowNode | undefined {
  return nodes.find((node) => node.type === "action" && node.service === COMMENTS_SERVICE);
}

/**
 * Page names the Comments trigger captured when each page was picked. Used to
 * name pages in save errors without re-fetching the live page list.
 */
export function readCommentPageNamesFromFlow(nodes: ReadonlyArray<CommentFlowNode>): Record<string, string> {
  return readCommentPageNames(findCommentTriggerNode(nodes)?.config?.pageNames);
}

/** Group id of the loaded automation, when its rules carry one. */
export function readCommentGroupIdFromFlow(nodes: ReadonlyArray<CommentFlowNode>): string | undefined {
  const groupId = findCommentTriggerNode(nodes)?.config?.commentGroupId;
  return typeof groupId === "string" && groupId ? groupId : undefined;
}

/** Pages the Comments trigger currently targets, in selection order. */
export function readCommentPageIdsFromFlow(nodes: ReadonlyArray<CommentFlowNode>): string[] {
  return asStringArray(findCommentTriggerNode(nodes)?.config?.pageIds);
}

export function buildCommentSavePayloadFromFlow(options: {
  readonly name: string;
  readonly nodes: ReadonlyArray<CommentFlowNode>;
  /** When true (Run), empty pageIds is an error. Save passes false for drafts. */
  readonly requirePages?: boolean;
}): CommentFlowSaveResult {
  const requirePages = options.requirePages !== false;
  const triggerNode = findCommentTriggerNode(options.nodes);
  const actionNode = findCommentActionNode(options.nodes);

  if (!triggerNode) {
    return { ok: false, error: "Add a Comments trigger before saving." };
  }
  if (!actionNode) {
    return { ok: false, error: "Add a Comments action (hide, delete, reply, or like) before saving." };
  }

  const foreignStepIndex = options.nodes.findIndex(isConfiguredForeignStep);
  if (foreignStepIndex !== -1) {
    const foreignStep = options.nodes[foreignStepIndex];
    return { ok: false, error: describeForeignStep(foreignStep, foreignStepIndex), nodeId: foreignStep.id };
  }

  const config = triggerNode.config ?? {};
  const pageIds = asStringArray(config.pageIds);
  if (requirePages && pageIds.length === 0) {
    return {
      ok: false,
      error: "Select at least one Facebook or Instagram page on the Comments trigger.",
      nodeId: triggerNode.id,
    };
  }

  // Empty conditions are allowed: the rule matches every new comment on the
  // selected pages (same as CommentsServer evaluateConditions with {}).
  const conditions = asConditions(config.conditions);

  const actionType = actionEventToType(actionNode.event);
  const actionConfig = asActionConfig(actionNode.config?.actionConfig);
  if (actionType === "reply") {
    const useAI = actionConfig.useAI === true;
    if (useAI && !String(actionConfig.aiPrompt ?? "").trim()) {
      actionConfig.aiPrompt = "Write a helpful reply.";
    }
    if (!useAI && !String(actionConfig.replyTemplate ?? "").trim()) {
      return { ok: false, error: "Enter a reply template for the fixed reply action.", nodeId: actionNode.id };
    }
    if (actionConfig.autoSend == null) {
      actionConfig.autoSend = !useAI;
    }
  }

  const triggerType = triggerEventToType(triggerNode.event);
  const platform: CommentPlatform = config.platform === "instagram" ? "instagram" : "facebook";
  const pagePlatforms = asPagePlatforms(config.pagePlatforms, pageIds, platform);
  // Only the account the trigger derived from its own pages. The builder's
  // `selectedAccountId` is deliberately NOT a fallback: comment automations
  // hide that selector, so it still holds the workspace's default account, and
  // using it would stamp an arbitrary account onto exactly the selections the
  // trigger declined to guess for (pages spanning several accounts).
  const adAccountId = (typeof config.adAccountId === "string" && config.adAccountId) || undefined;
  const schedule =
    triggerType === "scheduled"
      ? {
          frequency:
            typeof config.frequency === "string" && config.frequency ? config.frequency : DEFAULT_SCHEDULE_FREQUENCY,
          scheduledTime:
            typeof config.scheduledTime === "string" && config.scheduledTime
              ? config.scheduledTime
              : DEFAULT_SCHEDULE_TIME,
        }
      : {};

  const payload: CommentFlowSavePayload = {
    name: options.name.trim() || "Untitled Comment Automation",
    platform,
    pagePlatforms,
    triggerType,
    conditions,
    actionType,
    actionConfig: actionType === "reply" ? actionConfig : {},
    pageIds,
    groupId: typeof config.commentGroupId === "string" && config.commentGroupId ? config.commentGroupId : undefined,
    adAccountId,
    processExisting: config.processExisting === true,
    ...schedule,
  };

  return { ok: true, value: payload };
}

export function toCreateRuleParams(
  payload: CommentFlowSavePayload,
  context: { readonly userId: string; readonly company: string; readonly workspaceId?: string },
): CreateRuleParams {
  return {
    name: payload.name,
    platform: payload.platform,
    pagePlatforms: payload.pagePlatforms,
    triggerType: payload.triggerType,
    conditions: payload.conditions,
    actionType: payload.actionType,
    actionConfig: payload.actionConfig,
    pageIds: payload.pageIds,
    userId: context.userId,
    company: context.company,
    workspaceId: context.workspaceId,
    adAccountId: payload.adAccountId,
    frequency: payload.frequency,
    scheduledTime: payload.scheduledTime,
    // Backfill is a create-time behavior only; toUpdateRuleParams omits it on purpose.
    processExisting: payload.processExisting,
  };
}

/**
 * Single-rule update, for automations created before rules carried a group id.
 * `pageId` is the first selection because such a rule owns exactly one page.
 */
export function toUpdateRuleParams(payload: CommentFlowSavePayload): UpdateRuleParams {
  return {
    name: payload.name,
    platform: payload.platform,
    triggerType: payload.triggerType,
    conditions: payload.conditions,
    actionType: payload.actionType,
    actionConfig: payload.actionConfig,
    pageId: payload.pageIds[0],
    frequency: payload.frequency,
    scheduledTime: payload.scheduledTime,
  };
}

/**
 * Group update: shared configuration plus the page set the automation should
 * end up covering. CommentsServer patches the pages kept, creates rules for
 * pages added and removes those taken away, so every page stays in step with
 * what the builder showed.
 *
 * With no `groupId` the automation predates grouping: the save adopts its
 * look-alike rules into a new group first, so editing an old automation moves
 * it onto the new model instead of rewriting one page.
 */
export function toSyncGroupParams(payload: CommentFlowSavePayload): SyncGroupParams {
  return {
    groupId: payload.groupId,
    name: payload.name,
    platform: payload.platform,
    triggerType: payload.triggerType,
    conditions: payload.conditions,
    actionType: payload.actionType,
    actionConfig: payload.actionConfig,
    pageIds: payload.pageIds,
    pagePlatforms: payload.pagePlatforms,
    frequency: payload.frequency,
    scheduledTime: payload.scheduledTime,
  };
}

/**
 * Converts a CommentsServer rule into flow-builder nodes for editing in /automation.
 */
export function mapCommentRuleToFlowNodes(rule: CommentAutomationRuleSnapshot): CommentFlowNode[] {
  const triggerType = isCommentTriggerType(rule.triggerType) ? rule.triggerType : "realtime";
  const actionType = isCommentActionType(rule.actionType) ? rule.actionType : "hide";
  // Prefer the group's pages; `pageId` alone is the pre-grouping fallback and is
  // what made a 9-page automation open showing a single page.
  const pageIds = rule.pageIds?.length ? [...rule.pageIds] : rule.pageId ? [rule.pageId] : [];

  return [
    {
      id: "node-comment-trigger",
      type: "trigger",
      service: COMMENTS_SERVICE,
      event: COMMENT_TRIGGER_EVENTS[triggerType],
      position: 0,
      config: {
        adAccountId: rule.adAccountId ?? undefined,
        pageIds,
        pagePlatforms: rule.pagePlatforms ?? undefined,
        // Seeds the page labels the header, Run panel and History read from
        // the trigger config; the page picker still refreshes them when it loads.
        pageNames: rule.pageNames && Object.keys(rule.pageNames).length > 0 ? { ...rule.pageNames } : undefined,
        commentGroupId: rule.groupId ?? undefined,
        platform: rule.platform ?? "facebook",
        conditions: rule.conditions ?? {},
        // Preserve explicit score UI so gt 61 does not round-trip back to "positive".
        toneValue: inferToneValue(rule.conditions),
        frequency: rule.frequency,
        scheduledTime: rule.scheduledTime,
      },
    },
    {
      id: "node-comment-action",
      type: "action",
      service: COMMENTS_SERVICE,
      event: COMMENT_ACTION_EVENTS[actionType],
      position: 1,
      config: {
        actionConfig: rule.actionConfig ?? {},
      },
    },
  ];
}
