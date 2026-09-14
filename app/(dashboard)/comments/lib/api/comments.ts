import { apiClient, ApiError, AuthenticationError, buildUrl, getAuthHeaders } from "../../_lib/api/client";
import type {
  CommentsFilters,
  CommentsResponse,
  AdsForCommentsResponse,
  DeleteCommentParams,
  EditCommentParams,
  HideCommentParams,
  MarkCommentRepliedParams,
  MarkRepliedByFilterResult,
  ReplyCommentParams,
  GenerateAiReplyParams,
  GenerateAiReplyResponse,
  ReactToCommentParams,
  ReactToCommentResponse,
  ApiResponse,
  VocCategory,
} from "./types";

interface VocCategoriesResponse {
  success: boolean;
  data?: { workspaceId: string; categories: VocCategory[] };
  error?: string;
}

export type ReanalyzeSentimentsMode = "missing" | "current";

export interface ReanalyzeSentimentsParams extends CommentsFilters {
  mode: ReanalyzeSentimentsMode;
  /**
   * Cap on comments analyzed in this run. Page-wide callers send one so a large
   * backlog returns inside the request timeout; omit it to analyze every match.
   */
  maxComments?: number;
}

export interface ReanalyzeSentimentsStats {
  totalComments: number;
  facebookComments: number;
  instagramComments: number;
  deletedSentiments: number;
  analyzedCount: number;
  mode: ReanalyzeSentimentsMode;
  /** True when `maxComments` cut the run short and more comments still qualify. */
  limitReached?: boolean;
}

export interface ReanalyzeSentimentsResponse {
  success: boolean;
  data?: ReanalyzeSentimentsStats;
  error?: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string | string[];
}

const COMMENTS_SENTIMENT_REANALYZE_TIMEOUT_MS = 120_000;

/**
 * Fetch a workspace's editable VOC category set. No auth header — the endpoint
 * is keyed by workspaceId, not the Facebook token.
 */
export const fetchVocCategories = async (workspaceId: string): Promise<VocCategory[]> => {
  const response = await apiClient.get<VocCategoriesResponse>("/comments/voc-categories", { workspaceId });
  return response.data?.categories ?? [];
};

/** Replace a workspace's VOC category set. Returns the persisted (sanitized) list. */
export const updateVocCategories = async (workspaceId: string, categories: VocCategory[]): Promise<VocCategory[]> => {
  const response = await apiClient.patch<VocCategoriesResponse>("/comments/voc-categories", {
    workspaceId,
    categories,
  });
  if (!response.success) {
    throw new Error(response.error || "Failed to update VOC categories");
  }
  return response.data?.categories ?? [];
};

// ============================================
// Comments API
// ============================================

/**
 * Query params for `GET /comments`, in the server's naming (`ad_account_id`,
 * `ad_id`). "all"-valued filters are omitted so the backend applies no
 * predicate. Shared with the filter-scoped bulk actions, which must resolve
 * exactly the rows the list shows.
 */
