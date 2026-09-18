"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { listEvents, resetToFixtures, clearEvents, subscribeTelemetry } from "@/lib/telemetry/store";
import { FIXTURE_EVENTS } from "@/lib/telemetry/fixtures";
import { groupByAttempt, computeFunnel, filterAttempts, type AttemptSummary, type AttemptFilters } from "@/lib/telemetry/derive";
import { listReviews, saveReview, type ReviewLabel } from "@/lib/telemetry/reviews";
import type { JourneyOutcome, ProblemCategory, TelemetryEvent } from "@/lib/telemetry/events";

const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  repeated_confirmation: "Repeated confirmation (C01)",
  schedule_fidelity: "Schedule fidelity (C02)",
  invisible_template: "Invisible template (C03)",
  draft_preservation: "Draft preservation (C04)",
  incomplete_flow: "Incomplete flow (C05)",
  unsupported_platform: "Unsupported platform (C06)",
  none: "No category",
};

const OUTCOME_VARIANT: Record<string, "success" | "warning" | "destructive" | "info" | "secondary"> = {
  drafted: "info",
  saved: "info",
  activated: "success",
  run_succeeded: "success",
  waiting: "warning",
  blocked: "warning",
  unsupported: "warning",
  cancelled: "secondary",
  error: "destructive",
  run_failed: "destructive",
  unknown: "secondary",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function FunnelBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {count} {max > 0 ? `(${pct}%)` : ""}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EventRow({ event }: { event: TelemetryEvent }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 text-xs last:border-0">
      <div>
        <span className="font-mono font-semibold text-foreground">{event.type}</span>
        <span className="ml-2 text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
      </div>
      <pre className="max-w-[60%] overflow-x-auto whitespace-pre-wrap break-words text-right text-muted-foreground">
        {JSON.stringify(
          Object.fromEntries(
            Object.entries(event).filter(
              ([key]) => !["eventId", "sessionId", "attemptId", "timestamp", "flowRevision", "promptVersion", "type", "source"].includes(key),
            ),
          ),
          null,
          0,
        )}
      </pre>
    </div>
  );
}

