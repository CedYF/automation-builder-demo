/** In-memory comment automation data for the standalone demo. */
import { DEMO_COMMENT_PAGES } from "./comment-pages";

export interface DemoCommentRule {
  id: number;
  name: string;
  status: "active" | "paused";
  triggerType: "realtime";
  actionType: "hide" | "delete" | "reply" | "like" | "export_sheet";
  actionConfig: Record<string, unknown>;
  conditions: Record<string, unknown>;
  platform: "facebook" | "instagram";
  pageId: string;
  pageName: string;
  pageIds: string[];
  pagePlatforms: Record<string, "facebook" | "instagram">;
  pageNames: Record<string, string>;
  groupId: string;
  adAccountId: string;
  accountName: string;
  processedCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SEED_RULE: DemoCommentRule = {
  id: 101,
  name: "Auto-hide negative comments",
  status: "active",
  triggerType: "realtime",
  actionType: "hide",
  actionConfig: {},
  conditions: {
    sentimentMax: 40,
    matchMode: "any",
    brandStances: ["undermining"],
    customIntents: ["custom-comment-scan"],
  },
  platform: "facebook",
  pageId: "demo-page-1",
  pageName: "Northwind Coffee — UK",
  pageIds: ["demo-page-1"],
  pagePlatforms: { "demo-page-1": "facebook" },
  pageNames: { "demo-page-1": "Northwind Coffee — UK" },
  groupId: "demo-negative-comments",
  adAccountId: "act_100200300",
  accountName: "Northwind Coffee — UK",
  processedCount: 0,
  lastRunAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

let rules: DemoCommentRule[] = [structuredClone(SEED_RULE)];
let nextId = 102;

export function listCommentRules(): DemoCommentRule[] {
  return rules.map((rule) => structuredClone(rule));
}

export function getCommentRule(id: number): DemoCommentRule | null {
  const rule = rules.find((candidate) => candidate.id === id);
  return rule ? structuredClone(rule) : null;
}

export function saveCommentRule(input: Record<string, unknown>): DemoCommentRule | null {
  const id = typeof input.id === "number" ? input.id : null;
  const existing = id === null ? null : getCommentRule(id);
  if (id !== null && !existing) return null;
  const pageIds = Array.isArray(input.pageIds) ? input.pageIds.filter((value): value is string => typeof value === "string") : [];
  const selectedPages = pageIds.length > 0 ? pageIds : existing?.pageIds ?? SEED_RULE.pageIds;
  const knownPages = DEMO_COMMENT_PAGES.filter((page) => selectedPages.includes(page.id));
  const primaryPage = knownPages[0];
  const saved: DemoCommentRule = {
    ...(existing ?? SEED_RULE),
    id: existing?.id ?? nextId++,
    name: typeof input.name === "string" ? input.name : existing?.name ?? SEED_RULE.name,
    actionType: input.actionType === "delete" || input.actionType === "reply" || input.actionType === "like" || input.actionType === "export_sheet" || input.actionType === "hide"
      ? input.actionType : existing?.actionType ?? "hide",
    actionConfig: isRecord(input.actionConfig) ? input.actionConfig : existing?.actionConfig ?? {},
    status: input.status === "active" || input.status === "paused" ? input.status : existing?.status ?? "paused",
    pageId: selectedPages[0] ?? existing?.pageId ?? SEED_RULE.pageId,
    pageName: primaryPage?.name ?? existing?.pageName ?? SEED_RULE.pageName,
    pageIds: [...selectedPages],
    pagePlatforms: Object.fromEntries(knownPages.map((page) => [page.id, page.platform])) as Record<string, "facebook" | "instagram">,
    pageNames: Object.fromEntries(knownPages.map((page) => [page.id, page.name])),
    platform: primaryPage?.platform ?? existing?.platform ?? "facebook",
    conditions: isRecord(input.conditions) ? input.conditions : existing?.conditions ?? SEED_RULE.conditions,
    updatedAt: new Date().toISOString(),
  };
  if (existing) rules = rules.map((rule) => rule.id === existing.id ? saved : rule);
  else rules.push(saved);
  return structuredClone(saved);
}

export function deleteCommentRule(id: number): boolean {
  const length = rules.length;
  rules = rules.filter((rule) => rule.id !== id);
  return rules.length !== length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
