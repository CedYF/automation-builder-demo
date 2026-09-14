/**
 * CommentsServer refuses to create a comment automation unless every selected
 * page is subscribed to Meta's comment webhooks, and it names the pages that
 * failed. This turns that machine-readable rejection into a message the user can
 * act on: page names instead of raw ids, and the reason each one gave.
 *
 * ADM-10950: a 17-page automation failed with "The selected page could not be
 * subscribed to comment webhooks", naming nothing, so the customer had no way to
 * find the page to unselect.
 */

export const PAGE_WEBHOOK_SUBSCRIPTION_FAILED_CODE = "PAGE_WEBHOOK_SUBSCRIPTION_FAILED";

/** Beyond this the toast becomes a wall of text; the rest are counted instead. */
const MAX_LISTED_FAILED_PAGES = 5;

export interface CommentSubscriptionErrorOptions {
  /** Parsed JSON body of the failed create/update response. */
  readonly body: unknown;
  /** Page id -> display name, as captured by the Comments trigger config. */
  readonly pageNames: Readonly<Record<string, string>>;
  /** How many pages the automation targets, for "N of M". */
  readonly selectedPageCount: number;
  /** Message to use when the body is not a page-subscription rejection. */
  readonly fallback: string;
}

interface FailedPage {
  readonly pageId: string;
  readonly reason: string;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readFailedPages(body: unknown): FailedPage[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const source = body as Record<string, unknown>;
  if (source.code !== PAGE_WEBHOOK_SUBSCRIPTION_FAILED_CODE) return [];

  const pageIds = readStringArray(source, "pageIds");
  const reasons = readStringArray(source, "reasons");
  return pageIds.map((pageId, index) => ({ pageId, reason: reasons[index] ?? "" }));
}

function describeFailedPage(failure: FailedPage, pageNames: Readonly<Record<string, string>>): string {
  const pageName = pageNames[failure.pageId];
  const label = pageName ? `${pageName} (${failure.pageId})` : failure.pageId;
  return failure.reason ? `${label}: ${failure.reason}` : label;
}

/**
 * Builds the save-error toast for a comment automation.
 *
 * @returns a per-page message when the response is a page-subscription
 *   rejection, otherwise `options.fallback` unchanged.
 */
export function buildCommentSubscriptionErrorMessage(options: CommentSubscriptionErrorOptions): string {
  const failures = readFailedPages(options.body);
  if (failures.length === 0) return options.fallback;

  const selectedLabel = options.selectedPageCount === 1 ? "page" : "pages";
  const listed = failures
    .slice(0, MAX_LISTED_FAILED_PAGES)
    .map((failure) => describeFailedPage(failure, options.pageNames))
    .join(" · ");
  const hiddenCount = Math.max(0, failures.length - MAX_LISTED_FAILED_PAGES);
  const overflow = hiddenCount > 0 ? ` · and ${hiddenCount} more` : "";

  return (
    `${failures.length} of ${options.selectedPageCount} selected ${selectedLabel} could not be subscribed to ` +
    `comment webhooks, so no automation was created. Unselect them (or fix the page access) and save again. ` +
    `${listed}${overflow}`
  );
}
