"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useAutomationTrialStatus,
  useEffectiveOrganizationPlanName,
} from "@/lib/automation/use-essential-automation-plan";

export function AutomationTrialBanner() {
  const effectivePlanName = useEffectiveOrganizationPlanName();
  const trialStatus = useAutomationTrialStatus();

  if (effectivePlanName !== "essential" || trialStatus.state === "none") return null;

  const isActive = trialStatus.state === "active";

  return (
    <div
      className={
        isActive
          ? "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
          : "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">
            {isActive
              ? `Full Automations trial: ${trialStatus.daysRemaining} ${trialStatus.daysRemaining === 1 ? "day" : "days"} left`
              : "Your full Automations trial has ended"}
          </p>
          <p className="text-xs opacity-80">
            {isActive
              ? "You can use every Automations trigger until the trial ends. Your Essential subscription is unchanged."
              : "Performance Monitoring remains included with Essential. Upgrade to In-House to keep using all triggers."}
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant={isActive ? "outline" : "default"}>
        <Link href="/mybilling">{isActive ? "View plans" : "Upgrade Automations"}</Link>
      </Button>
    </div>
  );
}
