/**
 * Orchestrates the builder's Run button for comment automations.
 *
 * Comment rules do not go through the Prisma automation executor — they live in
 * CommentsServer. Running one from the /automation builder therefore means:
 * save the rule to CommentsServer (create or update), start a manual execution
 * there, then poll run status until the run completes or the poll window
 * closes (the run keeps going in the background either way).
 *
 * All I/O is injected so the sequencing (save → token → execute → poll) is
 * testable without network access.
 */

import type { AutomationRun, ProcessedComment } from "@/app/(dashboard)/comments/lib/api/automation";
import { describeCommentRunCounts } from "../_features/comment-automation/lib/comment-run-display";

export type CommentRunLogStatus = "running" | "success" | "error" | "cancelled";

/** One step-level progress event, mapped to an ExecutionLog entry by the caller. */
export interface CommentRunLogEvent {
  readonly nodeId: string;
  readonly status: CommentRunLogStatus;
  readonly message: string;
  /**
   * Comments the run has processed so far, for the live feed under the action
   * step. Present once the run has processed at least one comment; omitted
   * (rather than empty) before that, and whenever fetching them fails, so the
   * feed keeps showing its previous snapshot instead of flashing empty.
   */
  readonly comments?: readonly ProcessedComment[];
}

export type CommentRunOutcome =
  | "completed"
  | "completed-with-failures"
  | "failed"
  | "still-running"
  | "cancelled"
  | "not-started";

export interface RunCommentAutomationResult {
  readonly outcome: CommentRunOutcome;
  readonly ruleId: number | null;
}

export type CommentRunSaveResult =
  | {
      ok: true;
      ruleId: number | null;
      /**
       * Every rule the save covers, one per page of the automation. The run
       * fans out over all of them; without this only `ruleId` runs, which is
       * how "Run" on a 12-page automation used to scan a single page.
       */
      memberRuleIds?: readonly number[];
    }
  | { ok: false; error: string };

export interface RunCommentAutomationOptions {
  /**
   * Run only these per-page rules. Omitted (the default) runs every page of the
   * automation; set when the user picked pages from the Run menu.
   */
  readonly onlyRuleIds?: readonly number[];
  /** Flow node ids used to attribute progress to the right step cards. */
  readonly triggerNodeId: string;
  readonly actionNodeId: string;
  /** True when the flow already maps to a persisted CommentsServer rule. */
  readonly hasExistingRule: boolean;
  /** Create-time backfill: the create endpoint already starts a run when set. */
  readonly processExistingOnCreate: boolean;
  readonly saveRule: () => Promise<CommentRunSaveResult>;
  readonly getAccessToken: () => Promise<{ token: string | null; error?: string }>;
  /**
   * Starts one page's run. `runGroupId` is the same for every page of one
   * click, so History can show the click's runs as a single run.
   */
  readonly startExecution: (ruleId: number, accessToken: string, runGroupId: string) => Promise<unknown>;
  /** Injectable for tests; defaults to a random UUID. */
  readonly createRunGroupId?: () => string;
  readonly fetchLatestRun: (ruleId: number) => Promise<AutomationRun | null>;
  /** Comments a run has processed so far, for the live feed under the action step. */
  readonly fetchRunComments: (runId: number) => Promise<ProcessedComment[]>;
  readonly requestCancel: (ruleId: number) => Promise<unknown>;
  readonly onLog: (event: CommentRunLogEvent) => void;
  readonly signal: AbortSignal;
  readonly pollIntervalMs?: number;
  readonly maxPollMs?: number;
  /** Injectable delay for tests; rejects with AbortError when the signal fires. */
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 2_500;
const DEFAULT_MAX_POLL_MS = 90_000;

const MISSING_TOKEN_MESSAGE = "Facebook token not found. Please reconnect your Facebook account.";
const STILL_RUNNING_MESSAGE =
  "Run started — still processing in the background. See the rule's run history in Comments for the final result.";

function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Maps a terminal (non-"running") run to the log entry that reports it.
 *
 * Exported so the Execution Results panel's rehydration path (reopening the
 * panel for a run that finished outside this session) can reuse the exact
 * same status/message mapping the live poll loop uses below, instead of a
 * second copy drifting out of sync with it.
 */
export function mapTerminalRun(run: AutomationRun): {
  status: CommentRunLogStatus;
  message: string;
  outcome: CommentRunOutcome;
} {
  const counts = describeCommentRunCounts(run);
  if (run.status === "failed") {
    return { status: "error", message: `Run failed — ${counts}.`, outcome: "failed" };
  }
  if (run.status === "cancelled" || run.status === "interrupted") {
    return { status: "cancelled", message: `Run was ${run.status} — ${counts}.`, outcome: "cancelled" };
  }
  if (run.failedCount > 0) {
    return { status: "success", message: `Run finished — ${counts}.`, outcome: "completed-with-failures" };
  }
  return { status: "success", message: `Run finished — ${counts}.`, outcome: "completed" };
}