export const buildCommentsQueryParams = (
  filters: CommentsFilters = {},
): Record<string, string | number | undefined> => {
  const params: Record<string, string | number | undefined> = {};

  // Always send pageId, defaulting to "all" if not specified
  params.pageId = filters?.pageId || "all";

  if (filters.search) params.search = filters.search;
  if (filters.sentiments && filters.sentiments !== "all") {
    params.sentiments = filters.sentiments;
  }
  if (typeof filters.sentimentMin === "number") {
    params.sentimentMin = filters.sentimentMin;
  }
  if (typeof filters.sentimentMax === "number") {
    params.sentimentMax = filters.sentimentMax;
  }
  if (filters.language && filters.language !== "all") {
    params.language = filters.language;
  }
  if (filters.vocCategory && filters.vocCategory !== "all") {
    params.vocCategory = filters.vocCategory;
  }
  if (filters.theme && filters.theme !== "all") {
    params.theme = filters.theme;
  }
  if (filters.timeRange && filters.timeRange !== "all") {
    params.timeRange = filters.timeRange;
  }
  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }
  if (filters.adAccountId) {
    params.ad_account_id = filters.adAccountId;
  }
  if (filters.commentType && filters.commentType !== "all") {
    params.commentType = filters.commentType;
  }
  if (filters.adId) {
    params.ad_id = filters.adId;
  }
  if (filters.campaignId) {
    params.campaignId = filters.campaignId;
  }
  if (filters.adsetId) {
    params.adsetId = filters.adsetId;
  }

  if (filters.page !== undefined) params.page = filters.page;
  if (filters.limit !== undefined) params.limit = filters.limit;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.adAgeMaxDays === 7 || filters.adAgeMaxDays === 30 || filters.adAgeMaxDays === 90) {
    params.adAgeMaxDays = filters.adAgeMaxDays;
  }
  if (filters.replyStatus && filters.replyStatus !== "all") {
    params.replyStatus = filters.replyStatus;
  }
  if (filters.hidden && filters.hidden !== "all") {
    params.hidden = filters.hidden;
  }
  if (filters.platform && filters.platform !== "facebook") {
    params.platform = filters.platform;
  }

  return params;
};

/**
 * Fetch comments with filters and pagination
 */
export const fetchComments = async (
  filters: CommentsFilters = {},
  token?: string | null,
): Promise<{ success: boolean; data: CommentsResponse }> => {
  return apiClient.get<{ success: boolean; data: CommentsResponse }>("/comments", buildCommentsQueryParams(filters), {
    token,
  });
};

/**
 * Delete a comment
 */
export const deleteComment = async (params: DeleteCommentParams, token: string): Promise<ApiResponse<void>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  const result = await apiClient.delete<ApiResponse<void>>(
    "/comments/delete",
    {
      commentId: params.commentId,
      pageId: params.pageId,
      adAccountId: params.adAccountId,
      platform: params.platform,
    },
    { token },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to delete comment");
  }

  return result;
};

/** One synced comment on a post, flattened for the inbox post-thread view. */
export interface PostThreadComment {
  /** Graph comment id (FB facebook_id / IG comment_id). */
  id: string;
  /** Parent comment's Graph id, or null for top-level comments. */
  parentId: string | null;
  message: string;
  fromId: string | null;
  fromName: string | null;
  fromProfilePicture: string | null;
  pageId: string | null;
  createdAt: string | null;
  isHidden: boolean;
  /**
   * When Meta last refused to act on this comment — deleted, or the page lost
   * access. Null when it is fine; absent on responses that predate the column.
   */
  unavailableOnGraphAt?: string | null;
  sentimentScore: number | null;
  /** Detected language code when available (Facebook); null for Instagram. */
  language: string | null;
}

export interface PostThreadCommentsPage {
  comments: PostThreadComment[];
  /** Total synced comments on the post, for "Load more" pagination. */
  total: number;
}

/**
 * One page of synced comments on a post/media — powers the inbox "all post
 * comments" view. Served from the CommentsServer DB, no Graph round-trip.
 */
export const fetchPostComments = async (
  postId: string,
  platform: "facebook" | "instagram",
  token: string,
  pagination: { limit?: number; offset?: number } = {},
): Promise<PostThreadCommentsPage> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }
  const result = await apiClient.get<ApiResponse<PostThreadComment[]> & { total?: number }>(
    "/comments/by-post",
    { postId, platform, limit: pagination.limit ?? 100, offset: pagination.offset ?? 0 },
    { token },
  );
  if (!result.success) {
    throw new ApiError(result.error || "Failed to load post comments");
  }
  const comments = result.data ?? [];
  return { comments, total: result.total ?? comments.length };
};

/**
 * Hide or unhide a comment
 */
