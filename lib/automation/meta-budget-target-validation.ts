export const ACCOUNT_AS_CAMPAIGN_TARGET_ERROR =
  "An ad account ID was supplied as a campaign target. Select campaign IDs or use the qualifying campaigns from the trigger.";

export const INVALID_META_BUDGET_ENTITY_ERROR =
  "Meta Change Budget requires an ad set or campaign budget target. Select Ad Set, Campaign, or Automatic and matching target IDs.";

/** Match the executor default; missing/empty levels mean ad set, not invalid. */
export function hasInvalidMetaBudgetEntity(config: Record<string, unknown>): boolean {
  const level = config.budgetEntityLevel || "adset";
  return level !== "adset" && level !== "campaign" && level !== "automatic";
}

function parseStaticIds(value: unknown): string[] | null {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string")
    return value.includes("{{")
      ? null
      : value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
  if (Array.isArray(value) && value.every((id) => typeof id === "string" && !id.includes("{{"))) return value;
  return null;
}

/** Mirror Change Budget's explicit target precedence; unresolved pills remain unknown. */
export function hasStaticAccountAsCampaignTarget(config: Record<string, unknown>, accountId?: string | null): boolean {
  if (config.budgetEntityLevel !== "campaign") return false;
  const explicit = parseStaticIds(config.targetIds);
  if (explicit === null) return false;
  const targets = explicit.length ? explicit : parseStaticIds(config.selectedCampaignIds);
  if (!targets) return false;
  const accounts = [config.accountId, accountId]
    .filter((id): id is string => typeof id === "string" && !!id)
    .map((id) => id.replace(/^act_/, ""));
  return targets.some((id) => id.startsWith("act_") || accounts.includes(id));
}
