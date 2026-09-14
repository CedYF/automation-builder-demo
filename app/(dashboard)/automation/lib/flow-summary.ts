import type { AutomationNode } from "../contexts/automation-context";
import { getServiceInfo } from "./service-icons";

/**
 * One-line human summary of a flow's steps, e.g.
 * "Performance Threshold (Meta) → Launch on Axon (AppLovin Ads)".
 *
 * Used to give the assistant panel's empty state enough context to offer
 * edit-oriented suggestions instead of "build a new automation" prompts when
 * the user already has a flow open.
 */
export function summarizeFlowSteps(nodes: readonly AutomationNode[]): string {
  return nodes
    .map((node) => {
      const appLabel = node.service ? getServiceInfo(node.service).label : null;
      const stepLabel = node.event || appLabel || "Untitled step";
      return appLabel && appLabel !== stepLabel ? `${stepLabel} (${appLabel})` : stepLabel;
    })
    .join(" → ");
}
