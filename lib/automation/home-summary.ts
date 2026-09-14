/**
 * Shared shape and ordering rules for the Automate home list.
 *
 * Running, waiting for approval, idle and paused are states of the same
 * automation, not separate surfaces — so one list carries all of them and the
 * state lives in a column. These pure helpers are used by the API route that
 * assembles the rows and by the client that filters and re-orders them, so the
 * two can never disagree about what "running" means.
 */

/**
 * The state an automation is in right now, as rendered in the State column.
 *
 * "active" is the resting state of a healthy automation: switched on, with a
 * cadence or an event trigger that will fire it without anyone pressing Run.
 * Most automations sit here almost all the time, because "running" only covers
 * the seconds an execution is actually in flight — so this must not read as
 * "nothing is happening". "manual" is the opposite case, and the distinction
 * matters: a switched-on rule with no cadence will never run by itself.
 */
export type AutomationHomeState = "running" | "needs-you" | "active" | "manual" | "paused";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Filter pills above the list.
 *
 * Active is the resting on-and-scheduled state, so it has to appear as a pill
 * or the list reads as "Running 0" while every row badge still says Active.
 * Attention states sit first; Active is the bulk; Paused is last.
 */
export type AutomationHomeFilter = "all" | "running" | "needs-you" | "active" | "paused";

export const AUTOMATION_HOME_FILTERS: readonly AutomationHomeFilter[] = [
  "all",
  "running",
  "needs-you",
  "active",
  "paused",
];

/**
 * Sort weight per state: running first, then whatever is blocked on the user,
 * then scheduled-but-quiet, then manual, then everything switched off.
 *
 * Used both by an explicit State-column sort and by the default list order —
 * the list header promises "live · running first", but the default used to be
 * plain recency, so 171 paused rows buried all 15 active ones.
 */
const STATE_SORT_WEIGHT: Readonly<Record<AutomationHomeState, number>> = Object.freeze({
  running: 0,
  "needs-you": 1,
  active: 2,
  manual: 3,
  paused: 4,
});

/**
 * What the "Right now" column shows for a row.
 *
 * "approval" and "review" are both "a human has to answer this", but they are
 * answered differently and must stay separate types. A flow approval carries
 * the token `/api/automation/approval` needs and can be resolved inline. A
 * comment automation's drafted replies live in CommentsServer, have no such
 * token, and are reviewed one by one in the drafted-replies sheet — the union
 * is what stops the inline approve path being reachable without a token
 * (ADM-11260).
 */
export type AutomationRightNow =
  | { readonly kind: "progress"; readonly label: string; readonly percent: number }
  | { readonly kind: "approval"; readonly label: string; readonly approvalId: number; readonly approvalToken: string }
  | {
      readonly kind: "review";
      readonly label: string;
      /** Drafted replies waiting on a human, reviewed from the row's own id. */
      readonly pendingCount: number;
    }
  | {
      readonly kind: "failure";
      readonly label: string;
      readonly reason: string;
      readonly executionId: number;
    }
  | { readonly kind: "note"; readonly label: string; readonly muted: boolean; readonly attention?: "approval-expired" };

/**
 * Whether the row is blocked on a human, whichever kind of approval it is.
 *
 * One definition because the optimistic toggle recomputes state from the row it
 * already has; missing a kind there silently drops an automation out of
 * "needs you" and resets the Approvals count to 0.
 */
export function isPendingApprovalRightNow(rightNow: AutomationRightNow): boolean {
  return rightNow.kind === "approval" || rightNow.kind === "review";
}

