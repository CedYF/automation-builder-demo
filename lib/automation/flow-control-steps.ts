/**
 * Delay and Approval are ordinary entries in the step "choose an app" pickers,
 * but the executor dispatches on `node.type` — not `node.service` — so picking
 * one has to retype the node too. A node left as `{ type: "action", service:
 * "delay" }` is dispatched as a normal action and never waits.
 *
 * These helpers are the single source of truth for that mapping, shared by the
 * app pickers and by `addNode`.
 */

export type AutomationNodeType = "trigger" | "action" | "filter" | "delay" | "approval";

/**
 * Apps whose service id doubles as the node type. Values are the single event
 * each one exposes, so selecting the app implies the event.
 */
const FLOW_CONTROL_SERVICE_EVENTS = {
  delay: "Wait for Duration",
  approval: "Approval Required",
} as const;

export type FlowControlService = keyof typeof FLOW_CONTROL_SERVICE_EVENTS;

/** Node types that share the step app picker and can be converted between each other. */
const STEP_NODE_TYPES: ReadonlySet<AutomationNodeType> = new Set<AutomationNodeType>(["action", "delay", "approval"]);

/** True for the node types that run after the trigger and share one app picker. */
export function isStepNodeType(nodeType: AutomationNodeType): boolean {
  return STEP_NODE_TYPES.has(nodeType);
}

export function isFlowControlService(serviceId: string): serviceId is FlowControlService {
  return serviceId in FLOW_CONTROL_SERVICE_EVENTS;
}

/**
 * Node type a step must carry once `serviceId` is chosen.
 *
 * Triggers and filters keep their type: their pickers never offer flow-control
 * apps, and retyping them would silently move the node to a different stage.
 */
export function resolveNodeTypeForService(serviceId: string, currentType: AutomationNodeType): AutomationNodeType {
  if (!isStepNodeType(currentType)) return currentType;
  return isFlowControlService(serviceId) ? serviceId : "action";
}

/** The implied event for a flow-control app, or null when the user still has to pick one. */
export function getFlowControlServiceEvent(serviceId: string): string | null {
  return isFlowControlService(serviceId) ? FLOW_CONTROL_SERVICE_EVENTS[serviceId] : null;
}

/** Service + event a freshly added delay/approval node starts with. */
export function getFlowControlStepDefaults(
  nodeType: AutomationNodeType,
): { service: FlowControlService; event: string } | null {
  if (!isFlowControlService(nodeType)) return null;
  return { service: nodeType, event: FLOW_CONTROL_SERVICE_EVENTS[nodeType] };
}
