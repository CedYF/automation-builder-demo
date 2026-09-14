/**
 * Platform inference and filtering for the automation builder's ad-account pickers.
 *
 * Shared so the header selector and the AI assistant's readiness guard cannot drift
 * on which accounts count as selectable — they previously carried two hand-rolled
 * copies of the same filter with different null-type fallbacks.
 */

/** A workspace ad-account setting as `extendedUser.settings` exposes it. */
export interface AutomationAccountSetting {
  readonly workspaceId?: string | null;
  readonly businessId?: string | null;
  readonly type?: string | null;
  readonly tikId?: string | null;
}

/**
 * Platforms the per-node automation config panels accept.
 *
 * Most panels write Meta-shaped config (an `act_`-prefixed accountId, Meta metric
 * names), so offering a TikTok advertiser there would build a rule that cannot run.
 */
export const META_AUTOMATION_ACCOUNT_PLATFORMS = ["facebook", "meta"] as const;

/**
 * Platforms the builder header accepts, and therefore what the AI assistant can be
 * pointed at. TikTok is included because `tiktok-ads` has a real Performance
 * Threshold trigger plus pause/enable/budget/duplicate actions the assistant can build.
 * Snapchat is included because `snapchat-ads` has Performance Threshold + Pause Ad.
 */
export const BUILDER_AUTOMATION_ACCOUNT_PLATFORMS = ["facebook", "meta", "tiktok", "snapchat"] as const;

const SNAPCHAT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** TikTok advertiser ids are all digits; X ad-account ids are short base36 (e.g. `18ce54d4x5t`). */
const TIKTOK_NUMERIC_ID_RE = /^\d+$/;
const X_BASE36_ID_RE = /^[0-9a-z]{6,20}$/i;

const PLATFORM_GROUP_LABELS: Record<string, string> = {
  facebook: "Meta",
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  x: "X",
  chatgpt_ads: "ChatGPT Ads",
};

/**
 * Best-effort platform for a workspace setting.
 *
 * Older TikTok settings carry `type: null` with `tikId` set, and older Meta settings
 * carry `type: null` with an `act_`-prefixed `businessId`, so fall back to those
 * shapes before giving up. A bare non-numeric base36 id is an X ad account, which
 * used to fall through to "tiktok".
 */
export function inferAutomationAccountPlatform(setting: AutomationAccountSetting): string | null {
  if (setting.type) return setting.type;
  if (setting.tikId) return "tiktok";
  if (!setting.businessId) return null;
  if (setting.businessId.startsWith("adacct_")) return "chatgpt_ads";
  if (setting.businessId.startsWith("act_")) return "facebook";
  if (SNAPCHAT_UUID_RE.test(setting.businessId)) return "snapchat";
  if (TIKTOK_NUMERIC_ID_RE.test(setting.businessId)) return "tiktok";
  if (X_BASE36_ID_RE.test(setting.businessId)) return "x";
  return "tiktok";
}

/** Platforms a Snapchat step's ad-account field accepts. */
export const SNAPCHAT_AUTOMATION_ACCOUNT_PLATFORMS = ["snapchat"] as const;

/**
 * Whether the builder's "Runs on" account may be copied into a step's own
 * ad-account field.
 *
 * The header picker accepts Meta, TikTok and Snapchat, but each step writes
 * platform-shaped config, so seeding was only ever safe when the two agree.
 * Without this check a Snapchat header account landed in a Meta step's
 * `accountId` (and vice versa), producing a rule pointed at an account its
 * platform cannot read — the step then showed an id its own picker would never
 * offer.
 */
export function canSeedAccountIntoStep(
  accountId: string | null | undefined,
  stepPlatforms: readonly string[],
): boolean {
  if (!accountId) return false;
  return isAllowedAutomationAccountPlatform(inferAutomationAccountPlatform({ businessId: accountId }), stepPlatforms);
}

/** Whether a resolved platform is one the picker may offer. */
export function isAllowedAutomationAccountPlatform(
  platform: string | null,
  allowedPlatforms: readonly string[],
): boolean {
  return platform != null && allowedPlatforms.includes(platform);
}

/**
 * Whether the workspace has at least one account a picker with these platforms would
 * offer. Tells "no account selected yet" apart from "no eligible account exists",
 * which lead to different assistant behaviour.
 */
export function hasAutomationAccountOption(
  settings: readonly AutomationAccountSetting[] | undefined | null,
  workspaceId: string | null | undefined,
  allowedPlatforms: readonly string[],
): boolean {
  if (!settings || !workspaceId) return false;
  return settings.some((setting) => {
    if (setting.workspaceId !== workspaceId || !setting.businessId) return false;
    return isAllowedAutomationAccountPlatform(inferAutomationAccountPlatform(setting), allowedPlatforms);
  });
}

/**
 * Human-readable name for a picker's platform set, for placeholder and empty-state
 * copy — e.g. "Meta" or "Meta and TikTok".
 */
export function buildAutomationAccountPlatformsLabel(allowedPlatforms: readonly string[]): string {
  const labels = [...new Set(allowedPlatforms.map((platform) => PLATFORM_GROUP_LABELS[platform] ?? platform))];
  if (labels.length === 0) return "ad";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
