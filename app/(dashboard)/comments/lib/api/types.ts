// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalComments: number;
  totalPages: number;
}

// ============================================
// Comment Types
// ============================================

export interface ReactionCounts {
  like?: number;
  love?: number;
  haha?: number;
  wow?: number;
  sad?: number;
  angry?: number;
}

export interface ReplyComment {
  id: string | number;
  content: string;
  author: string;
  fromProfilePicture?: string;
  avatar?: string;
  fullDate: string;
  reactions: number;
  reactionCounts: ReactionCounts;
  replies?: ReplyComment[];
}

export interface Comment {
  id: string | number;
  facebookId?: string;
  content: string;
  language?: string | null;
  author: string;
  fromProfilePicture?: string;
  fullDate: string;
  postId: string;
  post_permalink_url?: string | null;
  permalinkUrl?: string | null;
  reactions: number;
  reactionCounts: ReactionCounts;
  sentimentScore?: number | string;
  theme?: string;
  /** Customer-defined VOC category assigned by the classifier; null when untagged. */
  vocCategory?: string | null;
  /**
   * Moderation verdict, independent of `sentimentScore`. "clean" = checked and
   * fine, "unknown" = no usable answer, null = the comment predates the feature.
   */
  moderationCategory?: string | null;
  replies?: ReplyComment[];
  isHidden?: boolean;
  platform?: "facebook" | "instagram" | "tiktok";
}

/** A single editable VOC category in a workspace's set. */
export interface VocCategory {
  id: string;
  name: string;
}

export interface CommentsFilters {
  search?: string;
  page?: number;
  limit?: number;
  sentiments?: string;
  /** Inclusive lower bound (0-100) of the sentiment score range filter. */
  sentimentMin?: number;
  /** Inclusive upper bound (0-100) of the sentiment score range filter. */
  sentimentMax?: number;
  language?: string;
  /** Customer-defined VOC category name to filter by; "all"/undefined disables it. */
  vocCategory?: string;
  /** Classifier theme (e.g. "question") to filter by; "all"/undefined disables it. */
  theme?: string;
  timeRange?: string;
  /** Inclusive lower bound ("yyyy-MM-dd") of a custom comment-date range. Takes precedence over timeRange. */
  dateFrom?: string;
  /** Inclusive upper bound ("yyyy-MM-dd") of a custom comment-date range. Takes precedence over timeRange. */
  dateTo?: string;
  commentType?: string;
  pageId?: string;
  adAccountId?: string;
  adId?: string;
  campaignId?: string;
  adsetId?: string;
  sortBy?: "positive_to_negative" | "negative_to_positive" | "newest" | "oldest";
  /** Facebook only — must match CommentsServer validation (ad effective start within N days). */
  adAgeMaxDays?: 7 | 30 | 90;
  /** "replied" | "unreplied" | "all". Server-side predicate; "all" omits the param. */
  replyStatus?: "all" | "replied" | "unreplied";
  /**
   * "visible" | "hidden" | "unavailable" | "all". Server-side predicate; "all"
   * omits the param. "visible" also excludes comments Meta refuses to act on.
   */
  hidden?: "all" | "visible" | "hidden" | "unavailable";
  /** Meta platform scope. "all" reads Facebook + Instagram at account/pageId=all scope. */
  platform?: "facebook" | "instagram" | "all";
}

export interface AdForComments {
  adId: string;
  adName: string;
  commentCount: number;
  campaignName?: string;
  campaignId?: string;
  spend?: string;
  adCreatedAt?: string;
}

export interface AdsForCommentsResponse {
  ads: AdForComments[];
}

export interface CommentsResponse {
  comments: Comment[];
  pagination: PaginationInfo;
  isSubscribed?: boolean;
  fetchingHistoricalComments?: boolean;
  historicalCommentsFetched?: boolean;
}

export interface DeleteCommentParams {
  commentId: string | number;
  pageId: string;
  // When set, the server tries `act_{adAccountId}/promote_pages` before
  // /me/accounts to resolve the page access token. Mirrors the subscribe flow.
  adAccountId?: string;
  platform?: "facebook" | "instagram";
}

