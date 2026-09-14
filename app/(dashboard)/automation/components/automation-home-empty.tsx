"use client";

import { ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import { AutomationChatLanding } from "./automation-chat-landing";

export interface AutomationHomeEmptyProps {
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
  /**
   * Comment-only roles (ADM-11300) get a recipe-first empty state: the chat
   * landing builds flow automations they cannot save.
   */
  readonly commentsOnly?: boolean;
}

function CommentAutomationsEmpty({ onBrowseTemplates }: Pick<AutomationHomeEmptyProps, "onBrowseTemplates">) {
  return (
    <div
      data-testid="home-empty-comments"
      className="flex h-full flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">No comment automations yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Hide spam, like positive comments or draft replies on your pages. Start from a recipe, pick the pages it should
        run on, then save.
      </p>
      <Button type="button" onClick={onBrowseTemplates} className="mt-6 gap-1.5">
        Browse comment templates
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * The new-user Automate home: the same chat landing as the Chat tab, with copy
 * that names the empty list.
 */
export function AutomationHomeEmpty({
  onSubmitGoal,
  onBrowseTemplates,
  commentsOnly = false,
}: AutomationHomeEmptyProps): React.ReactElement {
  if (commentsOnly) {
    return <CommentAutomationsEmpty onBrowseTemplates={onBrowseTemplates} />;
  }
  return (
    <AutomationChatLanding surface="empty-home" onSubmitGoal={onSubmitGoal} onBrowseTemplates={onBrowseTemplates} />
  );
}
