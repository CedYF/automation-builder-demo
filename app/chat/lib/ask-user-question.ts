import type { ToolCallRecord } from "@/lib/chat/types";

const ASK_USER_COUNT_MIN = 1;
const ASK_USER_COUNT_MAX = 5;
const ASK_USER_DEFAULT_COUNT = 4;
const MAX_INFERRED_QUESTION_CHARS = 500;
const LISTED_OPTION_PATTERN = /^(?:[A-Z][).]|[1-9][).])\s+(.+)$/;
const CLARIFYING_QUESTION_PATTERN =
  /\b(?:which|what website|what url|how many|do you want|would you like|should i|tell me|pick|choose)\b/i;
const HOW_MANY_PATTERN = /\bhow many\b/i;
const YES_NO_PATTERN =
  /\b(?:should i (?:create|scan|launch|proceed|continue|go ahead)|do you want(?: me)? to|would you like(?: me)? to|is that (?:ok|okay)|yes or no)\b/i;
const VALUE_QUESTION_PATTERN = /^\s*(?:what|which|how many)\b/i;
const ASK_USER_STATUS_PROSE_PATTERN = /\b(?:still waiting|waiting for the|wait for the user)\b/i;
const CONFIRM_OPTIONS: readonly AskUserOptionView[] = [
  { id: "yes", label: "Yes", description: null },
  { id: "no", label: "No", description: null },
];

export type AskUserKind = "choice" | "count" | "text" | "confirm";

export interface AskUserOptionView {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
}

export interface AskUserQuestionView {
  readonly question: string;
  readonly kind: AskUserKind;
  readonly options: readonly AskUserOptionView[];
  readonly defaultValue: string | null;
  readonly placeholder: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readKind(value: unknown): AskUserKind | null {
  if (value === "choice" || value === "count" || value === "text" || value === "confirm") return value;
  return null;
}

function parseOption(value: unknown): AskUserOptionView | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const label = readString(value.label);
  if (!id || !label) return null;
  const description = readString(value.description);
  return { id, label, description: description || null };
}

function parseOptions(value: unknown): AskUserOptionView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const option = parseOption(item);
    return option ? [option] : [];
  });
}

function clampCountBound(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(ASK_USER_COUNT_MAX, Math.max(ASK_USER_COUNT_MIN, value));
}

function countOptions(min: number, max: number): AskUserOptionView[] {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Array.from({ length: high - low + 1 }, (_, index) => {
    const id = String(low + index);
    return { id, label: id, description: null };
  });
}

function readDefaultValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = readString(value);
  return text || null;
}

function sourceRecord(args: Record<string, unknown>, result: unknown): Record<string, unknown> {
  const resultRecord = isRecord(result) ? result : {};
  return { ...resultRecord, ...args };
}

function baseView(
  question: string,
  kind: AskUserKind,
  options: readonly AskUserOptionView[],
  source: Record<string, unknown>,
): AskUserQuestionView {
  return {
    question,
    kind,
    options,
    defaultValue: readDefaultValue(source.defaultValue),
    placeholder: readString(source.placeholder) || null,
  };
}

function buildCountView(source: Record<string, unknown>, question: string): AskUserQuestionView {
  const min = clampCountBound(source.min, ASK_USER_COUNT_MIN);
  const max = clampCountBound(source.max, ASK_USER_COUNT_MAX);
  const options = parseOptions(source.options);
  return {
    ...baseView(question, "count", options.length > 0 ? options : countOptions(min, max), source),
    defaultValue: readDefaultValue(source.defaultValue) ?? String(ASK_USER_DEFAULT_COUNT),
  };
}

/** Normalize ask_user args/result into the card view model. */
export function buildAskUserQuestionView(args: Record<string, unknown>, result?: unknown): AskUserQuestionView | null {
  const source = sourceRecord(args, result);
  const question = readString(source.question);
  if (!question) return null;
  const parsedOptions = parseOptions(source.options);
  const kind = readKind(source.kind) ?? (parsedOptions.length > 0 ? "choice" : "text");
  if (kind === "count") return buildCountView(source, question);
  if (kind === "text") return baseView(question, "text", [], source);
  if (kind === "confirm") return baseView(question, "confirm", CONFIRM_OPTIONS, source);
  if (parsedOptions.length < 2) return null;
  return baseView(question, "choice", parsedOptions, source);
}

/** Match a later user message to an option id, or the typed text for freeform questions. */
export function matchAskUserAnswer(view: AskUserQuestionView, userText: string): string | null {
  const trimmed = userText.trim();
  if (!trimmed) return null;
  if (view.kind === "text") return trimmed;
  const lowered = trimmed.toLowerCase();
  const match = view.options.find((option) => option.id === trimmed || option.label.toLowerCase() === lowered);
  return match?.id ?? null;
}

/** Text sent as the next user message when an option is clicked. */
export function answerTextForOption(view: AskUserQuestionView, option: AskUserOptionView): string {
  return view.kind === "count" ? option.id : option.label;
}

function extractListedOptions(text: string): AskUserOptionView[] {
  return text.split("\n").flatMap((line) => {
    const match = LISTED_OPTION_PATTERN.exec(line.trim());
    const label = match?.[1]?.trim();
    if (!label) return [];
    return [{ id: label.toLowerCase(), label, description: null }];
  });
}

function extractQuestionLine(text: string): string | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const question = lines.find((line) => line.endsWith("?"));
  return question ?? null;
}

/** Infer ask_user args from assistant prose so leftover markdown questions still get a card. */
export function inferAskUserArgsFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_INFERRED_QUESTION_CHARS) return null;
  if (ASK_USER_STATUS_PROSE_PATTERN.test(trimmed)) return null;
  const listed = extractListedOptions(trimmed);
  if (listed.length >= 2) {
    return { question: extractQuestionLine(trimmed) ?? trimmed, kind: "choice", options: listed };
  }
  if (!trimmed.includes("?") || !CLARIFYING_QUESTION_PATTERN.test(trimmed)) return null;
  const question = extractQuestionLine(trimmed) ?? trimmed;
  if (HOW_MANY_PATTERN.test(question)) return { question, kind: "count" };
  if (YES_NO_PATTERN.test(question) && !VALUE_QUESTION_PATTERN.test(question)) {
    return { question, kind: "confirm" };
  }
  return { question, kind: "text" };
}

/** Synthetic ask_user tool call for a clarifying question written in prose. */
export function buildInferredAskUserToolCall(text: string): ToolCallRecord | null {
  const args = inferAskUserArgsFromText(text);
  if (!args) return null;
  return {
    id: "inferred-ask-user",
    name: "ask_user",
    args,
    isWrite: false,
    status: "done",
    card: { kind: "question", data: { tool: "ask_user", args, result: args } },
  };
}
