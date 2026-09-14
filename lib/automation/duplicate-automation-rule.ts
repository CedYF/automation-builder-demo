import { createAutomationDuplicatePayload } from "@/lib/automation/automation-import-export";
import {
  AUTOMATION_RULES_API_PATH,
  type AutomationRulesClientOptions,
  fetchFlowAutomationRule,
  readAutomationApiError,
} from "@/lib/automation/automation-rules-client";

export { AUTOMATION_RULES_API_PATH };
export const COMMENT_AUTOMATION_DUPLICATE_BLOCKED = "Comment automations cannot be duplicated yet";
export const AUTOMATION_DUPLICATE_PERMISSION_BLOCKED = "You do not have permission to manage automations";

export type DuplicateAutomationRuleOptions = AutomationRulesClientOptions;

export interface DuplicateAutomationRuleResult {
  readonly originalName: string;
  readonly copyName: string;
}

/**
 * Posts a paused copy of an already-loaded automation rule.
 */
export async function duplicateExistingAutomationRule(
  rule: unknown,
  options: DuplicateAutomationRuleOptions = {},
): Promise<DuplicateAutomationRuleResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const payload = createAutomationDuplicatePayload(rule);
  await postDuplicatedAutomation(payload, fetchFn);
  return {
    originalName: readAutomationRuleName(rule),
    copyName: payload.name,
  };
}

/**
 * Loads a flow automation by id, then creates a paused copy.
 */
export async function duplicateAutomationRuleById(
  ruleId: number,
  options: DuplicateAutomationRuleOptions = {},
): Promise<DuplicateAutomationRuleResult> {
  const rule = await fetchFlowAutomationRule(ruleId, options);
  return duplicateExistingAutomationRule(rule, options);
}

export function canDuplicateAutomationSource(source: "flow" | "comment", canManage: boolean): boolean {
  return canManage && source === "flow";
}

export function describeDuplicateAutomationBlock(source: "flow" | "comment", canManage: boolean): string | null {
  if (source === "comment") return COMMENT_AUTOMATION_DUPLICATE_BLOCKED;
  if (!canManage) return AUTOMATION_DUPLICATE_PERMISSION_BLOCKED;
  return null;
}

async function postDuplicatedAutomation(payload: unknown, fetchFn: typeof fetch): Promise<void> {
  const response = await fetchFn(AUTOMATION_RULES_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readAutomationApiError(response, "Failed to duplicate automation"));
  }
}

function readAutomationRuleName(rule: unknown): string {
  if (isRecord(rule) && typeof rule.name === "string" && rule.name.trim()) {
    return rule.name;
  }
  return "Untitled automation";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
