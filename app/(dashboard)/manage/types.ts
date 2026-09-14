import type { TwSkippedReason } from "@/lib/triplewhale/types";

/**
 * Metrics for a single Facebook custom conversion event column.
 * Keyed by the custom conversion ID in the parent `customEventMetrics` map.
 */
export interface CustomConversionMetric {
  count: number;
  costPer: number;
}

/**
 * Campaign data structure returned from BigQuery
 */
export interface CampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  /** True when this row was rendered structure-first; spend/metric cells are still loading. */
  metricsPending?: boolean;
  spend: number;
  currency?: string;
  budget?: number;
  results?: number;
  // Optional fields from schema
  account_id?: string;
  bid_strategy?: string;
  boosted_object_id?: string;
  budget_remaining?: number;
  buying_type?: string;
  effective_status?: string;
  issues_info?: any;
  lifetime_budget?: number;
  objective?: string;
  smart_promotion_type?: string;
  special_ad_category?: string;
  spend_cap?: number;
  dailyBudget?: number;
  createdTime?: string;
  updated_time?: string;
  impressions?: number;
  clicks?: number;
  reach?: number;
  frequency?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  shopClicks?: number;
  cpcLinkClick?: number;
  ctrLinkClick?: number;
  appLandingPageViews?: number;
  websiteLandingPageViews?: number;
  costPerLandingPageView?: number;
  lastSignificantEdit?: string | null;
  qualityRanking?: string | null;
  engagementRateRanking?: string | null;
  conversionRateRanking?: string | null;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  purchaseCostPer?: number;
  purchaseCr?: number;
  averageOrderValue?: number;
  // Additional action types for objective-based results
  linkClicks?: number;
  landingPageViews?: number;
  leads?: number;
  leadsCostPer?: number;
  contacts?: number;
  contactsCostPer?: number;
  postEngagements?: number;
  videoViews?: number;
  videoP25Watched?: number;
  videoP50Watched?: number;
  videoP75Watched?: number;
  videoP100Watched?: number;
  videoP25CostPer?: number;
  videoP50CostPer?: number;
  videoP75CostPer?: number;
  videoP100CostPer?: number;
  appInstalls?: number;
  registrations?: number;
  addToCart?: number;
  viewContent?: number;
  viewContentCostPer?: number;
  // Meta native result fields (from ads_insights.results and ads_insights.cost_per_result)
  metaResults?: number;
  metaCostPerResult?: number;
  metaResultIndicator?: string;
  /** Dominant child ad set custom_event_type used for zero-result campaign labels. */
  customEventType?: string | null;
  // Calculated result fields (computed in API based on objective)
  resultCount?: number;
  costPerResult?: number;
  resultType?: string;
  // Attribution setting from ads_insights (e.g. "7d_click, 1d_view")
  attributionSetting?: string;
  /** Keyed by Facebook custom conversion ID; populated when custom event columns are enabled. */
  customEventMetrics?: Record<string, CustomConversionMetric>;
  /** True when an ad was just launched into this campaign — used to hoist + tag the row. */
  _pendingLaunchTarget?: boolean;
  /** True when this campaign was just created from the Create dialog — shows a "Just launched" pill until real data arrives. */
  _pendingLaunch?: boolean;
}

/**
 * Ad Set data structure returned from BigQuery
 */
