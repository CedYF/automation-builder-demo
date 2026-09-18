import { encodeDone, encodeEvent } from "@/lib/chat/sse";
import type { ChatStreamEvent, ToolCallRecord } from "@/lib/chat/types";
import { buildMockTurn, type MockTurnRequest } from "@/lib/mock/assistant-script";

/**
 * Mock assistant stream.
 *
 * There is no model in this repo, but the assistant still has to *stream* for the
 * UI to be worth judging: thinking, tool calls landing one at a time, steps
 * appearing on the canvas as they arrive. So this serves a scripted turn over
 * real SSE, with real delays.
 *
 * It emits the same `ChatStreamEvent` union the product streams, so the client
 * (`use-automation-assistant.ts`) is untouched — swap this route for a model and
 * nothing downstream changes.
 */

export const dynamic = "force-dynamic";

/** Pause between events, so the stream reads as work happening rather than a dump. */
const STEP_DELAY_MS = 550;
/** Longer pause before the first token, standing in for model latency. */
const THINKING_DELAY_MS = 900;

interface ConversationState {
  turns: number;
  /** Summary of the turn a dropped connection already completed server-side. */
  undeliveredSummary: string | null;
}

/** Module state, so it resets with the dev server like the automation store. */
const conversations = new Map<string, ConversationState>();
let nextConversationNumber = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Marks a tool call as finished, with the result text the transcript shows. */
function completed(toolCall: ToolCallRecord, resultText: string): ToolCallRecord {
  return { ...toolCall, status: "done", resultText, latencyMs: STEP_DELAY_MS };
}

export async function POST(request: Request) {
  let body: MockTurnRequest;
  try {
    body = (await request.json()) as MockTurnRequest;
  } catch {
    return new Response("Request body was not valid JSON", { status: 400 });
  }

  const conversationId = body.conversationId ?? `mock-conversation-${nextConversationNumber++}`;
  const state = conversations.get(conversationId) ?? { turns: 0, undeliveredSummary: null };
  conversations.set(conversationId, state);

  // A resumed request re-runs the turn the dropped attempt already counted.
  const turnIndex = body.resume && state.turns > 0 ? state.turns - 1 : state.turns;
  // TODO(candidate): server-side logEvent for tool_call events (tool, durationMs, outcome) belongs here.
  const turn = buildMockTurn({ ...body, conversationId, turnIndex });

  // The first attempt of this scenario finishes server-side but the connection drops
  // before the client receives anything. The retry then replays that summary as well.
  const dropsConnection = turn.scenario === "competitor-retry" && !body.resume;
  const replayedSummary = body.resume ? state.undeliveredSummary : null;
  if (!body.resume) state.turns += 1;
  state.undeliveredSummary = dropsConnection ? turn.closing : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        send({ type: "conversation", conversationId: turn.conversationId, title: turn.title });

        if (dropsConnection) {
          await sleep(THINKING_DELAY_MS);
          controller.error(new TypeError("network error"));
          return;
        }

        for (const beat of turn.beats) {
          send({ type: "thinking" });
          await sleep(beat.thinkingMs ?? THINKING_DELAY_MS);

          if (beat.text) {
            send({ type: "text", text: beat.text });
            await sleep(STEP_DELAY_MS);
          }

          for (const toolCall of beat.toolCalls ?? []) {
            send({ type: "tool_start", toolCall });
            await sleep(STEP_DELAY_MS);
            send({ type: "tool_result", toolCall: completed(toolCall, toolCall.resultText ?? "Done") });
            await sleep(STEP_DELAY_MS);
          }
        }

        send({ type: "text", text: replayedSummary ? `${replayedSummary}\n\n${turn.closing}` : turn.closing });
        send({ type: "done" });
        controller.enqueue(encoder.encode(encodeDone()));
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Mock stream failed" });
      } finally {
        if (!dropsConnection) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
