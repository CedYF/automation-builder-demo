import {
  areAdAccountIdsEquivalent,
  normalizeAdAccountIdForComparison,
} from "@/lib/ad-accounts/resolve-preferred-ad-account-id";

const ACCOUNT_ID_SHAPED_NAME = /^(act_)?\d{6,}$/i;
const BARE_NUMERIC_ACCOUNT_ID = /^\d{6,}$/;

export interface AutomationAccountNameSource {
  readonly id: string;
  readonly names: ReadonlyArray<string | null | undefined>;
}

export interface AutomationAccountDisplayInput {
  readonly accountId?: string | null;
  readonly accountName?: string | null;
  readonly lookup: ReadonlyMap<string, string>;
}

export interface AutomationAccountDisplay {
  readonly label: string;
  readonly href: string | null;
}

export interface WorkspaceAccountNameInput {
  readonly defaultWorkspaceId?: string | null;
  readonly settings?: ReadonlyArray<{
    readonly workspaceId?: string | null;
    readonly businessId?: string | null;
    readonly businessName?: string | null;
    readonly name?: string | null;
    readonly customName?: string | null;
  }>;
  readonly workspaces?: ReadonlyArray<{
    readonly id?: string | null;
    readonly adAccounts?: ReadonlyArray<{
      readonly accountId?: string | null;
      readonly accountName?: string | null;
      readonly businessName?: string | null;
      readonly customName?: string | null;
    }>;
  }>;
  /**
   * Every ad account on the company, not just the open workspace. Automations
   * are company-scoped, so names for `act_` ids often live here.
   */
  readonly companyAdAccounts?: ReadonlyArray<{
    readonly businessId?: string | null;
    readonly accountId?: string | null;
    readonly accountName?: string | null;
    readonly businessName?: string | null;
    readonly customName?: string | null;
  }>;
}

export function isAccountIdShapedName(value: string): boolean {
  return ACCOUNT_ID_SHAPED_NAME.test(value.trim());
}

/**
 * Settings and AdAccount rows store Meta ids with or without `act_`. Query both.
 */
export function expandAccountIdLookupVariants(accountIds: ReadonlyArray<string>): string[] {
  const variants = new Set<string>();
  for (const accountId of accountIds) {
    const trimmed = accountId.trim();
    if (!trimmed || trimmed === "unknown") continue;
    variants.add(trimmed);
    const withoutPrefix = trimmed.replace(/^act_/i, "");
    if (withoutPrefix !== trimmed) variants.add(withoutPrefix);
    if (BARE_NUMERIC_ACCOUNT_ID.test(trimmed)) variants.add(`act_${trimmed}`);
  }
  return [...variants];
}

export function pickHumanAccountName(
  candidates: ReadonlyArray<string | null | undefined>,
  accountId?: string | null,
): string | null {
  for (const candidate of candidates) {
    const name = typeof candidate === "string" ? candidate.trim() : "";
    if (!name) continue;
    if (isAccountIdShapedName(name)) continue;
    if (accountId && areAdAccountIdsEquivalent(name, accountId)) continue;
    return name;
  }
  return null;
}

export function buildAutomationAccountNameLookup(
  sources: ReadonlyArray<AutomationAccountNameSource>,
): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();
  for (const source of sources) {
    const id = source.id.trim();
    if (!id) continue;
    const name = pickHumanAccountName(source.names, id);
    if (!name) continue;
    lookup.set(normalizeAdAccountIdForComparison(id), name);
  }
  return lookup;
}

export function resolveAutomationAccountDisplay(input: AutomationAccountDisplayInput): AutomationAccountDisplay {
  const accountId = input.accountId?.trim() || "";
  const storedName = input.accountName?.trim() || "";
  const lookedUpName = accountId ? input.lookup.get(normalizeAdAccountIdForComparison(accountId)) : undefined;
  const label = pickHumanAccountName([lookedUpName, storedName], accountId) || storedName || accountId || "-";
  return {
    label,
    href: accountId ? `/manage?account=${encodeURIComponent(accountId)}` : null,
  };
}

/**
 * Human name for a list row after validating the stored value against the
 * company-wide lookup. Returns null when every candidate is still an `act_` id.
 */