export interface AdSetData {
  adsetId: string;
  adsetName: string;
  campaignName: string;
  campaignId: string;
  status: string;
  /** True when this row was rendered structure-first; spend/metric cells are still loading. */
  metricsPending?: boolean;
  spend: number;
  currency?: string;
  budget?: number;
  results?: number;
  effective_status?: string;
  /** Delivery status of the parent campaign, for the "Campaign delivery" filter. */
  campaignEffectiveStatus?: string | null;
  // Optional fields
  bidStrategy?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  lifetime_budget?: number;
  createdTime?: string;
  impressions?: number;
  clicks?: number;
  reach?: number;
  frequency?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  shopClicks?: number;
  cpcLinkClick?: number;
  ctrLinkClick?: number;
  appLandingPageViews?: number;
  websiteLandingPageViews?: number;
  costPerLandingPageView?: number;
  lastSignificantEdit?: string | null;
  qualityRanking?: string | null;
  engagementRateRanking?: string | null;
  conversionRateRanking?: string | null;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  purchaseCostPer?: number;
  purchaseCr?: number;
  averageOrderValue?: number;
  // Additional action types for objective-based results
  linkClicks?: number;
  landingPageViews?: number;
  leads?: number;
  leadsCostPer?: number;
  contacts?: number;
  contactsCostPer?: number;
  postEngagements?: number;
  videoViews?: number;
  videoP25Watched?: number;
  videoP50Watched?: number;
  videoP75Watched?: number;
  videoP100Watched?: number;
  videoP25CostPer?: number;
  videoP50CostPer?: number;
  videoP75CostPer?: number;
  videoP100CostPer?: number;
  appInstalls?: number;
  registrations?: number;
  addToCart?: number;
  viewContent?: number;
  viewContentCostPer?: number;
  objective?: string;
  /** Ad set `promoted_object.custom_event_type` (e.g. SCHEDULE for pixel schedule conversions). */
  customEventType?: string | null;
  /** Insights action sum for `offsite_conversion.fb_pixel_schedule` when optimizing for Schedule. */
  offsiteSchedule?: number;
  // Meta native result fields (from ads_insights.results and ads_insights.cost_per_result)
  metaResults?: number;
  metaCostPerResult?: number;
  metaResultIndicator?: string;
  // Calculated result fields (computed in API based on objective)
  resultCount?: number;
  costPerResult?: number;
  resultType?: string;
  // Attribution setting from ads_insights (e.g. "7d_click, 1d_view")
  attributionSetting?: string;
  /** Keyed by Facebook custom conversion ID; populated when custom event columns are enabled. */
  customEventMetrics?: Record<string, CustomConversionMetric>;
  /** True when an ad was just launched into this ad set — used to hoist + tag the row. */
  _pendingLaunchTarget?: boolean;
  /** True when this ad set was just created from the Create dialog — shows a "Just launched" pill until real data arrives. */
  _pendingLaunch?: boolean;
  /** True when this ad set was just created from the Duplicate dialog — shows a "Just duplicated" pill until real data arrives. */
  _pendingDuplicate?: boolean;
}

export interface AdManageLaunchInfo {
  assetId: number | null;
  assetName?: string | null;
  assetUser?: string | null;
  assetDateAdded?: string | null;
  assetThumbnailUrl?: string | null;
  launchedAt?: string | null;
  uploadedAt?: string | null;
  businessId?: string | null;
  adsetId?: string | null;
  adGroupName?: string | null;
  creativeId?: string | null;
  batchId?: number | null;
  batchSlug?: string | null;
  batchUser?: string | null;
  batchDateAdded?: string | null;
  catalogId?: string | null;
  catalogName?: string | null;
  productSetId?: string | null;
  productSetName?: string | null;
  createProjectId?: string | null;
  matchingAssetCount?: number;
}

/**
 * Ad data structure returned from BigQuery
 */
export interface AdData {
  adId: string;
  adName: string;
  adsetName: string;
  adsetId: string;
  campaignName: string;
  campaignId: string;
  status: string;
  /** True when this row was rendered structure-first; spend/metric cells are still loading. */
  metricsPending?: boolean;
  spend: number;
  currency?: string;
  budget?: number;
  bidStrategy?: string;
  results?: number;
  effective_status?: string;
  /** Delivery status of the parent campaign, for the "Campaign delivery" filter. */
  campaignEffectiveStatus?: string | null;
  /** Delivery status of the parent ad set, for the "Ad set delivery" filter. */
  adsetEffectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  creativeId?: string | null;
  launchedViaAdManage?: boolean;
  admanageAssetIds?: number[];
  admanageLaunchInfo?: AdManageLaunchInfo;
  // Source ad ID for tracking duplicated ads (used for optimistic UI updates)
  sourceAdId?: string;
  // Optional fields
  updatedTime?: string;
  createdTime?: string;
  impressions?: number;
  clicks?: number;
  reach?: number;
  frequency?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  shopClicks?: number;
  cpcLinkClick?: number;
  ctrLinkClick?: number;
  appLandingPageViews?: number;
  websiteLandingPageViews?: number;
  costPerLandingPageView?: number;
  lastSignificantEdit?: string | null;
  qualityRanking?: string | null;
  engagementRateRanking?: string | null;
  conversionRateRanking?: string | null;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  purchaseCostPer?: number;
  purchaseCr?: number;
  averageOrderValue?: number;
  assetFeedSpec?: string | null;
  objectStorySpec?: string | null;
  degreesOfFreedomSpec?: string | null;
  creativeEnhancements?: "on" | "off" | "unknown";
  aiMediaSelfDisclosure?: "on" | "off" | "unknown";
  websiteDestinationOptimization?: "on" | "off" | "unknown";
  multiAdvertiser?: "on" | "off" | "unknown";
  shopDestination?: "on" | "off" | "unknown";
  // Additional action types for objective-based results
  linkClicks?: number;
  landingPageViews?: number;
  leads?: number;
  leadsCostPer?: number;
  contacts?: number;
  contactsCostPer?: number;
  postEngagements?: number;
  videoViews?: number;
  videoP25Watched?: number;
  videoP50Watched?: number;
  videoP75Watched?: number;
  videoP100Watched?: number;
  videoP25CostPer?: number;
  videoP50CostPer?: number;
  videoP75CostPer?: number;
  videoP100CostPer?: number;
  appInstalls?: number;
  registrations?: number;
  addToCart?: number;
  viewContent?: number;
  viewContentCostPer?: number;
  objective?: string;
  // Meta native result fields (from ads_insights.results and ads_insights.cost_per_result)
  metaResults?: number;
  metaCostPerResult?: number;
  metaResultIndicator?: string;
  // Calculated result fields (computed in API based on objective)
  resultCount?: number;
  costPerResult?: number;
  resultType?: string;
  // Attribution setting from ads_insights (e.g. "7d_click, 1d_view")
  attributionSetting?: string;
  /** Keyed by Facebook custom conversion ID; populated when custom event columns are enabled. */
  customEventMetrics?: Record<string, CustomConversionMetric>;
  /** True when this row is a placeholder for an ad just launched but not yet indexed by Meta. */
  _pendingLaunch?: boolean;
  /** Video URL fallback set on placeholder rows when no static thumbnail is available. */
  videoUrl?: string | null;
}

