export type FacebookCommentViewUrlSource = "permalink" | "post_derived" | "none";
export type MetaCommentViewPlatform = "facebook" | "instagram";
export type MetaCommentViewUrlSource = FacebookCommentViewUrlSource | "instagram_permalink";

export interface BuildFacebookCommentViewUrlResult {
  url: string | null;
  source: FacebookCommentViewUrlSource;
}

export interface BuildMetaCommentViewUrlResult {
  url: string | null;
  source: MetaCommentViewUrlSource;
  platform: MetaCommentViewPlatform;
}

const FACEBOOK_POST_EMBED_BASE_URL = "https://www.facebook.com/plugins/post.php";
const FACEBOOK_POST_EMBED_HEIGHT_PX = "700";
const FACEBOOK_POST_EMBED_WIDTH_PX = "380";
const INSTAGRAM_HOST_PATTERN = /(^|\.)instagram\.com$/i;

// Hostnames the Facebook post-embed plugin can actually render. Instagram (and
// any other) permalinks fed to plugins/post.php render a broken "content
// unavailable" card, so we must reject them before building the iframe URL.
const FACEBOOK_EMBEDDABLE_HOSTS = ["facebook.com", "fb.com"] as const;

/** True when `url` points at a Facebook host the post-embed plugin supports. */
function isFacebookEmbeddableUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\.|^web\./, "");
    return FACEBOOK_EMBEDDABLE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Builds a URL to open a Facebook comment in the browser.
 * Prefer Graph `permalink_url` when present; otherwise derive `www.facebook.com/{pageId}/posts/{storyFbid}`
 * from `postId` (format `{pageId}_{storyFbid}`) and optionally append `comment_id` for deep links.
 */
export function buildFacebookCommentViewUrl(comment: {
  post_permalink_url?: string;
  permalinkUrl?: string;
  postId?: string;
  post_id?: string | number;
  facebookId?: string;
}): BuildFacebookCommentViewUrlResult {
  const direct = comment.post_permalink_url ?? comment.permalinkUrl;
  if (typeof direct === "string") {
    const trimmed = direct.trim();
    if (trimmed.length > 0) {
      return { url: trimmed, source: "permalink" };
    }
  }

  const rawPostId = comment.postId ?? (comment.post_id != null ? String(comment.post_id) : "");
  if (!rawPostId) {
    const commentGraphId = comment.facebookId != null ? String(comment.facebookId).trim() : "";
    return commentGraphId
      ? { url: `https://www.facebook.com/${encodeURIComponent(commentGraphId)}`, source: "post_derived" }
      : { url: null, source: "none" };
  }

  const underscore = rawPostId.indexOf("_");
  if (underscore <= 0) {
    return { url: null, source: "none" };
  }

  const pageId = rawPostId.slice(0, underscore);
  const storyFbid = rawPostId.slice(underscore + 1);
  if (!pageId || !storyFbid) {
    return { url: null, source: "none" };
  }

  const postPath = `https://www.facebook.com/${pageId}/posts/${storyFbid}`;
  const commentGraphId = comment.facebookId != null ? String(comment.facebookId).trim() : "";
  if (commentGraphId.length > 0) {
    return {
      url: `${postPath}?comment_id=${encodeURIComponent(commentGraphId)}`,
      source: "post_derived",
    };
  }

  return { url: postPath, source: "post_derived" };
}

/**
 * Builds a browser URL for a Meta comment's source post.
 * Instagram media ids are not public shortcodes, so IG can only deep-link when
 * Graph has supplied a real media permalink.
 */
export function buildMetaCommentViewUrl(comment: {
  /** Any platform value is accepted; everything except "instagram" resolves as Facebook. */
  platform?: string;
  post_permalink_url?: string | null;
  permalinkUrl?: string | null;
  postId?: string | null;
  post_id?: string | number | null;
  facebookId?: string | null;
}): BuildMetaCommentViewUrlResult {
  const platform = comment.platform === "instagram" ? "instagram" : "facebook";

  if (platform === "instagram") {
    const permalink = normalizeInstagramPermalink(comment.post_permalink_url ?? comment.permalinkUrl);
    return {
      url: permalink,
      source: permalink ? "instagram_permalink" : "none",
      platform,
    };
  }

  const facebookResult = buildFacebookCommentViewUrl({
    post_permalink_url: comment.post_permalink_url ?? undefined,
    permalinkUrl: comment.permalinkUrl ?? undefined,
    postId: comment.postId ?? undefined,
    post_id: comment.post_id ?? undefined,
    facebookId: comment.facebookId ?? undefined,
  });

  return {
    ...facebookResult,
    platform,
  };
}

function normalizeInstagramPermalink(permalink: string | null | undefined): string | null {
  if (typeof permalink !== "string") return null;

  const trimmed = permalink.trim();
  if (trimmed.length === 0) return null;

  try {
    const url = new URL(trimmed);
    return INSTAGRAM_HOST_PATTERN.test(url.hostname) ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Builds the iframe URL for Facebook's embedded post plugin.
 * Returns null when we cannot produce a Facebook post URL from the comment data,
 * or when the resolved permalink is not a Facebook URL (e.g. an Instagram
 * permalink — the FB plugin renders those as a broken "content unavailable"
 * card, so callers should fall back to an empty state instead).
 */
export function buildFacebookPostEmbedUrl(comment: {
  post_permalink_url?: string;
  permalinkUrl?: string;
  postId?: string;
  post_id?: string | number;
}): string | null {
  const viewUrl = buildFacebookCommentViewUrl({
    post_permalink_url: comment.post_permalink_url,
    permalinkUrl: comment.permalinkUrl,
    postId: comment.postId,
    post_id: comment.post_id,
  }).url;
  if (!viewUrl || !isFacebookEmbeddableUrl(viewUrl)) return null;

  const embedUrl = new URL(FACEBOOK_POST_EMBED_BASE_URL);
  embedUrl.searchParams.set("href", viewUrl);
  // Caption hidden: the reply panel is about the creative + comment thread,
  // not the advertiser's copy (matches data-show-text="false" on the SDK path).
  embedUrl.searchParams.set("show_text", "false");
  embedUrl.searchParams.set("height", FACEBOOK_POST_EMBED_HEIGHT_PX);
  embedUrl.searchParams.set("width", FACEBOOK_POST_EMBED_WIDTH_PX);
  return embedUrl.toString();
}
