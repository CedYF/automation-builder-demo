"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { navigateToChatWithContext } from "@/app/chat/lib/chat-context-handoff";
import { Textarea } from "@/components/ui/textarea";
import { AssistantDraftSummary } from "./assistant-draft-summary";
import { AssistantLiveActivity } from "./assistant-live-activity";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  RotateCcw,
  Wand2,
  Check,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@/lib/providers/user-provider";
import { useAutomation, type AutomationFlow, type AutomationNode } from "../contexts/automation-context";
import { EDIT_SUGGESTED_PROMPTS, SUGGESTED_PROMPTS } from "../lib/automation-registry";
import { summarizeFlowSteps } from "../lib/flow-summary";
import { summarizeToolResultText } from "../lib/assistant-message-display";
import {
  buildSuggestionPickMessage,
  extractSuggestionIntro,
  extractSuggestionOutro,
  findScanInsightsFromToolCalls,
  resolveAssistantSuggestions,
  type ParsedAutomationSuggestion,
} from "../lib/parse-assistant-suggestions";
import { shouldSuppressSuggestionCards } from "../lib/suggestion-card-layout";
import {
  isSelectableAutomationBuilderAccount,
  resolveAutomationBuilderAccount,
} from "../lib/automation-ad-account-options";
import { isAutomationBuildNudgeMessage } from "@/lib/chat/automation-build-guard";
import { isAskUserToolName } from "@/lib/chat/ask-user-turn";
import { QuestionCard } from "@/app/chat/components/cards/QuestionCard";
import { AutomationAdSetSelector } from "./automation-adset-selector";
import type { ToolCallRecord } from "@/lib/chat/types";
import { ASSISTANT_PROSE_MARKDOWN_GATE } from "@/lib/chat/assistant-markdown-gate";
import { AssistantSuggestionCards } from "./assistant-suggestion-cards";
import { SuggestionBuildProgressCard } from "./assistant-suggestion-build-progress";
import {
  useAutomationAssistant,
  type AssistantMessage,
  type AssistantMode,
  type AssistantToolCall,
} from "../hooks/use-automation-assistant";
import type { AssistantPanelDisplayMode } from "../lib/assistant-panel-layout";

const MCP_TOOL_LABELS: Record<string, string> = {
  automation_start_flow: "Start a fresh draft",
  automation_add_step: "Add step",
  automation_update_step: "Update step",
  automation_remove_step: "Remove step",
  list_pages: "Find connected pages",
  create_automation: "Draft automation flow",
  scan_account_insights: "Scan account for suggestions",
  preview_performance_threshold: "Preview matched ads",
  get_automation_flow_reference: "Load flow reference",
  list_automations: "List automations",
  get_automation: "Read automation",
};

const HIGHLIGHT_CLEAR_DELAY_MS = 1200;

