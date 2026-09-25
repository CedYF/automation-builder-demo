import type { AutomationAccessScope } from "@/lib/automation/automation-access";

/**
 * Visible Automate tabs. Running automations and pending approvals are states
 * inside the Home list rather than tabs of their own, so they are not repeated
 * here.
 */
export const AUTOMATION_TABS = [
  { value: "chat", label: "Chat" },
  { value: "automations", label: "Automations" },
  { value: "templates", label: "Templates" },
  { value: "history", label: "History" },
] as const;

export type AutomationTabValue = (typeof AUTOMATION_TABS)[number]["value"];
export type AutomationTab = (typeof AUTOMATION_TABS)[number];

export const AUTOMATION_TAB_HOME: AutomationTabValue = "chat";

/**
 * Tabs a comment-only role can use (ADM-11300). History lists flow
 * executions, so it has nothing to show a comment-only role.
 */
const COMMENTS_ONLY_TAB_VALUES: ReadonlySet<AutomationTabValue> = new Set<AutomationTabValue>([
  "chat",
  "automations",
  "templates",
]);

/**
 * Secondary (Home-reachable, not in the strip) views a comment-only role can
 * use. "All automations" lists comment rows; the approvals queue and the
 * active/delayed list are flow-execution surfaces.
 */
const COMMENTS_ONLY_SECONDARY_TAB_VALUES: ReadonlySet<string> = new Set(["all"]);

/** The tab strip for an access scope. */
export function listAutomationTabsForScope(scope: AutomationAccessScope): readonly AutomationTab[] {
  if (scope !== "comments-only") return AUTOMATION_TABS;
  return AUTOMATION_TABS.filter((tab) => COMMENTS_ONLY_TAB_VALUES.has(tab.value));
}

/**
 * Where a URL-supplied tab lands for an access scope: a hidden tab (deep link,
 * stale bookmark) falls back to Home instead of rendering a surface the role
 * cannot use.
 */
export function resolveAutomationTabForScope(tab: string, scope: AutomationAccessScope): string {
  const isVisibleTab = AUTOMATION_TABS.some((candidate) => candidate.value === tab);
  if (scope !== "comments-only") {
    return isVisibleTab || ["all", "approvals", "active"].includes(tab) ? tab : AUTOMATION_TAB_HOME;
  }
  return (isVisibleTab && COMMENTS_ONLY_TAB_VALUES.has(tab as AutomationTabValue)) ||
    COMMENTS_ONLY_SECONDARY_TAB_VALUES.has(tab)
    ? tab
    : AUTOMATION_TAB_HOME;
}
