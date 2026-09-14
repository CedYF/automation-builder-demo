// Shared style tokens for the chat surface. Semantic tokens adapt to light/dark
// via globals.css CSS variables; navy rail tokens are fixed brand chrome for standalone mode.

export const NAVY_BG = "bg-[#0c1f33]";
export const NAVY_TEXT_MUTED = "text-blue-200/60";
export const BRAND_GRADIENT = "bg-gradient-to-br from-indigo-500 to-blue-500";
export const BRAND_GLOW = "shadow-[0_0_16px_rgba(59,130,246,0.5)]";
export const CARD_SHADOW = "shadow-[0_1px_2px_rgba(16,24,40,0.06)]";

export const CHAT_BETA_URL = "/chat";

/** Main chat canvas background */
export const CHAT_SURFACE = "bg-background text-foreground";

/** Elevated card/panel surfaces */
export const CHAT_CARD = "border border-border bg-card";

/** Header bar */
export const CHAT_HEADER = "border-b border-border bg-card";

/** Composer footer bar: blends into the canvas Claude-style — no divider line */
export const CHAT_COMPOSER_BAR = "flex-shrink-0 bg-background";

/** Multi-line composer card: textarea on top, controls row below.
 * No shadow / hover fill — a white hover rim was showing on the docked /chat composer. */
export const CHAT_COMPOSER_CARD =
  "rounded-2xl border border-border bg-card px-3.5 pb-2.5 pt-3 shadow-none transition-[border-color] hover:border-border hover:bg-card hover:shadow-none focus-within:border-blue-400";

/** @-mention popover shell (type picker + entity search) */
export const ENTITY_MENTION_DROPDOWN_SHELL =
  "rounded-[10px] border border-border bg-popover shadow-[0_8px_24px_rgba(0,0,0,0.1)]";

/** Keyboard-selected mention row */
export const ENTITY_MENTION_ROW_SELECTED = "bg-blue-50 dark:bg-blue-950/40";

/** Pointer hover on a mention row that is not keyboard-selected */
export const ENTITY_MENTION_ROW_HOVER = "hover:bg-muted/60";

/** Uppercase section label inside the mention popover */
export const ENTITY_MENTION_SECTION_LABEL =
  "text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

/** Matched substring highlight in mention search results */
export const ENTITY_MENTION_SEARCH_MARK = "rounded-sm bg-amber-200 px-px text-inherit dark:bg-amber-500/40";

/** Composer card while the @-mention dropdown is open */
export const CHAT_COMPOSER_MENTION_ACTIVE = "border-blue-600 ring-[3px] ring-blue-500/10";

/** Icon/action buttons in header and composer */
export const CHAT_ICON_BUTTON =
  "flex h-8.5 w-8.5 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300";

/** Suggestion chips in empty state */
export const CHAT_SUGGESTION_CHIP =
  "flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-blue-400 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:opacity-60";

/** Assistant message body: plain prose on the canvas, Claude-style (no bubble, no avatar) */
export const CHAT_MESSAGE_BODY = "min-w-0 break-words text-[15px] leading-7 text-foreground";

/** User message: muted rounded bubble aligned right, Claude-style */
export const CHAT_USER_BUBBLE =
  "min-w-0 max-w-[85%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl bg-muted px-4 py-2.5 text-[15px] leading-7 text-foreground";

/** Tool call / result card shell */
export const CHAT_TOOL_CARD = "overflow-hidden rounded-xl border border-border bg-card shadow-sm";

/** Tool card header strip */
export const CHAT_TOOL_CARD_HEADER = "border-b border-border bg-muted/50 px-3.5 py-2.5";

/** Secondary/muted panel inside cards */
export const CHAT_MUTED_PANEL = "border-t border-border bg-muted/50";

/** Small action button inside tool rows */
export const CHAT_ACTION_BUTTON =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50";

/** Beta badge */
export const CHAT_BETA_BADGE =
  "flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

/** Agent ad account selector trigger width (composer / header). */
export const CHAT_ACCOUNT_SELECTOR_TRIGGER = "min-w-0 max-w-[12rem] sm:max-w-[16rem]";

/** Agent ad account dropdown list width (wider than trigger for readable names/IDs). */
export const CHAT_ACCOUNT_SELECTOR_POPOVER =
  "w-[min(24rem,calc(100vw-1rem))] min-w-[max(var(--radix-popover-trigger-width),18rem)]";

/** Locked account pill */
export const CHAT_LOCKED_ACCOUNT =
  "flex h-8 max-w-[16rem] items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";

/** Share toast pill */
export const CHAT_SHARE_TOAST =
  "absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full border border-blue-100 bg-card px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm dark:border-blue-800 dark:text-blue-300";
