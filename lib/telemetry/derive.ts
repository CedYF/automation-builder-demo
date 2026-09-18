import type { JourneyOutcome, ProblemCategory, TelemetryEvent, TelemetryEventType } from "./events";

/** One row in the dashboard's attempt list — the events for one attemptId, summarized. */
export interface AttemptSummary {
  readonly attemptId: string;
  readonly sessionId: string;
  readonly platform: string;
  readonly problemCategory: ProblemCategory;
  readonly startedAt: string;
  readonly lastEventAt: string;
  readonly finalOutcome: JourneyOutcome | "unknown";
  readonly turnCount: number;
  readonly durationMs: number;
  readonly reachedPreview: boolean;
  readonly reachedSave: boolean;
  readonly reachedActivate: boolean;
  readonly reachedRun: boolean;
  readonly source: "live" | "fixture";
  readonly events: readonly TelemetryEvent[];
}

function firstNonEmpty<T>(values: readonly (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

/** Groups the flat event log into one summary row per attemptId, in most-recent-first order. */
export function groupByAttempt(events: readonly TelemetryEvent[]): AttemptSummary[] {
  const byAttempt = new Map<string, TelemetryEvent[]>();
  for (const event of events) {
    const list = byAttempt.get(event.attemptId) ?? [];
    list.push(event);
    byAttempt.set(event.attemptId, list);
  }

  const summaries: AttemptSummary[] = [];
  for (const [attemptId, attemptEvents] of byAttempt) {
    const sorted = [...attemptEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const started = sorted.find((event): event is Extract<TelemetryEvent, { type: "attempt_started" }> =>
      event.type === "attempt_started",
    );
    const outcomeEvents = sorted.filter(
      (event): event is Extract<TelemetryEvent, { type: "attempt_outcome" }> => event.type === "attempt_outcome",
    );
    const abandoned = sorted.find(
      (event): event is Extract<TelemetryEvent, { type: "attempt_abandoned" }> => event.type === "attempt_abandoned",
    );
    const lastOutcomeEvent = outcomeEvents[outcomeEvents.length - 1];
    const finalOutcome: JourneyOutcome | "unknown" = abandoned
      ? "cancelled"
      : (lastOutcomeEvent?.outcome ?? "unknown");

    const platform = firstNonEmpty(sorted.map((event) => event.platform)) ?? "unknown";
    const problemCategory =
      firstNonEmpty(sorted.map((event) => (event.problemCategory !== "none" ? event.problemCategory : undefined))) ??
      "none";
    const turnCount = Math.max(1, ...outcomeEvents.map((event) => event.turnCount), abandoned?.turnCount ?? 1);
    const durationMs = outcomeEvents.reduce((sum, event) => sum + event.durationMs, 0);

    summaries.push({
      attemptId,
      sessionId: sorted[0]?.sessionId ?? "unknown",
      platform,
      problemCategory,
      startedAt: sorted[0]?.timestamp ?? new Date(0).toISOString(),
      lastEventAt: sorted[sorted.length - 1]?.timestamp ?? new Date(0).toISOString(),
      finalOutcome,
      turnCount,
      durationMs,
      reachedPreview: sorted.some((event) => event.type === "preview_viewed"),
      reachedSave: sorted.some((event) => event.type === "draft_saved"),
      reachedActivate: sorted.some((event) => event.type === "automation_activated" && event.active),
      reachedRun: sorted.some((event) => event.type === "run_succeeded"),
      source: started?.source ?? sorted[0]?.source ?? "live",
      events: sorted,
    });
  }

  return summaries.sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
}

export interface FunnelStage {
  readonly key: "prompt" | "drafted" | "previewed" | "saved" | "activated" | "run";
  readonly label: string;
  readonly count: number;
}

/** prompt → draft → preview → save → activate → successful-run, with drop-off counts. */
export function computeFunnel(attempts: readonly AttemptSummary[]): FunnelStage[] {
  const prompt = attempts.length;
  const drafted = attempts.filter((a) => a.finalOutcome === "drafted" || a.reachedSave || a.reachedPreview).length;
  const previewed = attempts.filter((a) => a.reachedPreview).length;
  const saved = attempts.filter((a) => a.reachedSave).length;
  const activated = attempts.filter((a) => a.reachedActivate).length;
  const run = attempts.filter((a) => a.reachedRun).length;
  return [
    { key: "prompt", label: "Prompt", count: prompt },
    { key: "drafted", label: "Draft built", count: drafted },
    { key: "previewed", label: "Previewed", count: previewed },
    { key: "saved", label: "Saved", count: saved },
    { key: "activated", label: "Activated", count: activated },
    { key: "run", label: "Successful run", count: run },
  ];
}

export interface AttemptFilters {
  readonly problemCategory?: ProblemCategory | "all";
  readonly platform?: string | "all";
  readonly outcome?: JourneyOutcome | "unknown" | "all";
  readonly source?: "live" | "fixture" | "all";
  readonly sinceMs?: number; // now - sinceMs .. now
}

export function filterAttempts(attempts: readonly AttemptSummary[], filters: AttemptFilters): AttemptSummary[] {
  const now = Date.now();
  return attempts.filter((attempt) => {
    if (filters.problemCategory && filters.problemCategory !== "all" && attempt.problemCategory !== filters.problemCategory)
      return false;
    if (filters.platform && filters.platform !== "all" && attempt.platform !== filters.platform) return false;
    if (filters.outcome && filters.outcome !== "all" && attempt.finalOutcome !== filters.outcome) return false;
    if (filters.source && filters.source !== "all" && attempt.source !== filters.source) return false;
    if (filters.sinceMs !== undefined && now - new Date(attempt.startedAt).getTime() > filters.sinceMs) return false;
    return true;
  });
}

export function countByType(events: readonly TelemetryEvent[]): Partial<Record<TelemetryEventType, number>> {
  const counts: Partial<Record<TelemetryEventType, number>> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return counts;
}
