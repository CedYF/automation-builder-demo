/**
 * Layout classes for the Automate home's fixed-height shell.
 *
 * At `xl` and up the page itself stops scrolling and the automations list owns
 * the only scrollbar. That works only while every element from the tab-content
 * wrapper down to the row scroller is a flex child that is allowed to shrink:
 * a flex item defaults to `min-height: auto`, so one missing `min-h-0` lets the
 * scroller grow to fit all 200+ rows instead of scrolling, and the page
 * scrollbar comes straight back.
 *
 * The chain is declared here, once, so `home-shell-layout.test.ts` can assert
 * the invariant rather than leaving it to whoever next edits a className.
 *
 * Below `xl` the list is a single stacked column, the page scroller is correct,
 * and {@link HOME_LIST_STACKED_MAX_HEIGHT} caps the rows the old way.
 */

/**
 * Row-area cap below `xl`, where the shell is not height-pinned.
 *
 * A guess at the chrome above the list (page header, tab strip, stats strip).
 * It is deliberately confined to the stacked layout: at `xl` the flex shell
 * measures the real leftover space instead, which is why the wide layout no
 * longer double-scrolls when the rate-limit banner appears.
 */
export const HOME_LIST_STACKED_MAX_HEIGHT = "max-h-[calc(100vh-22rem)]";

/** Floor for the stacked scroller, so a short list still looks like a list. */
export const HOME_LIST_STACKED_MIN_HEIGHT = "min-h-[16rem]";

/**
 * Tab-content wrapper in `page.tsx`.
 *
 * Home is the only tab that pins its height; the others render content of
 * unknown length and need the page scroller at every width.
 */
export function homeTabContentClass(isHomeTab: boolean): string {
  const base = "flex min-h-0 flex-1 flex-col overflow-y-auto";
  return isHomeTab ? `${base} xl:overflow-hidden` : base;
}

/** The Home branch's padding wrapper, between the tab content and `AutomationHome`. */
export const HOME_SHELL_PADDING_CLASS = "flex min-h-0 flex-1 flex-col px-4 md:px-8";

/** `AutomationHome`'s root: stats strip plus the list card. */
export const HOME_SHELL_ROOT_CLASS = "flex flex-col gap-4 py-4 xl:min-h-0 xl:flex-1";

/** The list card. Stretches at `xl` so its scroller has something to fill. */
export const HOME_LIST_CARD_CLASS =
  "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card xl:min-h-0 xl:flex-1";

/** The row scroller: capped below `xl`, flex-sized above it. */
export const HOME_LIST_SCROLLER_CLASS = `${HOME_LIST_STACKED_MAX_HEIGHT} ${HOME_LIST_STACKED_MIN_HEIGHT} overflow-auto xl:max-h-none xl:min-h-0 xl:flex-1`;

/**
 * The shrink chain, outermost first, as it appears in the rendered tree.
 *
 * Every entry must permit shrinking at `xl`; every entry below the tab wrapper
 * must also stretch. The test walks this list.
 */
export const HOME_SHELL_SHRINK_CHAIN: readonly string[] = [
  homeTabContentClass(true),
  HOME_SHELL_PADDING_CLASS,
  HOME_SHELL_ROOT_CLASS,
  HOME_LIST_CARD_CLASS,
  HOME_LIST_SCROLLER_CLASS,
];

/**
 * True when a class string lets the element shrink at `xl` — either
 * unconditionally (`min-h-0`) or at the breakpoint (`xl:min-h-0`).
 */
export function allowsShrinkAtXl(className: string): boolean {
  const classes = className.split(/\s+/);
  return classes.includes("min-h-0") || classes.includes("xl:min-h-0");
}

/** True when a class string stretches to fill its flex parent at `xl`. */
export function stretchesAtXl(className: string): boolean {
  const classes = className.split(/\s+/);
  return classes.includes("flex-1") || classes.includes("xl:flex-1");
}