function AttemptDetail({ attempt }: { attempt: AttemptSummary }) {
  const [label, setLabel] = useState<ReviewLabel>(() => listReviews()[attempt.attemptId]?.label ?? "friction");
  const [note, setNote] = useState<string>(() => listReviews()[attempt.attemptId]?.note ?? "");
  const [converted, setConverted] = useState<boolean>(() => Boolean(listReviews()[attempt.attemptId]?.convertedToEval));
  const [evalPreview, setEvalPreview] = useState<string | null>(null);

  const handleConvert = () => {
    const fixture = {
      caseId: `dashboard-${attempt.attemptId}`,
      problemCategory: attempt.problemCategory,
      platform: attempt.platform,
      // Sanitized: counts and shapes only, never raw prompt/question text (those were
      // already redacted to {length, hash} before this attempt was ever persisted).
      turnCount: attempt.turnCount,
      finalOutcome: attempt.finalOutcome,
      reachedPreview: attempt.reachedPreview,
      reachedSave: attempt.reachedSave,
      reachedActivate: attempt.reachedActivate,
      reachedRun: attempt.reachedRun,
      eventSequence: attempt.events.map((event) => event.type),
    };
    const json = JSON.stringify(fixture, null, 2);
    setEvalPreview(json);
    saveReview({ attemptId: attempt.attemptId, label, note, convertedToEval: true, reviewedAt: new Date().toISOString() });
    setConverted(true);
  };

  const handleSaveReview = () => {
    saveReview({ attemptId: attempt.attemptId, label, note, convertedToEval: converted, reviewedAt: new Date().toISOString() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {attempt.attemptId}
          <Badge variant={OUTCOME_VARIANT[attempt.finalOutcome] ?? "secondary"} appearance="light" size="sm">
            {attempt.finalOutcome}
          </Badge>
          <Badge variant="secondary" appearance="light" size="sm">
            {attempt.platform}
          </Badge>
          <Badge variant="secondary" appearance="outline" size="sm">
            {CATEGORY_LABELS[attempt.problemCategory]}
          </Badge>
          <span className="text-xs font-normal text-muted-foreground">
            source: {attempt.source} · {attempt.turnCount} turn{attempt.turnCount === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2">
            {attempt.events.map((event) => (
              <EventRow key={event.eventId} event={event} />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review label</p>
            <div className="flex flex-wrap gap-1.5">
              {(["looks_fine", "friction", "bug", "needs_eval"] as ReviewLabel[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLabel(option)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    label === option ? "border-violet-500 bg-violet-50 text-violet-800" : "border-border text-muted-foreground"
                  }`}
                >
                  {option.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</p>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="What should the next investigation look at?"
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSaveReview}>
            Save review
          </Button>
          <Button size="sm" onClick={handleConvert}>
            {converted ? "Re-export eval fixture" : "Convert to eval"}
          </Button>
          {converted && <Badge variant="success" appearance="light" size="sm">Marked for eval</Badge>}
        </div>

        {evalPreview && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sanitized eval fixture (paste into <code>evals/fixtures/</code>)
            </p>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px]">{evalPreview}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutomationInsightsPage() {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AttemptFilters>({
    problemCategory: "all",
    platform: "all",
    outcome: "all",
    source: "all",
  });
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const reload = () => {
    try {
      setEvents(listEvents());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not read local telemetry storage.");
    }
  };

  useEffect(() => {
    setMounted(true);
    reload();
    return subscribeTelemetry(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attempts = useMemo(() => groupByAttempt(events), [events]);
  const filtered = useMemo(() => filterAttempts(attempts, filters), [attempts, filters]);
  const funnel = useMemo(() => computeFunnel(filtered), [filtered]);
  const maxFunnel = funnel[0]?.count ?? 0;
  const selected = filtered.find((attempt) => attempt.attemptId === selectedAttemptId) ?? null;

  const platforms = useMemo(() => Array.from(new Set(attempts.map((a) => a.platform))).sort(), [attempts]);
  const outcomes = useMemo(
    () => Array.from(new Set(attempts.map((a) => a.finalOutcome))).sort() as (JourneyOutcome | "unknown")[],
    [attempts],
  );

  // Before/after comparison for the one demonstrated improvement (C06).
  const beforeAttempt = attempts.find((a) => a.attemptId === "fixture-attempt-5");
  const afterAttempt = attempts.find((a) => a.attemptId === "fixture-attempt-4");

  if (!mounted) {
    return <div className="p-6 text-sm text-muted-foreground">Loading insights…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/automation" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to Automate
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Automation agent insights</h1>
          <p className="text-sm text-muted-foreground">
            Built from real events emitted by this app (chat attempts, saves, activations, runs) plus an optional seeded
            fixture set. Nothing here is sent anywhere — see the README's Logging section.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetToFixtures(FIXTURE_EVENTS);
            }}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Reset fixtures
          </Button>
          <Button size="sm" variant="outline" onClick={() => clearEvents()}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear all
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-4 text-sm text-destructive">
            <span>Couldn't load telemetry: {loadError}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadError && events.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No telemetry yet. Use the chat assistant to build/save/activate an automation, or load the seeded demo
              dataset to see the dashboard populated.
            </p>
            <Button size="sm" onClick={() => resetToFixtures(FIXTURE_EVENTS)}>
              Load demo fixtures
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadError && events.length > 0 && (
        <>
          {beforeAttempt && afterAttempt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Before / after — C06 unsupported-platform fix</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Before (baseline)</p>
                  <p className="mt-1 text-sm text-amber-900">
                    Silently built a Meta action for a Pinterest request. Outcome:{" "}
                    <strong>{beforeAttempt.finalOutcome}</strong> — no mismatch detected, nothing asked, wrong platform
                    drafted. Sample size: 1 (see <code>evals/fixtures/c06-unsupported-platform.json</code> for the
                    reproducible case).
                  </p>
                </div>
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">After (this pass)</p>
                  <p className="mt-1 text-sm text-emerald-900">
                    Detects the mismatch, asks via an inline picker of connected Pinterest accounts, then builds
                    correctly once answered. Outcome: <strong>{afterAttempt.finalOutcome}</strong>, reached save:{" "}
                    {String(afterAttempt.reachedSave)}. Sample size: 1 — a demo-scale improvement, not a production
                    lift claim (see docs/improvement.md).
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Journey funnel — prompt → draft → preview → save → activate → successful run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnel.map((stage) => (
                <FunnelBar key={stage.key} label={stage.label} count={stage.count} max={maxFunnel} />
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">No attempts match the current filters.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <label className="text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Problem category</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={filters.problemCategory}
                  onChange={(event) => setFilters((prev) => ({ ...prev, problemCategory: event.target.value as ProblemCategory | "all" }))}
                >
                  <option value="all">All</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Platform</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={filters.platform}
                  onChange={(event) => setFilters((prev) => ({ ...prev, platform: event.target.value }))}
                >
                  <option value="all">All</option>
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Outcome</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={filters.outcome}
                  onChange={(event) => setFilters((prev) => ({ ...prev, outcome: event.target.value as JourneyOutcome | "unknown" | "all" }))}
                >
                  <option value="all">All</option>
                  {outcomes.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {outcome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Source</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={filters.source}
                  onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value as "live" | "fixture" | "all" }))}
                >
                  <option value="all">All</option>
                  <option value="live">Live (from this app)</option>
                  <option value="fixture">Fixture (seeded demo)</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Time range</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  value={filters.sinceMs ?? "all"}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      sinceMs: event.target.value === "all" ? undefined : Number(event.target.value),
                    }))
                  }
                >
                  <option value="all">All time</option>
                  <option value={60 * 60_000}>Last hour</option>
                  <option value={24 * 60 * 60_000}>Last 24h</option>
                  <option value={7 * 24 * 60 * 60_000}>Last 7 days</option>
                </select>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Attempts ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No attempts match — try clearing filters.</p>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((attempt) => (
                    <button
                      key={attempt.attemptId}
                      type="button"
                      onClick={() => setSelectedAttemptId(attempt.attemptId)}
                      className={`flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-muted/50 ${
                        selectedAttemptId === attempt.attemptId ? "bg-violet-50" : ""
                      }`}
                    >
                      <span className="font-mono text-xs text-foreground">{attempt.attemptId}</span>
                      <Badge variant="secondary" appearance="outline" size="sm">
                        {attempt.platform}
                      </Badge>
                      <Badge variant="secondary" appearance="outline" size="sm">
                        {CATEGORY_LABELS[attempt.problemCategory]}
                      </Badge>
                      <Badge variant={OUTCOME_VARIANT[attempt.finalOutcome] ?? "secondary"} appearance="light" size="sm">
                        {attempt.finalOutcome}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(attempt.startedAt)}</span>
                      <span className="text-xs text-muted-foreground">{attempt.source}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selected && <AttemptDetail attempt={selected} />}
        </>
      )}
    </div>
  );
}
