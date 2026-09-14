// Shared domain types for the /chat MCP Assistant (beta).
// See docs/superpowers/specs/2026-06-26-chat-mcp-assistant-design.md

export type ChatRole = "user" | "assistant" | "tool";

/** Card variants rendered for tool calls in the chat transcript. */
export type CardKind =
  | "report"
  | "savedReport"
  | "launch"
  | "editableAds"
  | "diff"
  | "adscan"
  | "aiImage"
  | "performanceThreshold"
  | "creativeConcepts"
  | "dashboardWidget"
  | "question"
  | "generic";

/** Lifecycle of a single tool call within an assistant turn. */
export type ToolCallStatus =
  | "queued" // created, not yet executed
  | "running" // executing now (transient, UI only)
  | "pending" // write awaiting user Apply/Discard
  | "approved" // write approved by user, ready to execute
  | "discarded" // write declined by user
  | "done"
  | "error";

export interface CardDescriptor {
  readonly kind: CardKind;
  readonly data: unknown;
}

/** Reliability metadata recorded on gated writes (retries, partial failures, unknown outcome). */
export interface ToolCallWriteOutcome {
  /** True when we cannot know whether the platform applied the write (timeout/abort mid-flight). */
  readonly outcomeUnknown?: boolean;
  /** One-line user guidance derived from the bulk-edit failure taxonomy. */
  readonly guidance?: string;
  /** Total execution attempts (1 + automatic transient retries). */
  readonly attempts?: number;
  readonly succeededCount?: number;
  readonly failedEntities?: ReadonlyArray<{
    readonly entityId: string;
    readonly message: string;
    readonly failureClass: string;
  }>;
}

/** A tool call the model requested, plus its execution outcome and view metadata. */
export interface ToolCallRecord {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly isWrite: boolean;
  readonly status: ToolCallStatus;
  readonly resultText?: string;
  readonly latencyMs?: number;
  readonly card?: CardDescriptor;
  readonly errorMessage?: string;
  /**
   * When Meta Ads MCP failed (e.g. account not in rollout) but AdManage MAPI
   * recovered the read, keep the Meta error for /admin/mcp-usage feedback while
   * status stays `done` for the chat UX / model.
   */
  readonly metaMcpError?: string;
  readonly metaMcpFallbackTool?: string;
  readonly writeOutcome?: ToolCallWriteOutcome;
  /** UI-only: a later provider read confirmed a timed-out rename. */
  readonly verifiedByRead?: boolean;
}

export interface UserMessageContent {
  readonly text: string;
}

export interface AssistantMessageContent {
  readonly text: string;
  readonly toolCalls: ToolCallRecord[];
}

export type ChatMessageContent = UserMessageContent | AssistantMessageContent;

export interface ChatMessageView {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: ChatMessageContent;
  readonly createdAt: string;
}

export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

// ─── MCP tool metadata ─────────────────────────────────────────────────────

export interface McpToolMeta {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly isWrite: boolean;
  readonly destructive: boolean;
}

// ─── OpenAI / OpenRouter wire format ───────────────────────────────────────

export interface WireToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface WireMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | null;
  readonly tool_calls?: WireToolCall[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

export interface OpenAiFunctionTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface ChatErrorDebugInfo {
  readonly source: string;
  readonly timestamp: string;
  readonly operation?: string;
  readonly code?: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly url?: string;
  readonly model?: string;
  readonly attemptedModels?: readonly string[];
  readonly conversationId?: string;
  readonly requestId?: string;
  readonly detail?: string;
  readonly cause?: string;
  readonly context?: Record<string, unknown>;
}

// ─── SSE stream events (server → client) ───────────────────────────────────

export type ChatStreamEvent =
  | { readonly type: "conversation"; readonly conversationId: string; readonly title: string }
  | { readonly type: "thinking" }
  | { readonly type: "tool_start"; readonly toolCall: ToolCallRecord }
  | { readonly type: "tool_result"; readonly toolCall: ToolCallRecord }
  | { readonly type: "pending_tool"; readonly toolCall: ToolCallRecord }
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "error"; readonly message: string; readonly debug?: ChatErrorDebugInfo }
  | { readonly type: "done" };

/** The single `error` variant of a stream event — a failed assistant turn. */
export type ChatErrorStreamEvent = Extract<ChatStreamEvent, { readonly type: "error" }>;

/** User's decision on a gated write tool call. */
export type ToolDecision = "apply" | "discard";

/** Account context injected into the system prompt so tool calls target it. */
export interface SelectedAccount {
  readonly accountId: string;
  readonly toolAccountId?: string;
  readonly workspaceId?: string | null;
  readonly platform?: string;
  readonly name?: string;
}