export interface HideCommentParams {
  commentId: string | number;
  pageId: string;
  hide: boolean;
  adAccountId?: string;
  platform?: "facebook" | "instagram";
}

export interface EditCommentParams {
  commentId: string | number;
  /** The new message text replacing the current comment/reply content. */
  message: string;
  pageId: string;
  adAccountId?: string;
  platform?: "facebook" | "instagram";
}

export interface MarkCommentRepliedParams {
  commentId: string | number;
  replied: boolean;
  platform?: "facebook" | "instagram";
}

/** Result of the filter-scoped bulk mark-replied (ADM-12142). */
export interface MarkRepliedByFilterResult {
  /** Rows whose marker actually changed (already-marked rows are skipped). */
  updated: number;
  facebook: number;
  instagram: number;
}

export interface ReplyCommentParams {
  commentId: string | number;
  message: string;
  pageId: string;
  adAccountId?: string;
  platform?: "facebook" | "instagram";
}

export interface GenerateAiReplyParams {
  commentContent: string;
  customPrompt?: string;
  email: string;
}

export interface GenerateAiReplyResponse {
  success: boolean;
  aiReply: string;
  error?: string;
}

export interface ReactToCommentParams {
  commentId: string | number;
  pageId: string;
  reactionType: "like"; // Meta only exposes "like" for comments (FB Pages and IG accounts alike)
  adAccountId?: string;
  platform?: "facebook" | "instagram";
}

export interface ReactToCommentResponse {
  success: boolean;
  message: string;
  action: "liked" | "unliked";
  likedByPage: boolean;
  commentId: string;
  pageId: string;
  error?: string;
}

// ============================================
// Page Types
// ============================================

export interface Page {
  pageId: string;
  pageName: string;
  pagePicture: string;
  subscribed: boolean;
  subscribedFields: string[];
  subscribedAt: string;
  updatedAt: string;
  fetchingHistoricalComments: boolean;
  historicalCommentsFetched: boolean;
  commentCount?: number;
  hasAccess?: boolean;
  category?: string;
}

export interface AvailablePage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
  picture?: {
    data: {
      url: string;
    };
  };
}

export interface SubscriptionResult {
  success: boolean;
  message?: string;
  error?: string;
  timedOut?: boolean;
  executionTime?: number;
  newCommentsCount?: number;
  totalFetched?: number;
  stats?: {
    totalComments?: number;
    analyzedCount?: number;
    failedCount?: number;
  };
}

export interface SubscriptionStatus {
  /** False when the user never subscribed OR the circuit breaker auto-disabled the page. */
  subscribed: boolean;
  /** Set when comment ingest was auto-disabled after repeated errors (token dead, etc.). */
  autoDisabledAt?: string | null;
  autoDisabledReason?: string | null;
  fetchingHistoricalComments?: boolean;
  appId?: string;
  error?: string;
}

export interface PageSubscriptionStatus {
  pageId: string;
  /** False when the user never subscribed OR the circuit breaker auto-disabled the page. */
  subscribed: boolean;
  autoDisabledAt?: string | null;
  autoDisabledReason?: string | null;
  fetchingHistoricalComments: boolean;
  historicalCommentsFetched: boolean;
  details: {
    database: boolean;
    facebook: boolean;
  };
}

export interface HistoricalFetchStatus {
  id: number;
  pageId: string;
  status: "fetching_posts" | "processing_comments" | "completed" | "failed";
  stage: "fetching_posts" | "processing_comments" | "saving_to_db" | "completed" | "failed";
  totalPostsFetched: number;
  totalBatches: number;
  processedBatches: number;
  totalPosts: number;
  processedPosts: number;
  totalCommentsSaved: number;
  totalCommentsSkipped: number;
  errorMessage: string | null;
  startedAt: string;
  updatedAt: string;
}