/**
 * Saves the comment rule and starts + tracks one manual execution.
 *
 * @returns The terminal outcome plus the CommentsServer rule id the run targeted.
 *   Never rejects for expected failures (save/token/start errors are logged via
 *   `onLog` and returned as an outcome); unexpected dependency throws propagate.
 */
export async function runCommentAutomationFlow(
  options: RunCommentAutomationOptions,
): Promise<RunCommentAutomationResult> {
  const { triggerNodeId, actionNodeId, onLog } = options;

  onLog({ nodeId: triggerNodeId, status: "running", message: "Saving comment automation…" });
  const saved = await options.saveRule();
  if (!saved.ok) {
    onLog({ nodeId: triggerNodeId, status: "error", message: saved.error });
    return { outcome: "not-started", ruleId: null };
  }
  const ruleId = saved.ruleId;
  if (ruleId === null) {
    onLog({
      nodeId: triggerNodeId,
      status: "error",
      message: "Comment automation was saved but no rule id was returned.",
    });
    return { outcome: "not-started", ruleId: null };
  }
  onLog({
    nodeId: triggerNodeId,
    status: "success",
    message: options.hasExistingRule ? "Comment automation updated." : "Comment automation saved.",
  });

  const ruleIds = uniqueRuleIds(ruleId, saved.memberRuleIds, options.onlyRuleIds);
  if (ruleIds.length === 0) {
    onLog({
      nodeId: actionNodeId,
      status: "error",
      message: "None of the pages you picked belong to this automation, so there was nothing to run.",
    });
    return { outcome: "not-started", ruleId };
  }
  const started = await startManualRun(options, ruleIds);
  if (!started.ok) return { outcome: started.outcome, ruleId };

  onLog({
    nodeId: actionNodeId,
    status: "running",
    message: ruleIds.length > 1 ? `Processing comments across ${ruleIds.length} pages…` : "Processing comments…",
  });
  return pollRunOutcome(options, ruleId, ruleIds, started.baselineRunIds);
}

/**
 * The opened rule first, then every other page's rule, each once — narrowed to
 * `onlyRuleIds` when the user picked pages to run on.
 *
 * The seed rule is not privileged by the filter: "run on selected pages" has to
 * be able to leave out the page whose rule happens to be open in the builder,
 * or picking three of six pages would silently run four.
 */
