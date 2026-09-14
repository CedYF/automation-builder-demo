import { apiClient, AuthenticationError } from "../../_lib/api/client";

// ============================================
// Account Overview API
// ============================================

/** Per-page (or per-IG-account) sync + volume stats for the Overview tab. */
export interface OverviewPageStats {
  pageId: string;
  /** Null when the page is only known from synced comments (no subscription row). */
  pageName: string | null;
  pagePicture: string | null;
  platform: "facebook" | "instagram";
  subscribed: boolean;
  fetchingHistoricalComments: boolean;
  historicalCommentsFetched: boolean;
  autoDisabledAt: string | null;
  autoDisabledReason: string | null;
  subscribedAt: string | null;
  commentCount: number;
  commentsLast7d: number;
  /** Inbound comments answered (manually marked or page-authored reply exists).
   * Optional until every CommentsServer deploy returns it. */
  repliedCount?: number;
  /** Inbound comments still needing action (mirrors the inbox unreplied filter).
   * Optional until every CommentsServer deploy returns it. */
  unrepliedCount?: number;
  /** Newest comment timestamp we hold for the page (comment creation time). */
  lastCommentAt: string | null;
  /** Last time a comment row for the page was written — i.e. last sync activity. */
  lastSyncedAt: string | null;
}

export interface OverviewSyncRun {
  id: string;
  syncType: "ads" | "organic";
  status: "pending" | "running" | "completed" | "failed";
  stage: string;
  /** Ads for ads-syncs, posts for organic syncs. */
  totalUnits: number;
  processedUnits: number;
  totalCommentsSaved: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
}

export interface AccountOverviewData {
  pages: OverviewPageStats[];
  syncRuns: OverviewSyncRun[];
  /** Most recent successful sync activity across the account. */
  lastSyncAt: string | null;
  generatedAt: string;
}

/**
 * Fetch the account-scoped sync overview (per-page freshness + recent sync
 * runs) that powers the Overview tab and the header last-sync indicator.
 */
export const fetchAccountOverview = async (adAccountId: string, token: string): Promise<AccountOverviewData> => {
  if (!token) {
    throw new AuthenticationError("Facebook token required");
  }
  const result = await apiClient.get<{ success: boolean; data: AccountOverviewData }>(
    "/comments/account-overview",
    { adAccountId },
    { token },
  );
  return result.data;
};

export const overviewApi = {
  fetchAccountOverview,
};

export default overviewApi;
