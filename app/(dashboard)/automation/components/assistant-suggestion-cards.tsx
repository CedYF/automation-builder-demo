"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Hammer, Repeat2, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { AssistantToolCall } from "../hooks/use-automation-assistant";
import {
  formatBehaviorActionLabel,
  findScanInsightsFromToolCalls,
  labelFromEnrichedSignalType,
  type AccountInsightsScanSummary,
  type ParsedAutomationSuggestion,
} from "../lib/parse-assistant-suggestions";
import { suggestionRankBadgeClass } from "../lib/suggestion-card-layout";
import { formatSuggestionDetailLines } from "../lib/suggestion-display";
interface AssistantSuggestionCardsProps {
  readonly suggestions: readonly ParsedAutomationSuggestion[];
  readonly toolCalls: readonly AssistantToolCall[];
  readonly disabled: boolean;
  readonly onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}

export function AssistantSuggestionCards({
  suggestions,
  toolCalls,
  disabled,
  onBuildSuggestion,
}: AssistantSuggestionCardsProps): React.ReactElement | null {
  const scanSummary = findScanInsightsFromToolCalls(toolCalls);

  if (suggestions.length === 0) return null;

  return (
    <SuggestionCardsWithPreview
      suggestions={suggestions}
      scanSummary={scanSummary}
      disabled={disabled}
      onBuildSuggestion={onBuildSuggestion}
    />
  );
}

function SuggestionCardsWithPreview({
  suggestions,
  scanSummary,
  disabled,
  onBuildSuggestion,
}: {
  suggestions: readonly ParsedAutomationSuggestion[];
  scanSummary: AccountInsightsScanSummary | null;
  disabled: boolean;
  onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}): React.ReactElement {
  const [previewSuggestion, setPreviewSuggestion] = useState<ParsedAutomationSuggestion | null>(null);

  const openPreview = (suggestion: ParsedAutomationSuggestion): void => {
    setPreviewSuggestion(suggestion);
  };

  const confirmBuild = (): void => {
    if (!previewSuggestion) return;
    onBuildSuggestion(previewSuggestion);
    setPreviewSuggestion(null);
  };

  return (
    <>
      <div className="space-y-3">
        {scanSummary && <ScanInsightsBanner summary={scanSummary} />}
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={`${suggestion.rank}-${suggestion.title}`}
              suggestion={suggestion}
              disabled={disabled}
              onPreview={() => openPreview(suggestion)}
            />
          ))}
        </div>
      </div>

      <SuggestionPreviewDialog
        suggestion={previewSuggestion}
        disabled={disabled}
        onClose={() => setPreviewSuggestion(null)}
        onConfirmBuild={confirmBuild}
      />
    </>
  );
}

function ScanInsightsBanner({ summary }: { summary: AccountInsightsScanSummary }): React.ReactElement {
  const topBehavior = summary.behaviorSignals[0];
  const hasSpend = summary.totals.spend > 0;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
        <Sparkles className="h-3.5 w-3.5" />
        Account scan · last {summary.lookbackDays} days
      </p>

      {topBehavior ? (
        <div className="flex items-start gap-2 rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-violet-100">
          <Repeat2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <div>
            <p className="text-sm font-medium text-violet-950">
              Repeated manual pattern: {formatBehaviorActionLabel(topBehavior.action)}{" "}
              <span className="text-violet-700">{topBehavior.count}×</span>
            </p>
            <p className="mt-0.5 text-xs text-violet-800/80">{topBehavior.suggestion}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-violet-800/90">No repeated manual actions detected in this window.</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-violet-900/80">
        <ScanStat
          icon={<TrendingUp className="h-3 w-3" />}
          label={hasSpend ? `$${summary.totals.spend.toLocaleString()} spend` : "No spend in window"}
        />
        <ScanStat icon={<Zap className="h-3 w-3" />} label={`${summary.totals.adCount} ads checked`} />
        {summary.winnersCount > 0 && (
          <ScanStat icon={<TrendingUp className="h-3 w-3" />} label={`${summary.winnersCount} winners`} />
        )}
        {summary.losersCount > 0 && (
          <ScanStat icon={<TrendingDown className="h-3 w-3" />} label={`${summary.losersCount} underperformers`} />
        )}
      </div>
    </div>
  );
}

function ScanStat({ icon, label }: { icon: React.ReactNode; label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-violet-100">
      {icon}
      {label}
    </span>
  );
}

function SuggestionCard({
  suggestion,
  disabled,
  onPreview,
}: {
  suggestion: ParsedAutomationSuggestion;
  disabled: boolean;
  onPreview: () => void;
}): React.ReactElement {
  const isPrimary =
    suggestion.rank === 1 ||
    suggestion.subtitle?.toLowerCase().includes("strongest") ||
    suggestion.subtitle?.toLowerCase().includes("highest");
  const detailLines = formatSuggestionDetailLines(suggestion.details, suggestion.subtitle);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onPreview();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPreview();
        }
      }}
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        isPrimary ? "border-violet-300 ring-1 ring-violet-200/70" : "border-slate-200",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            suggestionRankBadgeClass(Boolean(isPrimary)),
          )}
        >
          {suggestion.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{suggestion.title}</p>
            {isPrimary && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                Top pick
              </span>
            )}
            {suggestion.signalType && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {labelFromEnrichedSignalType(suggestion.signalType)}
              </span>
            )}
          </div>
          {suggestion.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.subtitle}</p>}
          {detailLines.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
              {detailLines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-slate-400">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onPreview();
          }}
          className="h-8 gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
        >
          <Hammer className="h-3.5 w-3.5" />
          Build this
        </Button>
      </div>
    </div>
  );
}

function SuggestionPreviewDialog({
  suggestion,
  disabled,
  onClose,
  onConfirmBuild,
}: {
  suggestion: ParsedAutomationSuggestion | null;
  disabled: boolean;
  onClose: () => void;
  onConfirmBuild: () => void;
}): React.ReactElement {
  const detailLines = suggestion ? formatSuggestionDetailLines(suggestion.details, suggestion.subtitle) : [];

  return (
    <Dialog open={suggestion !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">What this will do</DialogTitle>
          <DialogDescription className="text-left">
            Review the automation before the agent adds it to your canvas.
          </DialogDescription>
        </DialogHeader>

        {suggestion && (
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{suggestion.title}</p>
              {suggestion.subtitle && <p className="mt-1 text-xs text-muted-foreground">{suggestion.subtitle}</p>}
            </div>

            {detailLines.length > 0 ? (
              <ul className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                {detailLines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                The agent will build this automation on your canvas using the trigger and action described in the
                suggestion above.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Clicking <span className="font-medium text-foreground">Build on canvas</span> sends this suggestion to the
              agent. You can still edit every step before saving or turning it on.
            </p>
          </div>
        )}

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={disabled || !suggestion}
            onClick={onConfirmBuild}
            className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
          >
            <Hammer className="h-3.5 w-3.5" />
            Build on canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
