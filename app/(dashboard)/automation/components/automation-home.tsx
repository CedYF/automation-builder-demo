"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AutomationHomeRow } from "@/lib/automation/home-summary";
import { buildAutomationHistoryHref } from "@/lib/automation/home-automation-actions";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import { useAutomationHome } from "../hooks/use-automation-home";
import { HOME_SHELL_ROOT_CLASS } from "../lib/home-shell-layout";
import { canManageAutomationsForScope, resolveAutomationAccessScope } from "@/lib/automation/automation-access";
import { useUser } from "@/lib/providers/user-provider";
import { COMMENT_AUTOMATION_SOURCE } from "../lib/map-comment-automation-to-table-row";
import { ApprovalReviewDialog, type PendingApproval } from "./approval-review-dialog";
import { AutomationHomeEmpty } from "./automation-home-empty";
import { AutomationHomeList } from "./automation-home-list";
import { AutomationHomeStats } from "./automation-home-stats";
import { CommentPendingRepliesSheet } from "./comment-pending-replies-sheet";
import { HomeDeleteDialog, HomeRenameDialog } from "./automation-home-row-dialogs";
import type { AutomationHomeRowMenuHandlers } from "./automation-home-row-actions";

export interface AutomationHomeProps {
  readonly onOpenAutomation: (id: number | string) => void;
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
  /** Reports live counts up to the page header. */
  readonly onCountsChange?: (counts: {
    readonly total: number;
    readonly running: number;
    readonly needsYou: number;
  }) => void;
}

/**
 * The Automate home: a stats strip and the list of automations. New users get
 * the chat-first empty state. Create (header) is where returning users start
 * a new flow — this view stays list-only so the two jobs do not compete.
 */
