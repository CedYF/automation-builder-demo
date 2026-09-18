/**
 * Typed event contract for the automation-agent customer journey.
 *
 * Every event carries enough correlation to reconstruct one attempt end to
 * end (session → attempt → turn) and to tell a genuine retry from a
 * duplicate delivery of the same turn. See `docs/investigation.md` and the
 * README's "Logging" section for the design rationale.
 *
 * This is a demo: events persist to localStorage only (see `store.ts`) and
 * nothing is sent to Axiom or any network sink. `EVENT_SINK_NOTE` below
 * documents where a production sink would attach.
 */

export const EVENT_SINK_NOTE =
  "Production would post EVENT batches from `recordEvent` to an Axiom dataset (e.g. `automation-agent-events`) " +
  "via a server route, keeping the same typed contract. This demo intentionally stops at localStorage.";

/** One of the outcomes an attempt or a turn within it can reach. */
export type JourneyOutcome =
  | "drafted"
  | "blocked"
  | "unsupported"
  | "cancelled"
  | "waiting"
  | "saved"
  | "activated"
  | "run_succeeded"
  | "run_failed"
  | "error";

/** Coarse error taxonomy — enough to group failures without leaking raw messages. */
export type ErrorCategory =
  | "none"
  | "stream_transport"
  | "capability_unsupported"
  | "ambiguous_request"
  | "missing_context"
  | "validation_failed"
  | "server_error"
  | "aborted_by_user"
  | "unknown";

/** Problem categories used to file cases and filter the dashboard (see docs/customer-cases.md). */
export type ProblemCategory =
  | "repeated_confirmation" // C01
  | "schedule_fidelity" // C02
  | "invisible_template" // C03
  | "draft_preservation" // C04
  | "incomplete_flow" // C05
  | "unsupported_platform" // C06
  | "none";

export type EventSource = "live" | "fixture";

/** Fields shared by every event. */
interface BaseEvent {
  /** Unique per event; used to de-duplicate retried/replayed deliveries. */
  readonly eventId: string;
  readonly timestamp: string; // ISO 8601
  /** One browser tab/session (persisted per-tab, reset with the fixtures). */
  readonly sessionId: string;
  /** One customer "job": from the first prompt to a terminal outcome, survives internal retries. */
  readonly attemptId: string;
  /** One user-visible turn (a message sent) within the attempt. Absent on attempt-level events. */
  readonly turnId?: string;
  /** Bumped whenever the scripted flow shape changes; lets the dashboard filter by version. */
  readonly flowRevision: string;
  /** Mock responder version — stands in for a model/prompt version string. */
  readonly promptVersion: string;
  readonly platform?: string;
  readonly problemCategory?: ProblemCategory;
  readonly source: EventSource;
}

export interface AttemptStartedEvent extends BaseEvent {
  readonly type: "attempt_started";
  readonly mode: "suggest" | "build";
  /** Redacted — see `redactText` in store.ts. Never the raw customer prompt. */
  readonly promptDigest: { readonly length: number; readonly hash: string };
  readonly hadExistingDraft: boolean;
  readonly existingNodeCount: number;
  readonly accountId?: string;
}

export interface QuestionAskedEvent extends BaseEvent {
  readonly type: "question_asked";
  readonly turnId: string;
  readonly questionDigest: { readonly length: number; readonly hash: string };
  readonly reason: string; // why we asked, e.g. "missing_timezone"
}

export interface QuestionAnsweredEvent extends BaseEvent {
  readonly type: "question_answered";
  readonly turnId: string;
  readonly answeredAfterMs: number;
}

export interface ToolCallStartedEvent extends BaseEvent {
  readonly type: "tool_call_started";
  readonly turnId: string;
  readonly toolCallId: string;
  readonly toolName: string;
}

export interface ToolCallFinishedEvent extends BaseEvent {
  readonly type: "tool_call_finished";
  readonly turnId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly durationMs: number;
  readonly status: "done" | "error" | "discarded";
  readonly errorCategory: ErrorCategory;
}

export interface DraftChangedEvent extends BaseEvent {
  readonly type: "draft_changed";
  readonly turnId: string;
  readonly changeKind: "start" | "add_step" | "update_step" | "remove_step" | "replace_flow";
  readonly nodeCount: number;
}

export interface PreviewViewedEvent extends BaseEvent {
  readonly type: "preview_viewed";
  readonly nodeCount: number;
}

export interface DraftSavedEvent extends BaseEvent {
  readonly type: "draft_saved";
  readonly ruleId: string;
  readonly nodeCount: number;
}

export interface AutomationActivatedEvent extends BaseEvent {
  readonly type: "automation_activated";
  readonly ruleId: string;
  readonly active: boolean;
}

export interface RunSucceededEvent extends BaseEvent {
  readonly type: "run_succeeded";
  readonly ruleId?: string;
  readonly durationMs: number;
  /** This demo never touches a live ad account — always "simulated". Never claim "observed". */
  readonly evidence: "simulated" | "unknown";
}

export interface AttemptRetriedEvent extends BaseEvent {
  readonly type: "attempt_retried";
  readonly turnId: string;
  readonly retryNumber: number;
  readonly reason: string;
}

export interface AttemptAbandonedEvent extends BaseEvent {
  readonly type: "attempt_abandoned";
  readonly lastOutcome: JourneyOutcome;
  readonly turnCount: number;
}

export interface StreamErrorEvent extends BaseEvent {
  readonly type: "stream_error";
  readonly turnId?: string;
  readonly errorCategory: ErrorCategory;
  readonly errorDigest: { readonly length: number; readonly hash: string };
}

/** Emitted once an attempt reaches a terminal (or waiting) state — the funnel's row-level outcome. */
export interface AttemptOutcomeEvent extends BaseEvent {
  readonly type: "attempt_outcome";
  readonly outcome: JourneyOutcome;
  readonly durationMs: number;
  readonly turnCount: number;
}

export type TelemetryEvent =
  | AttemptStartedEvent
  | QuestionAskedEvent
  | QuestionAnsweredEvent
  | ToolCallStartedEvent
  | ToolCallFinishedEvent
  | DraftChangedEvent
  | PreviewViewedEvent
  | DraftSavedEvent
  | AutomationActivatedEvent
  | RunSucceededEvent
  | AttemptRetriedEvent
  | AttemptAbandonedEvent
  | StreamErrorEvent
  | AttemptOutcomeEvent;

export type TelemetryEventType = TelemetryEvent["type"];

/** Bump when the scripted responder's flow shapes change in a way that would skew comparisons. */
export const FLOW_REVISION = "2026-09-18.1";
/** Stands in for a model/prompt version. */
export const PROMPT_VERSION = "mock-script@2";