/**
 * Union type for all entity types
 */
export type EntityData = CampaignData | AdSetData | AdData;

/**
 * Entity type for tab selection
 */
export type EntityType = "campaigns" | "adsets" | "ads" | "splitTests";

export type ManageChatEntityType = "campaign" | "adset" | "ad";

export interface ManageChatEntityRequest {
  readonly entityType: ManageChatEntityType;
  readonly entityId: string;
  readonly entityName: string;
  readonly accountId?: string | null;
  readonly parentCampaignId?: string | null;
  readonly parentCampaignName?: string | null;
  readonly parentAdsetId?: string | null;
  readonly parentAdsetName?: string | null;
  readonly status?: string | null;
}

/**
 * API response for manage endpoints
 */
export interface ManageApiResponse {
  success: boolean;
  data?: EntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  dataSource?: "bigquery" | "facebook_api" | string | null;
  queryTimeMs?: number;
  error?: string;
  errorCode?: "TOKEN_ERROR" | string;
  /** Set by the server when `skipInsights=true`; rows carry structure only, metrics pending. */
  metricsPending?: boolean;
  /**
   * Why Triple Whale columns came back empty, when any were requested.
   *
   * Absent when the merge succeeded or no Triple Whale column was on. Without
   * this the client cannot distinguish "not connected" from "connected but this
   * ad isn't tracked" — both render as blank cells.
   */
  northbeamStatus?: string | null;
  tripleWhaleStatus?: TwSkippedReason | null;
}

/**
 * Filtering options for manage queries
 */
export interface ManageFilters {
  campaignIds?: string[];
  adsetIds?: string[];
  adIds?: string[];
}

/**
 * TikTok Campaign data structure
 */
export interface TikTokCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  /**
   * TikTok's `secondary_status` for campaigns. Encodes the effective
   * delivery state — `CAMPAIGN_STATUS_DELIVERY_OK` means actively spending,
   * other values describe why it isn't (paused, deleted, audit, etc.).
   * `operation_status` only reflects the user-toggle and can lie about
   * effective delivery for hierarchical reasons (rare for campaigns since
   * they're the top of the tree, but kept for symmetry with ad groups + ads).
   */
  secondaryStatus?: string;
  spend: number;
  objective?: string;
  automationType?: string; // SMART_PLUS, UPGRADED_SMART_PLUS
  budget?: number;
  budgetMode?: string; // BUDGET_MODE_DAY or BUDGET_MODE_TOTAL
  currency?: string;
  createdTime?: string;
  // Metrics from report API
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  conversions?: number;
  costPerConversion?: number;
  conversionRate?: number;
}

/**
 * TikTok Ad Group data structure (equivalent to Ad Sets in Facebook)
 */
