"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createChatApiClient, isAssistantOutputEvent } from "@/app/chat/lib/chat-api-client";
import { isRetryableStreamError } from "@/lib/errors/transient-client-error";
import type { ChatStreamEvent, ToolCallRecord } from "@/lib/chat/types";
import type { AutomationFlow } from "../contexts/automation-context";
import { ASSISTANT_FLOW_TOOL_NAME, buildAssistantFlowFromToolArgs } from "../lib/assistant-flow";
import {
  applyAutomationToolCall,
  AUTOMATION_BUILDER_TOOLS,
  isAutomationBuilderTool,
  type AssistantCanvasApi,
} from "../lib/assistant-canvas";
import type { ParsedAutomationSuggestion } from "../lib/parse-assistant-suggestions";
import {
  buildAutomationCanvasDraftForRequest,
  withAutomationCanvasOpenSlots,
} from "@/lib/chat/automation-canvas-context";
import {
  isAutomationExplanationRequest,
  resolveAutomationChatDestination,
  type AutomationChatDestination,
} from "@/lib/chat/automation-chat-intent";
import { listCanvasOpenSlots } from "../lib/canvas-open-slots";
import { inferAutomationAccountPlatform } from "../lib/automation-account-platform";
import { emitTelemetry } from "@/lib/telemetry/emit";
import { redactText } from "@/lib/telemetry/store";
import type { ErrorCategory, JourneyOutcome, ProblemCategory } from "@/lib/telemetry/events";

const ASSISTANT_STREAM_URL = "/api/automation-assistant/stream";

/** Transient SSE drops before any output are auto-retried this many times before surfacing an error. */
const MAX_STREAM_RETRIES = 2;
const STREAM_RETRY_BASE_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AssistantToolCall {
  readonly id: string;
  readonly name: string;
  /** Needed to render ask_user as an answerable question card. */
  readonly args: Record<string, unknown>;
  readonly status: ToolCallRecord["status"];
  readonly resultText?: string;
  readonly errorMessage?: string;
  readonly latencyMs?: number;
  /** True for the create_automation call the builder applies to the canvas. */
  readonly isFlowProposal: boolean;
  /** True for the live canvas builder tools (start_flow/add_step/update_step/remove_step). */
  readonly isBuilderStep: boolean;
}

export interface SuggestionBuildMetadata {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly details: string;
}

export interface AssistantMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly toolCalls: AssistantToolCall[];
  /** Present when the user picked a ranked suggestion to build on canvas. */
  readonly suggestionBuild?: SuggestionBuildMetadata;
  /**
   * Mode of the turn this message belongs to. Ranked-suggestion parsing (the "TOP
   * PICK" / "Build this" cards) only makes sense for a "suggest" scan reply — an
   * "explain this automation" or edit-request reply can accidentally use the same
   * numbered/bolded shape and must never be read as buildable suggestions.
   */
  readonly mode?: AssistantMode;
  readonly handoff?: { destination: AutomationChatDestination; prompt: string };
  readonly startedAt?: number;
  readonly durationMs?: number;
  readonly outcome?: "completed" | "failed" | "cancelled";
}

interface UseAutomationAssistantOptions {
  readonly selectedAccountId?: string;
  readonly selectedAccountName?: string;
  /** Live automation flow — serialized into each assistant request for edit/remove turns. */
  readonly flow: AutomationFlow;
  /** Live canvas surface the builder tools drive as they stream. */
  readonly canvas: AssistantCanvasApi;
  /** Fallback for a whole-flow create_automation call (legacy path). */
  readonly onFlowProposed: (flow: AutomationFlow) => void;
  readonly onTurnStart?: () => void;
}

/** "suggest" makes the assistant scan the account and recommend automations before building. */
export type AssistantMode = "suggest" | "build";

interface UseAutomationAssistantResult {
  readonly messages: AssistantMessage[];
  readonly isLoading: boolean;
  readonly error: string | null;
  sendMessage(content: string, mode?: AssistantMode): Promise<void>;
  sendSuggestionBuild(suggestion: ParsedAutomationSuggestion): Promise<void>;
  clear(): void;
  stop(): void;
}

