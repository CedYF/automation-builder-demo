import type { AutomationNode, AssistantStepInput } from "../contexts/automation-context";
import { normalizeCheckDays } from "./polling-run-time";

function reindexNodes(nodes: AutomationNode[]): AutomationNode[] {
  return nodes.map((node, index) => ({ ...node, position: index }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Deep-merge node config so a partial update can add criteria.conditions without wiping lookbackDays. */
export function mergeAssistantStepConfig(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!incoming) return existing;
  if (!existing) {
    const merged: Record<string, unknown> = { ...incoming };
    if ("checkDays" in merged) {
      merged.checkDays = [...normalizeCheckDays(merged.checkDays)];
    }
    return merged;
  }

  const merged: Record<string, unknown> = { ...existing, ...incoming };
  if (isRecord(existing.criteria) && isRecord(incoming.criteria)) {
    const existingCriteria = existing.criteria;
    const incomingCriteria = incoming.criteria;
    merged.criteria = {
      ...existingCriteria,
      ...incomingCriteria,
      ...(Array.isArray(incomingCriteria.conditions)
        ? { conditions: incomingCriteria.conditions }
        : Array.isArray(existingCriteria.conditions)
          ? { conditions: existingCriteria.conditions }
          : {}),
    };
  }
  if ("checkDays" in merged) {
    merged.checkDays = [...normalizeCheckDays(merged.checkDays)];
  }
  return merged;
}

function mergeAssistantStep(node: AutomationNode, step: AssistantStepInput): AutomationNode {
  return {
    ...node,
    ...(step.type ? { type: step.type } : {}),
    ...(step.service !== undefined ? { service: step.service } : {}),
    ...(step.event !== undefined ? { event: step.event } : {}),
    config: mergeAssistantStepConfig(node.config, step.config),
  };
}

function resolveInsertIndex(nodeCount: number, position: number | undefined): number {
  if (typeof position !== "number" || position < 0 || !Number.isFinite(position)) {
    return nodeCount;
  }
  return Math.min(Math.trunc(position), nodeCount);
}

/** Moves an existing node to a zero-based index within the current list. */
export function moveAssistantNodeToPosition(
  nodes: readonly AutomationNode[],
  nodeId: string,
  targetPosition: number,
): AutomationNode[] {
  const fromIndex = nodes.findIndex((node) => node.id === nodeId);
  if (fromIndex < 0) return [...nodes];
  const bounded = Math.max(0, Math.min(Math.trunc(targetPosition), nodes.length - 1));
  if (fromIndex === bounded) return [...nodes];
  const next = [...nodes];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(bounded, 0, moved);
  return next;
}

/**
 * Inserts or updates a builder step and optionally reorders it. Matches the
 * automation context upsert semantics used by the live assistant canvas.
 */
export function upsertAssistantNodeInFlow(
  nodes: readonly AutomationNode[],
  step: AssistantStepInput,
): AutomationNode[] {
  const existingIndex = nodes.findIndex((node) => node.id === step.id);

  if (existingIndex >= 0) {
    let next = nodes.map((node, index) => (index === existingIndex ? mergeAssistantStep(node, step) : node));
    if (typeof step.position === "number") {
      next = moveAssistantNodeToPosition(next, step.id, step.position);
    }
    return reindexNodes(next);
  }

  const newNode: AutomationNode = {
    id: step.id,
    type: step.type ?? "action",
    service: step.service,
    event: step.event,
    config: mergeAssistantStepConfig(undefined, step.config),
    position: nodes.length,
  };
  const insertAt = resolveInsertIndex(nodes.length, step.position);
  const next = [...nodes.slice(0, insertAt), newNode, ...nodes.slice(insertAt)];
  return reindexNodes(next);
}
