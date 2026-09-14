import type { AccountRun, CommentActionType } from "../../../lib/api/automation";

export type RunStatus =
  | "sent"
  | "draft"
  | "discarded"
  | "failed"
  | "hidden"
  | "deleted"
  | "liked"
  | "skipped"
  | "running"
  | "interrupted";

export type RunActionType = CommentActionType;

export type GroupBucket = "today" | "yesterday" | "thisWeek" | "thisMonth" | "earlier";

export type SortOrder = "newest" | "oldest";

export type TimeRange = "24h" | "7d" | "30d" | "all";

const TIME_RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Maps a run's raw fields onto the redesigned status taxonomy. Run-level
// AccountRun doesn't carry an explicit status enum that matches the spec
// (sent/draft/failed/hidden/skipped) so we derive it from actionType +
// counts. `pendingCount` (drafted replies still awaiting approval) is
// computed by the backend; a run whose only successes are pending drafts
// surfaces as "draft" so it can be filtered as "Pending approval".
export function deriveRunStatus(
  run: Pick<
    AccountRun,
    | "status"
    | "actionType"
    | "totalProcessed"
    | "successCount"
    | "failedCount"
    | "unavailableCount"
    | "pendingCount"
    | "discardedCount"
  >,
): RunStatus {
  if (run.status === "running" || run.status === "executing") return "running";
  // The server process died mid-run (deploy/crash); the recovery sweeper
  // relaunches the rule, so this row is the partial "before" half.
  if (run.status === "interrupted") return "interrupted";
  if (run.totalProcessed === 0) return "skipped";
  if (run.failedCount > 0 && run.successCount === 0) return "failed";
  // Every comment it reached was unavailable on Meta (deleted, or the page
  // lost access): nothing was acted on, but nothing broke either — so not
  // the action's label, which would claim comments were hidden or deleted.
  if (run.successCount === 0 && run.failedCount === 0 && (run.unavailableCount ?? 0) > 0) return "skipped";

  // Drafted replies are counted in successCount when created. pendingCount and
  // discardedCount (resolved from the pending_replies table) carve out the ones
  // not actually posted, so sentCount is what truly went live.
  const pendingCount = run.pendingCount ?? 0;
  const discardedCount = run.discardedCount ?? 0;
  const sentCount = run.successCount - pendingCount - discardedCount;
  if (sentCount <= 0 && pendingCount > 0) return "draft";
  if (sentCount <= 0 && discardedCount > 0) return "discarded";

  if (run.actionType === "delete") return "deleted";
  if (run.actionType === "hide") return "hidden";
  if (run.actionType === "like") return "liked";
  return "sent";
}

export interface StatusVisual {
  label: string;
  dotClass: string;
  haloClass: string;
  badgeClass: string;
  rowTintClass: string;
}

