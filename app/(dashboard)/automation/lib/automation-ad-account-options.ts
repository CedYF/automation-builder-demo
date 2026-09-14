import {
  areAdAccountIdsEquivalent,
  resolvePreferredAdAccountId,
} from "@/lib/ad-accounts/resolve-preferred-ad-account-id";
import {
  inferAutomationAccountPlatform,
  isAllowedAutomationAccountPlatform,
  type AutomationAccountSetting,
  BUILDER_AUTOMATION_ACCOUNT_PLATFORMS,
} from "./automation-account-platform";

export interface AutomationAdAccountOption {
  readonly value: string;
  readonly label: string;
  readonly businessId: string;
  readonly type: string | null;
  readonly currency?: string | null;
}

export interface AutomationWorkspaceAccount {
  readonly accountId?: string | null;
  readonly accountName?: string | null;
  readonly businessName?: string | null;
  readonly customName?: string | null;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly currency?: string | null;
}

/**
 * A row of `extendedUser.settings`. `/api/user/extended2` populates it from the
 * same `AdAccount` rows it puts on `currentWorkspace.adAccounts`, so it carries
 * the same display fields — including the workspace's `customName` rename.
 */
export type AutomationAdAccountSettingRow = AutomationAccountSetting & {
  readonly businessName?: string | null;
  readonly accountName?: string | null;
  readonly customName?: string | null;
  readonly name?: string | null;
  readonly currency?: string | null;
};

export interface BuildAutomationAdAccountOptionsInput {
  readonly workspaceId: string | null | undefined;
  readonly allowedPlatforms: readonly string[];
  readonly settings: ReadonlyArray<AutomationAdAccountSettingRow>;
  readonly workspaceAccounts: ReadonlyArray<AutomationWorkspaceAccount>;
}

function normalizeWorkspaceId(workspaceId: string | number): string {
  return String(workspaceId).replace(/^ws_/, "");
}

export function isSameAutomationWorkspaceId(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
): boolean {
  if (first == null || second == null || first === "" || second === "") return false;
  return normalizeWorkspaceId(first) === normalizeWorkspaceId(second);
}

export function findAutomationAdAccountOption<T extends { value: string }>(
  options: readonly T[],
  value: string,
): T | undefined {
  if (!value) return undefined;
  return options.find((option) => areAdAccountIdsEquivalent(option.value, value));
}

/**
 * True when the picker would only rewrite the same Meta account with a
 * different spelling (`act_123` vs `123`). Callers that clear dependent
 * fields (pages, campaigns) on account change must skip those updates.
 */
export function isSameAutomationAdAccountSelection(current: string, next: string): boolean {
  return Boolean(current && next && areAdAccountIdsEquivalent(current, next));
}

export interface AutomationWorkspaceWithAccounts {
  readonly adAccounts?: ReadonlyArray<AutomationWorkspaceAccount> | null;
}

/**
 * Cross-workspace display-name lookup for an account id the current workspace's
 * picker options do not contain (e.g. an automation saved from another
 * workspace of the same organization). Display-only: it hydrates the trigger
 * label but must not add the account to the selectable options.
 */
export function resolveAutomationAdAccountLabel(
  accountId: string,
  workspaces: ReadonlyArray<AutomationWorkspaceWithAccounts>,
): string | null {
  if (!accountId) return null;
  for (const workspace of workspaces) {
    for (const account of workspace.adAccounts ?? []) {
      if (!account.accountId || !areAdAccountIdsEquivalent(account.accountId, accountId)) continue;
      const label = account.customName?.trim() || account.accountName?.trim() || account.businessName?.trim();
      if (label && !areAdAccountIdsEquivalent(label, accountId)) return label;
    }
  }
  return null;
}

/**
 * Display name for an ad-account row, in the precedence the rest of the product
 * uses: the workspace's rename wins over the platform's business name. Falls back
 * to the id so an account the platform never named stays selectable.
 *
 * Shared by both option sources — reading a shorter chain on one side is what let
 * the trigger and action pickers show two different names for one account.
 */
function resolveAccountOptionLabel(
  row: Pick<AutomationWorkspaceAccount, "customName" | "accountName" | "name" | "businessName">,
  accountId: string,
): string {
  return row.customName?.trim() || row.accountName?.trim() || row.name?.trim() || row.businessName?.trim() || accountId;
}

