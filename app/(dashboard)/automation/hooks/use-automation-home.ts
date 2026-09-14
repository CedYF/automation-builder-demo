"use client";

/**
 * Loads everything the Automate home renders: the live state of every
 * automation and the month's stats strip.
 *
 * Flow automations come from `/api/automation/home` already resolved and
 * ordered. Comment automations come from the comments service and are merged in
 * with the same pure helpers, so one list can carry both without either source
 * disagreeing about what "running" means.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { canManageCommentAutomations, canViewFlowAutomations } from "@/lib/automation/automation-access";
import { buildAutomationHomeRows } from "@/lib/automation/build-home-rows";
import {
  EMPTY_STATE_COUNTS,
  countAutomationHomeStates,
  isPendingApprovalRightNow,
  resolveAutomationHomeState,
  sortAutomationHomeRows,
  type AutomationHomeRow,
  type AutomationHomeStateCounts,
} from "@/lib/automation/home-summary";
import type { AutomationHomeStats } from "@/lib/automation/home-stats";
import type { CommentApprovalSummary } from "@/lib/comments/comment-approval-summary";
import { buildCommentReviewInputs } from "../lib/build-comment-review-inputs";
import { buildCommentSavedHoursByRuleId } from "../lib/estimate-comment-saved-hours";
import { groupCommentAutomationsForHome } from "../lib/group-comment-automations";
import { mapCommentAutomationToHomeRule } from "../lib/map-comment-automation-to-home-row";
import { COMMENT_AUTOMATION_SOURCE, type CommentAutomationApiRule } from "../lib/map-comment-automation-to-table-row";
import {
  buildAutomationStatusRequest,
  readAutomationStatusError,
  sendAutomationStatusRequest,
} from "../lib/automation-status-request";
import {
  COMMENT_AUTOMATION_DUPLICATE_BLOCKED,
  duplicateAutomationRuleById,
} from "@/lib/automation/duplicate-automation-rule";
import {
  archiveHomeAutomation,
  buildHomeAutomationExport,
  deleteHomeAutomation,
  downloadJsonFile,
  renameHomeAutomation,
} from "@/lib/automation/home-automation-actions";

/**
 * Long enough that the stats query's JSON scan is not re-run every half minute,
 * short enough that a run finishing is visible without a manual refresh.
 */
const HOME_POLL_INTERVAL_MS = 60_000;

interface AutomationHomeApiResponse {
  readonly rows?: AutomationHomeRow[];
  readonly counts?: AutomationHomeStateCounts;
  readonly stats?: AutomationHomeStats;
}

/** What a comment-only role gets instead of the flow home payload. */
const EMPTY_HOME_PAYLOAD: AutomationHomeApiResponse = { rows: [] };

export interface UseAutomationHomeOptions {
  /**
   * The viewer's role. Comment-only roles (ADM-11300) never request the flow
   * home payload, and the comment rows' manage lock follows the comment gate.
   */
  readonly role?: string | null;
}

export interface UseAutomationHomeResult {
  readonly rows: readonly AutomationHomeRow[];
  readonly counts: AutomationHomeStateCounts;
  readonly stats: AutomationHomeStats | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  /** Optimistically flips a row's switch, rolling back if the write fails. */
  readonly setRowEnabled: (row: AutomationHomeRow, enabled: boolean) => Promise<void>;
  /** Resolves an approval inline and drops the row out of "needs you". */
  readonly resolveApproval: (row: AutomationHomeRow, action: "approve" | "reject") => Promise<void>;
  /** Creates a paused copy of a flow automation and refreshes the list. */
  readonly duplicateRow: (row: AutomationHomeRow) => Promise<void>;
  readonly renameRow: (row: AutomationHomeRow, name: string) => Promise<void>;
  readonly deleteRow: (row: AutomationHomeRow) => Promise<void>;
  readonly archiveRow: (row: AutomationHomeRow) => Promise<void>;
  readonly exportRow: (row: AutomationHomeRow) => Promise<void>;
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.toLowerCase().includes("aborted");
}

/**
 * Fetches comment automations.
 *
 * Soft-fails: the comments service being down must not empty the list of flow
 * automations, which is the same trade-off the automations table makes.
 */
async function fetchCommentRules(signal: AbortSignal): Promise<CommentAutomationApiRule[]> {
  const response = await fetch("/api/comment-automation-rules", { signal });
  if (!response.ok) {
    if (response.status !== 401) console.error("Failed to fetch comment automations:", response.status);
    return [];
  }

  const payload: { rules?: CommentAutomationApiRule[] } = await response.json();
  return payload.rules ?? [];
}

/**
 * Fetches the drafted replies waiting on the user, per comment rule.
 *
 * Soft-fails for the same reason as the rules read: losing the counts must cost
 * the Approvals badge, not the whole list.
 */