function toAssistantToolCall(record: ToolCallRecord): AssistantToolCall {
  return {
    id: record.id,
    name: record.name,
    args: record.args,
    status: record.status,
    resultText: record.resultText,
    errorMessage: record.errorMessage,
    latencyMs: record.latencyMs,
    isFlowProposal: record.name === ASSISTANT_FLOW_TOOL_NAME,
    isBuilderStep: isAutomationBuilderTool(record.name),
  };
}

export function useAutomationAssistant(options: UseAutomationAssistantOptions): UseAutomationAssistantResult {
  const { selectedAccountId, selectedAccountName, flow, canvas, onFlowProposed } = options;

  // Keep a live ref so the streaming closure always applies to the current canvas.
  const canvasRef = useRef<AssistantCanvasApi>(canvas);
  canvasRef.current = canvas;
  const flowRef = useRef<AutomationFlow>(flow);
  flowRef.current = flow;

  // Always read the latest account at send time (avoids stale closures racing auto-select).
  const selectedAccountIdRef = useRef(selectedAccountId);
  const selectedAccountNameRef = useRef(selectedAccountName);
  selectedAccountIdRef.current = selectedAccountId;
  selectedAccountNameRef.current = selectedAccountName;

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Guards against two sends starting in the same tick; see `streamTurn`. */
  const inFlightRef = useRef(false);
  const clientRef = useRef(createChatApiClient());
  const appliedFlowToolIdsRef = useRef<Set<string>>(new Set());
  /**
   * A start_flow call held back until the rebuild's first step arrives, because
   * applying it clears the canvas. Null whenever no reset is awaiting a step.
   */
  const pendingFlowStartRef = useRef<{ readonly id: string; readonly record: ToolCallRecord } | null>(null);
  const consumedFlowStartIdsRef = useRef<Set<string>>(new Set());
  const turnCounterRef = useRef(0);
  const explanationOnlyRef = useRef(false);
  /** Per-turn telemetry scratch: problem category / question flag learned mid-stream, tool start times. */
  const telemetryRef = useRef<
    Map<
      string,
      {
        attemptId: string;
        problemCategory: ProblemCategory;
        askedQuestion: boolean;
        toolStarts: Map<string, number>;
      }
    >
  >(new Map());
  /** Timestamp of the last completed ask_user question, used to time `question_answered`. */
  const lastAskUserAtRef = useRef<number | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const upsertAssistantToolCall = useCallback((assistantId: string, record: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;
        const next = toAssistantToolCall(record);
        const existingIndex = message.toolCalls.findIndex((call) => call.id === record.id);
        const toolCalls =
          existingIndex >= 0
            ? message.toolCalls.map((call, index) => (index === existingIndex ? { ...call, ...next } : call))
            : [...message.toolCalls, next];
        return { ...message, toolCalls };
      }),
    );
  }, []);

  /** Agent streams cumulative text (same contract as useChat). Replace, do not append. */
  const setAssistantText = useCallback((assistantId: string, text: string) => {
    setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, text } : message)));
  }, []);

  /** Clear a turn's assistant bubble before an auto-retry so the re-stream renders from scratch. */
  const resetAssistantTurn = useCallback((assistantId: string) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === assistantId ? { ...message, text: "", toolCalls: [] } : message)),
    );
  }, []);

  const maybeApplyFlow = useCallback(
    (record: ToolCallRecord) => {
      if (record.name !== ASSISTANT_FLOW_TOOL_NAME || explanationOnlyRef.current) return;
      if (appliedFlowToolIdsRef.current.has(record.id)) return;
      const flow = buildAssistantFlowFromToolArgs(record.name, record.args, {
        selectedAccountId,
        selectedAccountName,
      });
      if (!flow) return;
      appliedFlowToolIdsRef.current.add(record.id);
      onFlowProposed(flow);
    },
    [onFlowProposed, selectedAccountId, selectedAccountName],
  );

  const getCanvasStepCount = useCallback(() => buildAutomationCanvasDraftForRequest(flowRef.current).steps.length, []);

  const resolveSelectedAccountPlatform = useCallback((): string | null => {
    const accountId = selectedAccountIdRef.current?.trim();
    if (!accountId) return null;
    return inferAutomationAccountPlatform({ businessId: accountId, type: null, tikId: null });
  }, []);

  const applyBuilderToolToCanvas = useCallback(
    (record: ToolCallRecord) => {
      applyAutomationToolCall(record, canvasRef.current, {
        canvasSteps: buildAutomationCanvasDraftForRequest(flowRef.current).steps,
        selectedAccountId: selectedAccountIdRef.current,
        selectedAccountPlatform: resolveSelectedAccountPlatform(),
      });
    },
    [resolveSelectedAccountPlatform],
  );

  /** Applies a held-back start_flow now that a rebuild step has actually arrived. */
  const flushPendingFlowStart = useCallback(() => {
    const pending = pendingFlowStartRef.current;
    if (!pending) return;
    pendingFlowStartRef.current = null;
    consumedFlowStartIdsRef.current.add(pending.id);
    applyBuilderToolToCanvas(pending.record);
  }, [applyBuilderToolToCanvas]);

  /**
   * start_flow clears the canvas, so applying it the moment it streams in destroys the
   * user's flow before we know the rebuild can finish. When the turn then stops to ask a
   * question, errors, or stalls, they are left staring at a wiped or half-built canvas
   * with no undo. Holding the reset until the first step of the rebuild arrives keeps a
   * completed rebuild identical to before, and makes an abandoned one a no-op. An empty
   * canvas has nothing to lose, so it resets immediately and picks up the new name.
   */
  const maybeApplyFlowStart = useCallback(
    (record: ToolCallRecord) => {
      if (consumedFlowStartIdsRef.current.has(record.id)) return;
      if (getCanvasStepCount() === 0) {
        consumedFlowStartIdsRef.current.add(record.id);
        applyBuilderToolToCanvas(record);
        return;
      }
      pendingFlowStartRef.current = { id: record.id, record };
    },
    [applyBuilderToolToCanvas, getCanvasStepCount],
  );

  // Apply only successful results; streamed arguments may still be incomplete.
  const maybeApplyBuilderStep = useCallback(
    (record: ToolCallRecord, eventType: "tool_start" | "tool_result") => {
      if (!isAutomationBuilderTool(record.name) || explanationOnlyRef.current) return;

      const isResult = eventType === "tool_result";
      const shouldApply = isResult && record.status === "done";

      if (!shouldApply) return;

      if (record.name === AUTOMATION_BUILDER_TOOLS.START) {
        maybeApplyFlowStart(record);
        return;
      }

      flushPendingFlowStart();
      applyBuilderToolToCanvas(record);
    },
    [applyBuilderToolToCanvas, flushPendingFlowStart, maybeApplyFlowStart],
  );

  const handleEvent = useCallback(
    (assistantId: string, event: ChatStreamEvent) => {
      if (
        explanationOnlyRef.current &&
        (event.type === "tool_start" || event.type === "tool_result" || event.type === "pending_tool") &&
        (isAutomationBuilderTool(event.toolCall.name) || event.toolCall.name === ASSISTANT_FLOW_TOOL_NAME)
      ) {
        upsertAssistantToolCall(assistantId, {
          ...event.toolCall,
          status: "discarded",
          errorMessage: "Your question did not request a draft change.",
        });
        return;
      }
      const telemetryEntry = telemetryRef.current.get(assistantId);
      switch (event.type) {
        case "conversation":
          conversationIdRef.current = event.conversationId;
          return;
        case "turn_meta":
          if (telemetryEntry) {
            telemetryEntry.problemCategory = (event.problemCategory as ProblemCategory | undefined) ?? "none";
            telemetryEntry.askedQuestion = event.askedQuestion ?? false;
          }
          return;
        case "tool_start":
          upsertAssistantToolCall(assistantId, event.toolCall);
          maybeApplyBuilderStep(event.toolCall, "tool_start");
          telemetryEntry?.toolStarts.set(event.toolCall.id, Date.now());
          if (telemetryEntry) {
            emitTelemetry({
              type: "tool_call_started",
              attemptId: telemetryEntry.attemptId,
              turnId: assistantId,
              toolCallId: event.toolCall.id,
              toolName: event.toolCall.name,
            });
          }
          return;
        case "tool_result": {
          upsertAssistantToolCall(assistantId, event.toolCall);
          maybeApplyBuilderStep(event.toolCall, "tool_result");
          if (event.toolCall.status === "done") maybeApplyFlow(event.toolCall);
          if (telemetryEntry) {
            const startedAt = telemetryEntry.toolStarts.get(event.toolCall.id);
            const durationMs = event.toolCall.latencyMs ?? (startedAt ? Date.now() - startedAt : 0);
            const status: "done" | "error" | "discarded" =
              event.toolCall.status === "error" ? "error" : event.toolCall.status === "discarded" ? "discarded" : "done";
            emitTelemetry({
              type: "tool_call_finished",
              attemptId: telemetryEntry.attemptId,
              turnId: assistantId,
              toolCallId: event.toolCall.id,
              toolName: event.toolCall.name,
              durationMs,
              status,
              errorCategory: status === "error" ? "server_error" : "none",
            });
            if (isAutomationBuilderTool(event.toolCall.name) && event.toolCall.status === "done") {
              const changeKind =
                event.toolCall.name === AUTOMATION_BUILDER_TOOLS.START
                  ? "start"
                  : event.toolCall.name === AUTOMATION_BUILDER_TOOLS.ADD
                    ? "add_step"
                    : event.toolCall.name === AUTOMATION_BUILDER_TOOLS.UPDATE
                      ? "update_step"
                      : "remove_step";
              emitTelemetry({
                type: "draft_changed",
                attemptId: telemetryEntry.attemptId,
                turnId: assistantId,
                changeKind,
                nodeCount: getCanvasStepCount(),
              });
            }
            if (event.toolCall.name === ASSISTANT_FLOW_TOOL_NAME && event.toolCall.status === "done") {
              emitTelemetry({
                type: "draft_changed",
                attemptId: telemetryEntry.attemptId,
                turnId: assistantId,
                changeKind: "replace_flow",
                nodeCount: getCanvasStepCount(),
              });
            }
            if (event.toolCall.name === "ask_user" && event.toolCall.status === "done") {
              const questionText =
                typeof event.toolCall.args.question === "string" ? event.toolCall.args.question : "";
              emitTelemetry({
                type: "question_asked",
                attemptId: telemetryEntry.attemptId,
                turnId: assistantId,
                questionDigest: redactText(questionText),
                reason: telemetryEntry.problemCategory === "none" ? "clarification" : telemetryEntry.problemCategory,
              });
              lastAskUserAtRef.current = Date.now();
            }
          }
          return;
        }
        case "pending_tool":
          // Gated writes pause the agent. Only create_automation is harvested onto
          // the canvas as "done"; other pending tools stay pending so we don't
          // fake a green check for unavailable tools like get_top_ads.
          if (event.toolCall.name === ASSISTANT_FLOW_TOOL_NAME) {
            upsertAssistantToolCall(assistantId, { ...event.toolCall, status: "done" });
            maybeApplyFlow(event.toolCall);
          } else {
            upsertAssistantToolCall(assistantId, { ...event.toolCall, status: "pending" });
          }
          return;
        case "text":
          setAssistantText(assistantId, event.text);
          return;
        case "error":
          // Banner only — avoid duplicating the same text into the assistant bubble.
          setError(event.message);
          return;
        default:
          return;
      }
    },
    [maybeApplyBuilderStep, maybeApplyFlow, setAssistantText, upsertAssistantToolCall],
  );

  const streamTurn = useCallback(
    async (
      trimmed: string,
      mode: AssistantMode,
      userMessageExtras: Pick<AssistantMessage, "suggestionBuild"> = {},
    ): Promise<void> => {
      // Synchronous latch. The `isLoading` guards in the callers read state
      // captured in their closure, which is still `false` for a second call in
      // the same tick (a fast double-click, or two effects flushing in one
      // commit) — both would fire and each would create its own conversation.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      explanationOnlyRef.current = isAutomationExplanationRequest(trimmed);
      optionsRef.current.onTurnStart?.();
      const startedAt = Date.now();
      const turn = turnCounterRef.current++;
      const userMessage: AssistantMessage = {
        id: `user-${turn}`,
        role: "user",
        text: trimmed,
        toolCalls: [],
        mode,
        ...userMessageExtras,
      };
      const assistantId = `assistant-${turn}`;
      const assistantMessage: AssistantMessage = {
        id: assistantId,
        startedAt,
        role: "assistant",
        text: "",
        toolCalls: [],
        mode,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const accountIdAtSend = selectedAccountIdRef.current;
      const accountNameAtSend = selectedAccountNameRef.current;
      const accountPlatformAtSend = resolveSelectedAccountPlatform();
      const canvasDraft = withAutomationCanvasOpenSlots(
        buildAutomationCanvasDraftForRequest(flowRef.current),
        listCanvasOpenSlots(flowRef.current),
      );

      const attemptId = `attempt-${assistantId}`;
      currentAssistantIdRef.current = assistantId;
      telemetryRef.current.set(assistantId, {
        attemptId,
        problemCategory: "none",
        askedQuestion: false,
        toolStarts: new Map(),
      });

      if (lastAskUserAtRef.current !== null) {
        emitTelemetry({
          type: "question_answered",
          attemptId,
          turnId: assistantId,
          answeredAfterMs: Date.now() - lastAskUserAtRef.current,
        });
        lastAskUserAtRef.current = null;
      }

      emitTelemetry({
        type: "attempt_started",
        attemptId,
        turnId: assistantId,
        mode,
        promptDigest: redactText(trimmed),
        hadExistingDraft: flowRef.current.nodes.length > 0,
        existingNodeCount: flowRef.current.nodes.length,
        accountId: accountIdAtSend,
        platform: accountPlatformAtSend ?? undefined,
      });

      let turnFailed = false;
      try {
        // A transient SSE drop *before* any output (planning / first tool) is safe to replay: nothing
        // was applied to the canvas yet, and `resume` stops the server re-appending the user turn.
        for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
          if (controller.signal.aborted) return;
          let producedOutput = false;
          let hasPartialTurn = false;
          try {
            await clientRef.current.stream(
              ASSISTANT_STREAM_URL,
              {
                conversationId: conversationIdRef.current ?? undefined,
                message: trimmed,
                adAccountId: accountIdAtSend,
                accountName: accountNameAtSend,
                accountPlatform: accountPlatformAtSend ?? undefined,
                mode,
                canvasDraft,
                resume: attempt > 0,
              },
              (event) => {
                if (controller.signal.aborted) return;
                if (event.type === "error") turnFailed = true;
                if (event.type === "conversation") {
                  hasPartialTurn = true;
                }
                if (isAssistantOutputEvent(event)) {
                  producedOutput = true;
                  hasPartialTurn = true;
                }
                handleEvent(assistantId, event);
              },
              controller.signal,
            );
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Without a conversation id the retry cannot carry `resume`, so the
            // server would treat it as a brand-new chat and create a second
            // conversation for the same prompt. Surface the error instead.
            const hasConversation = conversationIdRef.current !== null;
            const canRetry =
              attempt < MAX_STREAM_RETRIES && !producedOutput && hasConversation && isRetryableStreamError(err);
            if (!canRetry) {
              const messageText = err instanceof Error ? err.message : "The assistant hit an error. Try again.";
              turnFailed = true;
              setError(messageText);
              const errorCategory: ErrorCategory = hasConversation ? "stream_transport" : "unknown";
              emitTelemetry({
                type: "stream_error",
                attemptId,
                turnId: assistantId,
                errorCategory,
                errorDigest: redactText(messageText),
              });
              return;
            }
            if (!hasPartialTurn) {
              resetAssistantTurn(assistantId);
            }
            emitTelemetry({
              type: "attempt_retried",
              attemptId,
              turnId: assistantId,
              retryNumber: attempt + 1,
              reason: isRetryableStreamError(err) ? "transient_stream_drop" : "unknown",
            });
            await delay(STREAM_RETRY_BASE_DELAY_MS * 2 ** attempt);
          }
        }
      } finally {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  durationMs: Date.now() - startedAt,
                  outcome: controller.signal.aborted ? "cancelled" : turnFailed ? "failed" : "completed",
                }
              : message,
          ),
        );
        // A reset still waiting on its first step means the rebuild never happened.
        // Dropping it leaves the user's existing flow on the canvas untouched.
        pendingFlowStartRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
        inFlightRef.current = false;
        setIsLoading(false);

        const entry = telemetryRef.current.get(assistantId);
        const outcome: JourneyOutcome = controller.signal.aborted
          ? "cancelled"
          : turnFailed
            ? "error"
            : entry?.askedQuestion
              ? "waiting"
              : entry?.problemCategory === "schedule_fidelity"
                ? "blocked"
                : "drafted";
        emitTelemetry({
          type: "attempt_outcome",
          attemptId,
          turnId: assistantId,
          outcome,
          durationMs: Date.now() - startedAt,
          turnCount: 1,
          problemCategory: entry?.problemCategory ?? "none",
        });
      }
    },
    [handleEvent, resetAssistantTurn, resolveSelectedAccountPlatform],
  );

  const sendMessage = useCallback(
    async (content: string, mode: AssistantMode = "build") => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) {
        return;
      }
      const destination = resolveAutomationChatDestination(trimmed);
      if (destination) {
        const turn = turnCounterRef.current++;
        const text =
          destination === "mcp"
            ? "You can connect AdManage to Claude from MCP Setup. Your current automation stays as it is."
            : "This request fits the main assistant. Continue there with your request and selected account carried over; your automation draft stays here.";
        setMessages((previous) => [
          ...previous,
          { id: `user-${turn}`, role: "user", text: trimmed, toolCalls: [], mode },
          {
            id: `assistant-${turn}`,
            role: "assistant",
            text,
            toolCalls: [],
            mode,
            handoff: { destination, prompt: trimmed },
          },
        ]);
        return;
      }
      await streamTurn(trimmed, mode);
    },
    [isLoading, streamTurn],
  );

  const sendSuggestionBuild = useCallback(
    async (suggestion: ParsedAutomationSuggestion) => {
      const trimmed = suggestion.buildMessage.trim();
      if (!trimmed || isLoading) {
        return;
      }
      await streamTurn(trimmed, "build", {
        suggestionBuild: {
          rank: suggestion.rank,
          title: suggestion.title,
          ...(suggestion.subtitle !== undefined ? { subtitle: suggestion.subtitle } : {}),
          details: suggestion.details,
        },
      });
    },
    [isLoading, streamTurn],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationIdRef.current = null;
    appliedFlowToolIdsRef.current = new Set();
    pendingFlowStartRef.current = null;
    consumedFlowStartIdsRef.current = new Set();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const stop = useCallback(() => {
    const assistantId = currentAssistantIdRef.current;
    const entry = assistantId ? telemetryRef.current.get(assistantId) : undefined;
    if (abortRef.current && entry) {
      emitTelemetry({
        type: "attempt_abandoned",
        attemptId: entry.attemptId,
        lastOutcome: "cancelled",
        turnCount: turnCounterRef.current,
      });
    }
    abortRef.current?.abort();
  }, []);

  return { messages, isLoading, error, sendMessage, sendSuggestionBuild, clear, stop };
}
