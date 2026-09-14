"use client";

/**
 * The run log of a comment automation's history view
 * (`comment-automation-history-view.tsx`, at `view=history`).
 *
 * This module owns the data: CommentsServer stores an automation as one rule
 * per page, so runs are read for every member rule of the automation that was
 * opened — reading the one id it opened with would hide every other page's
 * runs. `run-history-table.tsx` renders them as a line per run under day
 * headers, and `run-detail-drawer.tsx` shows the run a row opens.
 *
 * Runs load a page at a time ("Load more"), and so do an open run's comments.
 * Runs still in progress are re-read every few seconds so their status and
 * counts move without a manual Refresh — including the one open in the drawer.
 * One builder "Run" starts a run per page; those share a run group and collapse
 * into a single line.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  automationApi,
  type AccountRun,
  type AutomationRun,
  type CommentActionType,
  type ProcessedComment,
  type RunOutcome,
  type RunOutcomeCount,
  type RunPageCount,
} from "@/app/(dashboard)/comments/lib/api/automation";
import { useCommentAutomationMembers } from "../hooks/use-comment-automation-members";
import { groupRunsForDisplay } from "../lib/comment-run-groups";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RunHistoryTable } from "./run-history-table";
import { RunDetailDrawer } from "./run-detail-drawer";
import { formatCount, pageLabel } from "./run-page-filter";

const RUNS_PAGE_SIZE = 50;
const RUN_DETAILS_PAGE_SIZE = 50;
/** How often runs still in progress are re-read while the history is open. */
export const RUN_POLL_INTERVAL_MS = 5_000;

interface CommentRunHistoryProps {
  /** Any member rule of the automation; the whole membership is resolved from it. */
  ruleId: number;
  /** The rule's action type, used to label successful runs (Hidden/Deleted/…). */
  actionType: CommentActionType;
  /**
   * Which page's runs to show; null is every page. Owned by the host so the
   * filter can sit in the page header, beside the automation it narrows.
   */
  pageFilter?: string | null;
  /**
   * Which outcome's runs to show; null is all of them. Server-side, like the
   * page filter — narrowing only the loaded rows would hide most of the errors
   * on an automation with thousands of runs.
   */
  outcome?: RunOutcome | null;
  /** Bumped by the host's Refresh control to re-read the list in place. */
  refreshToken?: number;
  /** Whether a refresh is in flight, for the host's Refresh spinner. */
  onRefreshingChange?: (refreshing: boolean) => void;
  /**
   * Every page of the automation with its run count, once loaded. The header
   * names the filter's options from these, which the builder config may have
   * stored no names for.
   */
  onPagesLoaded?: (pages: readonly RunPageCount[]) => void;
  /** Run count per outcome, for the header's outcome filter. */
  onOutcomesLoaded?: (outcomes: readonly RunOutcomeCount[]) => void;
}

/** An open run's comments: the pages loaded so far, and how many exist. */
interface RunComments {
  readonly comments: ProcessedComment[];
  readonly total: number;
}

function pluralizeRuns(count: number): string {
  return `${formatCount(count)} run${count !== 1 ? "s" : ""}`;
}

/**
 * Appends the next page, dropping anything already shown. Both lists are
 * ordered newest-first, and a run landing mid-read shifts every later run down
 * a slot — so the next offset can repeat rows the first page already had.
 */
