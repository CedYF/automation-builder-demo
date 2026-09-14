/**
 * Display labels and Meta-account gating for automation builder UI.
 * Keeps platform copy out of shared components that serve Meta + TikTok.
 */

export type AutomationAdsPlatform =
  | "meta"
  | "tiktok"
  | "snapchat"
  | "pinterest"
  | "google"
  | "axon"
  | "x"
  | "triplewhale"
  | "triplewhale-account";

const ADS_PLATFORM_LABELS: Record<AutomationAdsPlatform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  google: "Google Ads",
  axon: "AppLovin",
  x: "X",
  triplewhale: "Triple Whale",
  "triplewhale-account": "Triple Whale",
};

/**
 * Services that use the header ad-account selector / selectedAccountId.
 *
 * `tiktok-ads` belongs here even though its config panels carry their own
 * advertiser picker: the header selection is what the AI assistant is pointed at,
 * so hiding it on a TikTok flow would leave the assistant with no account.
 */
/**
 * `triplewhale-ads` belongs here even though it's a distinct trigger service: its
 * account id is a Meta act_… id (Triple Whale only supplies attributed metrics
 * keyed by Meta ad id), so it reads `selectedAccountId` exactly like `meta-ads`
 * instead of picking its own account inside the node.
 */
const HEADER_ACCOUNT_SERVICES = new Set([
  "meta-ads",
  "facebook-rules",
  "admanage",
  "tiktok-ads",
  "snapchat-ads",
  "triplewhale-ads",
]);

/**
 * Services that resolve their own target inside each node's config and never
 * read `selectedAccountId`. `comments` is here because comment automations are
 * page-level: the trigger picks pages workspace-wide and derives the ad account
 * from them, so a header account selector would be a control with no effect.
 * Kept as a literal to match {@link HEADER_ACCOUNT_SERVICES}; mirrors
 * `COMMENTS_SERVICE` in comment-flow-mapper.
 */
const NODE_SCOPED_ACCOUNT_SERVICES = new Set(["comments"]);

/**
 * Human-readable ads platform name for UI copy (e.g. insights helper text).
 */
export function getAutomationAdsPlatformLabel(platform: AutomationAdsPlatform): string {
  return ADS_PLATFORM_LABELS[platform];
}

/**
 * "Include today's partial data" is a Meta live-insights feature.
 * TikTok performance windows already run through today and ignore includeToday.
 */
export function supportsIncludeTodayPartialData(platform: AutomationAdsPlatform): boolean {
  return platform === "meta";
}

export function getIncludeTodayInsightsDescription(platform: AutomationAdsPlatform): string {
  const label = getAutomationAdsPlatformLabel(platform);
  return `Use live ${label} insights through today, even though conversions and CPA may still change.`;
}

type FlowNodeWithService = {
  service?: string | null;
};

/**
 * Whether the builder header should show the ad account selector.
 * Hide it for cross-channel flows (Snapchat/Pinterest/Google/AppLovin/X) that never
 * use selectedAccountId and pick their account inside each node's config instead.
 */
export function shouldShowAccountSelector(nodes: ReadonlyArray<FlowNodeWithService>): boolean {
  if (nodes.length === 0) {
    return true;
  }

  const hasHeaderAccountService = nodes.some((node) => {
    const service = node.service;
    return typeof service === "string" && HEADER_ACCOUNT_SERVICES.has(service);
  });

  if (hasHeaderAccountService) {
    return true;
  }

  // Checked after the header services so a mixed flow (comment trigger feeding a
  // meta-ads action) still offers the account that action needs.
  const hasNodeScopedAccountService = nodes.some((node) => {
    const service = node.service;
    return typeof service === "string" && NODE_SCOPED_ACCOUNT_SERVICES.has(service);
  });

  if (hasNodeScopedAccountService) {
    return false;
  }

  const hasOtherAdsService = nodes.some((node) => {
    const service = node.service;
    if (typeof service !== "string") return false;
    return service.endsWith("-ads") && !HEADER_ACCOUNT_SERVICES.has(service);
  });

  return !hasOtherAdsService;
}
