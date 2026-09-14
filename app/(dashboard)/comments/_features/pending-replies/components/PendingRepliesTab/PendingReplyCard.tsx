"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  X,
  Pencil,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowDown,
  ExternalLink,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { buildMetaCommentViewUrl } from "../../../../_lib/build-facebook-comment-view-url";
import type { PendingReply, PendingReplyPage, PendingReplyStatus } from "../../types";

interface PendingReplyCardProps {
  reply: PendingReply;
  /**
   * The page the comment is on. Shown when the queue spans several pages (an
   * automation's review sheet); the comments inbox is already page-filtered.
   */
  page?: PendingReplyPage;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onApprove: (id: number, editedReply?: string) => void;
  onReject: (id: number) => void;
  onRetry: (id: number) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isRetrying?: boolean;
}

const STATUS_CONFIG: Record<PendingReplyStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
  },
  approved: {
    label: "Approved",
    icon: Check,
    className: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
  },
  posted: {
    label: "Posted",
    icon: CheckCircle,
    className:
      "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
  },
  rejected: { label: "Rejected", icon: XCircle, className: "text-muted-foreground bg-muted border-border" },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800",
  },
  comment_deleted: {
    label: "Comment deleted",
    icon: XCircle,
    className: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
  },
};

const getSentimentConfig = (sentiment?: number) => {
  if (sentiment === undefined || sentiment === null) {
    return { label: "N/A", className: "text-muted-foreground bg-muted border-border" };
  }
  if (sentiment >= 70) {
    return {
      label: sentiment.toString(),
      className:
        "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
    };
  }
  if (sentiment >= 40) {
    return {
      label: sentiment.toString(),
      className:
        "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
    };
  }
  return {
    label: sentiment.toString(),
    className: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800",
  };
};

/** "on Patriot Crew" with the page's picture, so a multi-page queue reads at a glance. */
function PageChip({ page, platform }: { page: PendingReplyPage; platform: PendingReply["platform"] }) {
  const platformLabel = platform === "instagram" ? "Instagram" : "Facebook";
  return (
    <span
      className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
      title={`${platformLabel} page: ${page.name}`}
    >
      {page.picture ? (
        <img src={page.picture} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full bg-muted" />
      )}
      <span className="truncate">on {page.name}</span>
    </span>
  );
}

export function PendingReplyCard({
  reply,
  page,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onRetry,
  isApproving,
  isRejecting,
  isRetrying,
}: PendingReplyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(reply.editedReply || reply.generatedReply);

  const statusConfig = STATUS_CONFIG[reply.status];
  const StatusIcon = statusConfig.icon;
  const sentimentConfig = getSentimentConfig(reply.commentSnapshot.sentiment);
  // Link back to the post the comment was left on (deep-linked to the comment
  // on Facebook; IG needs the server-joined media permalink).
  const postUrl = buildMetaCommentViewUrl({
    platform: reply.platform,
    post_permalink_url: reply.postPermalinkUrl,
    postId: reply.commentSnapshot.postId,
    facebookId: reply.commentId,
  }).url;

  const handleApprove = () => {
    if (isEditing && editedText !== reply.generatedReply) {
      onApprove(reply.id, editedText);
    } else {
      onApprove(reply.id);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(reply.editedReply || reply.generatedReply);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "bg-card border rounded-lg transition-all duration-200 flex flex-col overflow-hidden shadow-sm",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border hover:shadow-md",
      )}
    >
      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Original Comment Section */}
        <div className="px-3 py-1.5 bg-muted/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              {reply.status === "pending" && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect(reply.id)}
                  className="shrink-0 h-3.5 w-3.5"
                />
              )}
              {reply.commentSnapshot.authorProfilePicture ? (
                <img
                  src={reply.commentSnapshot.authorProfilePicture}
                  alt={reply.commentSnapshot.authorName || "User"}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <span className="text-[11px] font-medium text-muted-foreground">
                {reply.commentSnapshot.authorName || "Unknown"}
              </span>
              {page && <PageChip page={page} platform={reply.platform} />}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 border",
                  statusConfig.className,
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" />
                {statusConfig.label}
              </span>
              <div
                className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border", sentimentConfig.className)}
              >
                Sentiment: {sentimentConfig.label}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="bg-background rounded border border-border px-2.5 py-1.5">
            <p className="text-[13px] text-foreground leading-snug">{reply.commentSnapshot.message}</p>
          </div>
        </div>

        {/* Arrow Divider */}
        <div className="flex justify-center -my-1.5 relative z-10">
          <div className="bg-background border border-border rounded-full p-0.5">
            <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" />
          </div>
        </div>

        {/* AI Reply Section */}
        <div className="px-3 py-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                <Sparkles className="h-2.5 w-2.5 text-indigo-600" />
              </div>
              <span className="text-[11px] font-medium text-indigo-700">AI Generated Reply</span>
            </div>
            {reply.status === "pending" && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-0.5 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-1.5 py-0.5 rounded transition-colors"
              >
                <Pencil className="h-2.5 w-2.5" />
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="min-h-[60px] text-[13px] border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                placeholder="Edit reply..."
              />
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 text-[11px]">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleApprove} disabled={isApproving} className="h-7 text-[11px]">
                  {isApproving && <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" />}
                  Save & Approve
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 rounded border border-indigo-100 px-2.5 py-1.5">
              <p className="text-[13px] text-foreground leading-snug">{reply.editedReply || reply.generatedReply}</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {reply.status === "failed" && reply.errorMessage && (
          <div className="mx-3 mb-2 flex items-center gap-1.5 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] rounded border border-red-100">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{reply.errorMessage}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/50">
        {postUrl ? (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View post
          </a>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {reply.status === "pending" && !isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(reply.id)}
                disabled={isRejecting}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50"
              >
                {isRejecting ? (
                  <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" />
                ) : (
                  <X className="h-2.5 w-2.5 mr-1" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
                className="h-6 px-2.5 text-[10px] bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
                  <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-2.5 w-2.5 mr-1" />
                )}
                Approve
              </Button>
            </>
          )}

          {reply.status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(reply.id)}
              disabled={isRetrying}
              className="h-6 text-[10px]"
            >
              <RefreshCw className={cn("h-2.5 w-2.5 mr-1", isRetrying && "animate-spin")} />
              Retry
            </Button>
          )}

          {reply.status === "posted" && reply.reviewedBy && (
            <span className="text-[10px] text-muted-foreground">
              <CheckCircle className="h-2.5 w-2.5 inline mr-1 text-green-500" />
              by {reply.reviewedBy}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
