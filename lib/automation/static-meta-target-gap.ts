function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEmptySelection(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * A scheduled two-node flow has no upstream selector to supply implicit ids.
 * Other trigger/action combinations are intentionally unknown, not invalid.
 * Shared by advisory save warnings and confirmed runtime-failure classification.
 */
export function findStaticMetaTargetGap(nodes: unknown): { nodeId: string; event: string } | null {
  if (!Array.isArray(nodes) || nodes.length !== 2 || !nodes.every(isRecord)) return null;
  const trigger = nodes.find((node) => node.type === "trigger");
  const action = nodes.find((node) => node.type === "action");
  if (
    trigger?.service !== "scheduled" ||
    trigger.event !== "Scheduled Run" ||
    action?.service !== "meta-ads" ||
    typeof action.id !== "string" ||
    !["Change Budget", "Set Minimum Spend", "Update Value Rules"].includes(String(action.event)) ||
    !isRecord(action.config)
  )
    return null;
  try {
    if (JSON.stringify(nodes).includes("{{")) return null;
  } catch {
    return null;
  }
  const config = action.config;
  const empty = [
    "targetIds",
    "targetAdSetIds",
    "selectedAdSetIds",
    "selectedCampaignIds",
    "specificTargetAdSets",
    "targetId",
    "targetAdSetId",
    "targetAdSetNameFilter",
  ].every((key) => isEmptySelection(config[key]));
  if (
    !empty ||
    config.budgetEntityLevel === "campaign" ||
    (config.targetAdSetMatchType !== undefined && config.targetAdSetMatchType !== "specific")
  )
    return null;
  return { nodeId: action.id, event: String(action.event) };
}
