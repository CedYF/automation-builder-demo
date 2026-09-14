"use client";

import { useCallback, useState } from "react";
import { ArrowRight, ChevronDown, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import { SUGGESTED_PROMPTS } from "../lib/automation-registry";
import { AutomationPromptBox } from "./automation-prompt-box";

/** Same short list the old home rail showed — enough to start, not a second catalog. */
const CREATE_MENU_SUGGESTION_LIMIT = 3;

export interface CreateAutomationMenuProps {
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
  readonly onStartBlank: () => void;
  /** Templates on offer, shown on the "start from a template" row. */
  readonly templateCount: number;
}

interface SuggestionRowProps {
  readonly text: string;
  readonly isSuggest: boolean;
  readonly onSelect: () => void;
}

function SuggestionRow({ text, isSuggest, onSelect }: SuggestionRowProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {isSuggest && <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        <span className={cn("truncate text-[13px]", isSuggest ? "font-medium text-foreground" : "text-foreground/80")}>
          {text}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

interface CreateSplitButtonProps {
  readonly onOpenComposer: () => void;
  readonly onStartBlank: () => void;
  readonly onBrowseTemplates: () => void;
}

function CreateSplitButton({
  onOpenComposer,
  onStartBlank,
  onBrowseTemplates,
}: CreateSplitButtonProps): React.ReactElement {
  return (
    <div className="inline-flex items-stretch">
      <Button type="button" onClick={onOpenComposer} className="gap-1.5 rounded-r-none">
        <Plus className="h-4 w-4" />
        Create
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="rounded-l-none border-l border-primary-foreground/20 px-2"
            aria-label="More create options"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onStartBlank}>Blank canvas</DropdownMenuItem>
          <DropdownMenuItem onClick={onBrowseTemplates}>From template</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface CreateComposerSuggestionsProps {
  readonly templateCount: number;
  readonly onPickPrompt: (text: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
  readonly onStartBlank: () => void;
}

function CreateComposerSuggestions({
  templateCount,
  onPickPrompt,
  onBrowseTemplates,
  onStartBlank,
}: CreateComposerSuggestionsProps): React.ReactElement {
  return (
    <div className="border-t border-border/60">
      {SUGGESTED_PROMPTS.slice(0, CREATE_MENU_SUGGESTION_LIMIT).map((prompt) => (
        <SuggestionRow
          key={prompt.text}
          text={prompt.text}
          isSuggest={prompt.mode === "suggest"}
          onSelect={() => onPickPrompt(prompt.text, prompt.mode)}
        />
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-3">
        <button
          type="button"
          onClick={onStartBlank}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Start blank
        </button>
        <button
          type="button"
          onClick={onBrowseTemplates}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Browse {templateCount > 0 ? templateCount : ""}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface CreateComposerDialogProps {
  readonly isOpen: boolean;
  readonly templateCount: number;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
  readonly onStartBlank: () => void;
}

function CreateComposerDialog({
  isOpen,
  templateCount,
  onOpenChange,
  onSubmitGoal,
  onBrowseTemplates,
  onStartBlank,
}: CreateComposerDialogProps): React.ReactElement {
  const finish = useCallback(
    (work: () => void) => {
      onOpenChange(false);
      work();
    },
    [onOpenChange],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <DialogHeader className="mb-0 space-y-1 px-4 pb-3 pt-4">
          <DialogTitle className="text-lg font-bold tracking-tight">What should I automate next?</DialogTitle>
          <DialogDescription>Describe a flow, pick a starting point, or start blank.</DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4">
          <AutomationPromptBox autoFocus onSubmit={(goal) => finish(() => onSubmitGoal(goal))} />
        </div>
        <CreateComposerSuggestions
          templateCount={templateCount}
          onPickPrompt={(text, mode) => finish(() => onSubmitGoal(text, mode))}
          onBrowseTemplates={() => finish(onBrowseTemplates)}
          onStartBlank={() => finish(onStartBlank)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Primary Create control on Automate: the main button opens the AI composer,
 * the chevron skips straight to a blank canvas or templates.
 */
export function CreateAutomationMenu({
  onSubmitGoal,
  onBrowseTemplates,
  onStartBlank,
  templateCount,
}: CreateAutomationMenuProps): React.ReactElement {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <>
      <CreateSplitButton
        onOpenComposer={() => setIsComposerOpen(true)}
        onStartBlank={onStartBlank}
        onBrowseTemplates={onBrowseTemplates}
      />
      <CreateComposerDialog
        isOpen={isComposerOpen}
        templateCount={templateCount}
        onOpenChange={setIsComposerOpen}
        onSubmitGoal={onSubmitGoal}
        onBrowseTemplates={onBrowseTemplates}
        onStartBlank={onStartBlank}
      />
    </>
  );
}
