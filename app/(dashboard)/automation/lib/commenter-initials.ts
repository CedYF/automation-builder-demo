const MAX_INITIALS = 2;
const FALLBACK_INITIALS = "?";

/**
 * Initials for a commenter's fallback avatar, e.g. "Morgan Lee" → "ML".
 *
 * Falls back to a single glyph rather than an empty circle so a one-word or
 * missing name still reads as an avatar next to the ones that have a picture.
 */
export function getCommenterInitials(authorName: string | undefined | null): string {
  const words = (authorName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return FALLBACK_INITIALS;

  return words
    .slice(0, MAX_INITIALS)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