function appendById<T extends { id: number }>(current: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

/** A polled run's moving parts; everything else on the row is immutable. */
function mergeRunProgress(row: AccountRun, latest: AutomationRun): AccountRun {
  return {
    ...row,
    status: latest.status,
    totalProcessed: latest.totalProcessed,
    successCount: latest.successCount,
    failedCount: latest.failedCount,
    unavailableCount: latest.unavailableCount ?? row.unavailableCount,
    completedAt: latest.completedAt,
  };
}

export function CommentRunHistory({
  ruleId,
  actionType,
  pageFilter = null,
  outcome = null,
  refreshToken = 0,
  onRefreshingChange,
  onPagesLoaded,
  onOutcomesLoaded,
}: CommentRunHistoryProps) {
  const members = useCommentAutomationMembers(ruleId);
  const memberIds = members.data?.memberIds;
  const [runs, setRuns] = useState<AccountRun[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState<RunPageCount[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  /**
   * The open run as it was when opened. A refresh (or a page filter) replaces
   * the loaded list, and a run opened from a later page is then no longer in
   * it — without this the drawer would close itself mid-read.
   */
  const [openedRun, setOpenedRun] = useState<AccountRun | null>(null);
  const [commentsByRunId, setCommentsByRunId] = useState<Record<number, RunComments>>({});
  const [loadingRunId, setLoadingRunId] = useState<number | null>(null);
  const [loadingMoreCommentsRunId, setLoadingMoreCommentsRunId] = useState<number | null>(null);
  const [stoppingRunIds, setStoppingRunIds] = useState<ReadonlySet<number>>(() => new Set());
  // Bumped whenever the list restarts (membership, filter, refresh), so a slow
  // response for the previous list can never land in the current one.
  const listVersion = useRef(0);
  /** Rows the server has handed over, which dedup can make exceed runs.length. */
  const loadedCount = useRef(0);
  // Read by the progress poll, which must not restart its timer every render.
  const selectedRunIdRef = useRef(selectedRunId);
  const commentsByRunIdRef = useRef(commentsByRunId);
  const onPagesLoadedRef = useRef(onPagesLoaded);
  const onOutcomesLoadedRef = useRef(onOutcomesLoaded);
  const onRefreshingChangeRef = useRef(onRefreshingChange);
  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
    commentsByRunIdRef.current = commentsByRunId;
    onPagesLoadedRef.current = onPagesLoaded;
    onOutcomesLoadedRef.current = onOutcomesLoaded;
    onRefreshingChangeRef.current = onRefreshingChange;
  });

  const fetchRuns = useCallback(
    async (showRefreshIndicator = false) => {
      if (!memberIds) return;
      const version = ++listVersion.current;
      if (showRefreshIndicator) onRefreshingChangeRef.current?.(true);
      try {
        const response = await automationApi.getRunsByRuleIds(
          memberIds,
          RUNS_PAGE_SIZE,
          0,
          pageFilter ?? undefined,
          outcome ?? undefined,
        );
        if (version !== listVersion.current) return;
        const firstPage = response.runs ?? [];
        loadedCount.current = firstPage.length;
        setRuns(firstPage);
        setTotal(response.total ?? firstPage.length);
        setPages(response.pages ?? []);
        setRunsError(null);
        setLoadMoreError(null);
        onPagesLoadedRef.current?.(response.pages ?? []);
        onOutcomesLoadedRef.current?.(response.outcomes ?? []);
      } catch (error) {
        if (version !== listVersion.current) return;
        console.error("Failed to fetch comment automation runs:", error);
        setRunsError(error instanceof Error ? error.message : "Failed to load run history");
      } finally {
        if (version === listVersion.current) {
          setRunsLoading(false);
          onRefreshingChangeRef.current?.(false);
        }
      }
    },
    [memberIds, pageFilter, outcome],
  );

  const loadMore = useCallback(async () => {
    if (!memberIds) return;
    const version = listVersion.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await automationApi.getRunsByRuleIds(
        memberIds,
        RUNS_PAGE_SIZE,
        loadedCount.current,
        pageFilter ?? undefined,
        outcome ?? undefined,
      );
      if (version !== listVersion.current) return;
      loadedCount.current += response.runs?.length ?? 0;
      setRuns((current) => appendById(current, response.runs ?? []));
      if (typeof response.total === "number") setTotal(response.total);
    } catch (error) {
      if (version !== listVersion.current) return;
      console.error("Failed to load more comment automation runs:", error);
      setLoadMoreError(error instanceof Error ? error.message : "Failed to load more runs");
    } finally {
      setLoadingMore(false);
    }
  }, [memberIds, pageFilter, outcome]);

  useEffect(() => {
    setRunsLoading(true);
    setSelectedRunId(null);
    setOpenedRun(null);
    setCommentsByRunId({});
    fetchRuns();
  }, [fetchRuns]);

  // Refresh from the page header re-reads the list without closing the drawer,
  // so it runs apart from the effect above. The first token is the initial read.
  const refreshedTokenRef = useRef(refreshToken);
  useEffect(() => {
    if (refreshedTokenRef.current === refreshToken) return;
    refreshedTokenRef.current = refreshToken;
    void fetchRuns(true);
  }, [refreshToken, fetchRuns]);

  // Runs still in progress are re-read in place — only those rows, so paging,
  // the page filter, and the open run stay exactly as they are. The timer
  // restarts only when the set of running runs changes.
  const runningRunKey = runs
    .filter((run) => run.status === "running")
    .map((run) => run.id)
    .join(",");
  useEffect(() => {
    if (!runningRunKey) return;
    const runIds = runningRunKey.split(",").map(Number);
    let pollInFlight = false;

    const poll = async (): Promise<void> => {
      if (pollInFlight) return;
      pollInFlight = true;
      const version = listVersion.current;
      try {
        const latest = await Promise.all(
          runIds.map((runId) => automationApi.getRunDetails(runId, 1, 0).catch(() => null)),
        );
        if (version !== listVersion.current) return;
        const latestById = new Map<number, { run: AutomationRun; total: number }>();
        for (const details of latest) {
          if (details?.run?.id) latestById.set(details.run.id, { run: details.run, total: details.total });
        }
        let replyRunFinished = false;
        setRuns((current) =>
          current.map((row) => {
            const found = latestById.get(row.id);
            if (!found) return row;
            if (row.status === "running" && found.run.status !== "running" && actionType === "reply") {
              replyRunFinished = true;
            }
            return mergeRunProgress(row, found.run);
          }),
        );
        // Draft approval counts come from the list read, not from a run's own
        // progress, so a finished reply run is re-read once to settle its badge.
        if (replyRunFinished) void fetchRuns();

        // The open run's comments: newest come first, so a first page that is
        // not full yet is refetched as batches land. Once there is a full page,
        // or the user has paged past it, the list stays put and only its total
        // moves — a poll never replaces comments being read.
        const openId = selectedRunIdRef.current;
        const open = openId !== null ? latestById.get(openId) : undefined;
        const cached = openId !== null ? commentsByRunIdRef.current[openId] : undefined;
        if (openId === null || !open || !cached || typeof open.total !== "number") return;
        if (cached.comments.length < RUN_DETAILS_PAGE_SIZE && open.total > cached.comments.length) {
          const firstPage = await automationApi.getRunDetails(openId, RUN_DETAILS_PAGE_SIZE, 0).catch(() => null);
          if (!firstPage || version !== listVersion.current) return;
          setCommentsByRunId((prev) => {
            const current = prev[openId];
            if (!current || current.comments.length >= RUN_DETAILS_PAGE_SIZE) return prev;
            const comments = firstPage.comments ?? [];
            return { ...prev, [openId]: { comments, total: firstPage.total ?? comments.length } };
          });
        } else if (open.total !== cached.total) {
          setCommentsByRunId((prev) =>
            prev[openId] ? { ...prev, [openId]: { ...prev[openId], total: open.total } } : prev,
          );
        }
      } finally {
        pollInFlight = false;
      }
    };

    const timer = setInterval(() => void poll(), RUN_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runningRunKey, actionType, fetchRuns]);

  // Membership resolves first; the runs read waits on it, so both stages
  // share one loading/error presentation.
  const loading = members.isLoading || (memberIds !== undefined && runsLoading);
  const loadError = members.error ? members.error.message : runsError;
  const pageCount = members.data?.pageIds.length ?? 0;
  const isMultiPage = pageCount > 1;
  const selectedPage = pageFilter ? pages.find((page) => page.pageId === pageFilter) : undefined;
  const selectedPageName = pageFilter ? pageLabel(selectedPage ?? { pageId: pageFilter }) : null;
  const hasMore = runs.length < total;
  const scopeLabel = selectedPageName ? ` on ${selectedPageName}` : isMultiPage ? ` across ${pageCount} pages` : "";

  // Prefer the live row (so polled progress reaches the open drawer), and fall
  // back to the copy captured when it was opened.
  const selectedRun = selectedRunId === null ? null : (runs.find((run) => run.id === selectedRunId) ?? openedRun);
  const items = useMemo(() => groupRunsForDisplay(runs), [runs]);

  /** Opening a run lazy-loads its first page of comments once, then caches it. */
  const openRun = useCallback(
    async (run: AccountRun) => {
      setSelectedRunId(run.id);
      setOpenedRun(run);
      if (commentsByRunId[run.id]) return;

      setLoadingRunId(run.id);
      try {
        const details = await automationApi.getRunDetails(run.id, RUN_DETAILS_PAGE_SIZE, 0);
        const comments = details.comments ?? [];
        setCommentsByRunId((prev) => ({ ...prev, [run.id]: { comments, total: details.total ?? comments.length } }));
      } catch (error) {
        console.error("Failed to fetch run details:", error);
        setCommentsByRunId((prev) => ({ ...prev, [run.id]: { comments: [], total: 0 } }));
      } finally {
        setLoadingRunId((current) => (current === run.id ? null : current));
      }
    },
    [commentsByRunId],
  );

  const loadMoreComments = useCallback(async () => {
    if (selectedRunId === null) return;
    const cached = commentsByRunId[selectedRunId];
    if (!cached) return;
    setLoadingMoreCommentsRunId(selectedRunId);
    try {
      const details = await automationApi.getRunDetails(selectedRunId, RUN_DETAILS_PAGE_SIZE, cached.comments.length);
      setCommentsByRunId((prev) => {
        const current = prev[selectedRunId];
        if (!current) return prev;
        return {
          ...prev,
          [selectedRunId]: {
            comments: appendById(current.comments, details.comments ?? []),
            total: details.total ?? current.total,
          },
        };
      });
    } catch (error) {
      console.error("Failed to load more run comments:", error);
    } finally {
      setLoadingMoreCommentsRunId((current) => (current === selectedRunId ? null : current));
    }
  }, [commentsByRunId, selectedRunId]);

  /**
   * Stops a run that is still going.
   *
   * The builder's own Cancel only aborts this tab's polling, so a run started
   * elsewhere — or before a reload — had no stop at all. CommentsServer cancels
   * by rule: it either asks the live loop to stop at the next comment, or closes
   * run rows whose loop died with an earlier deploy.
   */
  const stopRun = useCallback(
    async (run: AccountRun) => {
      setStoppingRunIds((current) => new Set(current).add(run.id));
      try {
        const result = await automationApi.cancelRuleExecution(run.ruleId);
        toast.success(result.status === "cancelled" ? "Run stopped" : "Stopping run", {
          description:
            result.status === "cancelled"
              ? "It had already stopped running; its rows are closed now."
              : "It finishes the comment it is working on, then stops.",
        });
        await fetchRuns();
      } catch (error) {
        toast.error("Could not stop this run", {
          description: error instanceof Error ? error.message : "CommentsServer did not accept the request.",
        });
      } finally {
        setStoppingRunIds((current) => {
          const next = new Set(current);
          next.delete(run.id);
          return next;
        });
      }
    },
    [fetchRuns],
  );

  const openComments = selectedRunId === null ? undefined : commentsByRunId[selectedRunId];

  return (
    <div>
      {loading && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loading && !loadError && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <span className="text-xl">📜</span>
          </div>
          {outcome ? (
            <>
              <h3 className="mb-1 text-sm font-semibold">No runs with this outcome</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                Nothing in this automation&apos;s history matches the outcome you picked.
              </p>
            </>
          ) : selectedPageName ? (
            <>
              <h3 className="mb-1 text-sm font-semibold">No runs on this page yet</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                This automation hasn&apos;t acted on a comment on {selectedPageName} yet.
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-1 text-sm font-semibold">No runs yet</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                Click Run in the builder, or wait for the trigger to fire, then check back here.
              </p>
            </>
          )}
        </div>
      )}

      {!loading && runs.length > 0 && (
        <>
          <RunHistoryTable
            items={items}
            actionType={actionType}
            showPage={isMultiPage && !pageFilter}
            selectedRunId={selectedRunId}
            onOpenRun={(run) => void openRun(run)}
            onStopRun={(run) => void stopRun(run)}
            stoppingRunIds={stoppingRunIds}
          />
          <div className="mt-4 flex flex-col items-center gap-2">
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full gap-2"
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Load more
              </Button>
            )}
            {loadMoreError && <p className="text-xs text-red-600 dark:text-red-400">{loadMoreError}</p>}
            <p className="text-center text-xs text-muted-foreground">
              {hasMore
                ? `Showing ${formatCount(runs.length)} of ${pluralizeRuns(total)}${scopeLabel}`
                : `${pluralizeRuns(runs.length)}${scopeLabel}`}
            </p>
          </div>
        </>
      )}

      <RunDetailDrawer
        run={selectedRun}
        actionType={actionType}
        comments={openComments?.comments}
        commentTotal={openComments?.total ?? 0}
        isLoading={loadingRunId === selectedRunId && selectedRunId !== null}
        isLoadingMore={loadingMoreCommentsRunId === selectedRunId && selectedRunId !== null}
        onLoadMore={() => void loadMoreComments()}
        onClose={() => {
          setSelectedRunId(null);
          setOpenedRun(null);
        }}
      />
    </div>
  );
}