export function AutomationHome({
  onOpenAutomation,
  onSubmitGoal,
  onBrowseTemplates,
  onCountsChange,
}: AutomationHomeProps): React.ReactElement {
  const { extendedUser } = useUser();
  const role = extendedUser?.role;
  const isCommentsOnly = resolveAutomationAccessScope(role) === "comments-only";
  const {
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
  } = useAutomationHome({ role });
  const canManage = canManageAutomationsForScope(role);
  const [busyRowKey, setBusyRowKey] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<AutomationHomeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationHomeRow | null>(null);
  const [reviewApproval, setReviewApproval] = useState<PendingApproval | null>(null);
  // A comment automation with drafts waiting; its replies are reviewed in a
  // sheet right here rather than on another page (ADM-11260).
  const [reviewCommentRow, setReviewCommentRow] = useState<AutomationHomeRow | null>(null);

  // Effect, not render: the parent header stores these in state, and calling it
  // during render would loop.
  const needsYou = counts["needs-you"];
  useEffect(() => {
    onCountsChange?.({ total: counts.total, running: counts.running, needsYou });
  }, [counts.total, counts.running, needsYou, onCountsChange]);

  const handleOpen = useCallback(
    (row: AutomationHomeRow) => {
      // Comment rules open in the same builder under a `comment:<id>` key, the
      // convention the automations table already uses.
      onOpenAutomation(row.source === COMMENT_AUTOMATION_SOURCE ? `comment:${row.id}` : row.id);
    },
    [onOpenAutomation],
  );

  const handleApprove = useCallback(
    async (row: AutomationHomeRow) => {
      setBusyRowKey(row.rowKey);
      try {
        await resolveApproval(row, "approve");
      } finally {
        setBusyRowKey(null);
      }
    },
    [resolveApproval],
  );

  // The review dialog needs the full approval record (flow state, pending
  // actions, expiry), which the home list deliberately does not carry.
  const handleReview = useCallback(async (row: AutomationHomeRow) => {
    if (row.rightNow.kind === "review") {
      setReviewCommentRow(row);
      return;
    }
    if (row.rightNow.kind !== "approval") return;
    const { approvalId } = row.rightNow;
    setBusyRowKey(row.rowKey);
    try {
      const response = await fetch("/api/automation/approval/pending");
      if (!response.ok) throw new Error("Could not load that approval");
      const payload: { approvals?: PendingApproval[] } = await response.json();
      const approval = payload.approvals?.find((candidate) => candidate.id === approvalId);
      if (!approval) throw new Error("That approval is no longer pending");
      setReviewApproval(approval);
    } catch (caughtError) {
      console.error(`Failed to open the approval for "${row.name}":`, caughtError);
      toast.error(caughtError instanceof Error ? caughtError.message : "Could not open that approval");
    } finally {
      setBusyRowKey(null);
    }
  }, []);

  const handleReviewClosed = useCallback(
    (wasApproved: boolean) => {
      setReviewApproval(null);
      if (wasApproved) void refresh();
    },
    [refresh],
  );

  // Any answered draft changes the row's count and possibly its state, so the
  // list is refreshed whenever the sheet closes rather than tracking each one.
  const handleCommentReviewOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setReviewCommentRow(null);
      void refresh();
    },
    [refresh],
  );

  const runBusy = useCallback(async (row: AutomationHomeRow, work: () => Promise<void>) => {
    setBusyRowKey(row.rowKey);
    try {
      await work();
    } finally {
      setBusyRowKey(null);
    }
  }, []);

  const menuHandlers = useMemo<AutomationHomeRowMenuHandlers>(
    () => ({
      onRename: (row) => setRenameTarget(row),
      onDuplicate: (row) => void runBusy(row, () => duplicateRow(row)),
      onViewHistory: (row) => {
        if (row.source === COMMENT_AUTOMATION_SOURCE) {
          handleOpen(row);
          return;
        }
        window.location.href = buildAutomationHistoryHref(row.id);
      },
      onExport: (row) => void runBusy(row, () => exportRow(row)),
      onArchive: (row) => void runBusy(row, () => archiveRow(row)),
      onDelete: (row) => setDeleteTarget(row),
    }),
    [archiveRow, duplicateRow, exportRow, handleOpen, runBusy],
  );

  if (!loading && rows.length === 0 && !error) {
    return (
      <AutomationHomeEmpty
        onSubmitGoal={onSubmitGoal}
        onBrowseTemplates={onBrowseTemplates}
        commentsOnly={isCommentsOnly}
      />
    );
  }

  return (
    <div className={HOME_SHELL_ROOT_CLASS}>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <AutomationHomeStats stats={stats} loading={loading} />

      <AutomationHomeList
        rows={rows}
        counts={counts}
        loading={loading}
        refreshing={refreshing}
        busyRowKey={busyRowKey}
        onRefresh={() => void refresh()}
        onOpen={handleOpen}
        onToggle={(row, enabled) => void setRowEnabled(row, enabled)}
        onApprove={(row) => void handleApprove(row)}
        onReview={(row) => void handleReview(row)}
        canManage={canManage}
        menuHandlers={menuHandlers}
      />

      <ApprovalReviewDialog approval={reviewApproval} open={reviewApproval !== null} onClose={handleReviewClosed} />
      <CommentPendingRepliesSheet
        open={reviewCommentRow !== null}
        onOpenChange={handleCommentReviewOpenChange}
        automationRuleId={reviewCommentRow?.id ?? null}
        automationName={reviewCommentRow?.name ?? ""}
      />
      <HomeRenameDialog
        row={renameTarget}
        busy={renameTarget !== null && busyRowKey === renameTarget.rowKey}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => {
          if (!renameTarget) return;
          void runBusy(renameTarget, async () => {
            await renameRow(renameTarget, name);
            setRenameTarget(null);
          });
        }}
      />
      <HomeDeleteDialog
        row={deleteTarget}
        busy={deleteTarget !== null && busyRowKey === deleteTarget.rowKey}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void runBusy(deleteTarget, async () => {
            await deleteRow(deleteTarget);
            setDeleteTarget(null);
          });
        }}
      />
    </div>
  );
}
