import { CHOOSE_APP_BLOCKER } from "./builder-readiness";
import { listStepConfigGaps, type StepConfigGap } from "./step-config-gaps";

/**
 * Flow-level view of what the automation assistant still has to resolve.
 *
 * Per-step gaps come from the same `listStepConfigGaps` the canvas pill reads, so a
 * slot the agent asks about is exactly a slot the user would see as "Needs setup".
 *
 * The two structural gaps are deliberately broader than the canvas blockers, because
 * the agent decides whether to build at all while the canvas only decides what to warn
 * about. `isTriggerMissing` fires on an empty canvas, where `builder-context-bar.tsx`
 * suppresses the trigger blocker; `isActionMissing` has no canvas counterpart, so a
 * flow with a configured trigger and no action reports a gap here while the canvas
 * shows its ready state.
 */

const SERVICE_SLOT_FIELD_NAME = "service";
const SERVICE_SLOT_LABEL = "App";

const TRIGGER_NODE_TYPE = "trigger";
const ACTION_NODE_TYPE = "action";

export interface OpenSlotNodeLike {
  readonly id?: string;
  readonly type?: string;
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
}

export interface OpenSlotFlowLike {
  readonly selectedAccountId?: string;
  readonly nodes?: readonly OpenSlotNodeLike[];
}

export interface CanvasStepOpenSlots {
  readonly stepId: string;
  readonly slots: readonly StepConfigGap[];
}

export interface CanvasOpenSlots {
  readonly isTriggerMissing: boolean;
  readonly isActionMissing: boolean;
  /** Only steps with at least one open slot. */
  readonly steps: readonly CanvasStepOpenSlots[];
}

function slotsForNode(node: OpenSlotNodeLike, flowAccountId?: string): readonly StepConfigGap[] {
  const service = node.service?.trim() ?? "";
  if (!service) {
    return [
      {
        kind: "service",
        fieldName: SERVICE_SLOT_FIELD_NAME,
        label: SERVICE_SLOT_LABEL,
        message: CHOOSE_APP_BLOCKER,
      },
    ];
  }
  return listStepConfigGaps({
    service,
    event: node.event?.trim() ?? "",
    nodeType: node.type,
    config: node.config ?? {},
    flowAccountId,
  });
}

export function listCanvasOpenSlots(flow: OpenSlotFlowLike | null | undefined): CanvasOpenSlots {
  const nodes = flow?.nodes ?? [];
  const steps = nodes
    .map((node) => ({ stepId: node.id?.trim() ?? "", slots: slotsForNode(node, flow?.selectedAccountId) }))
    .filter((step): step is CanvasStepOpenSlots => step.stepId.length > 0 && step.slots.length > 0);

  return {
    isTriggerMissing: !nodes.some((node) => node.type === TRIGGER_NODE_TYPE),
    isActionMissing: !nodes.some((node) => node.type === ACTION_NODE_TYPE),
    steps,
  };
}
