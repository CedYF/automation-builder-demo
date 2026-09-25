"use client";

import { ArrowRight, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AutomationHomeEmptyProps {
  readonly onBrowseTemplates: () => void;
}

export function AutomationHomeEmpty({ onBrowseTemplates }: AutomationHomeEmptyProps): React.ReactElement {
  return (
    <div
      data-testid="home-empty-comments"
      className="flex h-full flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <EyeOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">No automations yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Start with Auto-hide negative comments. Choose the page it should watch, review the flow, then save.
      </p>
      <Button type="button" onClick={onBrowseTemplates} className="mt-6 gap-1.5">
        View template
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
