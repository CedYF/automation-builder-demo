import { apiClient, AuthenticationError } from "../../_lib/api/client";

// ============================================
// Types
// ============================================

/**
 * Why a comment is unwelcome under an ad, judged independently of sentiment.
 * Mirrors `ModerationCategory` in CommentsServer.
 *
 * Deliberately separate from the sentiment score: an objectifying comment
 * ("The jugs on this one are superb!") scores ~90 as enthusiastic praise, so no
 * `sentimentMax` rule can ever catch it.
 */
export type ModerationCategory =
  | "clean"
  | "profanity"
  | "harassment"
  | "hate_speech"
  | "sexual"
  | "violence"
  | "scam"
  // Categorical hostility to AI as a technology ("AI slop", "AI is theft"),
  // not dissatisfaction with an AI product's output, which stays "clean".
  | "anti_ai"
  | "self_harm";

/**
 * What a commenter is trying to do, judged by the intent classifier. Mirrors
 * `CommentIntent` in CommentsServer. `other` and `unknown` exist server-side
 * but are never offered in a rule — see `SELECTABLE_INTENTS`.
 */
export type CommentIntent =
  | "purchase"
  | "price_question"
  | "product_question"
  | "availability_question"
  | "support_request"
  | "complaint"
  | "praise"
  | "tag_friend"
  | "spam_promo"
  | "other"
  | "unknown";

/**
 * A workspace-defined intent the classifier can also assign. `description` and
 * `examples` are what the LLM reads, so they carry the meaning; `id` is a slug
 * of the original name, assigned by the server and stable across renames.
 */
export interface CustomIntent {
  id: string;
  name: string;
  description: string;
  examples?: string[];
}

export interface AutomationConditions {
  /**
   * How the matching conditions combine: "all" (default) needs every condition
   * set on the rule, "any" fires on the first one that holds. Exclusions and
   * scoping (excludeKeywords, excludeAuthorIds, ad/adset/campaign ids,
   * isAdOnly, targetType) always apply on top of either mode.
   */
  matchMode?: "all" | "any";
  sentimentFilter?: "all" | "positive" | "neutral" | "negative";
  sentimentMin?: number;
  sentimentMax?: number;
  /**
   * Match comments whose stored moderation verdict is one of these. Fail-closed:
   * a comment with no verdict, or an `unknown` one, never matches.
   */
  moderationCategories?: ModerationCategory[];
  /**
   * Match comments whose stored intent verdict is one of these built-in
   * intents. Together with `customIntents` this is ONE condition ("intent is
   * any of"): a comment matches when either list hits.
   */
  intents?: CommentIntent[];
  /** Ids of the workspace's custom intents (see {@link CustomIntent}). */
  customIntents?: string[];
  /** Brand stance is judged independently of a comment's sentiment. */
  brandStances?: Array<"undermining" | "critical" | "supportive" | "neutral" | "off_topic">;
  keywords?: string[];
  excludeKeywords?: string[];
  authorIds?: string[];
  excludeAuthorIds?: string[];
  adIds?: string[];
  campaignIds?: string[];
  adsetIds?: string[];
  isAdOnly?: boolean;
  minLikes?: number;
  commenterHistory?: "returning" | "new";
  commentLength?: "short" | "medium" | "long";
  // Restrict matching by thread position. "comment" = top-level only,
  // "reply" = replies only, "all" or omitted = both.
  targetType?: "all" | "comment" | "reply";
}

export interface AutomationActionConfig {
  /** Used only by the demo's simulated Google Sheet export. */
  sheetName?: string;
  replyTemplate?: string;
  useAI?: boolean;
  aiPrompt?: string;
  aiTone?: "friendly" | "professional" | "empathetic";
  // When true on a "reply" action, the rule posts the reply directly to the
  // comment instead of creating an entry in the approval queue.
  autoSend?: boolean;
}

/** Which surface a rule (and its comments) live on. */
export type CommentPlatform = "facebook" | "instagram";

