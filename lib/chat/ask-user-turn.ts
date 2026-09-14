// Server-side helpers for ask_user turn boundaries and answer wiring.

import { buildAskUserQuestionView, matchAskUserAnswer, type AskUserKind } from "@/app/chat/lib/ask-user-question";
import { isManageEntityMessageText } from "@/lib/manage/manage-entity-chat-context";
import { isAssistantContent } from "./wire";
import type { ChatMessageView, ToolCallRecord } from "./types";

export const ASK_USER_TOOL_NAME = "ask_user";

export function isAskUserToolName(toolName: string): boolean {
  return toolName === ASK_USER_TOOL_NAME;
}

/** Assistant prose is hidden once tool cards render; ask_user turns should not persist streamed markdown. */
export function persistedAssistantText(
  content: string | null | undefined,
  toolCalls: readonly { readonly name: string }[],
): string {
  if (toolCalls.length === 0) return content?.trim() ?? "";
  if (toolCalls.some((call) => isAskUserToolName(call.name))) return "";
  return content?.trim() ?? "";
}

export interface AskUserAnswerContext {
  readonly question: string;
  readonly answer: string;
  readonly kind: AskUserKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAskUserPayload(call: ToolCallRecord): Record<string, unknown> {
  const cardData = call.card?.data;
  if (isRecord(cardData) && isRecord(cardData.args)) {
    return cardData.args;
  }
  if (call.resultText) {
    try {
      const parsed: unknown = JSON.parse(call.resultText);
      if (isRecord(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  return call.args;
}

function lastUserMessage(messages: readonly ChatMessageView[]): { index: number; text: string } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user" || !("text" in message.content)) continue;
    const text = message.content.text.trim();
    if (!text) continue;
    return { index, text };
  }
  return null;
}

function pendingAskUserCall(message: ChatMessageView): ToolCallRecord | null {
  if (message.role !== "assistant" || !isAssistantContent(message.content)) return null;
  const askCall = message.content.toolCalls.find((call) => isAskUserToolName(call.name) && call.status === "done");
  return askCall ?? null;
}

/**
 * When the latest user message answers a completed ask_user from the prior assistant turn,
 * returns structured context for system-prompt injection.
 */
export function resolveAskUserAnswerContext(messages: readonly ChatMessageView[]): AskUserAnswerContext | null {
  const latestUser = lastUserMessage(messages);
  if (!latestUser || latestUser.index === 0) return null;
  if (isManageEntityMessageText(latestUser.text)) return null;

  const previousMessage = messages[latestUser.index - 1];
  if (!previousMessage) return null;

  const askCall = pendingAskUserCall(previousMessage);
  if (!askCall) return null;

  const view = buildAskUserQuestionView(readAskUserPayload(askCall));
  if (!view) return null;

  const matched = matchAskUserAnswer(view, latestUser.text);
  const answer = view.kind === "text" ? latestUser.text : matched ? latestUser.text : null;
  if (!answer) return null;

  return { question: view.question, answer, kind: view.kind };
}

/** Prompt block telling the model to consume a pending ask_user answer and proceed. */
export function buildAskUserAnswerPromptSection(context: AskUserAnswerContext): string {
  return [
    "The user's latest message answers your pending ask_user question.",
    `Question: ${context.question}`,
    `Answer: ${context.answer}`,
    "Treat that answer as authoritative, continue the workflow, and do not call ask_user again for the same information.",
  ].join("\n");
}
