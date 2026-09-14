/**
 * Turning an automation on or off from the builder.
 *
 * Comment automations live behind their own endpoint and expose a `toggle`
 * action rather than a status field, so one request shape cannot serve both.
 * The choice is pure and tested here; the send is a thin boundary below.
 */

const COMMENT_AUTOMATION_ID_PREFIX = "comment:";
const AUTOMATION_RULES_ENDPOINT = "/api/automation-rules";
const COMMENT_AUTOMATION_RULES_ENDPOINT = "/api/comment-automation-rules";

export const AUTOMATION_STATUS_ACTIVE = "active";
export const AUTOMATION_STATUS_PAUSED = "paused";

export interface AutomationStatusRequestInput {
  /** Flow id as the builder holds it — numeric, `comment:<id>`, or a draft key. */
  readonly flowId: number | string;
  /** Saved rule id the endpoint addresses. */
  readonly ruleId: number;
  /**
   * Comment automations: the id shared by the automation's per-page rules.
   * Without it the request pauses one page and leaves the rest moderating.
   */
  readonly groupId?: string | null;
  /**
   * Forces the comment endpoint regardless of `flowId`. The builder flips the
   * switch on an automation that may still be unsaved: the save creates the
   * CommentsServer rule, but the React update that rewrites `flow.id` to
   * `comment:<id>` is not visible to the closure that already read it, so the
   * old `flow-*`/`template-*` id would route a comment rule id to
   * /api/automation-rules — failing, or worse, toggling an unrelated
   * automation that happens to share the number (reported by Codex review on
   * PR #14447). Callers holding a persisted id can leave this unset.
   */
  readonly isCommentAutomation?: boolean;
  readonly nextActive: boolean;
}

export interface AutomationStatusRequest {
  readonly url: string;
  readonly method: "POST" | "PUT";
  readonly body: Record<string, unknown>;
}

export function isCommentAutomationFlowId(flowId: number | string): boolean {
  return typeof flowId === "string" && flowId.startsWith(COMMENT_AUTOMATION_ID_PREFIX);
}

export function buildAutomationStatusRequest(input: AutomationStatusRequestInput): AutomationStatusRequest {
  if (input.isCommentAutomation === true || isCommentAutomationFlowId(input.flowId)) {
    return {
      url: COMMENT_AUTOMATION_RULES_ENDPOINT,
      method: "POST",
      body: {
        action: "toggle",
        id: input.ruleId,
        groupId: input.groupId ?? undefined,
        // The switch knows which way it moved, so say so rather than letting
        // the group flip from whatever mixture of statuses it is in.
        status: input.nextActive ? AUTOMATION_STATUS_ACTIVE : AUTOMATION_STATUS_PAUSED,
      },
    };
  }

  return {
    url: AUTOMATION_RULES_ENDPOINT,
    method: "PUT",
    body: { id: input.ruleId, status: input.nextActive ? AUTOMATION_STATUS_ACTIVE : AUTOMATION_STATUS_PAUSED },
  };
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Keep actionable API errors; proxies may instead return HTML or an empty body. */
export async function readAutomationStatusError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error.trim() || fallback;
    }
  } catch {
    // Non-JSON failures still need a useful message and optimistic rollback.
  }
  return fallback;
}

export async function sendAutomationStatusRequest(
  request: AutomationStatusRequest,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(request.url, {
    method: request.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
  });
}
