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
const DEMO_ACCOUNT_NAME = "Northwind Coffee — UK";

/* Flow rules start empty; the demo's only seeded automation is a comment rule. */
let rules: StoredRule[] = [];
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
    company: input.company ?? base?.company ?? "northwind",
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
