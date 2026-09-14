import type { AutomationNode } from "../contexts/automation-context";
import { findStaticMetaTargetGap } from "@/lib/automation/static-meta-target-gap";
import {
  hasInvalidMetaBudgetEntity,
  hasStaticAccountAsCampaignTarget,
} from "@/lib/automation/meta-budget-target-validation";
import { listStepConfigGaps } from "./step-config-gaps";

const SCALE_PLAN_EVENTS = new Set(["Duplicate Campaign", "Duplicate Ad Set"]);

function appearsBefore(candidate: AutomationNode, node: AutomationNode): boolean {
  return candidate.position < node.position;
}

function hasImplicitTarget(node: AutomationNode, nodes: readonly AutomationNode[]): boolean {
  if (
    nodes.some(
      (candidate) =>
        appearsBefore(candidate, node) &&
        candidate.type === "trigger" &&
        candidate.service === "meta-ads" &&
        candidate.event === "Performance Threshold",
    )
  ) {
    return true;
  }

  if (
    node.event === "Launch Ad" &&
    nodes.some(
      (candidate) =>
        appearsBefore(candidate, node) &&
        candidate.type === "trigger" &&
        candidate.service === "google-sheets" &&
        candidate.event === "New Rows to Launch",
    )
  ) {
    return true;
  }

  return nodes.some(
    (candidate) =>
      appearsBefore(candidate, node) &&
      candidate.type === "action" &&
      candidate.service === "meta-ads" &&
      SCALE_PLAN_EVENTS.has(candidate.event ?? "") &&
      candidate.config?.scaleQualifyingStructure === true,
  );
}

/** Advisory only: incomplete flows remain valid drafts and are still persisted. */
export function getAutomationSaveSetupWarning(
  nodes: readonly AutomationNode[],
  flowAccountId?: string | null,
): string | null {
  if (
    nodes.some(
      (node) =>
        node.type === "action" &&
        node.service === "meta-ads" &&
        node.event === "Change Budget" &&
        hasInvalidMetaBudgetEntity(node.config ?? {}),
    )
  ) {
    return "Saved, but Change Budget has an unsupported budget level. Choose Ad Set, Campaign, or Automatic and matching target IDs before it runs.";
  }
  if (
    nodes.some(
      (node) =>
        node.type === "action" &&
        node.service === "meta-ads" &&
        node.event === "Change Budget" &&
        hasStaticAccountAsCampaignTarget(node.config ?? {}, flowAccountId),
    )
  ) {
    return "Saved, but Change Budget uses an ad account as a campaign target. Choose campaign IDs or qualifying campaigns from the trigger before it runs.";
  }

  const missingTarget = nodes.find((node) => {
    if (!node.service || !node.event || hasImplicitTarget(node, nodes)) return false;
    return listStepConfigGaps({
      service: node.service,
      event: node.event,
      nodeType: node.type,
      config: node.config ?? {},
      flowAccountId,
    }).some((gap) => gap.kind === "target-ad-set");
  });

  const event = missingTarget?.event ?? findStaticMetaTargetGap(nodes)?.event;
  if (!event) return null;
  return `Saved, but ${event} has no target ad set. Choose an ad set, name filter, or data pill before it runs.`;
}