export const STATUS_VISUAL: Record<RunStatus, StatusVisual> = {
  sent: {
    label: "Success",
    dotClass: "bg-emerald-500",
    haloClass: "shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    rowTintClass: "bg-white dark:bg-card",
  },
  draft: {
    label: "Pending approval",
    dotClass: "bg-amber-500",
    haloClass: "shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    rowTintClass: "bg-[linear-gradient(to_right,#fffbeb_0%,white_18%)] dark:bg-none dark:bg-amber-950/20",
  },
  discarded: {
    label: "Discarded",
    dotClass: "bg-zinc-400",
    haloClass: "shadow-[0_0_0_3px_rgba(161,161,170,0.18)]",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
    rowTintClass: "bg-white dark:bg-card",
  },
  failed: {
    label: "Error",
    dotClass: "bg-red-500",
    haloClass: "shadow-[0_0_0_3px_rgba(239,68,68,0.18)]",
    badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    rowTintClass: "bg-[linear-gradient(to_right,#fef2f2_0%,white_18%)] dark:bg-none dark:bg-red-950/20",
  },
  hidden: {
    label: "Hidden",
    dotClass: "bg-slate-500",
    haloClass: "shadow-[0_0_0_3px_rgba(100,116,139,0.18)]",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
    rowTintClass: "bg-white dark:bg-card",
  },
  deleted: {
    label: "Deleted",
    dotClass: "bg-rose-500",
    haloClass: "shadow-[0_0_0_3px_rgba(244,63,94,0.18)]",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
    rowTintClass: "bg-white dark:bg-card",
  },
  liked: {
    label: "Liked",
    dotClass: "bg-sky-500",
    haloClass: "shadow-[0_0_0_3px_rgba(14,165,233,0.18)]",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
    rowTintClass: "bg-white dark:bg-card",
  },
  skipped: {
    label: "Skipped",
    dotClass: "bg-zinc-400",
    haloClass: "shadow-[0_0_0_3px_rgba(161,161,170,0.18)]",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
    rowTintClass: "bg-white dark:bg-card",
  },
  running: {
    label: "Running",
    dotClass: "bg-blue-500",
    haloClass: "shadow-[0_0_0_3px_rgba(59,130,246,0.18)]",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    rowTintClass: "bg-white dark:bg-card",
  },
  interrupted: {
    label: "Interrupted",
    dotClass: "bg-orange-500",
    haloClass: "shadow-[0_0_0_3px_rgba(249,115,22,0.18)]",
    badgeClass:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
    rowTintClass: "bg-white dark:bg-card",
  },
};

export const ACTION_VERB: Record<RunActionType, string> = {
  reply: "Reply",
  hide: "Hide",
  delete: "Delete",
  like: "Like",
};

// Compares a run timestamp against `now` and returns which date-bucket
// header it should appear under. Week/month boundaries are calendar-aware
// (rolling 7d / 30d windows would scatter rows across two adjacent group
// headers when crossed near midnight).
export function bucketForDate(date: Date, now: Date): GroupBucket {
  const startOfNow = startOfDay(now);
  const startOfDate = startOfDay(date);
  const diffDays = Math.round((startOfNow.getTime() - startOfDate.getTime()) / DAY_MS);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  if (diffDays < 30) return "thisMonth";
  return "earlier";
}

export const GROUP_ORDER: readonly GroupBucket[] = ["today", "yesterday", "thisWeek", "thisMonth", "earlier"] as const;

export const GROUP_LABEL: Record<GroupBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  thisMonth: "This month",
  earlier: "Earlier",
};

export interface RunFilterCriteria {
  search: string;
  automationIds: ReadonlySet<number>;
  statuses: ReadonlySet<RunStatus>;
  action: "all" | RunActionType;
  timeRange: TimeRange;
}

// Default time window for the History view. "all" so every run shows by
// default; users can narrow to a shorter window via the toolbar.
export const DEFAULT_TIME_RANGE: TimeRange = "all";

export const EMPTY_FILTER_CRITERIA: RunFilterCriteria = {
  search: "",
  automationIds: new Set(),
  statuses: new Set(),
  action: "all",
  timeRange: DEFAULT_TIME_RANGE,
};

export function isAnyFilterActive(c: RunFilterCriteria): boolean {
  return (
    c.search.trim().length > 0 ||
    c.automationIds.size > 0 ||
    c.statuses.size > 0 ||
    c.action !== "all" ||
    c.timeRange !== DEFAULT_TIME_RANGE
  );
}

export function countActiveFilters(c: RunFilterCriteria): number {
  let n = 0;
  if (c.search.trim().length > 0) n++;
  if (c.automationIds.size > 0) n++;
  if (c.statuses.size > 0) n++;
  if (c.action !== "all") n++;
  if (c.timeRange !== DEFAULT_TIME_RANGE) n++;
  return n;
}

export function matchesFilter(run: AccountRun, criteria: RunFilterCriteria, now: Date): boolean {
  if (criteria.timeRange !== "all") {
    const windowMs = TIME_RANGE_MS[criteria.timeRange];
    const startedMs = new Date(run.startedAt).getTime();
    if (now.getTime() - startedMs > windowMs) return false;
  }

  if (criteria.action !== "all" && run.actionType !== criteria.action) return false;

  if (criteria.automationIds.size > 0 && !criteria.automationIds.has(run.ruleId)) return false;

  if (criteria.statuses.size > 0) {
    const status = deriveRunStatus(run);
    if (!criteria.statuses.has(status)) return false;
  }

  const q = criteria.search.trim().toLowerCase();
  if (q.length > 0) {
    if (!run.ruleName.toLowerCase().includes(q)) return false;
  }

  return true;
}

export interface RunGroup {
  bucket: GroupBucket;
  label: string;
  runs: AccountRun[];
}

export function groupRuns(runs: readonly AccountRun[], now: Date, sort: SortOrder): RunGroup[] {
  const buckets = new Map<GroupBucket, AccountRun[]>();

  for (const run of runs) {
    const b = bucketForDate(new Date(run.startedAt), now);
    const arr = buckets.get(b) ?? [];
    arr.push(run);
    buckets.set(b, arr);
  }

  const direction = sort === "newest" ? -1 : 1;
  for (const arr of buckets.values()) {
    arr.sort((a, b) => direction * (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()));
  }

  const ordered = sort === "oldest" ? [...GROUP_ORDER].reverse() : GROUP_ORDER;
  const out: RunGroup[] = [];
  for (const bucket of ordered) {
    const arr = buckets.get(bucket);
    if (arr && arr.length > 0) out.push({ bucket, label: GROUP_LABEL[bucket], runs: arr });
  }
  return out;
}

export interface HourBucket {
  hour: number; // 0..23 in local time
  count: number;
}

// Builds a 24-element series for the sparkline. `runs` is already-scoped
// to the activity-strip window (last 24h) by the caller — we only bucket
// here.
export function buildHourlyBuckets(runs: readonly AccountRun[], now: Date): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: (now.getHours() - 23 + i + 24) % 24,
    count: 0,
  }));
  const earliest = now.getTime() - 23 * 60 * 60 * 1000;
  for (const run of runs) {
    const t = new Date(run.startedAt).getTime();
    if (t < earliest) continue;
    const hoursAgo = Math.floor((now.getTime() - t) / (60 * 60 * 1000));
    const idx = 23 - hoursAgo;
    if (idx >= 0 && idx < 24) buckets[idx].count++;
  }
  return buckets;
}

