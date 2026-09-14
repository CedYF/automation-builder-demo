import type { ComposerAttachment, ComposerDraft } from "@/app/chat/lib/suggestions";
import { filterTemplateVariables, resolveAdscanDisplayTitle } from "@/lib/adscan/adscan-ad-display";

export const ADSCAN_CONTEXT_HEADER = "Use this AdScan ad as context:";
export const ADSCAN_USER_PROMPT_SUFFIX = "User prompt: ";
export const ADSCAN_MCP_INSTRUCTIONS_MARKER = "Use MCP where possible:";
export const ADSCAN_ATTACHMENT_ID_PREFIX = "adscan-ad:";
export const ADSCAN_COMPOSER_PLACEHOLDER = "Ask about this ad or request creative variations…";

const VIDEO_URL_PATTERN = /\.(mp4|webm|mov|m3u8)(\?|$)/i;

export interface AdscanMessageDisplay {
  readonly attachment: ComposerAttachment;
  readonly instruction: string;
}

export interface AdscanContextFields {
  readonly adId: string;
  readonly adHash: string | null;
  readonly advertiser: string;
  readonly title: string | null;
  readonly imageUrl: string | null;
  readonly promptSubtitle: string | null;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseContextLineValue(lines: readonly string[], label: string): string | null {
  const prefix = `- ${label}: `;
  const line = lines.find((entry) => entry.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : null;
}

function parseAdscanContextFields(contextBody: string): AdscanContextFields | null {
  const lines = contextBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const adId = parseContextLineValue(lines, "Ad ID");
  const advertiser = parseContextLineValue(lines, "Advertiser");
  if (!adId || !advertiser) return null;

  const imageUrl = parseContextLineValue(lines, "Image URL") ?? parseContextLineValue(lines, "Media URL");
  const title = filterTemplateVariables(parseContextLineValue(lines, "Title"));

  return {
    adId,
    adHash: parseContextLineValue(lines, "Ad hash"),
    advertiser,
    title,
    imageUrl: imageUrl && !VIDEO_URL_PATTERN.test(imageUrl) ? imageUrl : null,
    promptSubtitle: null,
  };
}

function splitAdscanMessageSections(text: string): {
  readonly contextBody: string;
  readonly instruction: string;
} | null {
  if (!text.startsWith(ADSCAN_CONTEXT_HEADER)) return null;

  const promptIndex = text.lastIndexOf(ADSCAN_USER_PROMPT_SUFFIX);
  if (promptIndex === -1) return null;

  const contextBody = text.slice(ADSCAN_CONTEXT_HEADER.length, promptIndex).trim();
  const instruction = text.slice(promptIndex + ADSCAN_USER_PROMPT_SUFFIX.length).trim();

  return { contextBody, instruction };
}

function buildAdscanAttachment(fields: AdscanContextFields, instruction: string): ComposerAttachment {
  const displayTitle = resolveAdscanDisplayTitle({
    title: fields.title,
    advertiserName: fields.advertiser,
  });

  return {
    id: `${ADSCAN_ATTACHMENT_ID_PREFIX}${fields.adId}`,
    label: "From AdScan",
    title: displayTitle,
    subtitle: fields.advertiser,
    imageUrl: fields.imageUrl,
  };
}

function buildHiddenContextBody(options: {
  readonly adId: number;
  readonly adHash?: string | null;
  readonly advertiserName: string;
  readonly title?: string | null;
  readonly body?: string | null;
  readonly hook?: string | null;
  readonly transcript?: string | null;
  readonly ctaText?: string | null;
  readonly linkUrl?: string | null;
  readonly mediaUrl?: string | null;
  readonly imageUrl?: string | null;
  readonly mcpInstructions: readonly string[];
}): string {
  const lines = [
    formatLine("Ad ID", String(options.adId)),
    formatLine("Ad hash", options.adHash),
    formatLine("Advertiser", options.advertiserName),
    formatLine("Title", options.title),
    formatLine("Body", options.body),
    formatLine("Hook", options.hook),
    // Spoken content of a video ad — the analysis is only as good as this, so
    // it sits alongside the copy fields (bounded to keep the prompt small).
    formatLine("Video transcript", formatTranscriptValue(options.transcript)),
    formatLine("CTA", options.ctaText),
    formatLine("Landing URL", options.linkUrl),
    formatLine("Media URL", options.mediaUrl),
    formatLine("Image URL", options.imageUrl),
    "",
    ADSCAN_MCP_INSTRUCTIONS_MARKER,
    ...options.mcpInstructions,
  ].filter(isNonEmptyString);

  return lines.join("\n");
}

/** Max transcript characters kept in the handoff context (token/cost guard). */
const MAX_TRANSCRIPT_CONTEXT_CHARS = 2000;

/** Collapses a transcript to a single bounded line so it stays one context field. */
function formatTranscriptValue(
  transcript: string | null | undefined,
): string | null {
  const collapsed = transcript?.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > MAX_TRANSCRIPT_CONTEXT_CHARS
    ? `${collapsed.slice(0, MAX_TRANSCRIPT_CONTEXT_CHARS)}…`
    : collapsed;
}

function formatLine(label: string, value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? `- ${label}: ${trimmedValue}` : null;
}

/**
 * Builds the persisted MCP payload for an AdScan handoff, with the user-facing prompt at the end.
 */
export function buildAdscanHandoffMessageText(options: {
  readonly userPrompt: string;
  readonly adId: number;
  readonly adHash?: string | null;
  readonly advertiserName: string;
  readonly title?: string | null;
  readonly body?: string | null;
  readonly hook?: string | null;
  readonly transcript?: string | null;
  readonly ctaText?: string | null;
  readonly linkUrl?: string | null;
  readonly mediaUrl?: string | null;
  readonly imageUrl?: string | null;
  readonly mcpInstructions: readonly string[];
}): string {
  const contextBody = buildHiddenContextBody(options);
  return `${ADSCAN_CONTEXT_HEADER}\n\n${contextBody}\n\n${ADSCAN_USER_PROMPT_SUFFIX}${options.userPrompt.trim()}`;
}

/** Returns true when the composer draft carries hidden AdScan MCP context. */
export function isAdscanComposerDraft(draft: ComposerDraft): boolean {
  return (
    draft.attachment?.id.startsWith(ADSCAN_ATTACHMENT_ID_PREFIX) === true &&
    draft.text.startsWith(ADSCAN_CONTEXT_HEADER)
  );
}

/** AdScan drafts keep MCP context in draft.text but show only the user prompt in the input. */
export function getAdscanComposerInputValue(draft: ComposerDraft): string {
  const sections = splitAdscanMessageSections(draft.text);
  return sections?.instruction ?? "";
}

/** Combines hidden AdScan context with the user's visible composer prompt. */
export function mergeAdscanComposerMessage(contextText: string, userInstruction: string): string {
  const sections = splitAdscanMessageSections(contextText);
  if (!sections) return userInstruction.trim() || contextText;

  const trimmedInstruction = userInstruction.trim() || sections.instruction;
  const contextPrefix = contextText.slice(0, contextText.lastIndexOf(ADSCAN_USER_PROMPT_SUFFIX));
  return `${contextPrefix}${ADSCAN_USER_PROMPT_SUFFIX}${trimmedInstruction}`;
}

/** Returns true when persisted chat text carries hidden AdScan MCP context. */
export function isAdscanMessageText(text: string): boolean {
  return text.startsWith(ADSCAN_CONTEXT_HEADER) && text.includes(ADSCAN_USER_PROMPT_SUFFIX);
}

/** Extracts the user-facing prompt from a merged AdScan message. */
export function extractAdscanUserPrompt(text: string): string {
  const sections = splitAdscanMessageSections(text);
  return sections?.instruction ?? text.trim();
}

/**
 * Derives transcript-friendly chip + instruction from a persisted AdScan handoff message.
 * Returns null for regular chat messages.
 */
export function parseAdscanMessageForDisplay(text: string): AdscanMessageDisplay | null {
  const sections = splitAdscanMessageSections(text);
  if (!sections) return null;

  const mcpIndex = sections.contextBody.indexOf(ADSCAN_MCP_INSTRUCTIONS_MARKER);
  const adContextBody = mcpIndex >= 0 ? sections.contextBody.slice(0, mcpIndex).trim() : sections.contextBody;
  const fields = parseAdscanContextFields(adContextBody);
  if (!fields) return null;

  return {
    attachment: buildAdscanAttachment(fields, sections.instruction),
    instruction: sections.instruction,
  };
}

/** Returns true when a media URL should not be rendered as a static image preview. */
export function isVideoPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return VIDEO_URL_PATTERN.test(url.trim());
}
