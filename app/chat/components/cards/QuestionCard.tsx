"use client";

import type { ToolCallRecord } from "@/lib/chat/types";
import { useState, type FormEvent, type ReactElement } from "react";
import {
  answerTextForOption,
  buildAskUserQuestionView,
  matchAskUserAnswer,
  type AskUserKind,
  type AskUserOptionView,
  type AskUserQuestionView,
} from "../../lib/ask-user-question";
import { CHAT_TOOL_CARD, CHAT_TOOL_CARD_HEADER } from "../../lib/theme";

const CHOICE_BUTTON_CLASS =
  "flex w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card dark:hover:bg-blue-950/30";
const COUNT_BUTTON_CLASS =
  "flex h-10 min-w-10 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:border-blue-400 disabled:cursor-not-allowed disabled:hover:border-border";
const SELECTED_CLASS =
  "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-400/40 dark:bg-blue-950/40 dark:text-blue-100";
const DEFAULT_HINT_CLASS = "border-blue-300";
const TEXT_INPUT_CLASS =
  "min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-400";
const TEXT_SUBMIT_CLASS =
  "rounded-xl border border-blue-500 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground";

function questionHeader(kind: AskUserKind): string {
  if (kind === "count") return "How many";
  if (kind === "confirm") return "Confirm";
  if (kind === "text") return "Question";
  return "Choose one";
}

interface QuestionCardProps {
  readonly toolCall: ToolCallRecord;
  readonly answeredValue?: string | null;
  readonly disabled?: boolean;
  readonly onAnswer?: (answer: string) => void;
  readonly enhanced?: boolean;
  readonly editDisabled?: boolean;
  readonly onEditAnswer?: (question: string, answer: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cardPayload(toolCall: ToolCallRecord): { args: Record<string, unknown>; result: unknown } {
  const data = toolCall.card?.data;
  if (isRecord(data) && isRecord(data.args)) {
    return { args: data.args, result: data.result };
  }
  return { args: toolCall.args, result: undefined };
}

function optionClassName(view: AskUserQuestionView, option: AskUserOptionView, selectedId: string | null): string {
  const base = view.kind === "count" ? COUNT_BUTTON_CLASS : CHOICE_BUTTON_CLASS;
  if (selectedId === option.id) return `${base} ${SELECTED_CLASS}`;
  if (!selectedId && view.defaultValue === option.id) return `${base} ${DEFAULT_HINT_CLASS}`;
  return base;
}

function QuestionOptionButton({
  view,
  option,
  selectedId,
  disabled,
  onAnswer,
}: {
  readonly view: AskUserQuestionView;
  readonly option: AskUserOptionView;
  readonly selectedId: string | null;
  readonly disabled: boolean;
  readonly onAnswer?: (answer: string) => void;
}): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAnswer?.(answerTextForOption(view, option))}
      className={optionClassName(view, option, selectedId)}
    >
      <span className={view.kind === "count" ? undefined : "text-sm font-semibold text-foreground"}>
        {option.label}
      </span>
      {option.description ? (
        <span className="text-xs font-medium text-muted-foreground">{option.description}</span>
      ) : null}
    </button>
  );
}

function QuestionTextForm({
  view,
  answeredValue,
  disabled,
  onAnswer,
  multiline = false,
}: {
  readonly multiline?: boolean;
  readonly view: AskUserQuestionView;
  readonly answeredValue: string | null;
  readonly disabled: boolean;
  readonly onAnswer?: (answer: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(answeredValue ?? "");
  const canSubmit = Boolean(draft.trim()) && !disabled && !answeredValue;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) return;
    onAnswer?.(draft.trim());
  };

  if (answeredValue) {
    return (
      <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
        {answeredValue}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            value={draft}
            rows={4}
            disabled={disabled}
            aria-label={view.question}
            placeholder={view.placeholder ?? "Type your answer — line breaks are kept"}
            onChange={(event) => setDraft(event.target.value)}
            className={`${TEXT_INPUT_CLASS} resize-y`}
          />
        ) : (
          <input
            type="text"
            value={draft}
            disabled={disabled}
            aria-label={view.question}
            placeholder={view.placeholder ?? "Type your answer"}
            onChange={(event) => setDraft(event.target.value)}
            className={TEXT_INPUT_CLASS}
          />
        )}
        <button type="submit" disabled={!canSubmit} className={TEXT_SUBMIT_CLASS}>
          Send
        </button>
      </div>
      {multiline &&
        draft.trim() &&
        /(?:exact|fixed|set|certain).*(?:reply|response)|(?:reply|response).*(?:send|use)/i.test(view.question) && (
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Reply preview · your exact text</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{draft}</p>
          </div>
        )}
    </form>
  );
}

export function QuestionCard({
  toolCall,
  answeredValue = null,
  disabled = false,
  onAnswer,
  enhanced = false,
  editDisabled,
  onEditAnswer,
}: QuestionCardProps): ReactElement | null {
  const [search, setSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const payload = cardPayload(toolCall);
  const view = buildAskUserQuestionView(payload.args, payload.result);
  if (!view) return null;

  const selectedId = answeredValue ? matchAskUserAnswer(view, answeredValue) : null;
  const isDisabled = disabled || Boolean(answeredValue);
  const shownOptions = view.options.filter((option) =>
    `${option.label} ${option.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={CHAT_TOOL_CARD}>
      <div className={CHAT_TOOL_CARD_HEADER}>
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {questionHeader(view.kind)}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[15px] font-semibold leading-6 text-foreground">{view.question}</p>
        {enhanced && answeredValue && (
          <div className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 p-2 text-xs">
            <span className="whitespace-pre-wrap break-words">Answered: {answeredValue}</span>
            {onEditAnswer && (
              <button
                type="button"
                disabled={editDisabled ?? disabled}
                className="shrink-0 font-medium text-primary underline disabled:opacity-50"
                onClick={() => onEditAnswer(view.question, answeredValue)}
              >
                Change answer
              </button>
            )}
          </div>
        )}
        {enhanced && !answeredValue && view.options.length > 5 && (
          <input
            type="search"
            aria-label="Search answers"
            placeholder="Search by name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${TEXT_INPUT_CLASS} w-full`}
          />
        )}
        {enhanced && answeredValue ? null : view.kind === "text" ? (
          <QuestionTextForm
            view={view}
            answeredValue={answeredValue}
            disabled={disabled}
            onAnswer={onAnswer}
            multiline={enhanced}
          />
        ) : (
          <div className={view.kind === "count" ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
            {shownOptions.map((option) => (
              <QuestionOptionButton
                key={option.id}
                view={view}
                option={option}
                selectedId={selectedId}
                disabled={isDisabled}
                onAnswer={onAnswer}
              />
            ))}
          </div>
        )}
        {enhanced && view.kind !== "text" && !answeredValue && (
          <div>
            <button
              type="button"
              disabled={disabled}
              className="text-xs font-medium text-primary underline disabled:opacity-50"
              onClick={() => setShowCustom((value) => !value)}
            >
              Give a different answer
            </button>
            {showCustom && (
              <div className="mt-2">
                <QuestionTextForm view={view} answeredValue={null} disabled={disabled} onAnswer={onAnswer} multiline />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
