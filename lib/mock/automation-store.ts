/**
 * In-memory stand-in for the automation-rules table.
 *
 * The ported `automation-context.tsx` and `automations-table.tsx` talk to
 * `/api/automation-rules` exactly as they do in the app. Rather than edit those
 * files to fake their data, this repo serves the same endpoints from memory, so
 * loading, saving, duplicating, toggling and deleting all work end to end.
 *
 * State lives in a module-level array, which means it resets whenever the dev
 * server reloads. That is the intended trade-off: no database, no migrations,
 * nothing to configure before `pnpm dev` works.
 */

export interface StoredFlowNode {
  id: string;
  type: string;
  service?: string;
  event?: string;
  config?: Record<string, unknown>;
  position?: number;
}

export interface StoredRule {
  id: number;
  name: string;
  status: "active" | "paused" | "draft";
  frequency: string | null;
  accountId: string | null;
  accountName: string | null;
  company: string | null;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  lastRun: string | null;
  flow: {
    nodes: StoredFlowNode[];
    notificationSettings?: Record<string, unknown> | null;
  };
}

const DEMO_ACCOUNT_ID = "act_100200300";
const DEMO_ACCOUNT_NAME = "Demo Store — UK";

/**
 * Seed rules.
 *
 * The two flagship flows plus a paused digest, so the table's status states are
 * all visible without editing anything. The scheduled pause is seeded as a draft:
 * its Saturday 00:00 stop and its timezone are not represented in the flow.
 */
const SEED_RULES: StoredRule[] = [
  {
    id: 101,
    name: "Hide negative comments",
    status: "active",
    frequency: null,
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "demo-store",
    workspaceId: "ws_demo",
    createdAt: "2026-06-02T09:12:00.000Z",
    updatedAt: "2026-07-28T16:04:00.000Z",
    lastRun: null,
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "comments",
          event: "New Comment",
          position: 0,
          config: { pageIds: ["demo_page_001"], conditions: { sentimentFilter: "negative" }, processExisting: false },
        },
        {
          id: "action-1",
          type: "action",
          service: "comments",
          event: "Hide Comment",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: 102,
    name: "Pause low-spend ads (Friday 23:00)",
    status: "draft",
    frequency: "weekly",
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "demo-store",
    workspaceId: "ws_demo",
    createdAt: "2026-06-14T11:40:00.000Z",
    updatedAt: "2026-07-30T10:22:00.000Z",
    lastRun: null,
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            level: "ad",
            metric: "spend",
            comparison: "less_than",
            threshold: 5,
            minimumSpend: 0,
            lookbackWindow: 7,
            checkFrequency: "weekly",
            checkDays: ["friday"],
            checkTime: "23:00",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Pause Ad",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: 103,
    name: "Weekly spend digest",
    status: "paused",
    frequency: "weekly",
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "demo-store",
    workspaceId: "ws_demo",
    createdAt: "2026-07-01T08:05:00.000Z",
    updatedAt: "2026-07-19T14:47:00.000Z",
    lastRun: null,
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled",
          position: 0,
          config: { checkFrequency: "weekly", checkTime: "08:00", checkWeekday: "monday" },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: { notificationMethod: "email", customMessage: "Weekly spend summary" },
        },
      ],
    },
  },
];

let rules: StoredRule[] = SEED_RULES.map((rule) => structuredClone(rule));
let nextId = 200;

export function listRules(): StoredRule[] {
  return rules.map((rule) => structuredClone(rule));
}

export function getRule(id: number): StoredRule | null {
  const found = rules.find((rule) => rule.id === id);
  return found ? structuredClone(found) : null;
}

/** Creates a rule, or replaces one when `id` matches an existing row. */
export function upsertRule(input: Partial<StoredRule> & { id?: number }, timestamp: string): StoredRule {
  const existingIndex = input.id === undefined ? -1 : rules.findIndex((rule) => rule.id === input.id);
  const base = existingIndex >= 0 ? rules[existingIndex] : null;

  const saved: StoredRule = {
    id: base?.id ?? nextId++,
    name: input.name ?? base?.name ?? "Untitled automation",
    status: input.status ?? base?.status ?? "draft",
    frequency: input.frequency ?? base?.frequency ?? null,
    accountId: input.accountId ?? base?.accountId ?? DEMO_ACCOUNT_ID,
    accountName: input.accountName ?? base?.accountName ?? DEMO_ACCOUNT_NAME,
    company: input.company ?? base?.company ?? "demo-store",
    workspaceId: input.workspaceId ?? base?.workspaceId ?? "ws_demo",
    createdAt: base?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastRun: base?.lastRun ?? null,
    flow: input.flow ?? base?.flow ?? { nodes: [] },
  };

  if (existingIndex >= 0) rules[existingIndex] = saved;
  else rules.push(saved);

  return structuredClone(saved);
}

export function deleteRule(id: number): boolean {
  const before = rules.length;
  rules = rules.filter((rule) => rule.id !== id);
  return rules.length < before;
}

export function countByStatus(status: StoredRule["status"]): number {
  return rules.filter((rule) => rule.status === status).length;
}
