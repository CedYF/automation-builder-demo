import { hashUserId } from "./hash.ts";
import {
  AXIOM_DATASET,
  type AccountPlatform,
  type AgentEvent,
  type AgentEventName,
  type ErrorCategory,
  type EventOutcome,
} from "./types.ts";

/**
 * Builds the mock Axiom export in `fixtures/axiom-events.ndjson`. Deterministic: the same
 * seed always yields the same file, so a test can prove the committed fixture is current.
 * Every conversation belongs to one planted scenario; the dashboard should surface them.
 */

const SEED = 20260914;
const START = Date.parse("2026-09-01T08:00:00.000Z");
const DAY_MS = 86_400_000;
const MODELS = ["agent-model-v1", "agent-model-v2"] as const;
const PROMPT_VERSIONS = ["pv-2026-08", "pv-2026-09"] as const;

type Scenario =
  | "full_success"
  | "drop_at_draft"
  | "drop_before_save"
  | "drop_before_activate"
  | "duplicate_turn"
  | "platform_mismatch"
  | "explain_loop"
  | "schedule_timezone"
  | "clarification_loop"
  | "unresolved_account";

const PLAN: ReadonlyArray<readonly [Scenario, number]> = [
  ["full_success", 5],
  ["drop_at_draft", 4],
  ["drop_before_save", 2],
  ["drop_before_activate", 3],
  ["duplicate_turn", 5],
  ["platform_mismatch", 6],
  ["explain_loop", 5],
  ["schedule_timezone", 4],
  ["clarification_loop", 3],
  ["unresolved_account", 3],
];

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Conversation {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly accountPlatform: AccountPlatform;
  readonly requestedPlatform: AccountPlatform;
  readonly model: string;
  readonly promptVersion: string;
  clock: number;
  revision: number;
}

interface EmitOptions {
  readonly turn: string;
  readonly attempt: string;
  readonly tool?: string;
  readonly durationMs?: number;
  readonly outcome?: EventOutcome;
  readonly errorCategory?: ErrorCategory;
  readonly gapMs?: number;
}