function uniqueRuleIds(
  seedRuleId: number,
  memberRuleIds: readonly number[] | undefined,
  onlyRuleIds: readonly number[] | undefined,
): number[] {
  const ids = [seedRuleId];
  for (const id of memberRuleIds ?? []) {
    if (Number.isSafeInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  if (!onlyRuleIds) return ids;
  const wanted = new Set(onlyRuleIds);
  return ids.filter((id) => wanted.has(id));
}

/**
 * Starts the manual execution, unless the create call already launched a
 * backfill run (processExisting on a fresh rule) — then there is nothing to
 * start and any run found while polling is ours.
 */
async function startManualRun(
  options: RunCommentAutomationOptions,
  ruleIds: readonly number[],
): Promise<
  { ok: true; baselineRunIds: ReadonlyMap<number, number | null> } | { ok: false; outcome: CommentRunOutcome }
> {
  const { actionNodeId, onLog } = options;

  const createAlreadyStartedRun = !options.hasExistingRule && options.processExistingOnCreate;
  if (createAlreadyStartedRun) return { ok: true, baselineRunIds: new Map(ruleIds.map((id) => [id, null])) };

  const tokenResult = await options.getAccessToken().catch((error: unknown) => ({
    token: null,
    error: error instanceof Error ? error.message : MISSING_TOKEN_MESSAGE,
  }));
  if (!tokenResult.token) {
    onLog({ nodeId: actionNodeId, status: "error", message: tokenResult.error || MISSING_TOKEN_MESSAGE });
    return { ok: false, outcome: "not-started" };
  }

  // Snapshot the latest run of each rule before starting so polling can tell
  // the new run apart from a previously finished one on the same rule.
  const baselineRunIds = new Map<number, number | null>();
  for (const ruleId of ruleIds) {
    const baselineRun = options.hasExistingRule ? await options.fetchLatestRun(ruleId).catch(() => null) : null;
    baselineRunIds.set(ruleId, baselineRun?.id ?? null);
  }

  const runGroupId = options.createRunGroupId?.() ?? globalThis.crypto.randomUUID();
  for (const ruleId of ruleIds) {
    try {
      await options.startExecution(ruleId, tokenResult.token, runGroupId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start the comment automation run.";
      onLog({ nodeId: actionNodeId, status: "error", message });
      return { ok: false, outcome: "failed" };
    }
  }
  return { ok: true, baselineRunIds };
}

/**
 * Fetches the comments a run has processed so far, for the live feed.
 * Skipped while nothing has been processed yet (nothing to show), and
 * swallowed on failure so a flaky fetch never fails the run itself — the feed
 * just keeps showing its last known snapshot.
 */
async function fetchLiveComments(
  options: RunCommentAutomationOptions,
  runId: number,
  totalProcessed: number,
): Promise<readonly ProcessedComment[] | undefined> {
  if (totalProcessed === 0) return undefined;
  return options.fetchRunComments(runId).catch(() => undefined);
}

/**
 * Folds one run per page into the single run the panel reports on: counts
 * are summed, and the status is the worst one seen (failed, then cancelled or
 * interrupted, else completed). A single-page automation folds to itself.
 */
export function aggregateRuns(runs: readonly AutomationRun[]): AutomationRun {
  const [first] = runs;
  const status = runs.some((run) => run.status === "failed")
    ? "failed"
    : (runs.find((run) => run.status === "cancelled" || run.status === "interrupted")?.status ?? first.status);
  return {
    ...first,
    status,
    totalProcessed: runs.reduce((sum, run) => sum + run.totalProcessed, 0),
    successCount: runs.reduce((sum, run) => sum + run.successCount, 0),
    failedCount: runs.reduce((sum, run) => sum + run.failedCount, 0),
    unavailableCount: runs.reduce((sum, run) => sum + (run.unavailableCount ?? 0), 0),
  };
}

/** Live comments across every page's run, in rule order. */
async function fetchLiveCommentsForRuns(
  options: RunCommentAutomationOptions,
  runs: readonly AutomationRun[],
): Promise<readonly ProcessedComment[] | undefined> {
  const perRun = await Promise.all(runs.map((run) => fetchLiveComments(options, run.id, run.totalProcessed)));
  const seen = perRun.filter((comments): comments is readonly ProcessedComment[] => comments !== undefined);
  return seen.length > 0 ? seen.flat() : undefined;
}

/**
 * Polls every page's run until all reach a terminal state or the window
 * closes. A page whose new run has not appeared yet keeps the whole run
 * "running": each execution records a run row, even an empty one.
 */
async function pollRunOutcome(
  options: RunCommentAutomationOptions,
  ruleId: number,
  ruleIds: readonly number[],
  baselineRunIds: ReadonlyMap<number, number | null>,
): Promise<RunCommentAutomationResult> {
  const { actionNodeId, onLog, signal } = options;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollMs = options.maxPollMs ?? DEFAULT_MAX_POLL_MS;
  const wait = options.wait ?? waitWithAbort;
  const maxAttempts = Math.max(1, Math.ceil(maxPollMs / pollIntervalMs));

  // Latest new run per rule; a rule drops out once its run is terminal.
  const latestRuns = new Map<number, AutomationRun>();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await wait(pollIntervalMs, signal);
    } catch {
      return cancelRun(options, ruleId, ruleIds);
    }
    if (signal.aborted) return cancelRun(options, ruleId, ruleIds);

    for (const memberRuleId of ruleIds) {
      if (latestRuns.get(memberRuleId)?.status && latestRuns.get(memberRuleId)?.status !== "running") continue;
      const run = await options.fetchLatestRun(memberRuleId).catch(() => null);
      const baselineRunId = baselineRunIds.get(memberRuleId) ?? null;
      const isNewRun = run !== null && (baselineRunId === null || run.id !== baselineRunId);
      if (run && isNewRun) latestRuns.set(memberRuleId, run);
    }

    const runs = ruleIds.map((memberRuleId) => latestRuns.get(memberRuleId));
    const seenRuns = runs.filter((run): run is AutomationRun => run !== undefined);
    if (seenRuns.length === 0) continue;

    const allTerminal = seenRuns.length === ruleIds.length && seenRuns.every((run) => run.status !== "running");
    if (!allTerminal) {
      const aggregate = aggregateRuns(seenRuns);
      const comments = await fetchLiveCommentsForRuns(options, seenRuns);
      onLog({
        nodeId: actionNodeId,
        status: "running",
        message: `Processing comments… ${describeCommentRunCounts(aggregate)}.`,
        comments,
      });
      continue;
    }
    const terminal = mapTerminalRun(aggregateRuns(seenRuns));
    const comments = await fetchLiveCommentsForRuns(options, seenRuns);
    onLog({ nodeId: actionNodeId, status: terminal.status, message: terminal.message, comments });
    return { outcome: terminal.outcome, ruleId };
  }

  onLog({ nodeId: actionNodeId, status: "success", message: STILL_RUNNING_MESSAGE });
  return { outcome: "still-running", ruleId };
}

/** Asks CommentsServer to stop every page's in-flight run; cancellation is best-effort. */
function cancelRun(
  options: RunCommentAutomationOptions,
  ruleId: number,
  ruleIds: readonly number[],
): RunCommentAutomationResult {
  for (const memberRuleId of ruleIds) {
    void options.requestCancel(memberRuleId).catch(() => undefined);
  }
  options.onLog({
    nodeId: options.actionNodeId,
    status: "cancelled",
    message: "Run cancelled — asked the comments service to stop processing.",
  });
  return { outcome: "cancelled", ruleId };
}
