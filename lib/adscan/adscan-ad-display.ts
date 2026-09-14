import { isVideoPreviewUrl } from "./adscan-chat-context";

const TEMPLATE_VARIABLE_PATTERN = /\{\{[^}]+\}\}|\{[\w.]+\}/;

/**
 * Returns true when copy still contains unresolved dynamic-creative tokens.
 */
export function containsTemplateVariables(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return TEMPLATE_VARIABLE_PATTERN.test(value);
}

/**
 * Drops unresolved template tokens so UI and MCP do not surface `{{product.name}}`.
 */
export function filterTemplateVariables(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  if (containsTemplateVariables(value)) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

export interface ResolveAdscanDisplayTitleOptions {
  readonly title?: string | null;
  readonly hook?: string | null;
  readonly body?: string | null;
  readonly advertiserName: string;
}

/**
 * Picks human-readable card copy, skipping dynamic-creative template placeholders.
 */
export function resolveAdscanDisplayTitle(options: ResolveAdscanDisplayTitleOptions): string {
  const title = filterTemplateVariables(options.title);
  if (title) return title;

  if (containsTemplateVariables(options.title)) {
    return options.advertiserName;
  }

  const hook = filterTemplateVariables(options.hook);
  if (hook) return truncateLabel(hook, 72);

  const body = filterTemplateVariables(options.body);
  if (body) return truncateLabel(body, 72);

  return options.advertiserName;
}

/**
 * Guesses a JPEG poster URL from an AdScan video asset URL.
 */
export function deriveJpgPosterFromVideoUrl(videoUrl: string | null | undefined): string | null {
  if (!videoUrl || !/\.mp4(\?|$)/i.test(videoUrl)) return null;
  return videoUrl.replace(/\.mp4(\?.*)?$/i, ".jpg$1");
}

/** Seek target (seconds) that coerces Safari to paint a real first frame instead of black. */
export const FIRST_FRAME_SEEK_SECONDS = 0.1;
const FIRST_FRAME_MEDIA_FRAGMENT = `#t=${FIRST_FRAME_SEEK_SECONDS}`;

/**
 * Appends an MPEG media fragment so a poster-less `<video>` paints its first
 * frame instead of a black box. The fragment is resolved client-side and never
 * sent to the origin, so it cannot break signed CDN URLs. No-op when the URL
 * already carries a fragment.
 *
 * Chrome and Firefox honor the fragment alone; Safari (especially iOS) also
 * needs a programmatic `currentTime` seek to {@link FIRST_FRAME_SEEK_SECONDS}
 * on `loadedmetadata` (see `AdScanMedia`) or it still renders black pixels.
 */
export function firstFrameVideoUrl(videoUrl: string): string {
  return videoUrl.includes("#") ? videoUrl : `${videoUrl}${FIRST_FRAME_MEDIA_FRAGMENT}`;
}

export interface ResolveAdscanPreviewImageUrlOptions {
  readonly imagePoster?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly mediaUrl?: string | null;
  /** Meta Ads Library poster (`video_preview_image_url`) — may expire. */
  readonly videoPreviewImageUrl?: string | null;
}

function firstRenderableImageUrl(candidates: ReadonlyArray<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || isVideoPreviewUrl(trimmed)) continue;
    return trimmed;
  }
  return null;
}

/**
 * Resolves the best static preview for AdScan handoff cards
 * (thumbnail > Meta preview > poster > derived jpg).
 */
export function resolveAdscanPreviewImageUrl(options: ResolveAdscanPreviewImageUrlOptions): string | null {
  const mediaUrl = options.mediaUrl?.trim() || null;
  const imagePoster = options.imagePoster?.trim() || null;

  return firstRenderableImageUrl([
    options.thumbnailUrl,
    options.videoPreviewImageUrl,
    imagePoster,
    mediaUrl,
    deriveJpgPosterFromVideoUrl(imagePoster),
    deriveJpgPosterFromVideoUrl(mediaUrl),
  ]);
}

const ADSCAN_DETAIL_REFERENCE_BASE_URL = "https://adscan.ai/ad/";
const ADSCAN_FILES_HOST_PATTERN = /^(?:www\.)?files\.adscan\.ai$/i;
const ADSCAN_META_REFERENCE_PREFIX = "meta:";

export interface BuildAdscanDetailReferenceUrlOptions {
  readonly adId?: number | null;
  readonly hash?: string | null;
}

/**
 * Builds the AdScan detail URL that api-admanage expands via ads.getClonePayload.
 * Prefer the internal ad PK — ad.hash is often a Meta archive id that does not resolve.
 */
export function buildAdscanDetailReferenceUrl(
  options: BuildAdscanDetailReferenceUrlOptions | string | null | undefined,
): string | null {
  if (typeof options === "string" || options === null || options === undefined) {
    const trimmed = options?.trim();
    return trimmed ? `${ADSCAN_DETAIL_REFERENCE_BASE_URL}${encodeURIComponent(trimmed)}` : null;
  }

  if (typeof options.adId === "number" && Number.isFinite(options.adId) && options.adId > 0) {
    return `${ADSCAN_DETAIL_REFERENCE_BASE_URL}${options.adId}`;
  }

  const hash = options.hash?.trim();
  return hash ? `${ADSCAN_DETAIL_REFERENCE_BASE_URL}${encodeURIComponent(hash)}` : null;
}