function optionFromSetting(setting: AutomationAdAccountSettingRow): AutomationAdAccountOption | null {
  const businessId = setting.businessId?.trim();
  if (!businessId) return null;
  return {
    value: businessId,
    label: resolveAccountOptionLabel(setting, businessId),
    businessId,
    type: inferAutomationAccountPlatform(setting),
    currency: setting.currency,
  };
}

function optionFromWorkspaceAccount(account: AutomationWorkspaceAccount): AutomationAdAccountOption | null {
  const accountId = account.accountId?.trim();
  if (!accountId) return null;
  return {
    value: accountId,
    label: resolveAccountOptionLabel(account, accountId),
    businessId: accountId,
    type: inferAutomationAccountPlatform({ type: account.type, businessId: accountId }),
    currency: account.currency,
  };
}

function hasHumanAccountLabel(option: AutomationAdAccountOption): boolean {
  return option.label.trim() !== "" && !areAdAccountIdsEquivalent(option.label, option.value);
}

function mergeAccountOptions(options: readonly AutomationAdAccountOption[]): AutomationAdAccountOption[] {
  const merged: AutomationAdAccountOption[] = [];
  for (const option of options) {
    const existingIndex = merged.findIndex((candidate) => areAdAccountIdsEquivalent(candidate.value, option.value));
    if (existingIndex < 0) {
      merged.push(option);
      continue;
    }
    const existing = merged[existingIndex];
    if (hasHumanAccountLabel(existing) || !hasHumanAccountLabel(option)) continue;
    merged[existingIndex] = { ...existing, label: option.label, currency: option.currency ?? existing.currency };
  }
  return merged;
}

/**
 * Builds the picker list from workspace settings first, then fills any Meta
 * accounts that only exist on `currentWorkspace.adAccounts` — the source /comments
 * already uses. Settings and workspace rows often spell the same id with and
 * without `act_`; those collapse to one option.
 */
export function buildAutomationAdAccountOptions(
  input: BuildAutomationAdAccountOptionsInput,
): AutomationAdAccountOption[] {
  const fromSettings = input.settings
    .filter((setting) => isSameAutomationWorkspaceId(setting.workspaceId, input.workspaceId))
    .map(optionFromSetting)
    .filter((option): option is AutomationAdAccountOption => option != null);

  const fromWorkspace = input.workspaceAccounts
    .map(optionFromWorkspaceAccount)
    .filter((option): option is AutomationAdAccountOption => option != null);

  const merged = mergeAccountOptions([...fromSettings, ...fromWorkspace]);
  const result = merged.filter((option) => isAllowedAutomationAccountPlatform(option.type, input.allowedPlatforms));

  return result;
}

export interface ResolveAutomationBuilderAccountInput {
  readonly workspaceId: string | null | undefined;
  readonly defaultAccountId: string | null | undefined;
  readonly settings: ReadonlyArray<AutomationAdAccountSettingRow>;
  readonly workspaceAccounts: ReadonlyArray<AutomationWorkspaceAccount>;
}

export interface AutomationBuilderAccount {
  readonly accountId: string;
  readonly accountName: string;
}

/**
 * The account the builder and assistant may send. Always one of the picker's
 * options — a stale User.defaultAccountId from another workspace must not win,
 * or suggest-mode 403s as "not connected to the current workspace".
 */
export function isSelectableAutomationBuilderAccount(
  accountId: string | null | undefined,
  input: Omit<ResolveAutomationBuilderAccountInput, "defaultAccountId">,
): boolean {
  if (!accountId) return false;
  const options = buildAutomationAdAccountOptions({
    workspaceId: input.workspaceId,
    allowedPlatforms: BUILDER_AUTOMATION_ACCOUNT_PLATFORMS,
    settings: input.settings,
    workspaceAccounts: input.workspaceAccounts,
  });
  return Boolean(findAutomationAdAccountOption(options, accountId));
}

export function resolveAutomationBuilderAccount(
  input: ResolveAutomationBuilderAccountInput,
): AutomationBuilderAccount | null {
  const options = buildAutomationAdAccountOptions({
    workspaceId: input.workspaceId,
    allowedPlatforms: BUILDER_AUTOMATION_ACCOUNT_PLATFORMS,
    settings: input.settings,
    workspaceAccounts: input.workspaceAccounts,
  });
  const preferredId = resolvePreferredAdAccountId({
    availableIds: options.map((option) => option.value),
    defaultAccountId: input.defaultAccountId,
  });
  if (!preferredId) return null;
  const option = findAutomationAdAccountOption(options, preferredId);
  if (!option) return null;
  return { accountId: option.value, accountName: option.label };
}