export interface TikTokAdGroupData {
  adgroupId: string;
  adgroupName: string;
  campaignName: string;
  campaignId: string;
  status: string;
  /**
   * TikTok's `secondary_status` — the actual delivery state with hierarchy
   * info baked in. Values like `ADGROUP_STATUS_CAMPAIGN_DISABLE` mean the
   * ad group is paused because its parent campaign is off, even though
   * `operation_status` is still ENABLE.
   */
  secondaryStatus?: string;
  spend: number;
  smartCreative?: boolean;
  promotionType?: string;
  automationType?: string;
  budget?: number;
  budgetMode?: string; // BUDGET_MODE_DAY or BUDGET_MODE_TOTAL
  currency?: string;
  createdTime?: string;
  // Metrics from report API
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  conversions?: number;
  costPerConversion?: number;
  conversionRate?: number;
}

/**
 * One creative variant under a Smart+ ad. Powers the expandable sub-rows
 * on the manage page (`tab=ads`).
 */
export interface TikTokAdCreative {
  creativeId: string;
  videoId?: string;
  tiktokItemId?: string;
  name?: string;
  status?: string;
  thumbnailUrl?: string | null;
  /** Signed mp4 URL for in-browser playback (uploaded videos only). */
  videoUrl?: string | null;
}

/**
 * TikTok Ad data structure
 */
export interface TikTokAdData {
  adId: string;
  /**
   * Parent Smart+ asset group ID. Upgraded Smart+ ads surface in /ad/get/ as
   * multiple child rows that share one parent — operations on the Smart+ ad
   * (Creative+ toggle, material enable/disable, etc.) target this parent.
   * Null/undefined for regular non-Smart+ ads.
   */
  smartPlusAdId?: string | null;
  /**
   * **Sub-rows only.** Set on a creative sub-row to let the per-creative
   * On/Off toggle know which Smart+ parent + material to target. On top-level
   * ad rows these are undefined and the parent-level status toggle fires
   * instead.
   */
  adMaterialId?: string;
  parentSmartPlusAdId?: string;
  /**
   * **Sub-rows only.** The creative's own `material_operation_status`
   * (`ENABLE` / `DISABLE`). Independent from the parent ad's `status` and
   * drives the per-creative On/Off toggle. On top-level ad rows this is
   * undefined.
   */
  materialStatus?: string;
  adName: string;
  adgroupName: string;
  adgroupId: string;
  campaignName: string;
  campaignId: string;
  status: string;
  /**
   * TikTok's `secondary_status` — encodes parent-pause state. Values like
   * `AD_STATUS_CAMPAIGN_DISABLE` / `AD_STATUS_ADGROUP_DISABLE` mean the ad
   * is dark because an ancestor is off, even though its own `operation_status`
   * is ENABLE.
   */
  secondaryStatus?: string;
  spend: number;
  isSmartCreative?: boolean;
  automationType?: string;
  currency?: string;
  createdTime?: string;
  thumbnailUrl?: string | null;
  launchedViaAdManage?: boolean;
  admanageAssetIds?: number[];
  admanageLaunchInfo?: AdManageLaunchInfo;
  /** Signed mp4 URL for in-browser playback in the preview dialog. Set for
   * uploaded videos (regular `ad.video_id` and Smart+ uploaded creatives).
   * Null for image-only ads and Spark Ads (which use the oEmbed iframe). */
  videoUrl?: string | null;
  tiktokItemId?: string | null;
  /** Smart+ ads can carry multiple creatives. Empty/undefined for single-creative or non-Smart+ ads. */
  creatives?: TikTokAdCreative[];
  // Metrics from report API
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  conversions?: number;
  costPerConversion?: number;
  conversionRate?: number;
}

/**
 * Union type for all TikTok entity types
 */
export type TikTokEntityData = TikTokCampaignData | TikTokAdGroupData | TikTokAdData;

/**
 * TikTok entity type for tab selection
 */
export type TikTokEntityType = "campaigns" | "adgroups" | "ads";

/**
 * API response for TikTok manage endpoints
 */
