"use client";

/**
 * The list of comments a run processed — author, message, sentiment, and the
 * action taken. Shared by the History sheet's expanded run rows and the
 * Execution Results panel's live run feed, so both render the same evidence
 * instead of maintaining two copies of this markup.
 */

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { describeSentimentTone } from "../../../lib/sentiment-tone-badge";
import { getCommenterInitials } from "../../../lib/commenter-initials";
import { cn } from "@/lib/utils";
import type { ProcessedComment } from "@/app/(dashboard)/comments/lib/api/automation";

const DEFAULT_EMPTY_MESSAGE = "No comments were processed in this run.";
const SENTIMENT_SCORE_MAX = 100;

/**
 * The commenter's profile picture, or their initials when the snapshot has no
 * picture (older rows never captured one).
 */
function CommenterAvatar({
  authorName,
  pictureUrl,
}: {
  readonly authorName: string;
  readonly pictureUrl: string | undefined;
}) {
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Facebook CDN avatar, not a bundled asset
      <img
        src={pictureUrl}
        alt={authorName}
        className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
    >
      {getCommenterInitials(authorName)}
    </span>
  );
}

interface RunCommentListProps {
  readonly comments: ReadonlyArray<ProcessedComment> | undefined;
  readonly isLoading: boolean;
  /** Shown in place of the list when there is nothing to show yet. */
  readonly emptyMessage?: string;
}

export function RunCommentList({ comments, isLoading, emptyMessage = DEFAULT_EMPTY_MESSAGE }: RunCommentListProps) {
  if (isLoading || comments === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <Skeleton key={idx} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return <p className="py-2 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {comments.map((comment) => {
        // Meta would not show the action this comment (deleted, or the page
        // lost access): not a success, but not a plain failure either.
        const unavailable = comment.result === "unavailable";
        const failed = !unavailable && Boolean(comment.errorMsg);
        const sentiment = comment.commentSnapshot?.sentiment;
        const tone = describeSentimentTone(sentiment);
        const authorName = comment.commentSnapshot?.authorName || "Unknown author";
        return (
          <li key={comment.id} className="rounded-lg border border-border p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <CommenterAvatar authorName={authorName} pictureUrl={comment.commentSnapshot?.authorProfilePicture} />
                <span className="truncate text-xs font-medium">{authorName}</span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                {tone ? (
                  <span
                    className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", tone.className)}
                    aria-label={
                      sentiment === undefined
                        ? undefined
                        : `Sentiment score: ${sentiment} out of ${SENTIMENT_SCORE_MAX}`
                    }
                  >
                    {tone.label}
                  </span>
                ) : null}
                {unavailable ? (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" aria-label="Unavailable" />
                ) : failed ? (
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                )}
                {comment.actionTaken}
              </span>
            </div>
            {comment.commentSnapshot?.message && (
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {comment.commentSnapshot.message}
              </p>
            )}
            {comment.errorMsg && (
              <p className={cn("mt-1 text-xs", unavailable ? "text-amber-700 dark:text-amber-400" : "text-red-600")}>
                {comment.errorMsg}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