async function fetchCommentApprovals(signal: AbortSignal): Promise<CommentApprovalSummary[]> {
  const response = await fetch("/api/comment-automation-approvals", { signal });
  if (!response.ok) {
    if (response.status !== 401) console.error("Failed to fetch comment approvals:", response.status);
    return [];
  }

  const payload: { approvals?: CommentApprovalSummary[] } = await response.json();
  return payload.approvals ?? [];
}

interface BuildCommentRowsOptions {
  readonly rules: readonly CommentAutomationApiRule[];
  readonly approvals: readonly CommentApprovalSummary[];
  readonly canManage: boolean;
  readonly now: Date;
}

/** Maps comment automations and their waiting drafts into home rows. */
function buildCommentRows({ rules, approvals, canManage, now }: BuildCommentRowsOptions): AutomationHomeRow[] {
  // Grouped first: the comments service stores one rule per page, and 31
  // identical "Like positive comments" rows is not what the user set up.
  const groupedComments = groupCommentAutomationsForHome(rules);
  return buildAutomationHomeRows({
    rules: groupedComments.map(mapCommentAutomationToHomeRule),
    runningExecutions: [],
    // ADM-11260: this was hardcoded empty, so a comment automation could never
    // reach "needs you" and the Approvals filter was structurally pinned at 0
    // while its drafted replies piled up in the review queue.
    approvals: buildCommentReviewInputs(groupedComments, approvals),
    delays: [],
    // The home API only knows about flow executions, so comment automations
    // bring their own estimate or they would all read as saving nothing.
    savedHoursByRuleId: buildCommentSavedHoursByRuleId(groupedComments),
    canManage,
    isStaff: false,
    now,
  });
}

async function fetchHomePayload(signal: AbortSignal): Promise<AutomationHomeApiResponse> {
  const response = await fetch("/api/automation/home", { signal });
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to load your automations");
  }
  return response.json();
}