function humanizeToolName(name: string): string {
  return MCP_TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

const SUGGESTED_PROMPT_LIMIT = 4;

const ASSISTANT_MARKDOWN_COMPONENTS: Components = {
  // SEC-012b (ADM-10938): gated `img` renderer, paired with the `urlTransform` at each call site.
  ...ASSISTANT_PROSE_MARKDOWN_GATE.components,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/80">{children}</thead>,
  th: ({ children }) => (
    <th className="whitespace-nowrap border-b border-border px-2.5 py-2 font-semibold text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border px-2.5 py-2 align-top text-foreground">{children}</td>,
};

interface AssistantPanelProps {
  readonly onClose: () => void;
  readonly embeddedInDock?: boolean;
  readonly onOpenStep?: (id: string, tab: "setup" | "preview") => void;
  /** Optional goal seeded from the home hero — auto-sent once on open. */
  readonly seedPrompt?: string | null;
  /** Mode for the seeded goal: "suggest" scans + recommends, "build" (default) builds directly. */
  readonly seedMode?: AssistantMode;
  readonly onSeedConsumed?: () => void;
  readonly displayMode?: AssistantPanelDisplayMode;
  readonly onExpandPanel?: () => void;
  readonly onMinimizePanel?: () => void;
}

export function AssistantPanel({
  onClose,
  embeddedInDock = false,
  onOpenStep,
  seedPrompt,
  seedMode = "build",
  onSeedConsumed,
  displayMode = "normal",
  onExpandPanel,
  onMinimizePanel,
}: AssistantPanelProps): React.ReactElement {
  const {
    flow,
    draftEditVersion,
    restoreAssistantDraft,
    applyAssistantFlow,
    startAssistantFlow,
    upsertAssistantStep,
    removeAssistantStep,
    clearAssistantActiveStep,
  } = useAutomation();
  const { extendedUser, currentWorkspace, isLoading: isUserLoading } = useUser();
  const [inputValue, setInputValue] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const pendingUndoRef = useRef<{ before: AutomationFlow; version: number } | null>(null);
  const seededPromptRef = useRef<string | null>(null);
  const [undo, setUndo] = useState<{ before: AutomationFlow; after: string; version: number } | null>(null);
  const canUndo = Boolean(undo && undo.version === draftEditVersion && undo.after === JSON.stringify(flow));

  const builderAccountScope = useMemo(
    () => ({
      workspaceId: currentWorkspace?.id ?? extendedUser?.defaultWorkspaceId,
      settings: extendedUser?.settings ?? [],
      workspaceAccounts: currentWorkspace?.adAccounts ?? [],
    }),
    [currentWorkspace, extendedUser],
  );

  // Shares the header selector's filter so the two cannot disagree on whether an
  // account is coming — used to wait for its auto-select before sending a seeded goal.
  const hasSelectableAccountOptions = useMemo(
    () =>
      resolveAutomationBuilderAccount({
        workspaceId: builderAccountScope.workspaceId,
        defaultAccountId: extendedUser?.defaultAccountId,
        settings: builderAccountScope.settings,
        workspaceAccounts: builderAccountScope.workspaceAccounts,
      }) != null,
    [builderAccountScope, extendedUser?.defaultAccountId],
  );

  // Adapter mapping the reducer's canvas surface onto the automation context.
  const canvas = useMemo(
    () => ({
      startFlow: startAssistantFlow,
      upsertStep: upsertAssistantStep,
      removeStep: removeAssistantStep,
    }),
    [startAssistantFlow, upsertAssistantStep, removeAssistantStep],
  );

  const { messages, isLoading, error, sendMessage, sendSuggestionBuild, clear, stop } = useAutomationAssistant({
    selectedAccountId: flow.selectedAccountId,
    selectedAccountName: flow.selectedAccountName,
    flow,
    canvas,
    onTurnStart: () => {
      pendingUndoRef.current = { before: structuredClone(flow), version: draftEditVersion };
    },
    onFlowProposed: (proposedFlow) => {
      applyAssistantFlow(proposedFlow);
      toast.success(`"${proposedFlow.name}" added to the canvas`);
    },
  });

  useEffect(() => {
    if (followingRef.current) {
      scrollAnchorRef.current?.scrollIntoView?.({ behavior: "auto", block: "end" });
    } else {
      setHasNewActivity(true);
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading || !pendingUndoRef.current) return;
    const snapshot = pendingUndoRef.current;
    pendingUndoRef.current = null;
    if (JSON.stringify(snapshot.before) !== JSON.stringify(flow) && snapshot.version === draftEditVersion) {
      setUndo({ before: snapshot.before, after: JSON.stringify(flow), version: snapshot.version });
    }
  }, [isLoading, flow, draftEditVersion]);

  useEffect(() => {
    if (isLoading || queuedMessage === null) return;
    // A failed response needs the user's attention before a queued follow-up proceeds.
    if (error) return;
    const next = queuedMessage;
    setQueuedMessage(null);
    void sendMessage(next);
  }, [isLoading, queuedMessage, error, sendMessage]);

  // Fade the live "building" highlight shortly after the assistant stops.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(clearAssistantActiveStep, HIGHLIGHT_CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading, clearAssistantActiveStep]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-send the goal seeded from the home hero, exactly once — but only after an
  // ad account is selected. The header selector auto-fills shortly after mount; sending
  // before that races and surfaces "Chat requires a connected ad account".
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !seedPrompt?.trim()) return;

    if (isSelectableAutomationBuilderAccount(flow.selectedAccountId, builderAccountScope)) {
      // Defer until mount effects settle: Strict Mode replays cleanup and would
      // otherwise abort the first stream while leaving the seed marked consumed.
      const timer = setTimeout(() => {
        seededRef.current = true;
        seededPromptRef.current = seedPrompt.trim();
        void sendMessage(seedPrompt, seedMode);
        onSeedConsumed?.();
      }, 0);
      return () => clearTimeout(timer);
    }

    if (isUserLoading) return;
    // Selectable accounts exist — wait for selector auto-select / context backfill.
    if (hasSelectableAccountOptions) return;

    // User loaded and no eligible accounts connected: keep the goal in the composer
    // instead of firing a doomed request.
    seededRef.current = true;
    setInputValue(seedPrompt.trim());
    onSeedConsumed?.();
  }, [
    seedPrompt,
    seedMode,
    sendMessage,
    onSeedConsumed,
    flow.selectedAccountId,
    flow.selectedAccountName,
    startAssistantFlow,
    isUserLoading,
    hasSelectableAccountOptions,
    builderAccountScope,
  ]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    followingRef.current = true;
    setHasNewActivity(false);
    void sendMessage(inputValue);
    setInputValue("");
  };

  const handleSuggestion = (text: string, mode?: AssistantMode) => {
    if (isLoading) return;
    void sendMessage(text, mode);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex h-10 shrink-0 items-center justify-between border-b px-4">
        <span className="text-xs font-medium text-muted-foreground">Conversation</span>
        <div className="flex items-center gap-1">
          {!embeddedInDock && displayMode === "normal" && onExpandPanel && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExpandPanel} title="Expand agent panel">
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          {!embeddedInDock && displayMode !== "minimized" && onMinimizePanel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onMinimizePanel}
              title="Minimize agent panel"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          {!isEmpty && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isLoading}
              onClick={() => {
                setQueuedMessage(null);
                clear();
              }}
              title="New conversation (keep draft)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          {!embeddedInDock && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Dock agent">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <AssistantDraftSummary
        flow={flow}
        busy={isLoading}
        canUndo={canUndo}
        onOpenStep={onOpenStep}
        onUndo={() => {
          if (undo && canUndo) {
            restoreAssistantDraft(undo.before);
            setUndo(null);
          }
        }}
      />
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        onScroll={() => {
          const element = scrollRef.current;
          if (!element) return;
          followingRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          if (followingRef.current) setHasNewActivity(false);
        }}
      >
        {isEmpty ? (
          <EmptyState onSuggestion={handleSuggestion} disabled={isLoading} existingNodes={flow.nodes} />
        ) : (
          messages.map((message, index) => {
            if (message.role === "user" && isAutomationBuildNudgeMessage(message.text)) {
              return null;
            }

            if (message.role === "user" && message.suggestionBuild) {
              const buildMeta = message.suggestionBuild;
              const assistantMessage = messages[index + 1]?.role === "assistant" ? messages[index + 1] : null;
              const isActiveTurn = isLoading && index === messages.length - 2;
              return (
                <SuggestionBuildProgressCard
                  key={message.id}
                  suggestion={buildMeta}
                  showSummary={false}
                  toolCalls={assistantMessage?.toolCalls ?? []}
                  assistantText={assistantMessage?.text ?? ""}
                  isLoading={isActiveTurn}
                  hasError={Boolean(error) && index === messages.length - 2}
                  onRetry={() => {
                    if (isLoading) return;
                    void sendSuggestionBuild({
                      rank: buildMeta.rank,
                      title: buildMeta.title,
                      subtitle: buildMeta.subtitle,
                      details: buildMeta.details,
                      buildMessage: buildSuggestionPickMessage(buildMeta),
                    });
                  }}
                />
              );
            }

            return (
              <MessageRow
                key={message.id}
                message={message}
                collapseSeededRequest={message.role === "user" && message.text.trim() === seededPromptRef.current}
                isLoading={isLoading}
                isLatest={index === messages.length - 1}
                accountId={flow.selectedAccountId}
                accountName={flow.selectedAccountName}
                onEditAnswer={(question, answer) => {
                  setInputValue(`Correction to "${question}": ${answer}`);
                  inputRef.current?.focus();
                }}
                suppressSuggestionCards={shouldSuppressSuggestionCards(messages, index)}
                answeredValue={resolveAnsweredValue(messages, index)}
                onAnswerQuestion={(answer) => {
                  if (isLoading) {
                    setQueuedMessage(answer);
                    stop();
                    return;
                  }
                  void sendMessage(answer);
                }}
                onBuildSuggestion={(suggestion) => {
                  if (isLoading) {
                    return;
                  }
                  void sendSuggestionBuild(suggestion);
                }}
              />
            );
          })
        )}

        <AssistantLiveActivity
          message={[...messages].reverse().find((message) => message.role === "assistant")}
          busy={isLoading}
        />

        {error && !isLoading && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      {hasNewActivity && (
        <button
          type="button"
          className="border-t py-2 text-xs font-medium text-primary"
          onClick={() => {
            followingRef.current = true;
            setHasNewActivity(false);
            scrollAnchorRef.current?.scrollIntoView?.({ behavior: "auto", block: "end" });
          }}
        >
          New activity ↓
        </button>
      )}
      <form onSubmit={handleSubmit} className="space-y-2 border-t p-3">
        {queuedMessage !== null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-xs">
            <p className="font-medium">
              {error ? "Follow-up paused — resolve the error or edit this message" : "Queued for after this response"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words">{queuedMessage}</p>
            <button
              type="button"
              className="mt-1 underline"
              onClick={() => {
                setInputValue(queuedMessage);
                setQueuedMessage(null);
              }}
            >
              Edit queued message
            </button>
            <button type="button" className="ml-3 mt-1 underline" onClick={() => setQueuedMessage(null)}>
              Remove
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              isLoading
                ? "Add a detail or prepare your next message…"
                : "Describe a change, ask a question, or build an automation…"
            }
            aria-label="Message the automation assistant"
            rows={2}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !isLoading) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            className="max-h-40 min-h-16 flex-1 resize-y"
          />
          {isLoading ? (
            <Button type="button" variant="outline" size="icon" onClick={stop} title="Stop">
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              className="bg-violet-600 hover:bg-violet-700"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isLoading && inputValue.trim() && queuedMessage === null && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQueuedMessage(inputValue.trim());
                setInputValue("");
              }}
            >
              Send after this
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                stop();
                inputRef.current?.focus();
              }}
            >
              Stop and correct
            </Button>
          </div>
        )}
        <p className="px-1 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line. Changes save automatically; turn on the automation when ready.
        </p>
      </form>
    </div>
  );
}

