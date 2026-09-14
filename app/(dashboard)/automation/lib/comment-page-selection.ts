import type { CommentPlatform } from "@/app/(dashboard)/comments/lib/api/automation";

export interface CommentPageTarget {
  readonly pageId: string;
  readonly platform: CommentPlatform;
  /** Display name at selection time; persisted so the config can render names when the live page list is unavailable. */
  readonly pageName?: string;
}

export interface CommentPageSelection {
  readonly pageIds: string[];
  readonly pagePlatforms: Record<string, CommentPlatform>;
  readonly pageNames: Record<string, string>;
}

/** Adds a target without clearing accounts selected from the other Meta platform. */
export function addCommentPageTarget(selection: CommentPageSelection, target: CommentPageTarget): CommentPageSelection {
  return {
    pageIds: selection.pageIds.includes(target.pageId) ? selection.pageIds : [...selection.pageIds, target.pageId],
    pagePlatforms: { ...selection.pagePlatforms, [target.pageId]: target.platform },
    pageNames: target.pageName ? { ...selection.pageNames, [target.pageId]: target.pageName } : selection.pageNames,
  };
}

/** Removes one target while retaining every other Facebook and Instagram selection. */
export function removeCommentPageTarget(selection: CommentPageSelection, pageId: string): CommentPageSelection {
  return {
    pageIds: selection.pageIds.filter((selectedPageId) => selectedPageId !== pageId),
    pagePlatforms: Object.fromEntries(
      Object.entries(selection.pagePlatforms).filter(([selectedPageId]) => selectedPageId !== pageId),
    ),
    pageNames: Object.fromEntries(
      Object.entries(selection.pageNames).filter(([selectedPageId]) => selectedPageId !== pageId),
    ),
  };
}

/** Adds all filtered targets to the current selection, regardless of platform. */
export function addAllCommentPageTargets(
  selection: CommentPageSelection,
  targets: readonly CommentPageTarget[],
): CommentPageSelection {
  return targets.reduce(addCommentPageTarget, selection);
}

/** Removes all provided targets while retaining selections outside the current filter. */
export function removeAllCommentPageTargets(
  selection: CommentPageSelection,
  targets: readonly Pick<CommentPageTarget, "pageId">[],
): CommentPageSelection {
  const targetIds = new Set(targets.map((target) => target.pageId));
  return {
    pageIds: selection.pageIds.filter((pageId) => !targetIds.has(pageId)),
    pagePlatforms: Object.fromEntries(
      Object.entries(selection.pagePlatforms).filter(([pageId]) => !targetIds.has(pageId)),
    ),
    pageNames: Object.fromEntries(Object.entries(selection.pageNames).filter(([pageId]) => !targetIds.has(pageId))),
  };
}

/** Drops pages that cannot receive comment webhooks once subscription status is known. */
export function excludeUnsubscribedCommentPages<T extends { readonly pageId: string }>(
  pages: readonly T[],
  unsubscribedPageIds: readonly string[],
  isResolved: boolean,
): T[] {
  if (!isResolved) return [...pages];
  const unsubscribed = new Set(unsubscribedPageIds);
  return pages.filter((page) => !unsubscribed.has(page.pageId));
}

/**
 * Reads the page-name map a saved Comments trigger carries. Names are captured
 * when the page is picked so both the config UI and error messages can render
 * them without waiting on (or re-fetching) the live page list.
 */
export function readCommentPageNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );
}

/** Reads the per-page platform map stored on a Comments trigger node. */
export function readCommentPagePlatforms(value: unknown): Record<string, CommentPlatform> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, CommentPlatform] => entry[1] === "facebook" || entry[1] === "instagram",
    ),
  );
}

/**
 * The ad account a page selection resolves to, or "" when the selection spans
 * several accounts or none is known.
 *
 * Comment automations are page-level, so the builder no longer asks for an ad
 * account. Rules still store one — CommentsServer uses it to resolve a token and
 * to scope legacy "all pages" runs — so it is derived from the selected pages
 * instead. An ambiguous selection deliberately resolves to "" rather than
 * guessing, which also stands down the campaign / ad-set filters.
 */
export function resolveAdAccountForPages(
  pageIds: readonly string[],
  adAccountIdByPageId: ReadonlyMap<string, string>,
): string {
  const accountIds = new Set(pageIds.map((pageId) => adAccountIdByPageId.get(pageId)).filter(Boolean));
  return accountIds.size === 1 ? [...accountIds][0]! : "";
}