export interface ActivitySummary {
  totalLast24h: number;
  totalPrior24h: number;
  deltaPct: number | null;
  successRatePct: number | null;
  failedLast24h: number;
  peakHour: number | null;
  buckets: HourBucket[];
}

export function summarizeActivity(allRuns: readonly AccountRun[], now: Date): ActivitySummary {
  const nowMs = now.getTime();
  const window = 24 * 60 * 60 * 1000;
  const last24h: AccountRun[] = [];
  const prior24h: AccountRun[] = [];

  for (const run of allRuns) {
    const t = new Date(run.startedAt).getTime();
    const age = nowMs - t;
    if (age < window) last24h.push(run);
    else if (age < window * 2) prior24h.push(run);
  }

  const buckets = buildHourlyBuckets(last24h, now);

  let successTotal = 0;
  let processedTotal = 0;
  let failedLast24h = 0;
  for (const r of last24h) {
    successTotal += r.successCount;
    processedTotal += r.totalProcessed;
    failedLast24h += r.failedCount;
  }

  const successRatePct = processedTotal > 0 ? Math.round((successTotal / processedTotal) * 1000) / 10 : null;

  const deltaPct =
    prior24h.length > 0
      ? Math.round(((last24h.length - prior24h.length) / prior24h.length) * 1000) / 10
      : last24h.length > 0
        ? null
        : 0;

  let peakHour: number | null = null;
  let peakCount = 0;
  for (const b of buckets) {
    if (b.count > peakCount) {
      peakCount = b.count;
      peakHour = b.hour;
    }
  }

  return {
    totalLast24h: last24h.length,
    totalPrior24h: prior24h.length,
    deltaPct,
    successRatePct,
    failedLast24h,
    peakHour,
    buckets,
  };
}

export interface AutomationOption {
  id: number;
  name: string;
  colorClass: string;
  count: number;
}

const AUTOMATION_PALETTE = [
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-lime-500",
];

// Deterministic color assignment by ruleId so the same automation gets
// the same dot color across renders without having to thread a palette
// through props.
export function automationColorClass(ruleId: number): string {
  const idx = Math.abs(ruleId) % AUTOMATION_PALETTE.length;
  return AUTOMATION_PALETTE[idx];
}

export function uniqueAutomations(runs: readonly AccountRun[]): AutomationOption[] {
  const map = new Map<number, AutomationOption>();
  for (const r of runs) {
    const existing = map.get(r.ruleId);
    if (existing) existing.count++;
    else map.set(r.ruleId, { id: r.ruleId, name: r.ruleName, colorClass: automationColorClass(r.ruleId), count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
