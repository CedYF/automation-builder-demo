import {
  type AutomationRulesClientOptions,
  deleteAutomationRule,
  fetchFlowAutomationRule,
  putAutomationRule,
  putCommentAutomationRule,
} from "@/lib/automation/automation-rules-client";
import { buildAutomationExportBundle } from "@/lib/automation/automation-import-export";
import { AUTOMATION_DUPLICATE_PERMISSION_BLOCKED } from "@/lib/automation/duplicate-automation-rule";

export const COMMENT_AUTOMATION_ARCHIVE_BLOCKED = "Archive is not available for comment automations yet";
export const COMMENT_AUTOMATION_EXPORT_BLOCKED = "Comment automations cannot be exported yet";

export interface HomeAutomationActionTarget {
  readonly id: number;
  readonly source: "flow" | "comment";
  /** Comment automations: the id shared by the automation's per-page rules. */
  readonly groupId?: string | null;
  readonly name: string;
  readonly isArchived: boolean;
}

export function normalizeAutomationName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Automation name is required");
  return trimmed;
}

export function buildAutomationHistoryHref(ruleId: number): string {
  return `/automation?tab=history&automationRuleId=${ruleId}`;
}

export function canRenameHomeAutomation(canManage: boolean): boolean {
  return canManage;
}

export function canDeleteHomeAutomation(canManage: boolean): boolean {
  return canManage;
}

export function canArchiveHomeAutomation(source: "flow" | "comment", canManage: boolean): boolean {
  return canManage && source === "flow";
}

export function canExportHomeAutomation(source: "flow" | "comment"): boolean {
  return source === "flow";
}

export function describeArchiveAutomationBlock(source: "flow" | "comment", canManage: boolean): string | null {
  if (source === "comment") return COMMENT_AUTOMATION_ARCHIVE_BLOCKED;
  if (!canManage) return AUTOMATION_DUPLICATE_PERMISSION_BLOCKED;
  return null;
}

export function describeExportAutomationBlock(source: "flow" | "comment"): string | null {
  return source === "comment" ? COMMENT_AUTOMATION_EXPORT_BLOCKED : null;
}

export async function renameHomeAutomation(
  target: Pick<HomeAutomationActionTarget, "id" | "source" | "groupId">,
  name: string,
  options: AutomationRulesClientOptions = {},
): Promise<string> {
  const nextName = normalizeAutomationName(name);
  if (target.source === "comment") {
    // Rename every page, or the list would show the new name on one rule and
    // the old one on the rest.
    await putCommentAutomationRule(target.id, { name: nextName }, { ...options, groupId: target.groupId });
  } else {
    await putAutomationRule(target.id, { name: nextName }, options);
  }
  return nextName;
}

export async function deleteHomeAutomation(
  target: Pick<HomeAutomationActionTarget, "id" | "source" | "groupId">,
  options: AutomationRulesClientOptions = {},
): Promise<void> {
  await deleteAutomationRule(target.id, target.source, { ...options, groupId: target.groupId });
}

export async function archiveHomeAutomation(
  target: Pick<HomeAutomationActionTarget, "id" | "isArchived">,
  options: AutomationRulesClientOptions = {},
): Promise<"archived" | "paused"> {
  const nextStatus = target.isArchived ? "paused" : "archived";
  await putAutomationRule(target.id, { status: nextStatus }, options);
  return nextStatus;
}

export async function buildHomeAutomationExport(
  ruleId: number,
  options: AutomationRulesClientOptions = {},
): Promise<{ readonly filename: string; readonly content: unknown }> {
  const rule = await fetchFlowAutomationRule(ruleId, options);
  const fileStem = getSafeDownloadFileName(readAutomationName(rule)) || `automation-${ruleId}`;
  return {
    filename: `${fileStem}.json`,
    content: buildAutomationExportBundle({
      rules: [rule],
      exportedAt: new Date().toISOString(),
    }),
  };
}

function readAutomationName(rule: unknown): string {
  if (isRecord(rule) && typeof rule.name === "string") return rule.name;
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function downloadJsonFile(options: { readonly filename: string; readonly content: unknown }): void {
  const blob = new Blob([JSON.stringify(options.content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getSafeDownloadFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
