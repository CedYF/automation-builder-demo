"use client";

import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AutomationHomeStats } from "@/lib/automation/home-stats";

const ESTIMATE_HINT =
  "Estimated from the actions your automations actually ran, using a fixed per-action model of how long the same work takes by hand in Ads Manager.";
const TRUNCATED_HINT = "Based on the 2,000 most recent runs — your real total is higher.";

interface StatTile {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** Estimated tiles carry an info affordance so nobody reads them as tracked. */
  readonly isEstimate: boolean;
  readonly trendPercent?: number | null;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function buildTiles(stats: AutomationHomeStats): readonly StatTile[] {
  return [
    {
      key: "saved",
      label: `Time saved · ${stats.periodLabel}`,
      value: `${stats.savedHours.toLocaleString("en-US")} hrs`,
      isEstimate: true,
      trendPercent: stats.savedHoursTrendPercent,
    },
    { key: "runs", label: "Runs completed", value: formatCount(stats.runsCompleted), isEstimate: false },
    { key: "actions", label: "Actions taken", value: formatCount(stats.actionsTaken), isEstimate: false },
    {
      key: "clicks",
      label: "Manual clicks avoided",
      value: formatCount(stats.manualClicksAvoided),
      isEstimate: true,
    },
  ];
}

function TrendPill({ trendPercent }: { readonly trendPercent: number }): React.ReactElement {
  const isPositive = trendPercent >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
      )}
    >
      {isPositive ? "+" : ""}
      {trendPercent}%
    </span>
  );
}

function EstimateBadge({ hint }: { readonly hint: string }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1 text-[11px] font-medium text-muted-foreground">
          est.
          <Info className="h-3 w-3" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px]">
        <p>{hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function StatTileCell({ tile, hint }: { readonly tile: StatTile; readonly hint: string }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-2.5 sm:border-l sm:border-border/60 sm:first:border-l-0">
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="truncate">{tile.label}</span>
        {tile.isEstimate && <EstimateBadge hint={hint} />}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-xl font-bold leading-none tracking-tight tabular-nums text-foreground">{tile.value}</span>
        {typeof tile.trendPercent === "number" && <TrendPill trendPercent={tile.trendPercent} />}
      </span>
    </div>
  );
}

interface AutomationHomeStatsProps {
  readonly stats: AutomationHomeStats | null;
  readonly loading: boolean;
}

/**
 * Compresses the month's automation impact into a single strip.
 *
 * Runs completed and Ads actioned are counted from execution records. Time saved
 * and Manual clicks avoided are estimates and say so — see `effort-model.ts`.
 */
export function AutomationHomeStats({ stats, loading }: AutomationHomeStatsProps): React.ReactElement {
  if (loading && !stats) {
    return (
      <div className="flex shrink-0 flex-col rounded-xl border border-border bg-card sm:flex-row">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex flex-1 flex-col gap-1.5 px-4 py-2.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return <></>;

  const hint = stats.sampleTruncated ? `${ESTIMATE_HINT} ${TRUNCATED_HINT}` : ESTIMATE_HINT;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex shrink-0 flex-col divide-y divide-border/60 rounded-xl border border-border bg-card sm:flex-row sm:divide-y-0">
        {buildTiles(stats).map((tile) => (
          <StatTileCell key={tile.key} tile={tile} hint={hint} />
        ))}
      </div>
    </TooltipProvider>
  );
}
