"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  useApprovePendingReply,
  useBulkApprovePendingReplies,
  useBulkRejectPendingReplies,
  useRejectPendingReply,
  useRetryPendingReply,
} from "./usePendingReplies";

/**
 * Selection and per-card busy state for a drafted-replies queue, plus the
 * approve / reject / retry handlers that drive it.
 *
 * Shared by the comments-page queue and the automation review sheet
 * (ADM-11260) so both surfaces approve a draft the same way: same mutation,
 * same toasts, same cache invalidation.
 */
export interface PendingReplyQueueActions {
  readonly selectedIds: ReadonlySet<number>;
  readonly approvingIds: ReadonlySet<number>;
  readonly rejectingIds: ReadonlySet<number>;
  readonly retryingIds: ReadonlySet<number>;
  readonly isBulkApproving: boolean;
  readonly isBulkRejecting: boolean;
  readonly toggleSelected: (id: number) => void;
  /** Selects every id, or clears the selection when all of them are already selected. */
  readonly toggleSelectAll: (ids: readonly number[]) => void;
  readonly clearSelection: () => void;
  readonly approve: (id: number, editedReply?: string) => void;
  readonly reject: (id: number) => void;
  readonly retry: (id: number) => void;
  readonly bulkApprove: () => void;
  readonly bulkReject: () => void;
}

function withId(ids: ReadonlySet<number>, id: number): Set<number> {
  return new Set(ids).add(id);
}

function withoutId(ids: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

export function usePendingReplyQueueActions(): PendingReplyQueueActions {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<number>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set());

  const { mutate: approveReply } = useApprovePendingReply();
  const { mutate: rejectReply } = useRejectPendingReply();
  const { mutate: retryReply } = useRetryPendingReply();
  const { mutate: bulkApproveReplies, isPending: isBulkApproving } = useBulkApprovePendingReplies();
  const { mutate: bulkRejectReplies, isPending: isBulkRejecting } = useBulkRejectPendingReplies();

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.has(id) ? withoutId(prev, id) : withId(prev, id)));
  }, []);

  const toggleSelectAll = useCallback((ids: readonly number[]) => {
    setSelectedIds((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const approve = useCallback(
    (id: number, editedReply?: string) => {
      setApprovingIds((prev) => withId(prev, id));
      setSelectedIds((prev) => withoutId(prev, id));
      approveReply({ id, editedReply }, { onSettled: () => setApprovingIds((prev) => withoutId(prev, id)) });
    },
    [approveReply],
  );

  const reject = useCallback(
    (id: number) => {
      setRejectingIds((prev) => withId(prev, id));
      setSelectedIds((prev) => withoutId(prev, id));
      rejectReply(id, { onSettled: () => setRejectingIds((prev) => withoutId(prev, id)) });
    },
    [rejectReply],
  );

  const retry = useCallback(
    (id: number) => {
      setRetryingIds((prev) => withId(prev, id));
      retryReply(id, { onSettled: () => setRetryingIds((prev) => withoutId(prev, id)) });
    },
    [retryReply],
  );

  const bulkApprove = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const toastId = toast.loading(`Approving ${ids.length} replies...`);
    bulkApproveReplies(ids, {
      onSuccess: () => setSelectedIds(new Set()),
      onSettled: () => toast.dismiss(toastId),
    });
  }, [bulkApproveReplies, selectedIds]);

  const bulkReject = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const toastId = toast.loading(`Rejecting ${ids.length} replies...`);
    bulkRejectReplies(ids, {
      onSuccess: () => setSelectedIds(new Set()),
      onSettled: () => toast.dismiss(toastId),
    });
  }, [bulkRejectReplies, selectedIds]);

  return {
    selectedIds,
    approvingIds,
    rejectingIds,
    retryingIds,
    isBulkApproving,
    isBulkRejecting,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    approve,
    reject,
    retry,
    bulkApprove,
    bulkReject,
  };
}