/** One automation as the home list renders it. */
export interface AutomationHomeRow {
  /** Stable key across the two automation sources. */
  readonly rowKey: string;
  readonly id: number;
  /** Which backing table the row came from — flow rules or comment rules. */
  readonly source: "flow" | "comment";
  /**
   * Comment automations only: the id their per-page rules share. Toggling and
   * deleting go through it so every page of the automation is affected.
   */
  readonly groupId?: string | null;
  readonly name: string;
  readonly state: AutomationHomeState;
  /** Ad account this automation runs against, kept separate so search can match it. */
  readonly accountName: string | null;
  /** Raw ad-account id. Null when the automation is not tied to one. */
  readonly accountId: string | null;
  /** Sub-line under the name, e.g. "Every hour · Fussy · 900 runs". */
  readonly subtitle: string;
  readonly rightNow: AutomationRightNow;
  /** Estimated hours of manual work this automation has avoided. */
  readonly savedHours: number;
  /** Whether the on/off switch reads as on. */
  readonly enabled: boolean;
  /** Whether the switch is locked (archived, rate-limited, or no permission). */
  readonly toggleLocked: boolean;
  /** Explains a locked switch, for the tooltip. */
  readonly toggleLockReason: string | null;
  /** True when the persisted rule status is archived. */
  readonly isArchived: boolean;
  /** Sorted within a state, most recent activity first. */
  readonly lastActivityAt: string | null;
  /**
   * Whether something will run this without the Run button. Carried on the row
   * so an optimistic toggle can recompute the state rather than assume "active".
   */
  readonly runsUnattended: boolean;

  // Columns carried over from the full automations table. Users identify a rule
  // by its id and the apps in its flow, so the home list keeps them.
  /** "C#2507" / "#823" — the id as the table has always shown it. */
  readonly displayId: string;
  /** Service ids of the configured steps, in flow order, for the icon chips. */
  readonly stepServices: readonly string[];
  /**
   * Facebook/Instagram page ids this automation runs on.
   *
   * Comment automations run on pages, not ad accounts, so the account column
   * shows the page's profile and name for them. Empty for flow rules, which
   * genuinely run on an ad account.
   */
  readonly pageIds: readonly string[];
  /**
   * The concrete next run, e.g. "Tue 1 Sept at 11:15 (BST)". Null for polling and
   * event-driven rules, which have no single queued date.
   *
   * ADM-11225: the list only ever showed the cadence, which is derived from
   * `dayOfWeek` and so kept reading correctly while the date the cron actually
   * matches on had drifted to another weekday.
   */
  readonly nextRunLabel: string | null;
  /** Set when the queued date contradicts the cadence, or has already passed. */
  readonly nextRunWarning: string | null;
  /** Last completed run, ISO. Null when it has never run. */
  readonly lastRunAt: string | null;
  /** Lifetime run count. */
  readonly runCount: number;
  /** When the rule was last edited, ISO. */
  readonly updatedAt: string | null;
  /** Owner's email, for the avatar tooltip. */
  readonly ownerEmail: string | null;
  /** Two-letter avatar for the owner. */
  readonly ownerInitials: string;
}

/** Per-state totals rendered on the filter pills and in the header sub-line. */
export type AutomationHomeStateCounts = Readonly<Record<AutomationHomeState, number>> & { readonly total: number };

export const EMPTY_STATE_COUNTS: AutomationHomeStateCounts = Object.freeze({
  running: 0,
  "needs-you": 0,
  active: 0,
  manual: 0,
  paused: 0,
  total: 0,
});

/**
 * Decides which single state an automation is in.
 *
 * A blocked approval outranks everything, including a paused rule — the run
 * already happened and still needs an answer. An in-flight execution outranks
 * the rule's own on/off flag for the same reason.
 *
 * A switched-on rule is "active" when something will fire it unattended, and
 * "manual" when only the Run button will. Reporting both as one state was the
 * confusing part: an hourly rule between runs is working, not sitting idle.
 */
export function resolveAutomationHomeState(input: {
  readonly enabled: boolean;
  readonly hasPendingApproval: boolean;
  readonly hasRunningExecution: boolean;
  /** Whether a cron, sweep or event will run this without the Run button. */
  readonly runsUnattended: boolean;
}): AutomationHomeState {
  if (input.hasPendingApproval) return "needs-you";
  if (input.hasRunningExecution) return "running";
  if (!input.enabled) return "paused";
  return input.runsUnattended ? "active" : "manual";
}

function toTimestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Orders rows by how live they are, then by most recent activity, then by name. */
export function compareAutomationHomeRows(left: AutomationHomeRow, right: AutomationHomeRow): number {
  const byState = STATE_SORT_WEIGHT[left.state] - STATE_SORT_WEIGHT[right.state];
  if (byState !== 0) return byState;

  const byActivity = toTimestamp(right.lastActivityAt) - toTimestamp(left.lastActivityAt);
  if (byActivity !== 0) return byActivity;

  return left.name.localeCompare(right.name);
}

