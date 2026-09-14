import { buildAutomationHomeRows } from "@/lib/automation/build-home-rows";
import { countAutomationHomeStates } from "@/lib/automation/home-summary";
import { listRules } from "./automation-store";

/** Adapt current demo storage to the refreshed production home contract. */
export function buildDemoHomePayload(now = new Date()) {
  const rows = buildAutomationHomeRows({
    rules: listRules().map((rule) => ({
      id: rule.id, source: "flow" as const, name: rule.name, status: rule.status,
      accountId: rule.accountId, accountName: rule.accountName, runCount: 0,
      rateLimited: false, cadenceLabel: rule.frequency, runsUnattended: Boolean(rule.frequency),
      flowStepCount: rule.flow.nodes.length, lastRunAt: null, updatedAt: rule.updatedAt,
      stepServices: rule.flow.nodes.flatMap((node) => node.service ? [node.service] : []),
      ownerEmail: "demo@example.com",
    })),
    runningExecutions: [], approvals: [], delays: [], savedHoursByRuleId: {},
    canManage: true, isStaff: false, now,
  });
  return { rows, counts: countAutomationHomeStates(rows), stats: {
    periodLabel: "Demo session · simulated", savedHours: 0, savedHoursTrendPercent: null,
    runsCompleted: 0, actionsTaken: 0, manualClicksAvoided: 0, sampleTruncated: false,
  } };
}
