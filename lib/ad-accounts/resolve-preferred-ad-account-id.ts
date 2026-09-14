/**
 * Shared ad-account preference resolution used by Launch, Chat, Reports, and Manage.
 *
 * Priority: URL override → valid current selection → User.defaultAccountId → first available.
 * Account IDs are compared with Meta `act_` / Google Ads dash normalization so surfaces
 * that store different shapes of the same account still match.
 */

export interface ResolvePreferredAdAccountIdOptions {
  readonly availableIds: ReadonlyArray<string>;
  readonly currentId?: string | null;
  readonly defaultAccountId?: string | null;
  readonly urlId?: string | null;
}

/**
 * Normalize account IDs for equivalence checks across Launch / Manage / Reports / Chat.
 * Strips Meta `act_` prefixes and Google Ads dashes when the id is digit-only.
 */
export function normalizeAdAccountIdForComparison(accountId: string | null | undefined): string {
  const normalized = (accountId ?? "").trim().replace(/^act_/i, "");
  const withoutDashes = normalized.replace(/-/g, "");

  if (/^\d{10}$/.test(withoutDashes) && /^[\d-]+$/.test(normalized)) {
    return withoutDashes;
  }

  return normalized;
}

export function areAdAccountIdsEquivalent(
  firstAccountId: string | null | undefined,
  secondAccountId: string | null | undefined,
): boolean {
  const first = normalizeAdAccountIdForComparison(firstAccountId);
  const second = normalizeAdAccountIdForComparison(secondAccountId);
  return Boolean(first && second && first === second);
}

function findAvailableAccountId(
  availableIds: ReadonlyArray<string>,
  accountId: string | null | undefined,
): string | null {
  if (!accountId) {
    return null;
  }

  const matched = availableIds.find((id) => areAdAccountIdsEquivalent(id, accountId));
  return matched ?? null;
}

/**
 * Resolve which ad account ID should be preselected.
 * Returns the canonical ID from `availableIds` (not the raw input), or null if none.
 */
export function resolvePreferredAdAccountId(options: ResolvePreferredAdAccountIdOptions): string | null {
  const urlAccountId = findAvailableAccountId(options.availableIds, options.urlId);
  if (urlAccountId) {
    return urlAccountId;
  }

  const currentAccountId = findAvailableAccountId(options.availableIds, options.currentId);
  if (currentAccountId) {
    return currentAccountId;
  }

  const defaultAccountId = findAvailableAccountId(options.availableIds, options.defaultAccountId);
  if (defaultAccountId) {
    return defaultAccountId;
  }

  return options.availableIds[0] ?? null;
}
