/**
 * Maps the UI "Comment source" filter to CommentsServer `isAdOnly`.
 *
 * - `all` → omitted (match ad and organic comments)
 * - `ads` → `isAdOnly: true`
 * - `organic` → `isAdOnly: false`
 */
export type CommentSourceFilter = "all" | "ads" | "organic";

export const COMMENT_SOURCE_LABEL: Record<CommentSourceFilter, string> = {
  all: "All comments",
  ads: "Ads only",
  organic: "Organic posts only",
};

/** Read the UI filter from persisted rule conditions. */
export function commentSourceFromIsAdOnly(isAdOnly?: boolean): CommentSourceFilter {
  if (isAdOnly === true) return "ads";
  if (isAdOnly === false) return "organic";
  return "all";
}

/** Serialize the UI filter into `AutomationConditions.isAdOnly`. */
export function isAdOnlyFromCommentSource(source: CommentSourceFilter): boolean | undefined {
  if (source === "ads") return true;
  if (source === "organic") return false;
  return undefined;
}