export const hideComment = async (params: HideCommentParams, token: string): Promise<ApiResponse<void>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  // No client timeout: like the reply POST, hide/unhide does a Meta Graph
  // round-trip server-side and can exceed the default 30s, which surfaced a
  // false "service did not respond" failure while the hide still applied
  // (ADM-9608).
  const result = await apiClient.post<ApiResponse<void>>(
    "/comments/hide",
    {
      commentId: params.commentId,
      pageId: params.pageId,
      hide: params.hide,
      adAccountId: params.adAccountId,
      platform: params.platform,
    },
    { token, timeoutMs: null },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to hide comment");
  }

  return result;
};

/**
 * Edit a page-authored comment or reply's message (ADM-9463). Facebook only —
 * Meta's Graph API has no comment-edit endpoint for Instagram.
 */
export const editComment = async (params: EditCommentParams, token: string): Promise<ApiResponse<void>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  // No client timeout: like reply/hide, the edit does a Meta Graph round-trip
  // server-side and can exceed the default 30s (ADM-9608 pattern).
  const result = await apiClient.post<ApiResponse<void>>(
    "/comments/edit",
    {
      commentId: params.commentId,
      message: params.message,
      pageId: params.pageId,
      adAccountId: params.adAccountId,
      platform: params.platform,
    },
    { token, timeoutMs: null },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to edit comment");
  }

  return result;
};

/**
 * Persist the inbox "Mark replied" action so the handled state survives
 * refreshes, syncs across devices, and is excluded from the server-side
 * unreplied filter/count. No Graph API call — DB-only.
 */
export const markCommentReplied = async (
  params: MarkCommentRepliedParams,
  token: string,
): Promise<ApiResponse<void>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  const result = await apiClient.post<ApiResponse<void>>(
    "/comments/mark-replied",
    {
      commentId: params.commentId,
      replied: params.replied,
      platform: params.platform,
    },
    { token },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to mark comment as replied");
  }

  return result;
};

/**
 * Mark every comment matching the list filters as replied — the "Select all N
 * comments" bulk action (ADM-12142). One request covers pages the client never
 * loaded; the server resolves the scope with the same query as the list.
 */
export const markCommentsRepliedByFilter = async (
  filters: CommentsFilters,
  token: string,
  replied = true,
): Promise<MarkRepliedByFilterResult> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  // Pagination and sort don't change the scope; the server DTO rejects unknown
  // keys only implicitly, so strip them rather than send meaningless values.
  const { page: _page, limit: _limit, sortBy: _sortBy, ...scope } = buildCommentsQueryParams(filters);

  const result = await apiClient.post<ApiResponse<MarkRepliedByFilterResult>>(
    "/comments/mark-replied/by-filter",
    { ...scope, replied },
    // Large scopes stamp thousands of rows in chunks; don't let the default
    // client timeout abort a request the server is still applying.
    { token, timeoutMs: null },
  );

  if (!result.success || !result.data) {
    throw new ApiError(result.error || "Failed to mark comments as replied");
  }

  return result.data;
};

/**
 * Reply to a comment
 */
export const replyToComment = async (
  params: ReplyCommentParams,
  token: string,
): Promise<ApiResponse<{ replyId: string }>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  // No client timeout: the reply POST does Meta Graph round-trips server-side
  // and can take ~20s+. Aborting at the default timeout surfaced a false
  // "service did not respond" error while the reply still landed on the
  // server, so a retry duplicated it (ADM-9608).
  const result = await apiClient.post<ApiResponse<{ replyId: string }>>(
    "/comments/reply",
    {
      commentId: params.commentId,
      message: params.message,
      pageId: params.pageId,
      adAccountId: params.adAccountId,
      platform: params.platform,
    },
    { token, timeoutMs: null },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to send reply");
  }

  return result;
};

/**
 * Generate an AI reply for a comment
 */
export const generateAiReply = async (params: GenerateAiReplyParams): Promise<GenerateAiReplyResponse> => {
  const result = await apiClient.post<GenerateAiReplyResponse>("/comments/generate-ai-reply", {
    commentContent: params.commentContent,
    customPrompt: params.customPrompt,
    email: params.email,
  });

  if (!result.success) {
    throw new ApiError(result.error || "Failed to generate AI reply");
  }

  return result;
};

