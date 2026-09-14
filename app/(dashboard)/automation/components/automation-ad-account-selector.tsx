"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdAccountPlatformIcon } from "@/components/ad-account-platform-icon";
import { areAdAccountIdsEquivalent } from "@/lib/ad-accounts/resolve-preferred-ad-account-id";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useUser } from "@/lib/providers/user-provider";
import {
  META_AUTOMATION_ACCOUNT_PLATFORMS,
  buildAutomationAccountPlatformsLabel,
} from "../lib/automation-account-platform";
import {
  buildAutomationAdAccountOptions,
  findAutomationAdAccountOption,
  isSameAutomationAdAccountSelection,
  resolveAutomationAdAccountLabel,
} from "../lib/automation-ad-account-options";

interface AdAccountOption {
  value: string;
  label: string;
  businessId: string;
  type: string | null;
  currency?: string | null;
}

export type AutomationAdAccountSelectorSize = "default" | "compact";

interface AutomationAdAccountSelectorProps {
  value: string;
  onChange: (value: string, type: string | null, currency?: string | null, label?: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  /**
   * Platforms this picker may offer. Defaults to Meta-only: most automation config
   * panels write Meta-shaped config (act_-prefixed accountId, Meta metric names) and
   * would build an unrunnable rule against a TikTok advertiser. Widen it only where
   * the consumer genuinely handles the other platform — see the builder header.
   */
  allowedPlatforms?: readonly string[];
  /** "compact" matches the launch chooseAdAccount2 trigger in the assistant composer. */
  size?: AutomationAdAccountSelectorSize;
  /**
   * Optional per-account annotation rendered beside the label, for consumers who
   * know something about an account this picker doesn't — e.g. whether a Triple
   * Whale shop tracks it, which decides whether the rule can return anything.
   * Return `null` to annotate nothing, including while the answer is unknown.
   */
  renderOptionBadge?: (accountId: string) => ReactNode;
}

const ALL_ACCOUNTS_VALUE = "__all_accounts__";

const TRIGGER_CLASS: Readonly<Record<AutomationAdAccountSelectorSize, string>> = {
  default: "h-10 w-full justify-between",
  compact: "relative h-8 w-auto min-w-[10rem] max-w-[16rem] px-2 transition-colors hover:scale-100",
};

const POPOVER_CLASS: Readonly<Record<AutomationAdAccountSelectorSize, string>> = {
  default: "w-full min-w-[300px] p-0",
  compact:
    "w-[min(24rem,calc(100vw-1rem))] min-w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0",
};

export function AutomationAdAccountSelector({
  value,
  onChange,
  placeholder = "Select ad account...",
  allowEmpty = false,
  disabled = false,
  allowedPlatforms = META_AUTOMATION_ACCOUNT_PLATFORMS,
  size = "default",
  renderOptionBadge,
}: AutomationAdAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isCompact = size === "compact";

  const { extendedUser, currentWorkspace, isLoading: userLoading } = useUser();

  const adAccountOptions = useMemo<AdAccountOption[]>(() => {
    const workspaceId = currentWorkspace?.id ?? extendedUser?.defaultWorkspaceId;
    return buildAutomationAdAccountOptions({
      workspaceId,
      allowedPlatforms,
      settings: extendedUser?.settings ?? [],
      workspaceAccounts: currentWorkspace?.adAccounts ?? [],
    });
  }, [allowedPlatforms, currentWorkspace, extendedUser]);

  const platformsLabel = buildAutomationAccountPlatformsLabel(allowedPlatforms);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return adAccountOptions;
    const searchLower = searchTerm.toLowerCase();
    return adAccountOptions.filter(
      (option) => option.label.toLowerCase().includes(searchLower) || option.value.toLowerCase().includes(searchLower),
    );
  }, [adAccountOptions, searchTerm]);

  const selectedOption = findAutomationAdAccountOption(adAccountOptions, value);
  const selectedValue = selectedOption?.value;

  useEffect(() => {
    if (adAccountOptions.length === 0 || allowEmpty || disabled) return;
    if (selectedValue) return;

    const defaultAccount = findAutomationAdAccountOption(adAccountOptions, extendedUser?.defaultAccountId ?? "");
    const accountToSelect = defaultAccount ?? adAccountOptions[0];
    onChange(accountToSelect.value, accountToSelect.type, accountToSelect.currency, accountToSelect.label);
  }, [selectedValue, adAccountOptions, extendedUser?.defaultAccountId, onChange, allowEmpty, disabled]);

  if (userLoading) {
    return (
      <Button variant="outline" className={TRIGGER_CLASS[size]} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading accounts...</span>
      </Button>
    );
  }

  if (adAccountOptions.length === 0) {
    return (
      <div className="rounded-md border bg-muted/50 p-2 text-sm text-muted-foreground">
        No {platformsLabel} ad accounts connected. Please connect an account in Settings.
      </div>
    );
  }

  // A stored account can come from another workspace of the org; hydrate its
  // name from any workspace's account list instead of showing the raw act_ id.
  const crossWorkspaceLabel =
    !selectedOption && value ? resolveAutomationAdAccountLabel(value, extendedUser?.workspaces ?? []) : null;

  const triggerLabel = selectedOption
    ? selectedOption.label
    : value
      ? (crossWorkspaceLabel ?? value)
      : allowEmpty
        ? `All ${platformsLabel} accounts (no filter)`
        : placeholder;

  return (
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={TRIGGER_CLASS[size]}
        >
          <div className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-left", isCompact && "pr-6")}>
            {selectedOption ? <AdAccountPlatformIcon type={selectedOption.type} /> : null}
            <span className="block min-w-0 flex-1 truncate leading-tight">{triggerLabel}</span>
          </div>
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50",
              isCompact ? "absolute right-2 top-1/2 -translate-y-1/2" : "ml-2",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={POPOVER_CLASS[size]}
        align={isCompact ? "end" : "start"}
        collisionPadding={12}
        sideOffset={8}
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search account..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {allowEmpty && (
                <CommandItem
                  key="__all_accounts__"
                  value={ALL_ACCOUNTS_VALUE}
                  onSelect={() => {
                    onChange("", null, null, "");
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground">All {platformsLabel} accounts (no filter)</span>
                </CommandItem>
              )}
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    if (!isSameAutomationAdAccountSelection(value, option.value)) {
                      onChange(option.value, option.type, option.currency, option.label);
                    }
                    setOpen(false);
                  }}
                  className="group cursor-pointer hover:bg-muted"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      areAdAccountIdsEquivalent(value, option.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden py-0.5">
                    <div className="flex items-center gap-2">
                      <AdAccountPlatformIcon type={option.type} />
                      <span className="min-w-0 flex-1 truncate text-sm leading-tight">{option.label}</span>
                      {renderOptionBadge?.(option.value)}
                    </div>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">{option.value}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
