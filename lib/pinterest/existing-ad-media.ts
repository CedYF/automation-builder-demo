/** Source media is copied into a new Pin; source Pin/board/media IDs are never reused. */
export interface PinterestImportMedia {
  type: "image" | "video" | null;
  url: string | null;
  thumbnail: string | null;
  title: string;
  description: string;
  link: string;
  unavailableReason: string | null;
}

interface PinAsset {
  url?: string;
  width?: number;
  height?: number;
}
export interface PinterestImportPin {
  title?: string;
  description?: string;
  link?: string;
  media?: {
    media_type?: string;
    images?: Record<string, PinAsset>;
    cover_image_url?: string;
    video_url?: string;
  };
}

function publicUrl(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function resolvePinterestImportMedia(
  pin: PinterestImportPin | null,
  creativeType?: string,
): PinterestImportMedia {
  const media = pin?.media;
  const images = Object.entries(media?.images ?? {}).sort(
    ([ak, a], [bk, b]) =>
      (bk === "originals" ? Infinity : (b.width ?? 0) * (b.height ?? 0)) -
      (ak === "originals" ? Infinity : (a.width ?? 0) * (a.height ?? 0)),
  );
  const image = images.map(([, asset]) => publicUrl(asset.url)).find(Boolean) ?? null;
  const mediaType = media?.media_type?.toLowerCase();
  const adType = creativeType?.toUpperCase();
  // Never flatten a carousel, collection or shopping ad to its first image.
  const unsupported =
    (mediaType && !["image", "video"].includes(mediaType)) ||
    (adType && !["REGULAR", "VIDEO", "VIDEO_LARGE"].includes(adType));
  const type = unsupported
    ? null
    : mediaType === "video" || adType?.startsWith("VIDEO")
      ? "video"
      : mediaType === "image"
        ? "image"
        : null;
  const url = type === "video" ? publicUrl(media?.video_url) : type === "image" ? image : null;
  return {
    type,
    url,
    thumbnail: publicUrl(media?.cover_image_url) || image,
    title: pin?.title ?? "",
    description: pin?.description ?? "",
    link: pin?.link ?? "",
    unavailableReason: url
      ? null
      : type === "video"
        ? "Pinterest did not provide the video file. Upload the original video to copy this ad."
        : unsupported
          ? "This ad format cannot be copied here. Load its original media instead."
          : "Pinterest did not provide usable media for this ad.",
  };
}

export function pinterestAdToLaunchMedia(
  ad: {
    adId: string;
    adName: string;
    destinationUrl?: string | null;
    callToAction?: string | null;
    importMedia?: PinterestImportMedia;
  },
  sourceAccountId: string,
  includeCopy = true,
): Record<string, unknown> | null {
  const media = ad.importMedia;
  if (!media?.url || !media.type || media.unavailableReason) return null;
  return {
    id: `pinterest-${sourceAccountId}-${ad.adId}`,
    name: ad.adName,
    customName: ad.adName,
    preview: media.url,
    url: media.url,
    thumbnail: media.thumbnail || media.url,
    type: media.type,
    ...(media.type === "video" ? { mimeType: "video/mp4" } : {}),
    pinterestSourceAdAccountId: sourceAccountId,
    ...(includeCopy
      ? {
          adCopyTitle: media.title,
          adCopyDescription: media.description,
          adCopyLink: ad.destinationUrl || media.link,
          adCopyCta: ad.callToAction || undefined,
        }
      : {}),
  };
}
