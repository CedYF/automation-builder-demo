/**
 * Helper utility to generate and manage R2 links for profile images.
 */

export const R2_MEDIA_BASE_URL = "https://media.admanage.ai";
export const PROFILE_ICON_PREFIX = "icons";
export const PLACEHOLDER_IMAGE_URL = "/placeholder-image.jpg";

export type ProfileIconType = "fb" | "ig";

export interface ProfileIconCandidateOptions {
  identifier?: string | null;
  type: ProfileIconType;
  company?: string | null;
  explicitUrl?: string | null;
  fallbackIdentifier?: string | null;
  fallbackType?: ProfileIconType;
}

export function normalizeProfileIconId(identifier: string | null | undefined): string | null {
  const trimmed = String(identifier || "")
    .trim()
    .replace(/^@/, "");
  if (!trimmed) return null;
  return trimmed.replace(/^(fb|ig)_/i, "");
}

export function isValidProfileIconId(identifier: string | null | undefined): boolean {
  const normalizedId = normalizeProfileIconId(identifier);
  return Boolean(normalizedId && /^\d/.test(normalizedId));
}

export function buildProfileIconKey(identifier: string): string {
  const normalizedId = normalizeProfileIconId(identifier);
  if (!normalizedId) return "";
  return `${PROFILE_ICON_PREFIX}/${encodeURIComponent(normalizedId)}.jpg`;
}

export function buildProfileIconUrl(identifier: string | null | undefined): string {
  const key = identifier ? buildProfileIconKey(identifier) : "";
  if (!key) return PLACEHOLDER_IMAGE_URL;
  return `${R2_MEDIA_BASE_URL}/${key}`;
}

export function buildLegacyProfileIconUrl(type: ProfileIconType, identifier: string, company?: string | null): string {
  const normalizedId = normalizeProfileIconId(identifier);
  if (!company || !normalizedId) return PLACEHOLDER_IMAGE_URL;
  return `${R2_MEDIA_BASE_URL}/${company}/profile/${type}_${normalizedId}.jpg`;
}

const SOCIAL_CDN_AVATAR_MARKERS = ["fbcdn.net", "scontent", "cdninstagram.com"] as const;

/**
 * True for expired Facebook/Instagram CDN avatars that often HTTP 200 a gray silhouette.
 */
export function isUnusableSocialCdnAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return SOCIAL_CDN_AVATAR_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Unauthenticated Graph picture URL for a numeric Page/IG id. img tags follow the 302 to a fresh asset.
 */
export function buildGraphProfilePictureUrl(identifier: string | null | undefined): string | null {
  const normalizedId = normalizeProfileIconId(identifier);
  if (!normalizedId || !/^\d+$/.test(normalizedId)) return null;
  return `https://graph.facebook.com/${encodeURIComponent(normalizedId)}/picture?type=large`;
}

export function buildProfileIconCandidates(options: ProfileIconCandidateOptions): string[] {
  const primaryId = normalizeProfileIconId(options.identifier);
  const fallbackId = normalizeProfileIconId(options.fallbackIdentifier);
  const stableExplicitUrl = isUnusableSocialCdnAvatarUrl(options.explicitUrl) ? null : options.explicitUrl;
  const candidates = [
    primaryId ? buildProfileIconUrl(primaryId) : null,
    stableExplicitUrl,
    primaryId && options.company ? buildLegacyProfileIconUrl(options.type, primaryId, options.company) : null,
    primaryId ? buildGraphProfilePictureUrl(primaryId) : null,
    fallbackId ? buildProfileIconUrl(fallbackId) : null,
    fallbackId && options.company
      ? buildLegacyProfileIconUrl(options.fallbackType || "fb", fallbackId, options.company)
      : null,
    fallbackId ? buildGraphProfilePictureUrl(fallbackId) : null,
    PLACEHOLDER_IMAGE_URL,
  ];

  return Array.from(new Set(candidates.filter((url): url is string => Boolean(url))));
}

