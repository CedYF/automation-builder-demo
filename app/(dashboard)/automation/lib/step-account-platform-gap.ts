import { inferAutomationAccountPlatform } from "./automation-account-platform";

/** Platforms a step's ad account must belong to, by service. */
const SERVICE_ACCOUNT_PLATFORMS: Readonly<Record<string, readonly string[]>> = {
  // triplewhale-ads evaluates a Meta `act_…` account, so it shares Meta's rule.
  "chatgpt-ads": ["chatgpt_ads"],
  "meta-ads": ["facebook", "meta"],
  "triplewhale-ads": ["facebook", "meta"],
  "tiktok-ads": ["tiktok"],
  "snapchat-ads": ["snapchat"],
};

/** Where each service stores the account it runs against. */
const SERVICE_ACCOUNT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "chatgpt-ads": ["accountId"],
  "meta-ads": ["accountIds", "accountId"],
  "triplewhale-ads": ["accountIds", "accountId"],
  "tiktok-ads": ["advertiserId"],
  "snapchat-ads": ["adAccountId"],
};

const PLATFORM_LABEL: Readonly<Record<string, string>> = {
  chatgpt_ads: "ChatGPT Ads",
  facebook: "Meta",
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
};

function readFirstAccountId(config: Record<string, unknown>, fieldNames: readonly string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = config[fieldName];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (Array.isArray(value)) {
      const first = value.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
      if (first) return first.trim();
    }
  }
  return null;
}

export interface StepAccountPlatformInput {
  readonly service: string;
  readonly config: Record<string, unknown>;
  /** The builder's "Runs on" account, used when the step names none of its own. */
  readonly flowAccountId?: string | null;
}

/**
 * The mismatch between a step's platform and the ad account it would actually
 * use, or null when they agree (or when the service is platform-agnostic).
 *
 * A Meta step pointed at a Snapchat account cannot run: the id is not one the
 * Meta API can read. This was reachable because the builder's "Runs on" picker
 * offers Meta, TikTok and Snapchat while each step writes platform-shaped
 * config, so the two could silently disagree.
 */
export function describeStepAccountPlatformMismatch(input: StepAccountPlatformInput): string | null {
  const expectedPlatforms = SERVICE_ACCOUNT_PLATFORMS[input.service];
  if (!expectedPlatforms) return null;

  const accountId =
    readFirstAccountId(input.config, SERVICE_ACCOUNT_FIELDS[input.service] ?? []) ??
    (input.service === "chatgpt-ads" ? null : (input.flowAccountId ?? null));
  if (!accountId) return null;

  const actualPlatform = inferAutomationAccountPlatform({ businessId: accountId });
  if (actualPlatform === null || expectedPlatforms.includes(actualPlatform)) return null;

  const expectedLabel = PLATFORM_LABEL[expectedPlatforms[0] ?? ""] ?? expectedPlatforms[0] ?? "another platform";
  const actualLabel = PLATFORM_LABEL[actualPlatform] ?? actualPlatform;
  return `This step needs a ${expectedLabel} ad account, but it is set to a ${actualLabel} one`;
}