export interface TikTokManageApiResponse {
  success: boolean;
  data?: TikTokEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Filtering options for TikTok manage queries
 */
export interface TikTokManageFilters {
  campaignIds?: string[];
  adgroupIds?: string[];
}

/**
 * TikTok Comment data structure from v1.3 API
 */
export interface TikTokCommentData {
  commentId: string;
  content: string;
  likes: number;
  replies: number;
  commentType: "COMMENT" | "REPLY";
  commentStatus: "HIDDEN" | "PUBLIC";
  createTime: string;
  adId: string;
  adName: string;
  adgroupId: string;
  adgroupName: string;
  campaignId: string;
  campaignName: string;
  isPinned: boolean;
  canDelete: boolean;
  userName?: string;
  userId?: string;
  userAvatarUrl?: string;
  videoPlayUrl?: string;
  videoCoverUrl?: string;
  originalCommentId?: string;
  tiktokItemId?: string;
  hitBlockedWord?: boolean;
}

/**
 * API response for TikTok comments endpoint
 */
export interface TikTokCommentsApiResponse {
  success: boolean;
  data?: TikTokCommentData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Snapchat Campaign data structure
 */
export interface SnapchatCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  objective?: string;
  budget?: number;
  currency?: string;
  createdTime?: string;
  startTime?: string;
  endTime?: string;
  impressions?: number;
  result?: number;
  resultType?: string;
  costPerResult?: number;
}

/**
 * Snapchat Ad Squad data structure (equivalent to Ad Sets in Facebook)
 */
export interface SnapchatAdSquadData {
  adsquadId: string;
  adsquadName: string;
  campaignName: string;
  campaignId: string;
  status: string;
  spend: number;
  optimizationGoal?: string;
  billingEvent?: string;
  budget?: number;
  currency?: string;
  createdTime?: string;
  impressions?: number;
  result?: number;
  resultType?: string;
  costPerResult?: number;
}

/**
 * Snapchat Ad data structure
 */
export interface SnapchatAdData {
  adId: string;
  adName: string;
  adsquadName: string;
  adsquadId: string;
  campaignName: string;
  campaignId: string;
  status: string;
  spend: number;
  currency?: string;
  createdTime?: string;
  thumbnailUrl?: string | null;
  impressions?: number;
  result?: number;
  resultType?: string;
  costPerResult?: number;
  /** Raw Snapchat ad/creative `type` enum (e.g. `SNAP_AD`); humanized for display via formatSnapchatAdType. */
  adType?: string | null;
}

/**
 * Union type for all Snapchat entity types
 */
export type SnapchatEntityData = SnapchatCampaignData | SnapchatAdSquadData | SnapchatAdData;

/**
 * Snapchat entity type for tab selection
 */
export type SnapchatEntityType = "campaigns" | "adsquads" | "ads";

/**
 * API response for Snapchat manage endpoints
 */
export interface SnapchatManageApiResponse {
  success: boolean;
  data?: SnapchatEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Filtering options for Snapchat manage queries
 */
export interface SnapchatManageFilters {
  campaignIds?: string[];
  adsquadIds?: string[];
}

/**
 * Ad creative edit types
 */
export type AdCreativeType = "multi" | "single" | "unknown";

export type AdCopyField = "body" | "title" | "description" | "url" | "url_tags";

export type CopyMode = "replace" | "append" | "prepend";

/**
 * Text variation for ad creative
 */
export interface TextVariation {
  text: string;
  index: number;
}

/**
 * Ad creative with edit-friendly structure
 */
export interface EditableAdCreative {
  id: string;
  name?: string;
  type: AdCreativeType;
  bodies: TextVariation[];
  titles: TextVariation[];
  descriptions: TextVariation[];
  urls: string[];
  urlTags?: string;
  asset_feed_spec?: any;
  object_story_spec?: any;
}

/**
 * Update ad creative request payload
 */
export interface UpdateAdCreativeRequest {
  adId: string;
  accountId: string;
  type: AdCopyField;
  index: number;
  newValue: string;
}

/**
 * Bulk update ad copy request payload
 */
export interface BulkUpdateAdCopyRequest {
  adIds: string[];
  accountId: string;
  copyValues: {
    primaryText1?: string;
    primaryText2?: string;
    primaryText3?: string;
    primaryText4?: string;
    primaryText5?: string;
    headline1?: string;
    headline2?: string;
    headline3?: string;
    headline4?: string;
    headline5?: string;
    description1?: string;
    description2?: string;
    description3?: string;
    description4?: string;
    description5?: string;
    url?: string;
    urlTags?: string;
    cta?: string;
    adName?: string;
    creativeEnhancements?: "on" | "off";
    creativeEnhancementFeatures?: Record<string, "OPT_IN" | "OPT_OUT">;
    websiteDestinationOptimization?: "on" | "off";
    multiAdvertiser?: "on" | "off";
    shopDestination?: "on" | "off";
    aiMediaSelfDisclosure?: boolean;
  };
  mode?: CopyMode;
}

/**
 * Update response
 */
export interface UpdateResponse {
  success: boolean;
  newCreativeId?: string;
  message?: string;
  error?: string;
}

/**
 * Bulk update response
 */
export interface BulkUpdateResponse {
  success: boolean;
  results: Array<{
    adId: string;
    success: boolean;
    error?: string;
  }>;
  successCount: number;
  failCount: number;
}

/**
 * Axon Campaign data structure (from Axon Campaign Management API)
 */
export interface AxonCampaignData {
  campaignId: string;
  campaignName: string;
  hashedId: string;
  status: "LIVE" | "PAUSED" | "COMPLETED" | "DELETED";
  type: string;
  dailyBudget?: number;
  goalType?: string;
  goalValue?: number;
  roasDayTarget?: string;
  biddingStrategy?: string;
  countries?: string[];
  websiteUrl?: string;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  isDynamicAdsEnabled?: boolean;
  currency?: string;
}

/**
 * Axon Creative Set data structure (from Axon Campaign Management API)
 */
export interface AxonCreativeSetData {
  creativeSetId: string;
  hashedId: string;
  name: string;
  campaignId: string;
  campaignName?: string;
  status: "LIVE" | "PAUSED" | "DELETED";
  type: string;
  countries?: string[];
  websiteUrl?: string;
  assetCount?: number;
  createdAt?: string;
}

/**
 * A single asset belonging to an Axon creative set, as returned by the
 * full-detail read endpoint (`/creative_set/list_by_campaign_id`). Unlike the
 * list view (which exposes only `assetCount`), each asset carries its review
 * `status` so an edit form can show which assets are IN_REVIEW / REJECTED /
 * ACTIVE before the user submits a change.
 */
export interface AxonCreativeSetAsset {
  id: string;
  /** Raw Axon per-asset review status (e.g. "IN_REVIEW" | "REJECTED" | "ACTIVE"); "" when upstream omitted it. */
  status: string;
  /** Raw Axon `asset_type` (e.g. "VID_LONG_P", "HOSTED_HTML"); undefined when upstream omitted it. */
  assetType?: string;
  /**
   * Resolved playback/preview URL (ADM-8068), enriched from the account asset
   * list so the edit composer renders a real thumbnail. "" when the asset id
   * wasn't found in the account list.
   */
  url: string;
  /** Resolved human-readable filename (ADM-8068); "" when unresolved. */
  name: string;
}

/**
 * Full-detail Axon creative set (ADM-8068). Extends the list-view
 * {@link AxonCreativeSetData} with the per-asset detail the edit form needs to
 * prefill: the resolved `assets[]` (with per-asset review status) and language
 * targeting. Returned by `GET /api/manage/axon/creativeset`.
 */
export interface AxonCreativeSetDetail extends AxonCreativeSetData {
  /** Member assets in their original set order, each with its review status. */
  assets: AxonCreativeSetAsset[];
  /** Language targeting codes (e.g. ["en", "fr"]); empty/omitted means ALL languages. */
  languages?: string[];
}

/**
 * Camelcase request contract for editing an existing Axon creative set in place
 * (ADM-8068) via `POST /api/manage/axon/update-creativeset`. `businessId`,
 * `campaignId` and `creativeSetId` identify the target; every other field is an
 * optional edit — omitted fields keep their current value (read-merge-write).
 *
 * Field semantics mirror the launcher's create mapping:
 * - `assets` is a full replacement of the set's asset-id list (order preserved).
 * - empty `countries` / `languages` means ALL (the field is omitted on the wire).
 * - `creativeSetUrl` is dropped for APP-type sets (Axon has no URL field there).
 */
export interface AxonUpdateCreativeSetRequest {
  businessId: string;
  workspaceId?: string;
  campaignId: string;
  creativeSetId: string;
  name?: string;
  /** Full replacement asset-id list (not a delta). Order is preserved. */
  assets?: string[];
  /** Country targeting codes; empty array means ALL countries. */
  countries?: string[];
  /** Language targeting codes; empty array means ALL languages. */
  languages?: string[];
  creativeSetUrl?: string;
  status?: Extract<AxonCreativeSetData["status"], "LIVE" | "PAUSED">;
}

/**
 * Union type for all Axon entity types
 */
export type AxonEntityData = AxonCampaignData | AxonCreativeSetData;

/**
 * Axon entity type for tab selection (Campaigns and Creative Sets only)
 */
export type AxonEntityType = "campaigns" | "creativesets";

/**
 * API response for Axon manage endpoints
 */
export interface AxonManageApiResponse {
  success: boolean;
  data?: AxonEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
  /** Machine-readable manage-list failure code when `success` is false. */
  errorCode?: "upstream_error" | "timeout" | "request_failed" | "parse_error";
  /** AppLovin `x-al-error-code` when upstream returned one. */
  axonErrorCode?: string | null;
  /** False for auth/client failures that should not be auto-retried. */
  retryable?: boolean;
}

/**
 * Filtering options for Axon manage queries
 */
export interface AxonManageFilters {
  campaignIds?: string[];
  status?: string[];
}

/**
 * Pinterest Campaign data structure
 */
export interface PinterestCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  budget?: number;
  dailyBudget?: number;
  currency?: string;
  objective?: string;
  createdTime?: string;
}

/**
 * Pinterest Ad Group data structure
 */
export interface PinterestAdGroupData {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  budget?: number;
  currency?: string;
  createdTime?: string;
}

/**
 * Pinterest Ad data structure
 */
export interface PinterestAdData {
  importMedia?: import("@/lib/pinterest/existing-ad-media").PinterestImportMedia;
  adId: string;
  adName: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  pinId?: string;
  thumbnailUrl?: string | null;
  creativeType?: string;
  createdTime?: string;
  currency?: string;
  destinationUrl?: string | null;
  callToAction?: string | null;
  /** True when this ad was matched to an AdManage launch batch — drives the launch badge. */
  launchedViaAdManage?: boolean;
  admanageAssetIds?: number[];
  admanageLaunchInfo?: AdManageLaunchInfo;
}

/**
 * Union type for all Pinterest entity types
 */
export type PinterestEntityData = PinterestCampaignData | PinterestAdGroupData | PinterestAdData;

/**
 * Pinterest entity type for tab selection
 */
export type PinterestEntityType = "campaigns" | "adgroups" | "ads";

/**
 * API response for Pinterest manage endpoints
 */
export interface PinterestManageApiResponse {
  success: boolean;
  data?: PinterestEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Filtering options for Pinterest manage queries
 */
export interface PinterestManageFilters {
  campaignIds?: string[];
  adGroupIds?: string[];
  /** Exact ad IDs to scope the ads tab to — preferred over adGroupIds, like Meta's selected ad IDs. */
  adIds?: string[];
}

/**
 * Reddit Campaign data structure
 */
export interface RedditCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  effectiveStatus?: string | null;
  objective?: string | null;
  isMax?: boolean | null;
  startTime?: string | null;
  endTime?: string | null;
  createdTime?: string | null;
}

/**
 * Reddit Ad Group data structure
 */
export interface RedditAdGroupData {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  effectiveStatus?: string | null;
  isMax?: boolean | null;
  optimizationGoal?: string | null;
  bidType?: string | null;
  bidValue?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  createdTime?: string | null;
}

/**
 * Reddit Ad data structure
 */
export interface RedditAdData {
  adId: string;
  adName: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  effectiveStatus?: string | null;
  isMax?: boolean | null;
  adType?: string | null;
  clickUrl?: string | null;
  createdTime?: string | null;
  postId?: string | null;
  thumbnail?: string | null;
}

/**
 * Union type for all Reddit entity types
 */
export type RedditEntityData = RedditCampaignData | RedditAdGroupData | RedditAdData;

/**
 * Reddit entity type for tab selection
 */
export type RedditEntityType = "campaigns" | "adgroups" | "ads";

/**
 * API response for Reddit manage endpoints
 */
export interface RedditManageApiResponse {
  success: boolean;
  data?: RedditEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
  errorCode?: "TOKEN_ERROR" | string;
}

/**
 * Filtering options for Reddit manage queries
 */
export interface RedditManageFilters {
  campaignIds?: string[];
  adGroupIds?: string[];
}

/** Performance metrics for an X Ads entity (spend in the account's local currency units). */
export interface XMetrics {
  impressions: number;
  engagements: number;
  clicks: number;
  urlClicks: number;
  spend: number;
  videoViews: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

/** X Ads campaign row (mirrors api-admanage `XCampaignRow`). */
export interface XCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  servable?: boolean | null;
  dailyBudgetMicro?: number | null;
  totalBudgetMicro?: number | null;
  currency?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  createdTime?: string | null;
  metrics: XMetrics;
}

/** X Ads ad group (line item) row (mirrors api-admanage `XAdGroupRow`). */
export interface XAdGroupData {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  objective?: string | null;
  productType?: string | null;
  placements?: string[] | null;
  bidMicro?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  createdTime?: string | null;
  metrics: XMetrics;
}

/** X Ads ad (promoted tweet) row (mirrors api-admanage `XAdRow`). */
export interface XAdData {
  adId: string;
  adName: string;
  tweetId?: string | null;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  approvalStatus?: string | null;
  text?: string | null;
  thumbnail?: string | null;
  mediaType?: "image" | "video" | null;
  createdTime?: string | null;
  metrics: XMetrics;
}

export type XEntityData = XCampaignData | XAdGroupData | XAdData;

/** X entity type for tab selection. */
export type XEntityType = "campaigns" | "adgroups" | "ads";

/** API response for X manage endpoints. */
export interface XManageApiResponse {
  success: boolean;
  data?: XEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
  errorCode?: "TOKEN_ERROR" | string;
}

/** Filtering options for X manage queries. */
export interface XManageFilters {
  campaignIds?: string[];
  adGroupIds?: string[];
}

/**
 * Taboola campaign data structure returned from the manage API.
 */
export interface TaboolaCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  approvalState?: string | null;
  brandingText?: string | null;
  marketingObjective?: string | null;
  bidStrategy?: string | null;
  bidCpc?: number | null;
  spendingLimit?: number | null;
  spendingLimitModel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  reportCpc?: number | null;
}