/** Columns the home list can be sorted by, beyond its default live ordering. */
export type AutomationHomeSortKey = "id" | "name" | "state" | "account" | "lastRun" | "runs" | "modified" | "saved";

export type SortDirection = "asc" | "desc";

/** Null means the default: live rows first, most recently active first within each state. */
export interface AutomationHomeSort {
  readonly key: AutomationHomeSortKey;
  readonly direction: SortDirection;
}

/**
 * Whether a row has anything to sort by in a column.
 *
 * Rows without a value are pushed to the bottom *before* the direction is
 * applied, so flipping to descending cannot lead the list with a wall of
 * dashes — which would hide exactly the rows the user clicked to find.
 */
function hasSortValue(row: AutomationHomeRow, key: AutomationHomeSortKey): boolean {
  switch (key) {
    case "account":
      return Boolean(row.accountName);
    case "lastRun":
      return toTimestamp(row.lastActivityAt) > 0;
    case "modified":
      return toTimestamp(row.updatedAt) > 0;
    default:
      return true;
  }
}

/** Ascending comparison for one column; direction is applied by the caller. */
function compareByKey(left: AutomationHomeRow, right: AutomationHomeRow, key: AutomationHomeSortKey): number {
  switch (key) {
    case "id":
      return left.id - right.id;
    case "name":
      return left.name.localeCompare(right.name);
    case "state":
      return STATE_SORT_WEIGHT[left.state] - STATE_SORT_WEIGHT[right.state];
    case "account":
      return (left.accountName ?? "").localeCompare(right.accountName ?? "");
    case "lastRun":
      return toTimestamp(left.lastActivityAt) - toTimestamp(right.lastActivityAt);
    case "runs":
      return left.runCount - right.runCount;
    case "modified":
      return toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt);
    case "saved":
      return left.savedHours - right.savedHours;
  }
}

/**
 * Sorts by a chosen column, falling back to name so the order is total and a
 * re-render never reshuffles rows that tie.
 *
 * Blank values sort last in both directions: a descending sort led by twelve
 * dashes hides exactly the rows the user clicked the column to find.
 */
export function sortAutomationHomeRowsBy(
  rows: readonly AutomationHomeRow[],
  sort: AutomationHomeSort | null,
): AutomationHomeRow[] {
  if (!sort) return sortAutomationHomeRows(rows);

  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftHasValue = hasSortValue(left, sort.key);
    const rightHasValue = hasSortValue(right, sort.key);
    if (leftHasValue !== rightHasValue) return leftHasValue ? -1 : 1;

    const byKey = compareByKey(left, right, sort.key);
    if (byKey !== 0) return byKey * direction;
    return left.name.localeCompare(right.name);
  });
}

/**
 * Date columns read newest-first on the first click, matching the default
 * live ordering. A first click landing on "oldest at the top" makes a
 * freshly-clicked date column look like it did nothing useful.
 */
const DESCENDING_FIRST_SORT_KEYS: ReadonlySet<AutomationHomeSortKey> = new Set(["lastRun", "modified"]);

/**
 * Next sort state when a header is clicked.
 *
 * Cycles through the column's most useful direction first, then the reverse,
 * then back to the default live ordering, so the user can always get back to
 * most-recent-first without hunting for a reset.
 */
export function nextAutomationHomeSort(
  current: AutomationHomeSort | null,
  key: AutomationHomeSortKey,
): AutomationHomeSort | null {
  const firstDirection: SortDirection = DESCENDING_FIRST_SORT_KEYS.has(key) ? "desc" : "asc";
  if (current?.key !== key) return { key, direction: firstDirection };
  if (current.direction === firstDirection) return { key, direction: firstDirection === "asc" ? "desc" : "asc" };
  return null;
}

/** Returns a new list in home order, leaving the input untouched. */
export function sortAutomationHomeRows(rows: readonly AutomationHomeRow[]): AutomationHomeRow[] {
  return [...rows].sort(compareAutomationHomeRows);
}

/** Totals every state plus the overall count. */
export function countAutomationHomeStates(rows: readonly AutomationHomeRow[]): AutomationHomeStateCounts {
  const counts = { running: 0, "needs-you": 0, active: 0, manual: 0, paused: 0, total: rows.length };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

/** Narrows rows to a filter pill. "all" passes everything through unchanged. */
export function filterAutomationHomeRows(
  rows: readonly AutomationHomeRow[],
  filter: AutomationHomeFilter,
): AutomationHomeRow[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => row.state === filter);
}

