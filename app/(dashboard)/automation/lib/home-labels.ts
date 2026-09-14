import type { AutomationHomeFilter, AutomationHomeState } from "@/lib/automation/home-summary";

export const AUTOMATION_HOME_FILTER_LABELS: Readonly<Record<AutomationHomeFilter, string>> = {
  all: "All",
  running: "Running",
  "needs-you": "Approvals",
  active: "Active",
  paused: "Paused",
};

export const AUTOMATION_HOME_STATE_LABELS: Readonly<Record<AutomationHomeState, string>> = {
  running: "Running",
  "needs-you": "Approvals",
  active: "Active",
  manual: "Manual",
  paused: "Paused",
};

export interface HomeHeaderCounts {
  readonly total: number;
  readonly running: number;
  readonly needsYou: number;
}

/**
 * Compact live counts for the page header, skipping empty clauses.
 * Example: "12 automations · 4 running · 2 approvals"
 */
export function formatHomeHeaderSummary(counts: HomeHeaderCounts): string {
  const parts = [`${counts.total} automation${counts.total === 1 ? "" : "s"}`];
  if (counts.running > 0) parts.push(`${counts.running} running`);
  if (counts.needsYou > 0) {
    parts.push(`${counts.needsYou} approval${counts.needsYou === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
