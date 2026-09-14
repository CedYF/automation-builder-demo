import { getTargetSetupIssues } from "./setup-target-validation";
export type SetupNode = {
  id?: string;
  type?: string;
  service?: string;
  event?: string;
  position?: number;
  config?: Record<string, any>;
};
export type SetupIssue = { nodeId: string; message: string };

function ids(value: unknown): string[] {
  if (typeof value === "string")
    return value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  return [];
}

/** Only reject provably invalid targets; dynamic values that need a real run stay valid. */
export function getAutomationSetupIssues(nodes: readonly SetupNode[], accountId?: string | null): SetupIssue[] {
  const issues: SetupIssue[] = getTargetSetupIssues(nodes, accountId);
  for (const [index, node] of nodes.entries()) {
    if (node.type !== "action" || node.service !== "meta-ads" || node.event !== "Change Budget") continue;
    const config = node.config ?? {};
    const add = (message: string) => issues.push({ nodeId: node.id ?? "", message });
    const level = config.budgetEntityLevel || "adset";
    if (!["adset", "campaign", "automatic"].includes(level)) {
      add("Change Budget: ads do not have budgets. Choose Ad Set, Campaign, or Automatic and matching target IDs.");
      continue;
    }
    const expected = level === "campaign" ? "qualifyingCampaignIds" : "qualifyingAdSetIds";
    const label = level === "campaign" ? "campaign" : "ad set";
    const targets = ids(config.targetIds);
    const selected = targets.length
      ? targets
      : ids(level === "campaign" ? config.selectedCampaignIds : config.selectedAdSetIds);
    const accounts = [accountId, config.accountId].filter(Boolean).map((id) => String(id).replace(/^act_/, ""));
    if (selected.some((id) => !id.includes("{{") && (id.startsWith("act_") || accounts.includes(id)))) {
      add(
        `Change Budget: an ad account ID cannot be a ${label} target. Select ${label} IDs or use qualifying ${label}s from the trigger.`,
      );
    }
    if (!selected.length) {
      const source = nodes
        .slice(0, index)
        .find(
          (n) =>
            n.type === "trigger" &&
            n.service === "meta-ads" &&
            ["Performance Threshold", "Performance Monitoring"].includes(n.event ?? ""),
        );
      if (!source)
        add(
          `Change Budget: select target ${label} IDs or connect a performance trigger that supplies qualifying ${label}s.`,
        );
      else if (
        source.event === "Performance Monitoring" &&
        (source.config?.monitoringLevel || "account") !== (level === "campaign" ? "campaign" : "adset")
      ) {
        add(
          `Change Budget: the monitoring trigger does not supply qualifying ${label} IDs. Match the trigger's monitoring level to this budget level.`,
        );
      }
    }
    for (const target of selected) {
      for (const match of target.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        const path = match[1]!;
        const field = path.slice(path.lastIndexOf(".") + 1);
        if (/^qualifying(?:Ad|AdSet|Campaign)Ids$/.test(field) && field !== expected) {
          add(
            `Change Budget: this data pill supplies the wrong target type. Use ${expected} for the selected budget level.`,
          );
        }
        const source = nodes.slice(0, index).find((n) => n.id === path.slice(0, path.lastIndexOf(".")));
        if (source?.service === "meta-ads" && source.event === "Performance Monitoring") {
          const sourceLevel = source.config?.monitoringLevel || "account";
          const output =
            sourceLevel === "campaign"
              ? "qualifyingCampaignIds"
              : sourceLevel === "adset"
                ? "qualifyingAdSetIds"
                : sourceLevel === "ad"
                  ? "qualifyingAdIds"
                  : "qualifyingEntityIds";
          if (field === "qualifyingEntityIds" && output !== expected) {
            add(
              `Change Budget: qualifyingEntityIds contains ${sourceLevel} IDs, but this budget level requires ${label} IDs.`,
            );
          }
          if (
            field.startsWith("qualifying") &&
            field.endsWith("Ids") &&
            field !== output &&
            field !== "qualifyingEntityIds"
          ) {
            add(
              `Change Budget: the monitoring trigger returns ${sourceLevel === "adset" ? "ad set" : sourceLevel} IDs. Match its monitoring level, budget level, and target data pill.`,
            );
          }
        }
      }
    }
  }
  return issues.filter(
    (issue, index) =>
      issues.findIndex((other) => other.nodeId === issue.nodeId && other.message === issue.message) === index,
  );
}
