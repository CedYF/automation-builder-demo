import type { AssistantMode } from "../hooks/use-automation-assistant";
import type { TemplateCategory } from "./automation-templates";

/** Starting points offered under the composer before any templates are shown. */
export const AUTOMATION_CHAT_SUGGESTION_LIMIT = 3;

export interface AutomationChatSuggestion {
  readonly text: string;
  readonly mode?: AssistantMode;
}

/**
 * Concrete first automations per category.
 *
 * Phrased as the outcome the user wants rather than the flow they would build.
 */
export const SUGGESTIONS_BY_CATEGORY: Readonly<Record<string, readonly AutomationChatSuggestion[]>> = {
  optimization: [
    { text: "Pause Meta ads under 1.0 ROAS after $50 spend" },
    { text: "Cap spend when CPA rises 30% day-over-day" },
    { text: "Turn off ad sets with zero purchases after 48 hours" },
  ],
  scaling: [
    { text: "Raise budget 20% on ad sets above 2.0 ROAS" },
    { text: "Duplicate my best performing ads into a new ad set" },
    { text: "Launch ads automatically when I upload new videos" },
  ],
  reporting: [
    { text: "Send me a spend and ROAS digest every Monday" },
    { text: "Alert me when an account's daily spend jumps 40%" },
    { text: "Suggest an automation from my last 7 days", mode: "suggest" },
  ],
  comments: [
    { text: "Hide negative comments on my ads automatically" },
    { text: "Like positive comments as they come in" },
    { text: "Reply to questions about shipping with a set answer" },
  ],
};

const FALLBACK_SUGGESTIONS: readonly AutomationChatSuggestion[] = SUGGESTIONS_BY_CATEGORY.optimization;

/** Starters for one template category, capped so the landing stays short. */
export function suggestionsForChatCategory(category: TemplateCategory): readonly AutomationChatSuggestion[] {
  return (SUGGESTIONS_BY_CATEGORY[category] ?? FALLBACK_SUGGESTIONS).slice(0, AUTOMATION_CHAT_SUGGESTION_LIMIT);
}