export interface SubscribePageParams {
  pageId: string;
  pageAccessToken?: string;
  platform?: "facebook" | "instagram";
  // When provided, the server tries `act_{adAccountId}/promote_pages` first to
  // get a page access_token before falling back to /me/accounts. Useful for
  // pages the user can promote via an ad account but doesn't directly admin.
  adAccountId?: string;
  // Instagram only: the Facebook page the account is linked to. IG webhooks are
  // delivered through that page, and the client already knows which page listed
  // the account, so this saves the server a scan over every reachable page.
  connectedPageId?: string;
}

// ============================================
// Ads Types
// ============================================

export interface AdsFilters {
  search?: string;
  sentiment?: "all" | "positive" | "neutral" | "negative";
  sortBy?: "comments" | "sentiment" | "reactions" | "latestComments" | "spend";
  pageId?: string;
  page?: number;
  limit?: number;
}

export interface Ad {
  postId: string;
  adId: string;
  adName: string;
  totalComments: number;
  avgSentiment: number;
  thumbnailUrl?: string;
  createdAt: string;
  spend?: number;
  spendCurrency?: string;
}

export interface AdsPagination {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalAds: number;
}

export interface AdsData {
  ads: Ad[];
  totalAds: number;
  totalComments: number;
  totalReactions: number;
  pagination?: AdsPagination;
}
export interface AdsResponse {
  success: boolean;
  data: AdsData;
}

export interface AdCommentsResponse {
  comments: Comment[];
  totalComments: number;
  hasMore: boolean;
}

export interface AdCommentsParams {
  postId: string;
  offset?: number;
  limit?: number;
  pageId?: string;
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsFilters {
  // Date strings in YYYY-MM-DD format. The picker always supplies both; if
  // either is missing the server defaults to the last 12 months.
  from?: string;
  to?: string;
  pageId?: string;
  adAccountId?: string;
  /** Meta comments platform; on "instagram", pageId carries the IG account id. */
  platform?: "facebook" | "instagram";
}

export interface StatWithGrowth {
  value: number;
  growth: number;
}

export interface StatWithPercentage {
  value: number;
  percentage: number;
}

export interface StatWithImprovement {
  value: number | string;
  improvement: number;
}

export interface ReactionBreakdown {
  type: string;
  count: number;
}

/** Reply coverage computed over the same filtered set as totalComments. */
export interface ReplyCoverageStats {
  replied: number;
  unreplied: number;
  /** Newest inbound (non-page-authored) comment in the window. */
  lastCommentAt: string | null;
}

export interface AnalyticsStats {
  totalComments: StatWithGrowth;
  avgSentiment: StatWithImprovement;
  positiveComments: StatWithPercentage;
  negativeComments?: StatWithPercentage;
  criticalComments?: StatWithPercentage;
  totalReactions: {
    value: number;
    breakdown: ReactionBreakdown[];
  };
  /** Optional until every CommentsServer deploy returns it. */
  replyCoverage?: ReplyCoverageStats;
}

export interface SentimentDistribution {
  positive: { count: number; percentage: number };
  neutral: { count: number; percentage: number };
  negative: { count: number; percentage: number };
}

export interface AnalyticsCharts {
  sentimentTrend: Array<{ label: string; score: number }>;
  volumeByDay: Array<{ label: string; day: string; count: number }>;
  sentimentDistribution: SentimentDistribution;
  topThemes: Array<{ theme: string; count: number; percentage: number }>;
  adPerformance: Array<{
    name: string;
    comments: number;
    sentiment: number;
    engagement: number;
    postId?: string;
    facebookLink?: string;
    thumbnail?: string;
  }>;
  activityHeatmap: { [day: string]: { [hour: string]: number } };
  // Legacy fields for backwards compatibility
  commentsOverTime?: Array<{ date: string; count: number }>;
  themeBreakdown?: Array<{ theme: string; count: number }>;
}

export interface AnalyticsResponse {
  stats: AnalyticsStats;
  charts: AnalyticsCharts;
}
