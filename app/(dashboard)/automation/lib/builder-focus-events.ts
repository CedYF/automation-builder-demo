/**
 * Header → canvas hop for the first incomplete step. The context bar lives in
 * the header; step selection lives in the flow builder, so a window event is
 * the narrow seam that does not pull selection into the automation context.
 */

export const BUILDER_FOCUS_INCOMPLETE_EVENT = "admanage:builder-focus-incomplete";

export function emitBuilderFocusIncomplete(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUILDER_FOCUS_INCOMPLETE_EVENT));
}

export function onBuilderFocusIncomplete(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (): void => {
    handler();
  };
  window.addEventListener(BUILDER_FOCUS_INCOMPLETE_EVENT, listener);
  return () => window.removeEventListener(BUILDER_FOCUS_INCOMPLETE_EVENT, listener);
}