/**
 * Taboola item/ad data structure returned from the manage API.
 */
export interface TaboolaAdData {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  approvalState?: string | null;
  url?: string | null;
  displayUrl?: string | null;
  thumbnailUrl?: string | null;
  cta?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpc?: number | null;
}

/**
 * Union type for all Taboola entity types.
 */
export type TaboolaEntityData = TaboolaCampaignData | TaboolaAdData;

/**
 * Taboola entity type for tab selection.
 */
export type TaboolaEntityType = "campaigns" | "ads";

/**
 * API response for Taboola manage endpoints.
 */
export interface TaboolaManageApiResponse {
  success: boolean;
  data?: TaboolaEntityData[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  meta?: {
    actualAccountId?: string;
    managerAccountId?: string;
    reportStartDate?: string;
    reportEndDate?: string;
  };
  error?: string;
  errorCode?: "TOKEN_ERROR" | string;
}

/**
 * Meta Pixel data (for Create Ad Set / conversion tracking)
 */
export interface PixelData {
  id: string;
  name: string;
  last_fired_time?: string;
}

/**
 * Meta Custom Audience data (for Create Ad Set targeting)
 */
export interface CustomAudienceData {
  id: string;
  name: string;
  subtype?: string;
  approximate_count?: number;
}

/**
 * Meta Interest targeting data (for Create Ad Set targeting)
 */
export interface InterestData {
  id: string;
  name: string;
  /** Meta detailed targeting segment type, e.g. interests, education_majors, behaviors. */
  type?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
}

// ─── Traffic Campaign (OUTCOME_TRAFFIC) Ad Set Types ────────────────────────

/** Meta destination_type values for OUTCOME_TRAFFIC ad sets */
export type TrafficDestinationType =
  | "WEBSITE"
  | "APP"
  | "MESSENGER"
  | "WHATSAPP"
  | "MESSAGING_INSTAGRAM_DIRECT_MESSENGER"
  | "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP"
  | "INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE"
  | "PHONE_CALL";

/** Conversion location keys used in our UI (maps to destination_type) */
export type TrafficConversionLocationKey =
  | "WEBSITE"
  | "APP"
  | "MESSAGE_DESTINATIONS"
  | "INSTAGRAM_OR_FACEBOOK"
  | "CALLS";

/** Optimization goals valid for traffic ad sets */
export type TrafficOptimizationGoal = "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | "REACH" | "CONVERSATIONS";

export interface TrafficConversionLocationConfig {
  value: TrafficConversionLocationKey;
  label: string;
  description: string;
  destinationType: TrafficDestinationType;
  /** Which optimization goals are valid for this location */
  allowedOptimizationGoals: readonly TrafficOptimizationGoal[];
}

// ─── Sales Campaign (OUTCOME_SALES) Ad Set Types ────────────────────────────

/** Sales destination keys for OUTCOME_SALES ad sets (per Meta: WEBSITE, MESSENGER, PHONE_CALL, multi-destination) */
export type SalesDestinationLocationKey = "CONVERSIONS" | "WEBSITE_AND_PHONE_CALL" | "MESSAGE_DESTINATIONS" | "CALLS";
