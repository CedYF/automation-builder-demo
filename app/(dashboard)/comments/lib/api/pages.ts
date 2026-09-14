import { apiClient, ApiError, AuthenticationError } from "../../_lib/api/client";
import type {
  Page,
  SubscribePageParams,
  SubscriptionResult,
  SubscriptionStatus,
  PageSubscriptionStatus,
  HistoricalFetchStatus,
} from "./types";

// ============================================
// Pages API
// ============================================

/**
 * Fetch all subscribed pages
 */
export const fetchPages = async (token: string): Promise<Page[]> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.get<{ data: Page[] }>("/page-subscriptions", undefined, { token });

  return result.data;
};

/**
 * Subscribe a page to webhooks
 */
export const subscribePage = async (params: SubscribePageParams, token: string): Promise<SubscriptionResult> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const body: Record<string, unknown> = {};
  if (params.pageAccessToken) {
    body.pageAccessToken = params.pageAccessToken;
  }
  if (params.platform) {
    body.platform = params.platform;
  }
  if (params.adAccountId) {
    body.adAccountId = params.adAccountId;
  }
  if (params.connectedPageId) {
    body.connectedPageId = params.connectedPageId;
  }

  const result = await apiClient.post<SubscriptionResult>(
    `/page-subscriptions/${params.pageId}/subscribe`,
    Object.keys(body).length > 0 ? body : undefined,
    { token, timeoutMs: null },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to subscribe page");
  }

  return result;
};

/**
 * Unsubscribe a page from webhooks
 */
export const unsubscribePage = async (pageId: string, token: string): Promise<SubscriptionResult> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.delete<SubscriptionResult>(`/page-subscriptions/${pageId}/subscribe`, undefined, {
    token,
    timeoutMs: null,
  });

  if (!result.success) {
    throw new ApiError(result.error || "Failed to unsubscribe page");
  }

  return result;
};

/**
 * Check subscription status for a single page
 */
export const getPageSubscriptionStatus = async (pageId: string, token: string): Promise<SubscriptionStatus> => {
  if (!token || !pageId) {
    return { subscribed: false };
  }

  return apiClient.get<SubscriptionStatus>(`/page-subscriptions/${pageId}/subscription`, undefined, { token });
};

/**
 * Check subscription status for multiple pages (bulk)
 */
export const getAllPagesSubscriptionStatus = async (
  pageIds: string[],
  token: string,
): Promise<Record<string, PageSubscriptionStatus>> => {
  if (!token || pageIds.length === 0) {
    return {};
  }

  const result = await apiClient.post<{ data: PageSubscriptionStatus[] }>(
    "/page-subscriptions/check",
    { pageIds },
    { token },
  );

  // Convert array to a map of pageId -> PageSubscriptionStatus
  return (result.data || []).reduce(
    (acc: Record<string, PageSubscriptionStatus>, item: PageSubscriptionStatus) => {
      acc[item.pageId] = item;
      return acc;
    },
    {} as Record<string, PageSubscriptionStatus>,
  );
};

/**
 * Trigger fetching historical comments for a page
 */
export const syncHistoricalComments = async (pageId: string, token: string): Promise<SubscriptionResult> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.post<SubscriptionResult>(`/page-subscriptions/${pageId}/sync`, undefined, { token });

  if (!result.success) {
    throw new ApiError(result.error || "Failed to sync historical comments");
  }

  return result;
};

/**
 * Get the historical comments fetch status for a page
 */
export const getHistoricalFetchStatus = async (
  pageId: string,
  token: string,
): Promise<HistoricalFetchStatus | null> => {
  if (!token || !pageId) {
    return null;
  }

  const result = await apiClient.get<{ success: boolean; status: HistoricalFetchStatus | null }>(
    `/page-subscriptions/${pageId}/fetch-historical-status`,
    undefined,
    { token },
  );

  return result.status;
};

/**
 * Sync all comments for an ad account (ads + organic posts) from Facebook.
 * Legacy synchronous endpoint — blocks until the sync completes. For new UIs
 * prefer `startAdAccountSync` + `getSyncRunStatus` so the request stays short
 * even when the sync is deep.
 */
export const syncAdAccountComments = async (
  adAccountId: string,
  workspaceId: string,
  token: string,
  forceRefresh: boolean = true,
): Promise<SubscriptionResult> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.post<SubscriptionResult>(
    `/comments/sync-ad-account`,
    {
      adAccountId,
      workspaceId,
      forceRefresh,
    },
    { token },
  );

  if (!result.success) {
    throw new ApiError(result.error || "Failed to sync ad account comments");
  }

  return result;
};

export type SyncRunStage =
  | "queued"
  | "fetching_ads"
  | "processing_ads"
  | "fetching_organic"
  // Organic-only runs (startOrganicSync) — totalAds/processedAds carry post counts.
  | "fetching_pages"
  | "processing_posts"
  | "saving"
  | "sentiment"
  | "completed"
  | "failed";

export type SyncRunStatus = "pending" | "running" | "completed" | "failed";

/** Which sync produced the run — ads-first account sync or organic all-posts sync. */
export type SyncRunType = "ads" | "organic";

export interface StartSyncRunResponse {
  syncRunId: string;
  /** True when an in-flight run of the same type was returned instead of starting a new one. */
  alreadyRunning: boolean;
}

export interface SyncRunHiddenByPage {
  [pageId: string]: { name: string; pictureUrl?: string | null; count: number };
}

