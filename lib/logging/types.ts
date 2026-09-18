export const AXIOM_DATASET = "automation-agent";

export type AgentEventName =
  | "prompt_submitted"
  | "clarification_asked"
  | "clarification_answered"
  | "tool_call"
  | "draft_created"
  | "turn_completed"
  | "turn_error"
  | "stream_retry"
  | "explain_requested"
  | "preview_run"
  | "flow_saved"
  | "flow_activated"
  | "run_succeeded"
  | "run_failed";

export type EventOutcome = "ok" | "error" | "dropped" | "cancelled" | "unknown";

export type ErrorCategory =
  | "duplicate_turn"
  | "platform_mismatch"
  | "schedule_timezone_lost"
  | "clarification_loop"
  | "unresolved_account"
  | "stream_dropped"
  | "unclear_state";

export type AccountPlatform = "meta" | "tiktok" | "pinterest" | "snapchat";

export interface AgentEvent {
  readonly _time: string;
  readonly dataset: typeof AXIOM_DATASET;
  readonly conversationId: string;
  readonly turnId: string;
  readonly attemptId: string;
  readonly userIdHash: string;
  readonly workspaceId: string;
  readonly accountPlatform: AccountPlatform;
  readonly requestedPlatform: AccountPlatform;
  readonly event: AgentEventName;
  readonly tool?: string;
  readonly durationMs?: number;
  readonly outcome: EventOutcome;
  readonly errorCategory?: ErrorCategory;
  readonly flowRevision: number;
  readonly model: string;
  readonly promptVersion: string;
}

/** What a call site supplies; `_time`, `dataset` and the user hash are filled in by `logEvent`. */
export type AgentEventInput = Omit<AgentEvent, "_time" | "dataset" | "userIdHash"> & {
  readonly userId: string;
  readonly time?: Date;
};

export interface LogSink {
  write(event: AgentEvent): void;
  read(): readonly AgentEvent[];
  clear(): void;
}