export function generateFixtureEvents(): AgentEvent[] {
  const random = mulberry32(SEED);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
  const events: AgentEvent[] = [];

  const emit = (conversation: Conversation, event: AgentEventName, options: EmitOptions): void => {
    conversation.clock += options.gapMs ?? between(700, 4000);
    events.push({
      _time: new Date(conversation.clock).toISOString(),
      dataset: AXIOM_DATASET,
      conversationId: conversation.id,
      turnId: options.turn,
      attemptId: options.attempt,
      userIdHash: hashUserId(conversation.userId),
      workspaceId: conversation.workspaceId,
      accountPlatform: conversation.accountPlatform,
      requestedPlatform: conversation.requestedPlatform,
      event,
      ...(options.tool === undefined ? {} : { tool: options.tool }),
      ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
      outcome: options.outcome ?? "ok",
      ...(options.errorCategory === undefined ? {} : { errorCategory: options.errorCategory }),
      flowRevision: conversation.revision,
      model: conversation.model,
      promptVersion: conversation.promptVersion,
    });
  };

  const buildTurn = (conversation: Conversation, turn: string, attempt: string, steps: number): void => {
    emit(conversation, "prompt_submitted", { turn, attempt });
    emit(conversation, "tool_call", { turn, attempt, tool: "automation_start_flow", durationMs: between(300, 900) });
    for (let step = 0; step < steps; step++) {
      conversation.revision += 1;
      emit(conversation, "tool_call", { turn, attempt, tool: "automation_add_step", durationMs: between(400, 1400) });
    }
    emit(conversation, "draft_created", { turn, attempt });
  };

  const finishTurn = (conversation: Conversation, turn: string, attempt: string, errorCategory?: ErrorCategory) => {
    emit(conversation, "turn_completed", { turn, attempt, durationMs: between(4000, 9000), errorCategory });
  };

  const journeyAfterDraft = (conversation: Conversation, upTo: "draft" | "preview" | "save" | "activate" | "run") => {
    const turn = "t1";
    const attempt = "a1";
    const order = ["draft", "preview", "save", "activate", "run"] as const;
    const reach = order.indexOf(upTo);
    if (reach >= 1) emit(conversation, "preview_run", { turn, attempt, gapMs: between(20_000, 90_000) });
    if (reach >= 2) emit(conversation, "flow_saved", { turn, attempt, gapMs: between(20_000, 200_000) });
    if (reach >= 3) emit(conversation, "flow_activated", { turn, attempt, gapMs: between(5000, 120_000) });
    if (reach >= 4) emit(conversation, "run_succeeded", { turn, attempt, gapMs: between(3_600_000, 86_400_000) });
  };

  const scenarios: Scenario[] = PLAN.flatMap(([scenario, count]) => Array<Scenario>(count).fill(scenario));
  const mismatchUsers = ["user-m1", "user-m1", "user-m1", "user-m2", "user-m3", "user-m4"];
  const explainUsers = ["user-e1", "user-e2", "user-e3", "user-e4", "user-e5"];
  let mismatchIndex = 0;
  let explainIndex = 0;

  scenarios.forEach((scenario, index) => {
    const versionIndex = index % 3 === 0 ? 0 : 1;
    const isMismatch = scenario === "platform_mismatch";
    const userId = isMismatch
      ? mismatchUsers[mismatchIndex++]
      : scenario === "explain_loop"
        ? explainUsers[explainIndex++]
        : `user-${index + 1}`;
    const conversation: Conversation = {
      id: `c_${String(index + 1).padStart(3, "0")}`,
      userId,
      workspaceId: `ws_${1 + (index % 17)}`,
      accountPlatform: "meta",
      requestedPlatform: isMismatch ? "pinterest" : "meta",
      model: MODELS[versionIndex],
      promptVersion: PROMPT_VERSIONS[versionIndex],
      clock: START + Math.floor(random() * 13 * DAY_MS),
      revision: 0,
    };

    switch (scenario) {
      case "full_success":
        buildTurn(conversation, "t1", "a1", 3);
        finishTurn(conversation, "t1", "a1");
        journeyAfterDraft(conversation, index === 4 ? "activate" : "run");
        break;
      case "drop_at_draft":
        buildTurn(conversation, "t1", "a1", 2);
        finishTurn(conversation, "t1", "a1");
        break;
      case "drop_before_save":
        buildTurn(conversation, "t1", "a1", 3);
        finishTurn(conversation, "t1", "a1");
        journeyAfterDraft(conversation, "preview");
        break;
      case "drop_before_activate":
        buildTurn(conversation, "t1", "a1", 3);
        finishTurn(conversation, "t1", "a1");
        journeyAfterDraft(conversation, "save");
        break;
      case "duplicate_turn": {
        emit(conversation, "prompt_submitted", { turn: "t1", attempt: "a1" });
        emit(conversation, "tool_call", { turn: "t1", attempt: "a1", tool: "automation_start_flow", durationMs: 610 });
        emit(conversation, "turn_error", {
          turn: "t1",
          attempt: "a1",
          outcome: "dropped",
          errorCategory: "stream_dropped",
        });
        emit(conversation, "stream_retry", { turn: "t1", attempt: "a2", outcome: "ok" });
        buildTurn(conversation, "t1", "a2", 3);
        const deliveries = between(2, 4);
        for (let delivery = 0; delivery < deliveries; delivery++) {
          finishTurn(conversation, "t1", `a${2 + delivery}`, delivery === 0 ? undefined : "duplicate_turn");
        }
        if (index % 2 === 0) journeyAfterDraft(conversation, "save");
        break;
      }
      case "platform_mismatch":
        buildTurn(conversation, "t1", "a1", 3);
        finishTurn(conversation, "t1", "a1", "platform_mismatch");
        if (index % 3 === 0) journeyAfterDraft(conversation, "preview");
        break;
      case "explain_loop": {
        buildTurn(conversation, "t1", "a1", 3);
        finishTurn(conversation, "t1", "a1");
        const asks = between(1, 3);
        for (let ask = 0; ask < asks; ask++) {
          const turn = `t${2 + ask}`;
          emit(conversation, "explain_requested", { turn, attempt: "a1", errorCategory: "unclear_state" });
          finishTurn(conversation, turn, "a1", "unclear_state");
        }
        if (index % 2 === 0) journeyAfterDraft(conversation, "preview");
        break;
      }
      case "schedule_timezone":
        buildTurn(conversation, "t1", "a1", 3);
        emit(conversation, "clarification_asked", { turn: "t1", attempt: "a1" });
        finishTurn(conversation, "t1", "a1");
        emit(conversation, "clarification_answered", { turn: "t2", attempt: "a1" });
        conversation.revision += 1;
        emit(conversation, "tool_call", {
          turn: "t2",
          attempt: "a1",
          tool: "automation_update_step",
          durationMs: between(400, 1200),
        });
        finishTurn(conversation, "t2", "a1", "schedule_timezone_lost");
        if (index % 2 === 0) journeyAfterDraft(conversation, "save");
        break;
      case "clarification_loop": {
        emit(conversation, "prompt_submitted", { turn: "t1", attempt: "a1" });
        const rounds = between(3, 4);
        for (let round = 0; round < rounds; round++) {
          const turn = `t${1 + round}`;
          emit(conversation, "clarification_asked", {
            turn,
            attempt: "a1",
            errorCategory: round >= 2 ? "clarification_loop" : undefined,
          });
          emit(conversation, "clarification_answered", { turn: `t${2 + round}`, attempt: "a1" });
        }
        break;
      }
      case "unresolved_account":
        emit(conversation, "prompt_submitted", { turn: "t1", attempt: "a1" });
        emit(conversation, "tool_call", {
          turn: "t1",
          attempt: "a1",
          tool: "automation_start_flow",
          durationMs: 480,
          outcome: "error",
          errorCategory: "unresolved_account",
        });
        emit(conversation, "turn_error", {
          turn: "t1",
          attempt: "a1",
          outcome: "error",
          errorCategory: "unresolved_account",
        });
        break;
    }
  });

  return events.sort((left, right) => left._time.localeCompare(right._time));
}

export function toNdjson(events: readonly AgentEvent[]): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}