/**
 * Bulk delete comments
 */
export const bulkDeleteComments = async (
  commentIds: (string | number)[],
  pageId: string,
  token: string,
): Promise<ApiResponse<{ deleted: number; failed: number }>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  const result = await apiClient.delete<ApiResponse<{ deleted: number; failed: number }>>(
    "/comments/bulk-delete",
    {
      commentIds,
      pageId,
    },
    { token },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to delete comments");
  }

  return result;
};

/**
 * Bulk hide comments
 */
export const bulkHideComments = async (
  commentIds: (string | number)[],
  pageId: string,
  hide: boolean,
  token: string,
): Promise<ApiResponse<{ hidden: number; failed: number }>> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  // No client timeout: bulk hide performs one Graph call per comment
  // server-side, so it exceeds the default 30s far more easily than a
  // single hide (ADM-9608).
  const result = await apiClient.post<ApiResponse<{ hidden: number; failed: number }>>(
    "/comments/bulk-hide",
    {
      commentIds,
      pageId,
      hide,
    },
    { token, timeoutMs: null },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to hide comments");
  }

  return result;
};

/**
 * React to a comment (like)
 */
export const reactToComment = async (params: ReactToCommentParams, token: string): Promise<ReactToCommentResponse> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  const result = await apiClient.post<ReactToCommentResponse>(
    "/comments/react",
    {
      commentId: params.commentId,
      pageId: params.pageId,
      reactionType: params.reactionType,
      adAccountId: params.adAccountId,
      platform: params.platform,
    },
    { token },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to add reaction");
  }

  return result;
};

/**
 * Export all comments matching filters as a CSV file download
 */
export const exportCommentsCSV = async (filters: CommentsFilters = {}, token?: string | null): Promise<void> => {
  const params: Record<string, string | number | undefined> = {};

  params.pageId = filters?.pageId || "all";
  if (filters.search) params.search = filters.search;
  if (filters.sentiments && filters.sentiments !== "all") {
    params.sentiments = filters.sentiments;
  }
  if (typeof filters.sentimentMin === "number") {
    params.sentimentMin = filters.sentimentMin;
  }
  if (typeof filters.sentimentMax === "number") {
    params.sentimentMax = filters.sentimentMax;
  }
  if (filters.language && filters.language !== "all") {
    params.language = filters.language;
  }
  if (filters.vocCategory && filters.vocCategory !== "all") {
    params.vocCategory = filters.vocCategory;
  }
  if (filters.theme && filters.theme !== "all") {
    params.theme = filters.theme;
  }
  if (filters.timeRange && filters.timeRange !== "all") {
    params.timeRange = filters.timeRange;
  }
  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }
  if (filters.adAccountId) {
    params.ad_account_id = filters.adAccountId;
  }
  if (filters.commentType && filters.commentType !== "all") {
    params.commentType = filters.commentType;
  }
  if (filters.adId) {
    params.ad_id = filters.adId;
  }
  if (filters.campaignId) {
    params.campaignId = filters.campaignId;
  }
  if (filters.adsetId) {
    params.adsetId = filters.adsetId;
  }
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.adAgeMaxDays === 7 || filters.adAgeMaxDays === 30 || filters.adAgeMaxDays === 90) {
    params.adAgeMaxDays = filters.adAgeMaxDays;
  }
  if (filters.replyStatus && filters.replyStatus !== "all") {
    params.replyStatus = filters.replyStatus;
  }
  if (filters.hidden && filters.hidden !== "all") {
    params.hidden = filters.hidden;
  }

  const url = buildUrl("/comments/export", params);
  const headers = token ? getAuthHeaders(token) : { "Content-Type": "application/json" };

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const contentDisposition = response.headers.get("Content-Disposition");
  const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
  const filename = filenameMatch ? filenameMatch[1] : `comments_export_${new Date().toISOString().split("T")[0]}.csv`;

  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