/** Coerces an untrusted query-string value to a filter, defaulting to "all". */
export function parseAutomationHomeFilter(value: string | null | undefined): AutomationHomeFilter {
  return AUTOMATION_HOME_FILTERS.includes(value as AutomationHomeFilter) ? (value as AutomationHomeFilter) : "all";
}

/**
 * Progress through an in-flight execution, as a whole percentage.
 *
 * Clamped to a visible floor and a sub-complete ceiling: a bar pinned at 0% or
 * 100% reads as stalled or finished, and a running execution is neither.
 */
export function calculateRunProgressPercent(completedSteps: number, totalSteps: number): number {
  if (!Number.isFinite(completedSteps) || !Number.isFinite(totalSteps) || totalSteps <= 0) return 10;
  const raw = Math.round((completedSteps / totalSteps) * 100);
  return Math.min(95, Math.max(8, raw));
}

/** Joins the non-empty parts of a row's sub-line with the list's separator. */
export function buildRowSubtitle(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * Renders saved time at a scale that suits its size, or null when there is none.
 *
 * Everything was previously forced into hours to one decimal, so an automation
 * that had genuinely saved a couple of minutes displayed as a dash — identical
 * to one that had never run. Sub-hour savings are shown in minutes instead.
 */
export function formatSavedDuration(savedHours: number): string | null {
  if (!Number.isFinite(savedHours) || savedHours <= 0) return null;

  const minutes = savedHours * 60;
  if (minutes < 1) return "<1 min";
  if (savedHours < 1) return `${Math.round(minutes)} min`;
  return `${Math.round(savedHours * 10) / 10} hrs`;
}

/** "900 runs" / "1 run" / "" when the automation has never run. */
export function formatRunCount(runCount: number): string {
  if (!Number.isFinite(runCount) || runCount <= 0) return "";
  return `${runCount.toLocaleString("en-US")} ${runCount === 1 ? "run" : "runs"}`;
}

/**
 * The list footer's count.
 *
 * The rows scroll inside the card, so every rendered row is reachable — saying
 * "Showing 50 of 50" would imply otherwise. Only a genuine cut-off names both
 * numbers.
 */
export function describeVisibleRowCount(visibleCount: number, totalCount: number): string {
  if (totalCount <= 0) return "No automations";
  if (visibleCount < totalCount) return `Showing ${visibleCount} of ${totalCount}`;
  return `${totalCount} ${totalCount === 1 ? "automation" : "automations"}`;
}

/** Fallback avatar when a rule has no owner email on it. */
const UNKNOWN_OWNER_INITIALS = "U";

/**
 * The id as the automations table has always shown it. Comment rules are
 * prefixed so a `C#2507` and a `#2507` are never mistaken for each other — they
 * are different automations in different tables.
 */
export function buildAutomationDisplayId(source: AutomationHomeRow["source"], id: number): string {
  return source === "comment" ? `C#${id}` : `#${id}`;
}

/** Two-letter avatar for the owner column. */
export function buildOwnerInitials(email: string | null | undefined): string {
  const trimmed = email?.trim();
  if (!trimmed) return UNKNOWN_OWNER_INITIALS;
  return trimmed.slice(0, 2).toUpperCase();
}

/** "Aug 13, 1:19 PM" for the Last Run column, or "—" when it has never run. */
export function formatAutomationTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "12m ago" / "2h ago" / "1d ago" for the Modified column, matching the table.
 * `now` is injected so the formatter stays pure.
 */
export function formatModifiedAgo(value: string | null | undefined, now: Date): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  const elapsedMs = now.getTime() - parsed.getTime();
  if (elapsedMs < MS_PER_MINUTE) return "just now";
  if (elapsedMs < MS_PER_HOUR) return `${Math.floor(elapsedMs / MS_PER_MINUTE)}m ago`;
  if (elapsedMs < MS_PER_DAY) return `${Math.floor(elapsedMs / MS_PER_HOUR)}h ago`;
  if (elapsedMs < MS_PER_WEEK) return `${Math.floor(elapsedMs / MS_PER_DAY)}d ago`;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
