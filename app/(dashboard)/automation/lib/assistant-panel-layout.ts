export const ASSISTANT_PANEL_MIN_WIDTH_PX = 380;
export const ASSISTANT_PANEL_MAX_WIDTH_PX = 960;
export const ASSISTANT_PANEL_DEFAULT_WIDTH_PX = 520;
export const ASSISTANT_PANEL_EXPANDED_WIDTH_PX = 880;
export const ASSISTANT_PANEL_MINIMIZED_WIDTH_PX = 48;

export type AssistantPanelDisplayMode = "minimized" | "normal" | "expanded";

export type AssistantAskAiToggleResult = "open" | "restore" | "minimize";

export interface AssistantAskAiToggleInput {
  readonly isOpen: boolean;
  readonly displayMode: AssistantPanelDisplayMode;
}

/**
 * Closing the agent docks it to a rail. It must not unmount, or the chat is lost
 * and the right column disappears.
 */
export function nextAssistantPanelModeOnClose(_mode: AssistantPanelDisplayMode): "minimized" {
  return "minimized";
}

/**
 * Minimize steps down one size: overlay → docked panel → rail.
 */
export function nextAssistantPanelModeOnMinimize(mode: AssistantPanelDisplayMode): AssistantPanelDisplayMode {
  if (mode === "expanded") return "normal";
  return "minimized";
}

/**
 * Ask AI never unmounts an already-open agent. Closed → open, rail → restore,
 * open panel → dock to the rail.
 */
export function nextAssistantPanelModeOnAskAiToggle(input: AssistantAskAiToggleInput): AssistantAskAiToggleResult {
  if (!input.isOpen) return "open";
  if (input.displayMode === "minimized") return "restore";
  return "minimize";
}

export function isAssistantPanelExpanded(mode: AssistantPanelDisplayMode): boolean {
  return mode === "expanded";
}

export function isAssistantPanelMinimized(mode: AssistantPanelDisplayMode): boolean {
  return mode === "minimized";
}
