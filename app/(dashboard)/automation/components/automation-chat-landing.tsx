"use client";

import { useMemo, useState } from "react";
import { ArrowRight, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/providers/user-provider";
import { automationChatIntro, type AutomationChatSurface } from "../lib/automation-chat-intro";
import { suggestionsForChatCategory } from "../lib/automation-chat-suggestions";
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "../lib/automation-templates";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import { buildGreeting } from "../lib/greeting";
import { AutomationPromptBox } from "./automation-prompt-box";

export interface AutomationChatLandingProps {
  readonly surface: AutomationChatSurface;
  readonly onSubmitGoal: (goal: string, mode?: AssistantMode) => void;
  readonly onBrowseTemplates: () => void;
}

interface CategoryChipsProps {
  readonly active: TemplateCategory;
  readonly onChange: (category: TemplateCategory) => void;
}

function CategoryChips({ active, onChange }: CategoryChipsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
      {TEMPLATE_CATEGORIES.map((category) => (
        <button
          key={category.value}
          type="button"
          aria-pressed={category.value === active}
          onClick={() => onChange(category.value)}
          className={cn(
            "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
            category.value === active
              ? "border-primary/20 bg-primary/10 font-semibold text-primary"
              : "border-border text-foreground/80 hover:bg-muted",
          )}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
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
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground/80">
        {isSuggest && <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        <span className="truncate">{text}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * Greeting + composer + category starters. Shared by the zero-automation Home
 * empty state and the dedicated Chat tab so those two surfaces cannot drift.
 */
export function AutomationChatLanding({
  surface,
  onSubmitGoal,
  onBrowseTemplates,
}: AutomationChatLandingProps): React.ReactElement {
  const { extendedUser } = useUser();
  const [category, setCategory] = useState<TemplateCategory>("optimization");
  const greeting = useMemo(
    () => buildGreeting(new Date(), extendedUser?.name, extendedUser?.email),
    [extendedUser?.name, extendedUser?.email],
  );
  const suggestions = suggestionsForChatCategory(category);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 py-6">
      <div className="flex flex-col gap-2.5">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5 text-[13px] font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AdManage Assistant
        </span>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">{greeting}</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{automationChatIntro(surface)}</p>
      </div>

      <AutomationPromptBox size="lg" autoFocus onSubmit={(goal) => onSubmitGoal(goal)} />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <CategoryChips active={category} onChange={setCategory} />
        {suggestions.map((suggestion) => (
          <SuggestionRow
            key={suggestion.text}
            text={suggestion.text}
            isSuggest={suggestion.mode === "suggest"}
            onSelect={() => onSubmitGoal(suggestion.text, suggestion.mode)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <FolderOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
          </span>
          <span className="text-[13.5px] text-foreground/80">
            Prefer a ready-made flow? Browse {AUTOMATION_TEMPLATES.length} templates by goal
          </span>
        </div>
        <button
          type="button"
          onClick={onBrowseTemplates}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          Browse templates
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