/**
 * Merges caller-supplied avatar URLs with the stored-icon then Graph fallback chain.
 */
export function resolvePageImageCandidates(
  options: ProfileIconCandidateOptions & {
    extraCandidates?: readonly (string | null | undefined)[];
  },
): string[] {
  const extras = (options.extraCandidates ?? []).filter(
    (url): url is string => Boolean(url) && !isUnusableSocialCdnAvatarUrl(url),
  );
  return Array.from(new Set([...extras, ...buildProfileIconCandidates(options)]));
}

export function generateR2Link(type: "fb" | "ig", identifier: string, company: string = "infernollc.com"): string {
  const normalizedId = normalizeProfileIconId(identifier);
  if (!normalizedId || (type === "ig" && !/^\d/.test(normalizedId))) return PLACEHOLDER_IMAGE_URL;
  return buildProfileIconUrl(normalizedId);
}

export function generateR2LinkFromPageData(
  page: {
    pageId: string;
    type?: string | null;
    instagramUserId?: string | null;
  },
  company: string = "infernollc.com",
): string {
  if (page.type === "instagram") {
    // For Instagram, use instagramUserId or pageId (both should be IDs)
    const identifier = page.instagramUserId || page.pageId;
    // Only generate if it's a valid ID (numeric)
    if (identifier && /^\d/.test(identifier)) {
      return generateR2Link("ig", identifier, company);
    }
    return PLACEHOLDER_IMAGE_URL;
  } else {
    // For Facebook pages
    return generateR2Link("fb", page.pageId, company);
  }
}

/**
 * Check if a URL is an R2 link
 */
export function isR2Link(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("media.admanage.ai");
}

/**
 * Get the best available image URL
 * Priority: r2Link > r2_picture > r2_profile_pic > generated R2 > picture > profile_pic > placeholder
 */
export function getBestImageUrl(
  data: {
    r2Link?: string | null;
    r2_picture?: string | null;
    r2_profile_pic?: string | null;
    picture?: string | null;
    profile_pic?: string | null;
    id?: string;
    pageId?: string;
    username?: string;
    type?: string | null;
    instagramUserId?: string | null;
  },
  company?: string,
  fallbackType?: "fb" | "ig",
): string {
  // First priority: explicit r2Link
  if (data.r2Link && isR2Link(data.r2Link)) {
    return data.r2Link;
  }

  // Second priority: r2_picture or r2_profile_pic
  if (data.r2_picture && isR2Link(data.r2_picture)) {
    return data.r2_picture;
  }
  if (data.r2_profile_pic && isR2Link(data.r2_profile_pic)) {
    return data.r2_profile_pic;
  }

  // Third priority: generate R2 link if we have the necessary data
  if (company) {
    if (data.type === "instagram" || fallbackType === "ig") {
      // For Instagram, ONLY use numeric IDs
      const identifier = data.instagramUserId || data.id || data.pageId;
      if (identifier && /^\d/.test(identifier)) {
        return generateR2Link("ig", identifier, company);
      }
    } else if (data.pageId || data.id) {
      const identifier = data.pageId || data.id;
      if (identifier) {
        return generateR2Link("fb", identifier, company);
      }
    }
  }

  // Fourth priority: check if existing picture URLs are not expired
  const existingPic = data.picture || data.profile_pic;
  if (existingPic && !isExpiredSocialMediaUrl(existingPic)) {
    return existingPic;
  }

  // Last resort: placeholder
  return PLACEHOLDER_IMAGE_URL;
}

/**
 * Check if a social media URL is expired (Facebook/Instagram CDN URLs expire)
 */
export function isExpiredSocialMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;

  return (
    url.includes("scontent-") ||
    url.includes("fbcdn.net") ||
    url.includes("facebook.com") ||
    url.includes("cdninstagram.com")
  );
}
