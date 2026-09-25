"use client";

import { ArrowRight, MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AutomationChatTab({ onStart }: { readonly onStart: () => void }): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:py-16">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">AdManage Agent</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">What would you like to automate?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            I can help protect your ads from negative comments. We’ll choose a connected page, review the rule and preview sample comments together.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested automation</p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <MessageSquareText className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold">Hide negative comments on my ads</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Find your connected Facebook and Instagram pages, ask which to watch, then show what would be hidden and why.
              </p>
            </div>
          </div>
          <Button onClick={onStart} className="shrink-0 gap-2">
            Set up with Agent <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Demo pages and comments are simulated. Nothing is hidden on a live account.</p>
    </div>
  );
}
