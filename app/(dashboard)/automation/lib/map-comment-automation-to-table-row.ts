/**
 * Maps comment-automation rules into the shape used by /automation My Automations.
 * Kept pure so the table can merge flow + comment rows without duplicating mapping logic.
 */

import { COMMENT_ACTION_EVENTS } from "./comment-flow-mapper";

export const COMMENT_AUTOMATION_SOURCE = "comment" as const;
export const FLOW_AUTOMATION_SOURCE = "flow" as const;

export type AutomationTableSource = typeof COMMENT_AUTOMATION_SOURCE | typeof FLOW_AUTOMATION_SOURCE;

export const COMMENT_AUTOMATION_SERVICE = "comments";

/** Reuses the flow-mapper's event names so both surfaces label an action identically. */
const COMMENT_ACTION_LABELS: Readonly<Record<string, string>> = COMMENT_ACTION_EVENTS;

const COMMENT_TRIGGER_LABELS: Readonly<Record<string, string>> = {
  realtime: "New Comment",
  scheduled: "Scheduled scan",
  manual: "Manual Run",
};

export interface CommentAutomationApiRule {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly triggerType?: string;
  readonly frequency?: string | null;
  readonly scheduledTime?: string | null;
  readonly actionType?: string;
  readonly userId?: string;
  readonly adAccountId?: string | null;
  readonly accountName?: string | null;
  readonly pageId?: string | null;
  /** Shared by every per-page rule of one automation. Null on pre-grouping rows. */
  readonly groupId?: string | null;
  readonly processedCount?: number;
  readonly lastRunAt?: string | null;
  readonly updatedAt?: string;
  readonly createdAt?: string;
}

export interface AutomationTableStep {
  readonly service: string;
  readonly event?: string;
}

export interface CommentAutomationTableRow {
  readonly rowKey: string;
  readonly source: typeof COMMENT_AUTOMATION_SOURCE;
  readonly id: number;
  /** Shared by every per-page rule of one automation. Null on pre-grouping rows. */
  readonly groupId: string | null;
  readonly name: string;
  readonly steps: AutomationTableStep[];
  readonly lastModified: Date;
  readonly lastRun?: Date;
  readonly status: "on" | "off" | "draft" | "archived";
  readonly userEmail: string;
  readonly userInitials: string;
  readonly nodes: never[];
  readonly accountId?: string;
  readonly accountName?: string;
  readonly runCount: number;
  readonly favourite: boolean;
  readonly rateLimited: boolean;
  /** Always false: comment rules fire on incoming comments, never on a cadence. */
  readonly manualOnly: boolean;
  readonly pageId?: string;
}

/**
 * Builds a stable row key so flow and comment numeric ids never collide in the unified table.
 */
export function buildAutomationRowKey(source: AutomationTableSource, id: number): string {
  return `${source}:${id}`;
}

export function isCommentAutomationRowKey(rowKey: string): boolean {
  return rowKey.startsWith(`${COMMENT_AUTOMATION_SOURCE}:`);
}

function mapCommentStatusToUi(status: string): "on" | "off" | "draft" | "archived" {
  if (status === "active" || status === "executing") return "on";
  return "off";
}

function buildCommentSteps(rule: CommentAutomationApiRule): AutomationTableStep[] {
  const triggerEvent = COMMENT_TRIGGER_LABELS[rule.triggerType ?? ""] ?? "Comment Trigger";
  const actionEvent = COMMENT_ACTION_LABELS[rule.actionType ?? ""] ?? "Comment Action";
  return [
    { service: COMMENT_AUTOMATION_SERVICE, event: triggerEvent },
    { service: COMMENT_AUTOMATION_SERVICE, event: actionEvent },
  ];
}

/**
 * Converts a CommentsServer rule into an /automation table row.
 */
export function mapCommentAutomationToTableRow(rule: CommentAutomationApiRule): CommentAutomationTableRow {
  const userEmail = typeof rule.userId === "string" ? rule.userId : "";
  const updatedAt = rule.updatedAt || rule.createdAt;
  const lastRunAt = rule.lastRunAt;

  return {
    rowKey: buildAutomationRowKey(COMMENT_AUTOMATION_SOURCE, rule.id),
    source: COMMENT_AUTOMATION_SOURCE,
    id: rule.id,
    groupId: rule.groupId ?? null,
    name: rule.name,
    steps: buildCommentSteps(rule),
    lastModified: updatedAt ? new Date(updatedAt) : new Date(),
    lastRun: lastRunAt ? new Date(lastRunAt) : undefined,
    status: mapCommentStatusToUi(rule.status),
    userEmail,
    userInitials: userEmail.slice(0, 2).toUpperCase() || "U",
    nodes: [],
    accountId: rule.adAccountId ?? undefined,
    accountName: rule.accountName ?? undefined,
    runCount: rule.processedCount ?? 0,
    favourite: false,
    rateLimited: false,
    manualOnly: false,
    pageId: rule.pageId ?? undefined,
  };
}

/**
 * Stamps DB-validated account names onto comment rules so the home list and
 * table do not have to guess from the open workspace alone.
 */
export function attachLookedUpAccountNames(
  rules: ReadonlyArray<CommentAutomationApiRule>,
  names: Readonly<Record<string, string>>,
): CommentAutomationApiRule[] {
  return rules.map((rule) => {
    const accountId = rule.adAccountId;
    if (!accountId) return { ...rule, accountName: rule.accountName ?? null };
    return { ...rule, accountName: names[accountId] ?? rule.accountName ?? null };
  });
}

/**
 * Deep-link into the comments automation tab, optionally scoped to the rule's page.
 */
export function buildCommentAutomationDeepLink(options: { readonly pageId?: string }): string {
  const params = new URLSearchParams({ tab: "automation" });
  if (options.pageId) {
    params.set("pageId", options.pageId);
  }
  return `/comments?${params.toString()}`;
}
