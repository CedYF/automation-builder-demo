"use client";

/**
 * One run, in full: what it acted on, how it ended, and every comment it
 * processed.
 *
 * The log lists a run per line, which leaves no room for the comment text, the
 * error Meta returned, or the rest of a batch. Those open here instead, so the
 * list stays scannable and the detail stays one click away.
 */

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { RunCommentList } from "./run-comment-list";
import { formatCount, PageAvatar, pageLabel } from "./run-page-filter";
import { commentRunTriggerLabel, describeCommentRunCounts } from "../lib/comment-run-display";
import { describeRunBadge } from "../lib/run-badge";
import type { AccountRun, CommentActionType, ProcessedComment } from "@/app/(dashboard)/comments/lib/api/automation";

/**
 * CommentsServer saves a batch run's comments every few seconds, so a run that
 * just started can have progress counts but no comments to show yet.
 */
const RUNNING_EMPTY_MESSAGE = "This run is still going. Its comments show up here every few seconds as they're saved.";

interface RunDetailDrawerProps {
  /** The open run; null closes the drawer. */
  readonly run: AccountRun | null;
  readonly actionType: CommentActionType;
  readonly comments: readonly ProcessedComment[] | undefined;
  /** How many comments the run processed in total, for "Showing X of Y". */
  readonly commentTotal: number;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly onClose: () => void;
}

export function RunDetailDrawer({
  run,
  actionType,
  comments,
  commentTotal,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onClose,
}: RunDetailDrawerProps) {
  const badge = run ? describeRunBadge(run, actionType) : null;
  const pageName = run?.pageId ? pageLabel({ pageId: run.pageId, pageName: run.pageName }) : null;
  const loadedCount = comments?.length ?? 0;

  return (
    <Sheet open={run !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        {run && badge && (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("gap-1 border", badge.badgeClass)}>
                  {badge.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
                  {badge.label}
                </Badge>
                <span className="font-mono text-sm text-muted-foreground">#{run.id}</span>
              </SheetTitle>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {run.pageId && pageName && (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <PageAvatar
                      pageId={run.pageId}
                      name={pageName}
                      picture={run.pagePicture}
                      className="h-4 w-4 text-[8px]"
                    />
                    {pageName}
                  </span>
                )}
                <span>{commentRunTriggerLabel(run.triggerType)}</span>
                <span>{new Date(run.startedAt).toLocaleString("en-US")}</span>
              </div>

              <p className="text-sm text-foreground">{describeCommentRunCounts(run)}</p>
            </SheetHeader>

            <div className="mt-4 flex-1">
              <RunCommentList
                comments={comments}
                isLoading={isLoading}
                emptyMessage={run.status === "running" ? RUNNING_EMPTY_MESSAGE : undefined}
              />

              {comments && loadedCount > 0 && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {loadedCount < commentTotal && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                      className="w-full gap-2"
                    >
                      {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Load more comments
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Showing {formatCount(loadedCount)} of {formatCount(commentTotal)} comments
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