function EmptyState({
  onSuggestion,
  disabled,
  existingNodes,
}: {
  onSuggestion: (text: string, mode?: AssistantMode) => void;
  disabled: boolean;
  /** Steps already on the canvas — when non-empty, the greeting and prompts talk about
   * editing this automation instead of building a new one from scratch. */
  existingNodes: readonly AutomationNode[];
}): React.ReactElement {
  // "Build me an automation" reads oddly once one already exists on the canvas — an
  // editor opening an existing flow wants edit suggestions that acknowledge what's
  // already there, not a blank-slate pitch.
  const hasExistingFlow = existingNodes.length > 0;
  const flowSummary = hasExistingFlow ? summarizeFlowSteps(existingNodes) : "";
  const prompts = hasExistingFlow ? EDIT_SUGGESTED_PROMPTS : SUGGESTED_PROMPTS;

  return (
    <div className="space-y-5">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <Wand2 className="h-6 w-6 text-violet-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {hasExistingFlow ? "Edit this automation with AI" : "Build automations with AI"}
        </h3>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          {hasExistingFlow
            ? "Describe a change and the agent edits the steps already on the canvas. Review the automatically saved draft before turning it on."
            : "Describe what you want to automate. The agent uses AdManage MCP tools to draft the flow and preview which ads it would affect."}
        </p>
        {hasExistingFlow && (
          <p className="mx-auto mt-2 max-w-xs truncate text-xs font-medium text-violet-700" title={flowSummary}>
            Currently: {flowSummary}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {prompts.slice(0, SUGGESTED_PROMPT_LIMIT).map((prompt) => {
          const isSuggest = prompt.mode === "suggest";
          return (
            <button
              key={prompt.text}
              type="button"
              disabled={disabled}
              onClick={() => onSuggestion(prompt.text, prompt.mode)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSuggest
                  ? "border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-sm ring-1 ring-violet-200/60 hover:border-violet-400 hover:shadow-md"
                  : "hover:border-violet-200 hover:bg-violet-50",
              )}
            >
              <div className="flex items-center gap-2">
                {isSuggest && (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}
                <div>
                  <p className={cn("text-sm font-medium text-foreground", isSuggest && "text-violet-900")}>
                    {prompt.text}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{prompt.description}</p>
                </div>
              </div>
              <ChevronRight
                className={cn("h-4 w-4 flex-shrink-0", isSuggest ? "text-violet-500" : "text-muted-foreground")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The reply that answered an ask_user card, so it renders as picked instead of still-open. */
function resolveAnsweredValue(messages: readonly AssistantMessage[], index: number): string | null {
  const next = messages[index + 1];
  return next?.role === "user" ? next.text : null;
}

/** QuestionCard reads the ask_user payload off a full record; the panel keeps a slimmer shape. */
function toQuestionToolCall(call: AssistantToolCall): ToolCallRecord {
  return {
    id: call.id,
    name: call.name,
    args: call.args,
    isWrite: false,
    status: call.status,
    resultText: call.resultText,
  };
}

function MessageRow({
  message,
  collapseSeededRequest,
  isLoading,
  isLatest,
  accountId,
  accountName,
  onEditAnswer,
  suppressSuggestionCards,
  answeredValue,
  onAnswerQuestion,
  onBuildSuggestion,
}: {
  message: AssistantMessage;
  collapseSeededRequest: boolean;
  isLoading: boolean;
  suppressSuggestionCards: boolean;
  answeredValue: string | null;
  isLatest: boolean;
  accountId?: string;
  accountName?: string;
  onEditAnswer: (question: string, answer: string) => void;
  onAnswerQuestion: (answer: string) => void;
  onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}): React.ReactElement {
  const scanToolStatus =
    message.role === "assistant"
      ? message.toolCalls.find((call) => call.name === "scan_account_insights")?.status
      : undefined;
  const scanSummary = message.role === "assistant" ? findScanInsightsFromToolCalls(message.toolCalls) : null;
  // Ranked-suggestion parsing only applies to "suggest" scan replies — an "explain this
  // automation" or edit-request reply can use the same numbered/bolded shape by coincidence
  // and must render as plain text, not phantom "TOP PICK" / "Build this" cards.
  const suggestions =
    message.role === "assistant" && message.mode === "suggest"
      ? resolveAssistantSuggestions(message.text, scanSummary, scanToolStatus)
      : [];

  if (message.role === "user") {
    if (collapseSeededRequest) {
      return (
        <details className="ml-auto max-w-[85%] rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">
          <summary className="cursor-pointer font-medium">Setup request</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-foreground">{message.text}</p>
        </details>
      );
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  const hasContent = message.text.trim().length > 0 || message.toolCalls.length > 0;
  if (!hasContent) return <div className="hidden" />;

  // A completed ask_user is the turn's question, not a step to report: it renders as an
  // answerable card. A failed one stays in the tool list so the failure is still visible.
  const questionCalls = message.toolCalls.filter((call) => isAskUserToolName(call.name) && call.status === "done");
  const stepCalls = message.toolCalls.filter((call) => !questionCalls.includes(call));

  return (
    <div className="space-y-2">
      {message.handoff && (
        <div className="rounded-xl border bg-primary/5 p-3">
          {message.handoff.destination === "mcp" ? (
            <a
              href="/integrations/mcp"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Open MCP Setup ↗
            </a>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const prompt = `${message.handoff!.prompt}\n\nSelected ad account: ${accountName || ""} (${accountId || "not selected"}).`;
                const transferred = navigateToChatWithContext(
                  { text: prompt },
                  { source: "automation-builder" },
                  (url) => {
                    window.open(url, "_blank");
                  },
                );
                if (!transferred)
                  toast.error(
                    "Could not carry your request over. Your message is still here; copy it into the main assistant.",
                  );
              }}
            >
              Continue in main assistant ↗
            </Button>
          )}
        </div>
      )}
      {stepCalls.length > 0 && <ToolCallCard toolCalls={stepCalls} />}
      {message.text.trim().length > 0 && (
        <AssistantText
          text={message.text}
          toolCalls={stepCalls}
          suggestions={suggestions}
          isLoading={isLoading}
          scanToolStatus={scanToolStatus}
          suppressSuggestionCards={suppressSuggestionCards}
          onBuildSuggestion={onBuildSuggestion}
        />
      )}
      {questionCalls.map((call) => (
        <div key={call.id} className="space-y-2">
          {isLatest &&
            !answeredValue &&
            accountId?.startsWith("act_") &&
            (call.args.entityType === "campaign" || call.args.entityType === "adset") && (
              <div className="rounded-xl border bg-background p-3">
                <p className="mb-1 text-sm font-medium">{String(call.args.question || "Choose a destination")}</p>
                <p className="mb-2 text-xs text-muted-foreground">Meta · {accountName || "Selected account"}</p>
                <AutomationAdSetSelector
                  accountId={accountId}
                  accountType="meta"
                  value=""
                  itemType={call.args.entityType}
                  autoSelectFirst={false}
                  callbacks={{
                    onChange: (id, name) =>
                      onAnswerQuestion(
                        `${call.args.entityType === "campaign" ? "Campaign" : "Ad set"}: ${name || id} (ID: ${id}; account: ${accountId})`,
                      ),
                  }}
                />
              </div>
            )}
          <QuestionCard
            toolCall={toQuestionToolCall(call)}
            answeredValue={answeredValue}
            disabled={!isLatest}
            onEditAnswer={onEditAnswer}
            enhanced
            editDisabled={isLoading}
            onAnswer={onAnswerQuestion}
          />
        </div>
      ))}
    </div>
  );
}

function AssistantText({
  text,
  toolCalls,
  suggestions,
  isLoading,
  scanToolStatus,
  suppressSuggestionCards,
  onBuildSuggestion,
}: {
  text: string;
  toolCalls: AssistantToolCall[];
  suggestions: readonly ParsedAutomationSuggestion[];
  isLoading: boolean;
  scanToolStatus: string | undefined;
  suppressSuggestionCards: boolean;
  onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}): React.ReactElement {
  const hasSuggestionCards = !suppressSuggestionCards && suggestions.length > 0;
  const intro = hasSuggestionCards ? extractSuggestionIntro(text, suggestions) : text.trim();
  const outro = hasSuggestionCards ? extractSuggestionOutro(text, suggestions) : "";
  const shownIntro = intro;

  return (
    <div className="w-full min-w-0 space-y-3">
      {shownIntro && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={ASSISTANT_MARKDOWN_COMPONENTS}
              urlTransform={ASSISTANT_PROSE_MARKDOWN_GATE.urlTransform}
            >
              {shownIntro}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {hasSuggestionCards && (
        <AssistantSuggestionCards
          suggestions={suggestions}
          toolCalls={toolCalls}
          disabled={isLoading && scanToolStatus !== "done"}
          onBuildSuggestion={onBuildSuggestion}
        />
      )}

      {outro && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={ASSISTANT_MARKDOWN_COMPONENTS}
              urlTransform={ASSISTANT_PROSE_MARKDOWN_GATE.urlTransform}
            >
              {outro}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ toolCalls }: { toolCalls: AssistantToolCall[] }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(() => toolCalls.some((call) => call.status === "error" || call.id.startsWith("comment-")));
  useEffect(() => {
    if (toolCalls.some((call) => call.status === "error")) setIsOpen(true);
  }, [toolCalls]);
  return (
    <details
      className="rounded-xl border bg-muted/20 p-2.5"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Activity · {toolCalls.filter((call) => call.status === "done").length} completed
        {toolCalls.some((call) => call.status === "error") ? " · Needs attention" : ""}
      </summary>
      <ul className="space-y-1">
        {toolCalls.map((call) => (
          <ToolCallRow key={call.id} call={call} />
        ))}
      </ul>
    </details>
  );
}

function ToolCallRow({ call }: { call: AssistantToolCall }): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const detail = summarizeToolResultText(call.errorMessage ?? call.resultText);
  const canExpand = Boolean(detail) && call.status === "error";

  return (
    <li className="rounded-lg bg-white px-2 py-1.5 text-xs shadow-sm ring-1 ring-slate-200/80">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn("flex w-full items-center gap-2 text-left", canExpand ? "cursor-pointer" : "cursor-default")}
      >
        <ToolStatusIcon status={call.status} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{humanizeToolName(call.name)}</span>
        {call.latencyMs != null && (
          <span className="tabular-nums text-muted-foreground">{(call.latencyMs / 1000).toFixed(1)}s</span>
        )}
        {call.isFlowProposal && call.status === "done" && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            On canvas
          </span>
        )}
        {call.status === "discarded" && <span className="text-[10px] text-muted-foreground">Draft unchanged</span>}
        {call.status === "error" && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">Failed</span>
        )}
        {canExpand && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-180")}
          />
        )}
      </button>
      {canExpand && isExpanded && detail && (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-snug text-slate-600">{detail}</p>
      )}
    </li>
  );
}

function ToolStatusIcon({ status }: { status: AssistantToolCall["status"] }): React.ReactElement {
  if (status === "discarded") return <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (status === "pending") return <span className="text-[10px] text-amber-700">Needs approval</span>;
  if (status === "error") return <X className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (status === "done" || status === "approved") return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />;
}
