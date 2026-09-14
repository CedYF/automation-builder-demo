import type { ComposerDraft } from "./suggestions";
import { CHAT_BETA_URL } from "./theme";
import { isAdscanMessageText, parseAdscanMessageForDisplay } from "@/lib/adscan/adscan-chat-context";

export const CHAT_HANDOFF_STORAGE_KEY = "admanage:chat-handoff:v1";
export const CHAT_HANDOFF_QUERY_PARAM = "handoff";

const MAX_HANDOFF_TEXT_LENGTH = 24_000;

export interface ChatHandoffMeta {
  readonly source?: string;
  readonly productId?: number;
  readonly conceptTitle?: string;
}

interface StoredChatHandoff {
  readonly draft: ComposerDraft;
  readonly meta?: ChatHandoffMeta;
  readonly savedAt: string;
}

export interface ChatHandoffPayload {
  readonly draft: ComposerDraft;
  readonly meta?: ChatHandoffMeta;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function normalizeDraft(draft: ComposerDraft): ComposerDraft | null {
  const text = draft.text.trim().slice(0, MAX_HANDOFF_TEXT_LENGTH);
  if (!text) return null;
  return {
    text,
    attachment: draft.attachment,
  };
}

/**
 * Persists a composer draft for one-time consumption on the chat page.
 */
export function saveChatHandoff(draft: ComposerDraft, meta?: ChatHandoffMeta): boolean {
  if (!isBrowser()) return false;
  const normalizedDraft = normalizeDraft(draft);
  if (!normalizedDraft) return false;

  const payload: StoredChatHandoff = {
    draft: normalizedDraft,
    meta,
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(CHAT_HANDOFF_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function parseStoredHandoff(raw: string): ChatHandoffPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const draftRecord = record.draft;
    if (!draftRecord || typeof draftRecord !== "object" || Array.isArray(draftRecord)) return null;
    const draftObj = draftRecord as Record<string, unknown>;
    if (typeof draftObj.text !== "string") return null;

    const normalizedDraft = normalizeDraft({
      text: draftObj.text,
      attachment: parseAttachment(draftObj.attachment),
    });
    if (!normalizedDraft) return null;

    return {
      draft: normalizedDraft,
      meta: parseMeta(record.meta),
    };
  } catch {
    return null;
  }
}

function parseAttachment(value: unknown): ComposerDraft["attachment"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string" || typeof record.title !== "string") {
    return undefined;
  }
  return {
    id: record.id,
    label: record.label,
    title: record.title,
    subtitle: typeof record.subtitle === "string" ? record.subtitle : null,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
  };
}

function parseMeta(value: unknown): ChatHandoffMeta | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const meta: ChatHandoffMeta = {
    source: typeof record.source === "string" ? record.source : undefined,
    productId: typeof record.productId === "number" ? record.productId : undefined,
    conceptTitle: typeof record.conceptTitle === "string" ? record.conceptTitle : undefined,
  };
  return meta.source || meta.productId || meta.conceptTitle ? meta : undefined;
}

/**
 * Reads and clears a pending chat handoff from sessionStorage.
 */
export function consumeChatHandoff(): ChatHandoffPayload | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(CHAT_HANDOFF_STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(CHAT_HANDOFF_STORAGE_KEY);
  return parseStoredHandoff(raw);
}

/**
 * Returns true when the current URL indicates a pending chat handoff.
 */
export function hasChatHandoffQuery(searchParams: URLSearchParams): boolean {
  return searchParams.get(CHAT_HANDOFF_QUERY_PARAM) === "1";
}

export function buildChatHandoffUrl(): string {
  return `${CHAT_BETA_URL}?${CHAT_HANDOFF_QUERY_PARAM}=1`;
}

/** Ensures AdScan handoff drafts keep a composer attachment even if storage omitted it. */
export function resolveHandoffComposerDraft(draft: ComposerDraft): ComposerDraft {
  if (draft.attachment) return draft;
  if (!isAdscanMessageText(draft.text)) return draft;
  const display = parseAdscanMessageForDisplay(draft.text);
  if (!display) return draft;
  return { text: draft.text, attachment: display.attachment };
}

/**
 * Saves draft context and navigates to the chat page for a fresh conversation.
 */
export function navigateToChatWithContext(
  draft: ComposerDraft,
  meta?: ChatHandoffMeta,
  navigate: (url: string) => void = (url) => {
    window.location.assign(url);
  },
): boolean {
  if (!saveChatHandoff(draft, meta)) return false;
  navigate(buildChatHandoffUrl());
  return true;
}