export function resolveOverlayAccountName(
  accountId: string | null | undefined,
  storedName: string | null | undefined,
  lookup: ReadonlyMap<string, string>,
): string | null {
  const display = resolveAutomationAccountDisplay({ accountId, accountName: storedName, lookup });
  return pickHumanAccountName([display.label], accountId);
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** ChannelAccount fields the home list and automations table resolve names from. */
export interface ChannelAccountNameFields {
  readonly businessId?: unknown;
  readonly businessName?: unknown;
  readonly name?: unknown;
  readonly customName?: unknown;
}

/**
 * Maps each requested account id onto a human name from ChannelAccount rows.
 *
 * Keys stay in the caller's original id shape (`act_123` vs `123`) so a rule
 * looked up by either form still gets the same label.
 */
export function mapAccountIdsToHumanNames(
  accountIds: ReadonlyArray<string>,
  accounts: ReadonlyArray<ChannelAccountNameFields>,
): Record<string, string> {
  const namesByNormalizedId = new Map<string, string>();
  for (const account of accounts) {
    const businessId = typeof account.businessId === "string" ? account.businessId : null;
    if (!businessId) continue;
    const name = pickHumanAccountName(
      [asOptionalString(account.name), asOptionalString(account.customName), asOptionalString(account.businessName)],
      businessId,
    );
    if (!name) continue;
    namesByNormalizedId.set(normalizeAdAccountIdForComparison(businessId), name);
  }

  const result: Record<string, string> = {};
  for (const accountId of accountIds) {
    const name = namesByNormalizedId.get(normalizeAdAccountIdForComparison(accountId));
    if (name) result[accountId] = name;
  }
  return result;
}

/** Legacy `AdAccounts` rows, where Meta's real `accountName` actually lives. */
export interface LegacyAdAccountNameFields {
  readonly accountId: string;
  readonly accountName: string;
  readonly businessName?: string | null;
}

/** Same id → name map as ChannelAccount, sourced from the legacy AdAccounts table. */
export function mapLegacyAdAccountsToHumanNames(
  accountIds: ReadonlyArray<string>,
  accounts: ReadonlyArray<LegacyAdAccountNameFields>,
): Record<string, string> {
  return mapAccountIdsToHumanNames(
    accountIds,
    accounts.map((account) => ({
      businessId: account.accountId,
      name: account.accountName,
      businessName: account.businessName,
    })),
  );
}

/** Settings.businessName, used when neither AdAccount nor AdAccounts has a label. */
export interface SettingsAccountNameFields {
  readonly businessId?: unknown;
  readonly businessName?: unknown;
}

/** Maps Settings rows onto the same id → name shape as ChannelAccount. */
export function mapSettingsAccountsToHumanNames(
  accountIds: ReadonlyArray<string>,
  settings: ReadonlyArray<SettingsAccountNameFields>,
): Record<string, string> {
  return mapAccountIdsToHumanNames(accountIds, settings);
}

export interface AccountNameLookupSources {
  readonly requestedIds: ReadonlyArray<string>;
  readonly channelAccounts: ReadonlyArray<ChannelAccountNameFields>;
  readonly legacyAccounts: ReadonlyArray<LegacyAdAccountNameFields>;
  readonly settingsAccounts?: ReadonlyArray<SettingsAccountNameFields>;
}

/**
 * Merges the three name tables. ChannelAccount custom names win, then Meta's
 * AdAccounts.accountName, then Settings.businessName for accounts that never
 * landed in the newer tables.
 */
export function buildAccountNameMapFromSources(sources: AccountNameLookupSources): Record<string, string> {
  return mergeHumanAccountNameMaps([
    mapAccountIdsToHumanNames(sources.requestedIds, sources.channelAccounts),
    mapLegacyAdAccountsToHumanNames(sources.requestedIds, sources.legacyAccounts),
    mapSettingsAccountsToHumanNames(sources.requestedIds, sources.settingsAccounts ?? []),
  ]);
}

/**
 * First map wins. ChannelAccount custom names should be listed first; legacy
 * Meta account names fill the gaps where AdAccount.name is empty.
 */
export function mergeHumanAccountNameMaps(
  maps: ReadonlyArray<Readonly<Record<string, string>>>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const map of maps) {
    for (const [accountId, name] of Object.entries(map)) {
      if (merged[accountId]) continue;
      merged[accountId] = name;
    }
  }
  return merged;
}

function pushAccountNameSource(
  target: AutomationAccountNameSource[],
  id: string | null | undefined,
  names: ReadonlyArray<string | null | undefined>,
): void {
  if (!id) return;
  target.push({ id, names });
}

/**
 * Names from every account the user can see.
 *
 * Company-wide accounts go first so a workspace custom name still wins.
 * Automations are company-scoped; using only the open workspace left most
 * rows as a raw `act_` id.
 */
export function collectWorkspaceAccountNameSources(
  user: WorkspaceAccountNameInput | null | undefined,
): AutomationAccountNameSource[] {
  if (!user) return [];
  const currentWorkspaceId = user.defaultWorkspaceId ?? null;
  const earlier: AutomationAccountNameSource[] = [];
  const current: AutomationAccountNameSource[] = [];

  for (const account of user.companyAdAccounts ?? []) {
    pushAccountNameSource(earlier, account.businessId ?? account.accountId, [
      account.accountName,
      account.customName,
      account.businessName,
    ]);
  }

  for (const setting of user.settings ?? []) {
    const bucket = currentWorkspaceId && setting.workspaceId === currentWorkspaceId ? current : earlier;
    pushAccountNameSource(bucket, setting.businessId, [setting.name, setting.customName, setting.businessName]);
  }

  for (const workspace of user.workspaces ?? []) {
    const bucket = currentWorkspaceId && workspace.id === currentWorkspaceId ? current : earlier;
    for (const account of workspace.adAccounts ?? []) {
      pushAccountNameSource(bucket, account.accountId, [account.accountName, account.customName, account.businessName]);
    }
  }

  return [...earlier, ...current];
}
