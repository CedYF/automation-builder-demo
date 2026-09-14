"use client";

import type { AssistantMode } from "../hooks/use-automation-assistant";
import { AutomationChatLanding } from "./automation-chat-landing";

export interface AutomationChatTabProps {
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
}

/**
 * Dedicated Automate Chat tab. Same layout as the empty Home, without claiming
 * the workspace has zero automations.
 */
export function AutomationChatTab({ onSubmitGoal, onBrowseTemplates }: AutomationChatTabProps): React.ReactElement {
  return <AutomationChatLanding surface="chat-tab" onSubmitGoal={onSubmitGoal} onBrowseTemplates={onBrowseTemplates} />;
}