export function useAutomationHome({ role }: UseAutomationHomeOptions = {}): UseAutomationHomeResult {
  const includeFlowAutomations = canViewFlowAutomations(role);
  const canManageComments = canManageCommentAutomations(role);
  const [rows, setRows] = useState<readonly AutomationHomeRow[]>([]);
  const [counts, setCounts] = useState<AutomationHomeStateCounts>(EMPTY_STATE_COUNTS);
  const [stats, setStats] = useState<AutomationHomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isManualRefresh: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (isManualRefresh) setRefreshing(true);

      try {
        const now = new Date();
        const [home, commentRules, commentApprovals] = await Promise.all([
          // A comment-only role has no flow automations to show, so the flow
          // payload is not requested at all rather than fetched and discarded.
          includeFlowAutomations ? fetchHomePayload(controller.signal) : Promise.resolve(EMPTY_HOME_PAYLOAD),
          fetchCommentRules(controller.signal).catch(() => [] as CommentAutomationApiRule[]),
          fetchCommentApprovals(controller.signal).catch(() => [] as CommentApprovalSummary[]),
        ]);

        const commentRows = buildCommentRows({
          rules: commentRules,
          approvals: commentApprovals,
          canManage: canManageComments,
          now,
        });
        const merged = sortAutomationHomeRows([...(home.rows ?? []), ...commentRows]);
        setRows(merged);
        setCounts(countAutomationHomeStates(merged));
        setStats(home.stats ?? null);
        setError(null);
      } catch (caughtError) {
        if (isAbortLikeError(caughtError)) return;
        console.error("Failed to load the automation home:", caughtError);
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load your automations");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [includeFlowAutomations, canManageComments],
  );

  useEffect(() => {
    void load(false);
    const interval = setInterval(() => void load(false), HOME_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [load]);

  const applyRowPatch = useCallback((rowKey: string, patch: Partial<AutomationHomeRow>) => {
    setRows((previous) => {
      const next = previous.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row));
      setCounts(countAutomationHomeStates(next));
      return next;
    });
  }, []);

  const setRowEnabled = useCallback(
    async (row: AutomationHomeRow, enabled: boolean) => {
      if (row.toggleLocked) {
        if (row.toggleLockReason) toast.error(row.toggleLockReason);
        return;
      }

      // Recomputed, not guessed: a switched-on rule with no cadence is "manual",
      // not "active", and the row already knows which it is.
      const nextState = resolveAutomationHomeState({
        enabled,
        // Both approval kinds keep the row in "needs you": testing only for the
        // flow kind flipped a comment automation with drafts waiting straight
        // back to "active" and reset the Approvals count mid-toggle.
        hasPendingApproval: isPendingApprovalRightNow(row.rightNow),
        hasRunningExecution: row.rightNow.kind === "progress",
        runsUnattended: row.runsUnattended,
      });
      applyRowPatch(row.rowKey, { enabled, state: nextState });
      // The activation preflight refuses with a reason the user can act on
      // ("Connect Meta in Integrations…", a Change Budget target mismatch).
      // Dropping it left the switch saying only "Could not turn … on", which is
      // what made ADM-12067 undiagnosable from outside the server logs.
      try {
        // The same request the builder's On/Off switch sends: `rowKey` is
        // `comment:<id>` or `flow:<id>`, which is how the builder tells the two
        // endpoints apart, so one tested function serves every toggle surface.
        const response = await sendAutomationStatusRequest(
          buildAutomationStatusRequest({
            flowId: row.rowKey,
            ruleId: row.id,
            groupId: row.groupId,
            nextActive: enabled,
          }),
        );
        if (!response.ok) {
          throw new Error(await readAutomationStatusError(response, `Toggle failed with ${response.status}`));
        }
      } catch (caughtError) {
        console.error(`Failed to turn "${row.name}" ${enabled ? "on" : "off"}:`, caughtError);
        applyRowPatch(row.rowKey, { enabled: row.enabled, state: row.state });
        toast.error(`Could not turn "${row.name}" ${enabled ? "on" : "off"}`, {
          description: caughtError instanceof Error ? caughtError.message : undefined,
        });
      }
    },
    [applyRowPatch],
  );

  const resolveApproval = useCallback(
    async (row: AutomationHomeRow, action: "approve" | "reject") => {
      // Flow approvals only. A comment automation's drafted replies have no
      // approval token and are answered in the drafted-replies sheet, never
      // through /api/automation/approval — the row's Review opens that instead.
      if (row.rightNow.kind !== "approval") return;
      const { approvalToken } = row.rightNow;

      try {
        const response = await fetch("/api/automation/approval", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: approvalToken, action }),
        });
        const result: { success?: boolean; error?: string } = await response.json();
        if (!result.success) throw new Error(result.error || "Action failed");

        if (action === "approve") {
          await fetch("/api/automation/approval/resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approvalToken }),
          });
        }

        toast.success(action === "approve" ? "Approved — the automation is resuming" : "Rejected");
        await load(true);
      } catch (caughtError) {
        console.error(`Failed to ${action} approval for "${row.name}":`, caughtError);
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to process that action");
      }
    },
    [load],
  );

  const refresh = useCallback(() => load(true), [load]);

  const duplicateRow = useCallback(
    async (row: AutomationHomeRow) => {
      if (row.source === COMMENT_AUTOMATION_SOURCE) {
        toast.error(COMMENT_AUTOMATION_DUPLICATE_BLOCKED);
        return;
      }

      try {
        const result = await duplicateAutomationRuleById(row.id);
        toast.success(`Duplicated "${result.originalName}" as paused`);
        await load(true);
      } catch (caughtError) {
        console.error(`Failed to duplicate "${row.name}":`, caughtError);
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to duplicate automation");
      }
    },
    [load],
  );

  const renameRow = useCallback(
    async (row: AutomationHomeRow, name: string) => {
      try {
        const nextName = await renameHomeAutomation(row, name);
        applyRowPatch(row.rowKey, { name: nextName });
        toast.success(`Renamed to "${nextName}"`);
      } catch (caughtError) {
        console.error(`Failed to rename "${row.name}":`, caughtError);
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to rename automation");
      }
    },
    [applyRowPatch],
  );

  const deleteRow = useCallback(async (row: AutomationHomeRow) => {
    try {
      await deleteHomeAutomation(row);
      setRows((previous) => {
        const next = previous.filter((candidate) => candidate.rowKey !== row.rowKey);
        setCounts(countAutomationHomeStates(next));
        return next;
      });
      toast.success(`Deleted "${row.name}"`);
    } catch (caughtError) {
      console.error(`Failed to delete "${row.name}":`, caughtError);
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to delete automation");
    }
  }, []);

  const archiveRow = useCallback(
    async (row: AutomationHomeRow) => {
      try {
        const nextStatus = await archiveHomeAutomation(row);
        toast.success(nextStatus === "archived" ? `Archived "${row.name}"` : `Unarchived "${row.name}"`);
        await load(true);
      } catch (caughtError) {
        console.error(`Failed to archive "${row.name}":`, caughtError);
        toast.error(caughtError instanceof Error ? caughtError.message : "Failed to archive automation");
      }
    },
    [load],
  );

  const exportRow = useCallback(async (row: AutomationHomeRow) => {
    if (row.source === COMMENT_AUTOMATION_SOURCE) {
      toast.error("Comment automations cannot be exported yet");
      return;
    }

    try {
      downloadJsonFile(await buildHomeAutomationExport(row.id));
      toast.success(`Exported "${row.name}"`);
    } catch (caughtError) {
      console.error(`Failed to export "${row.name}":`, caughtError);
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to export automation");
    }
  }, []);

  return {
    rows,
    counts,
    stats,
    loading,
    refreshing,
    error,
    refresh,
    setRowEnabled,
    resolveApproval,
    duplicateRow,
    renameRow,
    deleteRow,
    archiveRow,
    exportRow,
  };
}
