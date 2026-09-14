export type PendingReplyStatus = "pending" | "approved" | "posted" | "rejected" | "failed" | "comment_deleted";

export interface CommentSnapshot {
  message: string;
  authorName?: string;
  authorId?: string;
  authorProfilePicture?: string;
  sentiment?: number;
  postId?: string;
  createdAt?: string;
}

export interface AutomationRule {
  id: number;
  name: string;
  actionType: string;
}

export interface PendingReply {
  id: number;
  ruleId: number;
  commentId: string;
  generatedReply: string;
  editedReply?: string;
  status: PendingReplyStatus;
  postedReplyId?: string | null;
  errorMessage?: string | null;
  pageId: string;
  adAccountId?: string;
  company: string;
  workspaceId?: string;
  commentSnapshot: CommentSnapshot;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  rule?: AutomationRule;
  /** Platform the reply targets. Optional for back-compat; defaults to facebook. */
  platform?: "facebook" | "instagram";
  /** Permalink to the source post/comment, joined server-side from the synced comment. */
  postPermalinkUrl?: string | null;
}

/** The page a drafted reply's comment sits on, as the card labels it. */
export interface PendingReplyPage {
  name: string;
  picture: string | null;
}

export interface PendingRepliesPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PendingRepliesResponse {
  data: PendingReply[];
  total: number;
  pagination: PendingRepliesPagination;
}

export interface PendingReplyCountsResponse {
  pending: number;
  approved: number;
  rejected: number;
  posted: number;
  failed: number;
  /** Drafts whose target comment was deleted on the platform. Optional for back-compat. */
  comment_deleted?: number;
}

export interface BulkActionResult {
  success: number;
  failed: number;
  results: Array<{
    id: number;
    success: boolean;
    error?: string;
  }>;
}