/**
 * What a rule does to a matching comment. Mirrors the CommentsServer
 * `AUTOMATION_ACTION_TYPES` list; every action-keyed map in the UI derives its
 * keys from this union so a new action cannot be silently unhandled.
 */
export type CommentActionType = "hide" | "delete" | "reply" | "like" | "export_sheet";

export interface AutomationRule {
  id: number;
  name: string;
  status: "active" | "paused" | "executing";
  platform?: CommentPlatform;
  triggerType: "realtime" | "scheduled" | "manual";
  conditions: AutomationConditions;
  actionType: CommentActionType;
  actionConfig: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  userId: string;
  company: string;
  workspaceId?: string;
  adAccountId?: string;
  pageId?: string;
  processedCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleParams {
  name: string;
  platform?: CommentPlatform;
  pagePlatforms?: Readonly<Record<string, CommentPlatform>>;
  triggerType: "realtime" | "scheduled" | "manual";
  conditions: AutomationConditions;
  actionType: CommentActionType;
  actionConfig?: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  userId: string;
  company: string;
  workspaceId?: string;
  adAccountId?: string;
  pageIds: string[];
  /**
   * When true, each created rule is also executed once (in the background, on
   * the server) against the comments already stored for its page, so the
   * automation covers history instead of only newly received comments.
   */
  processExisting?: boolean;
}

export interface UpdateRuleParams {
  name?: string;
  status?: "active" | "paused";
  platform?: CommentPlatform;
  triggerType?: "realtime" | "scheduled" | "manual";
  conditions?: AutomationConditions;
  actionType?: CommentActionType;
  actionConfig?: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  pageId?: string;
}

/**
 * One edit applied to every per-page rule of an automation. `pageIds` is the
 * page set the automation should end up covering: CommentsServer patches the
 * pages kept, creates rules for pages added, and deletes those removed.
 */
export interface SyncGroupParams {
  /** Absent while the automation predates group ids; the server assigns one. */
  groupId?: string;
  name?: string;
  status?: "active" | "paused";
  platform?: CommentPlatform;
  triggerType?: "realtime" | "scheduled" | "manual";
  conditions?: AutomationConditions;
  actionType?: CommentActionType;
  actionConfig?: AutomationActionConfig;
  frequency?: string;
  scheduledTime?: string;
  pageIds?: string[];
  pagePlatforms?: Readonly<Record<string, CommentPlatform>>;
}

export interface ExecuteRuleParams {
  // Option 1: Execute on specific comments (used by BulkActionsBar)
  commentIds?: string[];
  // Option 2: Execute on all matching comments for ad account/page
  adAccountId?: string;
  pageId?: string;
  // Required for all executions
  encryptedUserToken: string;
  /**
   * Shared by every page's run started from one builder "Run" click, so
   * History can show them as one run.
   */
  runGroupId?: string;
}

/** Acknowledgement for background (adAccountId/pageId) executions. */
export interface ExecuteRuleStarted {
  status: string;
  ruleId: number;
}

/** Synchronous per-comment outcome when executing on specific commentIds. */
export interface ExecuteRuleOnCommentsResult {
  processed: number;
  success: number;
  failed: number;
  results: Array<{ commentId: string; success: boolean; error?: string }>;
}

export type ExecuteRuleResult = ExecuteRuleStarted | ExecuteRuleOnCommentsResult;

export interface CancelRuleExecutionResult {
  status: string;
  ruleId: number;
}

export interface ProcessedComment {
  id: number;
  ruleId: number;
  commentId: string;
  actionTaken: string;
  result?: string;
  errorMsg?: string;
  replyId?: string;
  runId?: number;
  commentSnapshot?: {
    message?: string;
    authorName?: string;
    authorProfilePicture?: string;
    sentiment?: number;
  };
  processedAt: string;
  /** Source post id (FB post id / IG media id), joined server-side from the synced comment. */
  postId?: string | null;
  /** Permalink to the source post/comment on the platform, when synced. */
  postPermalinkUrl?: string | null;
  /** Page (FB) or IG account that owns the commented post. */
  pageId?: string | null;
}

export interface AutomationRun {
  id: number;
  ruleId: number;
  triggerType: string;
  status: string; // "running", "completed", "failed", "cancelled", "interrupted"
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
  /**
   * Comments Meta would not let the action see — deleted, or the page lost
   * access — counted apart from failures. Optional for back-compat.
   */
  unavailableCount?: number;
  /**
   * Shared by every page's run from one builder "Run" click; null for realtime
   * runs and runs from before it existed. Optional for back-compat.
   */
  runGroupId?: string | null;
}

export interface RuleRunsResponse {
  ruleId: number;
  runs: AutomationRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccountRun extends AutomationRun {
  ruleName: string;
  actionType: string;
  /**
   * Number of processed comments in this run still awaiting approval
   * (drafted replies whose `replyId` is `pending:*`). Drives the
   * "Pending approval" status. Optional for back-compat with responses that
   * don't compute it.
   */
  pendingCount?: number;
  /**
   * Number of processed comments in this run whose drafted reply was discarded
   * (pending reply status `rejected`). Drives the "Discarded" status. Optional
   * for back-compat with responses that don't compute it.
   */
  discardedCount?: number;
  /**
   * Snapshot of the first comment processed in this run (the trigger for
   * realtime runs), so list rows can show the actual comment text instead of
   * just a count. Optional for back-compat; null when no snapshot was stored.
   */
  firstComment?: {
    message?: string;
    authorName?: string;
    authorProfilePicture?: string;
    sentiment?: number;
  } | null;
  /**
   * Page (or IG account) the run's rule watches — an automation is one rule
   * per page, so this names which page a multi-page automation's run was on.
   * Optional for back-compat with responses that predate it.
   */
  pageId?: string | null;
  platform?: "facebook" | "instagram";
  /** Null when the page is no longer connected. */
  pageName?: string | null;
  pagePicture?: string | null;
  /**
   * The first error this run recorded, shown on hover so a failure can be read
   * without opening the run. Absent on responses that predate it.
   */
  errorMessage?: string | null;
  /** Which bucket that error fell in: "failed" or "unavailable". */
  errorResult?: string | null;
}

export interface AccountRunsResponse {
  runs: AccountRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunDetailsResponse {
  run: AutomationRun;
  comments: ProcessedComment[];
  total: number;
  limit: number;
  offset: number;
  /** Platform the rule executes on. Optional for back-compat; defaults to facebook. */
  platform?: "facebook" | "instagram";
  /** Page (or IG account) the rule is scoped to. */
  pageId?: string | null;
  /** Ad account stored on the rule — needed for page-token resolution on comment actions. */
  adAccountId?: string | null;
}

// ============================================
// Automation API
// ============================================

/**
 * Get all automation rules filtered by pageId or adAccountId
 * Priority: pageId > adAccountId (only one is used, not both)
 * @param company - Company identifier (unused, kept for backwards compatibility)
 * @param workspaceId - Optional workspace ID (unused, kept for backwards compatibility)
 * @param adAccountId - Ad account ID to filter by (used if no pageId)
 * @param pageId - Page ID to filter by (takes priority, "all" means use adAccountId instead)
 */
export const getRules = async (
  _company: string,
  _workspaceId?: string,
  adAccountId?: string,
  pageId?: string,
): Promise<AutomationRule[]> => {
  const params: Record<string, string | undefined> = {};

  // Always send adAccountId to scope rules properly
  if (adAccountId) {
    params.adAccountId = adAccountId;
  }

  // Additionally filter by pageId if a specific page is selected
  if (pageId && pageId !== "all") {
    params.pageId = pageId;
  }

  return apiClient.get<AutomationRule[]>("/comment-automation/rules", params);
};

/**
 * Get a single rule by ID
 */
export const getRule = async (ruleId: number): Promise<AutomationRule> => {
  return apiClient.get<AutomationRule>(`/comment-automation/rules/${ruleId}`);
};

/**
 * Create one or more automation rules.
 * Backend creates one rule per pageId in `pageIds` and returns the full array.
 */
export const createRule = async (params: CreateRuleParams, facebookToken: string): Promise<AutomationRule[]> => {
  if (!facebookToken) {
    throw new AuthenticationError("Connect Facebook before creating comment automations.");
  }
  const result = await apiClient.post<AutomationRule[]>(
    "/comment-automation/rules",
    params as unknown as Record<string, unknown>,
    { token: facebookToken, timeoutMs: null },
  );

  return result;
};

/**
 * Update an automation rule
 */
export const updateRule = async (ruleId: number, params: UpdateRuleParams): Promise<AutomationRule> => {
  const result = await apiClient.patch<AutomationRule>(
    `/comment-automation/rules/${ruleId}`,
    params as unknown as Record<string, unknown>,
  );

  return result;
};

/**
 * Delete an automation rule
 */
export const deleteRule = async (ruleId: number): Promise<{ success: boolean; message: string }> => {
  return apiClient.delete<{ success: boolean; message: string }>(`/comment-automation/rules/${ruleId}`);
};

/**
 * Toggle rule status (active/paused)
 */
export const toggleRule = async (ruleId: number): Promise<AutomationRule> => {
  return apiClient.post<AutomationRule>(`/comment-automation/rules/${ruleId}/toggle`);
};

/**
 * Execute a rule manually on selected comments
 */
export const executeRule = async (ruleId: number, params: ExecuteRuleParams): Promise<ExecuteRuleResult> => {
  const { encryptedUserToken, ...bodyParams } = params;

  return apiClient.post<ExecuteRuleResult>(
    `/comment-automation/rules/${ruleId}/execute`,
    bodyParams as unknown as Record<string, unknown>,
    { token: encryptedUserToken },
  );
};

/**
 * Request cancellation of an in-flight rule execution.
 */
export const cancelRuleExecution = async (ruleId: number): Promise<CancelRuleExecutionResult> => {
  return apiClient.post<CancelRuleExecutionResult>(`/comment-automation/rules/${ruleId}/cancel`);
};

/**
 * Get processing history for a rule
 */
export const getRuleHistory = async (
  ruleId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<{
  ruleId: number;
  history: ProcessedComment[];
  limit: number;
  offset: number;
}> => {
  return apiClient.get<{
    ruleId: number;
    history: ProcessedComment[];
    limit: number;
    offset: number;
  }>(`/comment-automation/rules/${ruleId}/history`, { limit, offset });
};

/**
 * Get all runs (batches) for a rule
 */
export const getRuleRuns = async (
  ruleId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<RuleRunsResponse> => {
  return apiClient.get<RuleRunsResponse>(`/comment-automation/rules/${ruleId}/runs`, { limit, offset });
};

/**
 * Get details of a specific run including processed comments
 */
export const getRunDetails = async (
  runId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<RunDetailsResponse> => {
  return apiClient.get<RunDetailsResponse>(`/comment-automation/runs/${runId}`, { limit, offset });
};

/**
 * Get all runs across all rules for an ad account
 */
export const getRunsByAdAccount = async (
  adAccountId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<AccountRunsResponse> => {
  return apiClient.get<AccountRunsResponse>("/comment-automation/runs/by-account", {
    adAccountId,
    limit,
    offset,
  });
};

/** How many runs one page of a comment automation has had. */
export interface RunPageCount {
  pageId: string;
  platform: "facebook" | "instagram";
  /** Null when the page is no longer connected. */
  pageName: string | null;
  pagePicture: string | null;
  runCount: number;
}

export interface RuleSetRunsResponse extends AccountRunsResponse {
  ruleIds: number[];
  /**
   * Run count per member page, across every page even when `pageId` narrowed
   * the runs. Optional for back-compat with responses that predate it.
   */
  pages?: RunPageCount[];
  /**
   * Run count per outcome, across every outcome even when `outcome` narrowed
   * the runs — so the filter's own numbers never move as it is used.
   */
  outcomes?: RunOutcomeCount[];
}

/** How a run ended, as History filters it. */
export type RunOutcome = "success" | "failed" | "unavailable" | "interrupted" | "running" | "skipped";

export interface RunOutcomeCount {
  outcome: RunOutcome;
  runCount: number;
}

/**
 * Get all runs across a set of rules — the per-page members of one comment
 * automation. Scoped by rule id so runs from other automations on the same
 * pages stay out; `pageId` narrows the runs (and `total`) to one member page.
 */
export const getRunsByRuleIds = async (
  ruleIds: readonly number[],
  limit: number = 20,
  offset: number = 0,
  pageId?: string,
  outcome?: RunOutcome,
): Promise<RuleSetRunsResponse> => {
  return apiClient.get<RuleSetRunsResponse>("/comment-automation/runs/by-rule", {
    ruleIds: ruleIds.join(","),
    limit,
    offset,
    ...(pageId ? { pageId } : {}),
    ...(outcome ? { outcome } : {}),
  });
};

/**
 * Get all runs across one or more pages.
 * Scopes by pageId (stable) instead of adAccountId, which can drift when a
 * page is re-subscribed under a different ad account.
 */
export const getRunsByPages = async (
  pageIds: string[],
  limit: number = 20,
  offset: number = 0,
): Promise<AccountRunsResponse> => {
  return apiClient.get<AccountRunsResponse>("/comment-automation/runs/by-page", {
    pageIds: pageIds.join(","),
    limit,
    offset,
  });
};

/**
 * Get unique pages for an ad account (pages that have comments)
 */
export const getPagesForAdAccount = async (
  adAccountId: string,
): Promise<Array<{ pageId: string; pageName: string; commentCount: number }>> => {
  return apiClient.get<Array<{ pageId: string; pageName: string; commentCount: number }>>("/comment-automation/pages", {
    adAccountId,
  });
};

/** One comment a rule would act on, as returned by the dry run. */
export interface RulePreviewComment {
  commentId: string;
  message: string;
  authorName: string | null;
  pageId: string | null;
  postId: string | null;
  isReply: boolean;
  sentimentScore?: number;
  /** When the stored score was written. Preview does not re-score live. */
  sentimentAnalyzedAt?: string | null;
  isHidden: boolean;
  createdAt: string | null;
  /** Whether the comment was left on an ad post (Facebook only). */
  isAd?: boolean;
  platform?: CommentPlatform;
}

/**
 * What a rule would do right now, without doing it.
 *
 * `alreadyHandled` is reported alongside `matched` on purpose: rules are
 * repeat-safe, so comments this rule already acted on are deliberately absent
 * from `comments`. Without that count, a healthy rule previewing "0 matches"
 * reads as broken.
 */
export interface RulePreviewResult {
  scanned: number;
  matched: number;
  alreadyHandled: number;
  truncated: boolean;
  comments: RulePreviewComment[];
  blocked: Array<{ commentId: string; reason: string }>;
}

export interface PreviewRuleParams {
  conditions: AutomationConditions;
  platform?: CommentPlatform;
  /** Page (or IG account) to scan. Omit or pass "all" to scan every subscribed page. */
  pageId?: string;
  /** Selected pages when the rule covers more than one. Preferred over pageId: "all". */
  pageIds?: string[];
  adAccountId?: string;
  /** Set when editing a saved rule, so already-handled comments are reported separately. */
  ruleId?: number;
  limit?: number;
  /**
   * Needed for the server to resolve `conditions.customIntents` to the
   * workspace's definitions. Harmless otherwise, so send it whenever known.
   */
  workspaceId?: string;
}

export const PREVIEW_RULE_AUTH_ERROR = "Connect Facebook before previewing comment automations.";

/**
 * Dry-run a rule's conditions against real synced comments.
 *
 * The verdict comes from CommentsServer, which reuses the same matcher and the
 * same candidate query the live run uses. Matching is deliberately NOT
 * re-implemented here: the previous browser-side preview drifted from the
 * server (it ignored `matchMode`) and under-reported matches.
 *
 * The endpoint is guarded like every other comment-reading route (it returns
 * comment bodies and author names, and page ids are public), so the caller's
 * Facebook token must travel with the request. Sending none made every
 * preview fail with "Access denied. Authorization token is required."
 * (ADM-12013). The token is not used to call Graph — the dry run reads only
 * our own DB — it is the authentication bar.
 */
export const previewRule = async (
  params: PreviewRuleParams,
  facebookToken: string | null | undefined,
): Promise<RulePreviewResult> => {
  if (!facebookToken) {
    throw new AuthenticationError(PREVIEW_RULE_AUTH_ERROR);
  }
  return apiClient.post<RulePreviewResult>(
    "/comment-automation/rules/preview",
    {
      conditions: params.conditions,
      platform: params.platform,
      pageId: params.pageId,
      pageIds: params.pageIds,
      adAccountId: params.adAccountId,
      ruleId: params.ruleId,
      limit: params.limit,
      workspaceId: params.workspaceId,
    },
    { token: facebookToken },
  );
};

// ============================================
// Custom intents
// ============================================

interface CustomIntentsResponse {
  success: boolean;
  data?: { workspaceId: string; intents: CustomIntent[] };
  error?: string;
}

export const CUSTOM_INTENTS_AUTH_ERROR = "Connect Facebook before managing custom intents.";
/** Server-side cap on the list; mirrored so the form can refuse before the round-trip. */
export const MAX_CUSTOM_INTENTS = 30;
export const CUSTOM_INTENT_NAME_MAX = 80;
export const CUSTOM_INTENT_DESCRIPTION_MAX = 400;
export const CUSTOM_INTENT_EXAMPLE_MAX = 200;
export const CUSTOM_INTENT_MAX_EXAMPLES = 5;

/** Fetch a workspace's custom intents. Guarded like the other automation routes (caller's Facebook token). */
export const getCustomIntents = async (
  workspaceId: string,
  facebookToken: string | null | undefined,
): Promise<CustomIntent[]> => {
  if (!facebookToken) {
    throw new AuthenticationError(CUSTOM_INTENTS_AUTH_ERROR);
  }
  const response = await apiClient.get<CustomIntentsResponse>(
    "/comment-automation/custom-intents",
    { workspaceId },
    { token: facebookToken },
  );
  if (!response.success) {
    throw new Error(response.error || "Failed to load custom intents");
  }
  return response.data?.intents ?? [];
};

/**
 * Replace a workspace's custom intents (the endpoint is a whole-list PUT).
 * Always send existing entries back with their `id` so renames keep the id a
 * saved rule refers to; the server assigns an id to entries that omit one.
 * Returns the persisted list.
 */
export const saveCustomIntents = async (
  workspaceId: string,
  intents: Array<Omit<CustomIntent, "id"> & { id?: string }>,
  facebookToken: string | null | undefined,
): Promise<CustomIntent[]> => {
  if (!facebookToken) {
    throw new AuthenticationError(CUSTOM_INTENTS_AUTH_ERROR);
  }
  const response = await apiClient.put<CustomIntentsResponse>(
    "/comment-automation/custom-intents",
    { workspaceId, intents },
    { token: facebookToken },
  );
  if (!response.success) {
    throw new Error(response.error || "Failed to save custom intents");
  }
  return response.data?.intents ?? [];
};

export const automationApi = {
  previewRule,
  getCustomIntents,
  saveCustomIntents,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  executeRule,
  cancelRuleExecution,
  getRuleHistory,
  getRuleRuns,
  getRunsByRuleIds,
  getRunDetails,
  getRunsByAdAccount,
  getRunsByPages,
  getPagesForAdAccount,
};

export default automationApi;