export interface SyncRunState {
  id: string;
  adAccountId: string;
  workspaceId: string;
  status: SyncRunStatus;
  /** Optional so older CommentsServer builds (pre sync_type migration) still parse. */
  syncType?: SyncRunType;
  stage: SyncRunStage;
  totalAds: number;
  processedAds: number;
  totalCommentsSaved: number;
  totalCommentsHidden: number;
  hiddenByPage: SyncRunHiddenByPage;
  timedOut: boolean;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * Start a background ad-account sync. Returns a runId immediately — poll
 * `getSyncRunStatus(runId)` for progress and to detect completion. Pair with
 * `deep: true` to raise the per-sync ad cap for large accounts.
 */
export const startAdAccountSync = async (
  adAccountId: string,
  workspaceId: string,
  token: string,
  options: { forceRefresh?: boolean; deep?: boolean; maxAds?: number } = {},
): Promise<StartSyncRunResponse> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.post<{
    success: boolean;
    syncRunId: string;
    alreadyRunning?: boolean;
    error?: string;
  }>(
    `/comments/sync-ad-account/start`,
    {
      adAccountId,
      workspaceId,
      forceRefresh: options.forceRefresh ?? true,
      deep: options.deep ?? false,
      maxAds: options.maxAds,
    },
    { token },
  );

  if (!result.success || !result.syncRunId) {
    throw new ApiError(result.error || "Failed to start sync");
  }

  return { syncRunId: result.syncRunId, alreadyRunning: result.alreadyRunning ?? false };
};

/**
 * Start a background sync of ALL organic comments on the ad account's
 * Facebook page(s) — every post is walked with full pagination, unlike the
 * ad-account sync's shallow recent-posts organic pass. Returns a runId
 * immediately; poll `getSyncRunStatus(runId)` for progress (for organic runs
 * the totalAds/processedAds fields carry post counts).
 */
export const startOrganicSync = async (
  adAccountId: string,
  workspaceId: string,
  token: string,
  options: { pageIds?: string[]; maxPostsPerPage?: number } = {},
): Promise<StartSyncRunResponse> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.post<{
    success: boolean;
    syncRunId: string;
    alreadyRunning?: boolean;
    error?: string;
  }>(
    `/comments/sync-organic/start`,
    {
      adAccountId,
      workspaceId,
      pageIds: options.pageIds,
      maxPostsPerPage: options.maxPostsPerPage,
    },
    { token },
  );

  if (!result.success || !result.syncRunId) {
    throw new ApiError(result.error || "Failed to start organic sync");
  }

  return { syncRunId: result.syncRunId, alreadyRunning: result.alreadyRunning ?? false };
};

/**
 * Fetch the latest comments for a SINGLE ad on demand (Facebook + Instagram),
 * stamping its campaign/ad-set so it becomes filterable. Runs inline and returns
 * the counts saved — powers the per-ad "Fetch fresh" button. Unlike the
 * ad-account sync this is synchronous (no run id / polling).
 *
 * No client timeout: Meta/IG pagination for a high-volume ad routinely exceeds
 * the default 30s Comments API budget.
 */
export const syncSingleAd = async (
  adId: string,
  adAccountId: string,
  workspaceId: string,
  token: string,
): Promise<{ fbSaved: number; igSaved: number; fetched: number }> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }

  const result = await apiClient.post<{
    success: boolean;
    fbSaved: number;
    igSaved: number;
    fetched: number;
    error?: string;
  }>(`/comments/sync-ad`, { adId, adAccountId, workspaceId }, { token, timeoutMs: null });

  if (!result.success) {
    throw new ApiError(result.error || "Failed to fetch comments for ad");
  }

  return { fbSaved: result.fbSaved, igSaved: result.igSaved, fetched: result.fetched };
};

/**
 * Look up the most recent sync run for an ad account. Used on mount to
 * surface the "missing permission on page X" banner without having to remember
 * a specific run id across navigations.
 */
export const getLatestSyncRun = async (adAccountId: string, token: string): Promise<SyncRunState | null> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }
  const result = await apiClient.get<{ success: boolean; run: SyncRunState | null; error?: string }>(
    `/comments/sync-ad-account-latest?adAccountId=${encodeURIComponent(adAccountId)}`,
    undefined,
    { token },
  );
  if (!result.success) {
    throw new ApiError(result.error || "Failed to fetch latest sync run");
  }
  return result.run ?? null;
};

/**
 * Read the current state of a background sync run. The UI polls this every
 * few seconds while the run is in progress to show live "Syncing X/N" copy.
 */
export const getSyncRunStatus = async (syncRunId: string, token: string): Promise<SyncRunState> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }
  const result = await apiClient.get<{ success: boolean; run: SyncRunState; error?: string }>(
    `/comments/sync-ad-account/${encodeURIComponent(syncRunId)}`,
    undefined,
    { token },
  );
  if (!result.success || !result.run) {
    throw new ApiError(result.error || "Failed to fetch sync run status");
  }
  return result.run;
};

// Sentiment analysis is not here: it runs through the platform-aware
// `reanalyzeCommentSentiments` in ./comments, which targets the Facebook or
// Instagram comments table based on the selected page's platform. The old
// `/page-subscriptions/{pageId}/analyze-sentiment` client resolved a Facebook
// page token first and could never work for an Instagram account.

// Export all pages API methods
export const pagesApi = {
  fetch: fetchPages,
  subscribe: subscribePage,
  unsubscribe: unsubscribePage,
  getSubscriptionStatus: getPageSubscriptionStatus,
  getAllSubscriptionStatus: getAllPagesSubscriptionStatus,
  getHistoricalFetchStatus,
  syncHistoricalComments,
  syncAdAccountComments,
  startAdAccountSync,
  startOrganicSync,
  syncSingleAd,
  getSyncRunStatus,
  getLatestSyncRun,
};

export default pagesApi;
