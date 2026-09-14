"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutomation } from "../contexts/automation-context";
import { AutomationAdAccountSelector } from "./automation-ad-account-selector";
import { BUILDER_AUTOMATION_ACCOUNT_PLATFORMS } from "../lib/automation-account-platform";

const PLACEHOLDER = "Ask anything — or describe an automation…";

export interface AutomationPromptBoxProps {
  /** Called with the typed goal once an ad account is selected. */
  readonly onSubmit: (goal: string) => void;
  /** "lg" is the empty-state composer; "sm" is the Create menu and Chat landing. */
  readonly size?: "sm" | "lg";
  readonly autoFocus?: boolean;
}

/**
 * The chat composer that starts an automation.
 *
 * Shared by Create, Chat, and the new-user empty state so they cannot drift
 * on placeholder, account gating or submit behaviour.
 */
export function AutomationPromptBox({
  onSubmit,
  size = "sm",
  autoFocus = false,
}: AutomationPromptBoxProps): React.ReactElement {
  const [value, setValue] = useState("");
  const { flow, setSelectedAccount } = useAutomation();
  const hasAccount = Boolean(flow.selectedAccountId);
  const canSubmit = Boolean(value.trim()) && hasAccount;
  const isLarge = size === "lg";

  const submit = () => {
    const goal = value.trim();
    if (!goal || !hasAccount) return;
    onSubmit(goal);
    setValue("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card transition-colors focus-within:border-primary/40",
        isLarge ? "p-4 shadow-sm" : "p-3",
      )}
    >
      <input
        value={value}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the composer is the primary action on an empty Automate home
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={PLACEHOLDER}
        aria-label="Describe an automation"
        className={cn(
          "w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground",
          isLarge ? "text-[15px]" : "text-sm",
        )}
      />

      <div className="flex min-w-0 items-center justify-end gap-2">
        <AutomationAdAccountSelector
          size="compact"
          value={flow.selectedAccountId ?? ""}
          onChange={(accountId, _type, _currency, label) => setSelectedAccount(accountId, label ?? accountId)}
          placeholder="Select an ad account..."
          allowedPlatforms={BUILDER_AUTOMATION_ACCOUNT_PLATFORMS}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send to the assistant"
          title={hasAccount ? "Send to the assistant" : "Pick an ad account first"}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-40",
            isLarge ? "h-8 w-8" : "h-7 w-7",
          )}
        >
          <ArrowUp className={cn(isLarge ? "h-4 w-4" : "h-3.5 w-3.5")} />
        </button>
      </div>
    </form>
  );
}