function encodeBase64Url(value: string): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(value, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(value)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface BuildAdscanMetaReferenceUrlOptions {
  readonly referenceImages: readonly string[];
  readonly headline?: string | null;
  readonly advertiserName?: string | null;
}

/**
 * Builds a synthetic AdScan detail URL carrying explicit reference images for video ads.
 */
export function buildAdscanMetaReferenceUrl(options: BuildAdscanMetaReferenceUrlOptions): string | null {
  const referenceImages = options.referenceImages
    .map((url) => url.trim())
    .filter((url) => url.length > 0 && !isUnreliableStudioReferenceUrl(url));
  if (referenceImages.length === 0) return null;

  const payload = {
    referenceImages,
    ...(options.headline ? { headline: options.headline } : {}),
    ...(options.advertiserName ? { advertiserName: options.advertiserName } : {}),
  };
  return `${ADSCAN_DETAIL_REFERENCE_BASE_URL}${ADSCAN_META_REFERENCE_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
}

/**
 * Returns true when a URL is a guessed .jpg poster derived from an AdScan .mp4 asset path.
 */
export function isLikelyDerivedAdscanVideoPoster(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    if (!ADSCAN_FILES_HOST_PATTERN.test(parsed.hostname)) return false;
    return /\/\d+\.jpg(?:$|\?)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Returns true when a reference URL is likely to fail studio rehosting (404/hotlink).
 */
export function isUnreliableStudioReferenceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return isLikelyDerivedAdscanVideoPoster(trimmed) || /\.mp4(?:$|\?)/i.test(trimmed);
}

const DIRECT_IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:$|\?)/i;
const ADSCAN_DETAIL_REFERENCE_HOST_PATTERN = /^(?:www\.)?adscan\.ai$/i;

/**
 * Returns true when a URL points at a downloadable still image asset.
 */
export function isDirectStudioReferenceImageUrl(url: string | null | undefined): boolean {
  if (!url || isUnreliableStudioReferenceUrl(url)) return false;
  try {
    const parsed = new URL(url.trim());
    if (isVideoPreviewUrl(parsed.toString())) return false;
    if (DIRECT_IMAGE_EXTENSION_PATTERN.test(parsed.pathname)) return true;
    return ADSCAN_FILES_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Returns true when a URL is an AdScan detail/meta reference that must be expanded server-side.
 */
export function isAdscanDetailReferenceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return ADSCAN_DETAIL_REFERENCE_HOST_PATTERN.test(parsed.hostname) && parsed.pathname.startsWith("/ad/");
  } catch {
    return false;
  }
}

/**
 * Keeps only studio-safe reference URLs. Prefer direct image assets over AdScan detail/meta links.
 */
export function sanitizeStudioReferenceImageUrls(urls: readonly string[]): string[] {
  const trimmed = urls.map((url) => url.trim()).filter((url) => url.length > 0);
  const directImages = trimmed.filter(isDirectStudioReferenceImageUrl);
  if (directImages.length > 0) {
    return Array.from(new Set(directImages));
  }

  const detailUrls = trimmed.filter(isAdscanDetailReferenceUrl);
  if (detailUrls.length > 0) {
    return [detailUrls[0]];
  }

  return [];
}

export interface ResolveAdscanMcpReferenceImageUrlOptions {
  readonly adId?: number | null;
  readonly hash?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly previewImageUrl?: string | null;
  readonly advertiserName?: string | null;
  readonly title?: string | null;
}

/**
 * Picks the MCP-safe AdScan reference URL for generate_ai_image.
 * Prefer direct downloadable assets; use detail/meta links only when no still image exists.
 */
export function resolveAdscanMcpReferenceImageUrl(options: ResolveAdscanMcpReferenceImageUrlOptions): string | null {
  const directPreview = [options.thumbnailUrl, options.previewImageUrl].find((url) =>
    isDirectStudioReferenceImageUrl(url),
  );
  if (directPreview) return directPreview.trim();

  const metaReferenceUrl = buildAdscanMetaReferenceUrl({
    referenceImages: [options.thumbnailUrl, options.previewImageUrl].filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0,
    ),
    headline: options.title,
    advertiserName: options.advertiserName,
  });
  if (metaReferenceUrl) return metaReferenceUrl;

  const detailUrl = buildAdscanDetailReferenceUrl({ adId: options.adId, hash: options.hash });
  if (detailUrl) return detailUrl;

  const previewImageUrl = options.previewImageUrl?.trim() || null;
  if (!previewImageUrl || isUnreliableStudioReferenceUrl(previewImageUrl)) return null;
  return previewImageUrl;
}
