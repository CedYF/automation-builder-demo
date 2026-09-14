// ============================================
// API Layer - Central Export
// ============================================

// Base client and utilities
export { apiClient, ApiError, AuthenticationError, TokenEncryptionError } from "../../_lib/api/client";

// Domain-specific APIs
export { commentsApi } from "./comments";
export { pagesApi } from "./pages";
export { adsApi } from "./ads";
export { analyticsApi } from "./analytics";
export { automationApi } from "./automation";
export { overviewApi } from "./overview";
export { messagingApi } from "./messaging";
export * as pendingRepliesApi from "./pendingReplies";

// Types
export type {
  // Common
  ApiResponse,
  PaginationInfo,

  // Comments
  Comment,
  ReplyComment,
  ReactionCounts,
  CommentsFilters,
  CommentsResponse,
  AdForComments,
  AdsForCommentsResponse,
  DeleteCommentParams,
  HideCommentParams,
  ReplyCommentParams,
  GenerateAiReplyParams,
  GenerateAiReplyResponse,

  // Pages
  Page,
  AvailablePage,
  SubscribePageParams,
  SubscriptionResult,
  SubscriptionStatus,
  PageSubscriptionStatus,

  // Ads
  Ad,
  AdsFilters,
  AdsResponse,

  // Analytics
  AnalyticsFilters,
  AnalyticsStats,
  AnalyticsCharts,
  AnalyticsResponse,
  SentimentDistribution,
  StatWithGrowth,
  StatWithPercentage,
  StatWithImprovement,
  ReactionBreakdown,
} from "./types";

// Automation types
export type {
  AutomationRule,
  AutomationConditions,
  AutomationActionConfig,
  CreateRuleParams,
  UpdateRuleParams,
  ExecuteRuleParams,
  ExecuteRuleResult,
  ProcessedComment,
} from "./automation";

// Pending Reply types
export type {
  PendingReply,
  PendingReplyStatus,
  PendingRepliesResponse,
  PendingReplyCountsResponse,
  CommentSnapshot,
  BulkActionResult,
} from "../../_features/pending-replies/types";

export type { GetPendingRepliesParams } from "./pendingReplies";

// Account overview types
export type { AccountOverviewData, OverviewPageStats, OverviewSyncRun } from "./overview";