export const reanalyzeCommentSentiments = async (
  filters: ReanalyzeSentimentsParams,
  token?: string | null,
): Promise<ReanalyzeSentimentsResponse> => {
  if (!token) {
    throw new AuthenticationError("Please reconnect your Facebook account");
  }

  const response = await fetch(buildUrl("/comments/reanalyze-sentiments"), {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(buildReanalyzeSentimentsBody(filters)),
    signal: AbortSignal.timeout(COMMENTS_SENTIMENT_REANALYZE_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch((): ApiErrorPayload => ({}));
    throw new ApiError(resolveApiErrorMessage(errorPayload, response.status), response.status);
  }

  const result = (await response.json()) as ReanalyzeSentimentsResponse;
  if (!result.success) {
    throw new ApiError(result.error || "Failed to reanalyze sentiments");
  }

  return result;
};

function buildReanalyzeSentimentsBody(filters: ReanalyzeSentimentsParams): Record<string, string | number | undefined> {
  return {
    mode: filters.mode,
    pageId: filters.pageId || "all",
    search: filters.search,
    sentiments: filters.sentiments && filters.sentiments !== "all" ? filters.sentiments : undefined,
    sentimentMin: filters.sentimentMin,
    sentimentMax: filters.sentimentMax,
    language: filters.language && filters.language !== "all" ? filters.language : undefined,
    vocCategory: filters.vocCategory && filters.vocCategory !== "all" ? filters.vocCategory : undefined,
    theme: filters.theme && filters.theme !== "all" ? filters.theme : undefined,
    timeRange: filters.timeRange && filters.timeRange !== "all" ? filters.timeRange : undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ad_account_id: filters.adAccountId,
    commentType: filters.commentType && filters.commentType !== "all" ? filters.commentType : undefined,
    ad_id: filters.adId,
    campaignId: filters.campaignId,
    adsetId: filters.adsetId,
    adAgeMaxDays: filters.adAgeMaxDays,
    replyStatus: filters.replyStatus && filters.replyStatus !== "all" ? filters.replyStatus : undefined,
    hidden: filters.hidden && filters.hidden !== "all" ? filters.hidden : undefined,
    platform: filters.platform,
    maxComments: filters.maxComments,
  };
}

function resolveApiErrorMessage(errorPayload: ApiErrorPayload, status: number): string {
  if (Array.isArray(errorPayload.message)) return errorPayload.message.join(", ");
  return errorPayload.message || errorPayload.error || `Request failed: ${status}`;
}

/**
 * Fetch unique ads from comments for filter dropdown
 */
export const fetchAdsForComments = async (
  filters: {
    pageId?: string;
    adAccountId?: string;
    timeRange?: string;
    campaignId?: string;
    adsetId?: string;
  } = {},
  token?: string | null,
): Promise<{ success: boolean; data: AdsForCommentsResponse }> => {
  const params: Record<string, string | undefined> = {};

  if (filters.pageId) params.pageId = filters.pageId;
  if (filters.adAccountId) params.ad_account_id = filters.adAccountId;
  if (filters.timeRange && filters.timeRange !== "all") {
    params.timeRange = filters.timeRange;
  }
  if (filters.campaignId) params.campaignId = filters.campaignId;
  if (filters.adsetId) params.adsetId = filters.adsetId;

  return apiClient.get<{ success: boolean; data: AdsForCommentsResponse }>("/comments/ads", params, { token });
};

export const commentsApi = {
  fetch: fetchComments,
  fetchAdsForComments,
  fetchPostComments,
  delete: deleteComment,
  edit: editComment,
  hide: hideComment,
  reply: replyToComment,
  generateAiReply,
  bulkDelete: bulkDeleteComments,
  bulkHide: bulkHideComments,
  react: reactToComment,
  exportCSV: exportCommentsCSV,
  reanalyzeSentiments: reanalyzeCommentSentiments,
  markRepliedByFilter: markCommentsRepliedByFilter,
};

export default commentsApi;
