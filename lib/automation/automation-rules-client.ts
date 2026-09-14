export const AUTOMATION_RULES_API_PATH = "/api/automation-rules";
export const COMMENT_AUTOMATION_RULES_API_PATH = "/api/comment-automation-rules";

export interface AutomationRulesClientOptions {
  readonly fetchFn?: typeof fetch;
}

interface AutomationRuleLookupResponse {
  readonly rule?: unknown;
}

export async function readAutomationApiError(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallback;
}

export async function fetchFlowAutomationRule(
  ruleId: number,
  options: AutomationRulesClientOptions = {},
): Promise<unknown> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(`${AUTOMATION_RULES_API_PATH}?id=${ruleId}`);
  if (!response.ok) {
    throw new Error(await readAutomationApiError(response, "Failed to load automation"));
  }

  const body = (await response.json()) as AutomationRuleLookupResponse;
  if (body.rule == null) {
    throw new Error("Automation data is not ready yet");
  }
  return body.rule;
}

export async function putAutomationRule(
  id: number,
  updates: Record<string, unknown>,
  options: AutomationRulesClientOptions = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(AUTOMATION_RULES_API_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!response.ok) {
    throw new Error(await readAutomationApiError(response, "Failed to update automation"));
  }
}

/**
 * Updates a comment automation. With a `groupId` the change lands on every page
 * the automation covers; without one it falls back to the single rule, which is
 * all a pre-grouping row has.
 */
export async function putCommentAutomationRule(
  id: number,
  updates: Record<string, unknown>,
  options: AutomationRulesClientOptions & { readonly groupId?: string | null } = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(COMMENT_AUTOMATION_RULES_API_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, groupId: options.groupId ?? undefined, ...updates }),
  });
  if (!response.ok) {
    throw new Error(await readAutomationApiError(response, "Failed to update comment automation"));
  }
}

/**
 * Deletes an automation. A comment automation with a `groupId` is removed in
 * full — deleting only the row's own rule would leave its other pages running.
 */
export async function deleteAutomationRule(
  id: number,
  source: "flow" | "comment",
  options: AutomationRulesClientOptions & { readonly groupId?: string | null } = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const path = source === "comment" ? COMMENT_AUTOMATION_RULES_API_PATH : AUTOMATION_RULES_API_PATH;
  const query = source === "comment" && options.groupId ? `groupId=${encodeURIComponent(options.groupId)}` : `id=${id}`;
  const response = await fetchFn(`${path}?${query}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await readAutomationApiError(response, "Failed to delete automation"));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
