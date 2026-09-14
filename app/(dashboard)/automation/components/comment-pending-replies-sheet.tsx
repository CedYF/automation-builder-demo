"use client";

/**
 * Review queue for one comment automation's drafted replies, inside /automation.
 *
 * Comment automations set to require approval draft their replies into
 * CommentsServer's `pending_replies`. That queue used to be reachable only from
 * a Comments tab, and once automations moved to /automation there was nowhere
 * left to answer them (ADM-11260). This sheet is that place: the builder's menu,
 * the home row and the Notifications tab all open it, and approving here posts
 * the reply exactly as the comments queue does.
 */

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareDot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingReplies } from "@/app/(dashboard)/comments/_features/pending-replies/hooks/usePendingReplies";
import { usePendingReplyQueueActions } from "@/app/(dashboard)/comments/_features/pending-replies/hooks/usePendingReplyQueueActions";
import { PendingReplyCard } from "@/app/(dashboard)/comments/_features/pending-replies/components/PendingRepliesTab/PendingReplyCard";
import { PendingReplyBulkBar } from "@/app/(dashboard)/comments/_features/pending-replies/components/PendingRepliesTab/PendingReplyBulkBar";
import { PaginationControls } from "@/app/(dashboard)/comments/_features/comments-feed/components/PaginationControls";
import { usePages } from "@/app/(dashboard)/comments/_features/account-management/hooks/usePages";
import type { PendingReplyPage } from "@/app/(dashboard)/comments/_features/pending-replies/types";
import {
  toPendingRepliesScope,
  useCommentAutomationMembers,
} from "../_features/comment-automation/hooks/use-comment-automation-members";

const DEFAULT_PAGE_SIZE = 9;
const SKELETON_CARD_COUNT = 3;

export interface CommentPendingRepliesSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Any member rule of the automation; the sheet resolves the rest. */
  readonly automationRuleId: number | null;
  readonly automationName: string;
}

/** A failed refetch keeps the last known count; only a first load with no data reads as failed. */
function describePendingTotal(total: number | undefined, failed: boolean): string {
  if (total === undefined) return failed ? "Could not load drafts" : "Loading drafts…";
  if (total === 0) return "Nothing waiting for approval";
  return `${total.toLocaleString("en-US")} ${total === 1 ? "reply" : "replies"} waiting for approval`;
}

export function CommentPendingRepliesSheet({
  open,
  onOpenChange,
  automationRuleId,
  automationName,
}: CommentPendingRepliesSheetProps): React.ReactElement {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const actions = usePendingReplyQueueActions();
  const { clearSelection } = actions;

  const members = useCommentAutomationMembers(automationRuleId, open);
  const replies = usePendingReplies({
    ...toPendingRepliesScope(members.data),
    page: currentPage,
    limit: pageSize,
    enabled: open && members.data !== undefined,
  });

  // A fresh open starts at the first page with nothing selected, so a draft
  // ticked in an earlier visit cannot be bulk-approved by surprise.
  useEffect(() => {
    if (!open) return;
    setCurrentPage(1);
    clearSelection();
  }, [automationRuleId, clearSelection, open]);

  // An automation spans several pages, so each draft names the page its
  // comment sits on. Only the pages API knows the name and picture; a page it
  // does not return (disconnected since) falls back to the raw id on the card.
  const { data: pages } = usePages();
  const pageById = useMemo(() => {
    const lookup = new Map<string, PendingReplyPage>();
    for (const page of pages ?? []) {
      if (!page.pageId) continue;
      lookup.set(page.pageId, { name: page.pageName ?? page.pageId, picture: page.pagePicture ?? null });
    }
    return lookup;
  }, [pages]);

  const rows = replies.data?.data ?? [];
  const pendingIds = rows.filter((reply) => reply.status === "pending").map((reply) => reply.id);
  const isLoading = members.isLoading || (replies.isLoading && rows.length === 0);
  const loadError = members.error ?? replies.error ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareDot className="h-5 w-5" />
            <span className="truncate">Review replies: {automationName}</span>
          </SheetTitle>
          <SheetDescription>{describePendingTotal(replies.data?.total, loadError !== null)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <PendingReplyBulkBar
              pendingIds={pendingIds}
              selectedIds={actions.selectedIds}
              isBulkApproving={actions.isBulkApproving}
              isBulkRejecting={actions.isBulkRejecting}
              onToggleSelectAll={() => actions.toggleSelectAll(pendingIds)}
              onBulkApprove={actions.bulkApprove}
              onBulkReject={actions.bulkReject}
            />
            <Button
              variant="outline"
              size="icon"
              className="ml-auto h-8 w-8 shrink-0"
              aria-label="Refresh drafted replies"
              onClick={() => void replies.refetch()}
              disabled={replies.isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4", replies.isRefetching && "animate-spin")} />
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && loadError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {loadError instanceof Error ? loadError.message : "Could not load drafted replies"}
            </div>
          )}

          {!isLoading && !loadError && rows.length === 0 && (
            <div className="rounded-lg border bg-card p-8 text-center">
              <MessageSquareDot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-base font-semibold">No pending replies</h3>
              <p className="text-sm text-muted-foreground">
                Drafts wait here when this automation replies with approval required.
              </p>
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <div className="space-y-3">
              {rows.map((reply) => (
                <PendingReplyCard
                  key={reply.id}
                  reply={reply}
                  page={pageById.get(reply.pageId) ?? { name: reply.pageId, picture: null }}
                  isSelected={actions.selectedIds.has(reply.id)}
                  onSelect={actions.toggleSelected}
                  onApprove={actions.approve}
                  onReject={actions.reject}
                  onRetry={actions.retry}
                  isApproving={actions.approvingIds.has(reply.id)}
                  isRejecting={actions.rejectingIds.has(reply.id)}
                  isRetrying={actions.retryingIds.has(reply.id)}
                />
              ))}
            </div>
          )}

          {replies.data?.pagination && (
            <PaginationControls
              paginationInfo={{
                currentPage: replies.data.pagination.currentPage,
                pageSize: replies.data.pagination.pageSize,
                totalComments: replies.data.pagination.totalItems,
                totalPages: replies.data.pagination.totalPages,
              }}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={(page) => {
                setCurrentPage(page);
                clearSelection();
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
                clearSelection();
              }}
              disabled={replies.isRefetching}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
