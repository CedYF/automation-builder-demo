"use client";

/**
 * Which outcomes the run log shows: everything by default, or just the errors,
 * the interrupted runs, and so on.
 *
 * Filtering happens on the server (the endpoint takes the outcome), because a
 * client-side filter would only narrow the fifty runs already loaded — on an
 * automation with thousands of runs "only errors" would then miss most of them.
 * The counts come back for every outcome even while one is selected, so the
 * numbers beside each option never move as it is used.
 */

import { ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCount } from "./run-page-filter";
import type { CommentActionType, RunOutcome, RunOutcomeCount } from "@/app/(dashboard)/comments/lib/api/automation";

/** The "no outcome picked" value; a radio group needs a value for every option. */
const ALL_OUTCOMES_VALUE = "__all_outcomes__";

/** Success reads as what the automation did, so it matches the row badges. */
const SUCCESS_LABEL: Readonly<Record<CommentActionType, string>> = {
  hide: "Hidden",
  delete: "Deleted",
  like: "Liked",
  reply: "Sent",
  export_sheet: "Exported",
};

const OUTCOME_LABEL: Readonly<Record<Exclude<RunOutcome, "success">, string>> = {
  failed: "Error",
  unavailable: "Unavailable",
  interrupted: "Interrupted",
  running: "Running",
  skipped: "Skipped",
};

function outcomeLabel(outcome: RunOutcome, actionType: CommentActionType): string {
  return outcome === "success" ? SUCCESS_LABEL[actionType] : OUTCOME_LABEL[outcome];
}

export function RunOutcomeFilter({
  outcomes,
  selectedOutcome,
  actionType,
  totalRuns,
  onSelect,
}: {
  readonly outcomes: readonly RunOutcomeCount[];
  readonly selectedOutcome: RunOutcome | null;
  readonly actionType: CommentActionType;
  /** Runs in the whole history, for the "All outcomes" row. */
  readonly totalRuns: number;
  readonly onSelect: (outcome: RunOutcome | null) => void;
}) {
  const selected = outcomes.find((entry) => entry.outcome === selectedOutcome) ?? null;
  const selectedLabel = selected ? outcomeLabel(selected.outcome, actionType) : "All outcomes";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[15rem] gap-2" aria-label="Filter runs by outcome">
          <Filter className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatCount(selected ? selected.runCount : totalRuns)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuRadioGroup
          value={selectedOutcome ?? ALL_OUTCOMES_VALUE}
          onValueChange={(value) => onSelect(value === ALL_OUTCOMES_VALUE ? null : (value as RunOutcome))}
        >
          <DropdownMenuRadioItem value={ALL_OUTCOMES_VALUE} className="gap-2">
            <span className="min-w-0 flex-1 truncate">All outcomes</span>
            <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">{formatCount(totalRuns)}</span>
          </DropdownMenuRadioItem>
          {outcomes.map((entry) => (
            <DropdownMenuRadioItem key={entry.outcome} value={entry.outcome} className="gap-2">
              <span className="min-w-0 flex-1 truncate">{outcomeLabel(entry.outcome, actionType)}</span>
              <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatCount(entry.runCount)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
