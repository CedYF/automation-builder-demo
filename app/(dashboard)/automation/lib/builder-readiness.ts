import { getConfigPanelPreviewBlocker } from "./config-panel-preview-ready";

/**
 * Readiness model for the automation builder.
 *
 * The redesigned builder leads with a plain-language blocker ("1 field to fill
 * before this can run") instead of leaving the user to hunt for an amber dot on
 * a card. The canvas status pill, the per-step chip and the header sentence all
 * resolve through here so they cannot disagree.
 *
 * The per-step gap itself is not re-derived: it reuses the same
 * `getConfigPanelPreviewBlocker` the config panel uses to gate its Preview CTA,
 * so a step reads "Needs setup" on the canvas exactly when its Setup tab still
 * blocks. That covers the flow-level ad account too — steps that accept the
 * header account declare `accountId`/`accountIds`, which the blocker resolves
 * against `flowAccountId`.
 */

export type BuilderStepStatus = "ready" | "needs-setup" | "error";

export const BUILDER_STEP_STATUS_LABELS: Readonly<Record<BuilderStepStatus, string>> = {
  ready: "Ready",
  "needs-setup": "Needs setup",
  error: "Has an error",
};

/** Exported so `canvas-open-slots` reports this gap in the same words the canvas shows. */
export const CHOOSE_APP_BLOCKER = "Choose an app to continue";
const MISSING_TRIGGER_BLOCKER = "Add a trigger to continue";

export interface BuilderStepReadinessInput {
  readonly service?: string | null;
  readonly event?: string | null;
  readonly nodeType?: string;
  readonly config?: Record<string, unknown> | null;
  /** Header ad account, which satisfies steps that inherit it. */
  readonly flowAccountId?: string | null;
  /** A failed save blamed this step. */
  readonly hasError?: boolean;
}

export interface BuilderStepReadiness {
  readonly status: BuilderStepStatus;
  /** Pill copy on the step card ("Ready", "Needs setup"). */
  readonly label: string;
  /** The specific gap, e.g. "Fill in Ad Account to continue". Null when ready. */
  readonly blocker: string | null;
}

export function getBuilderStepReadiness(input: BuilderStepReadinessInput): BuilderStepReadiness {
  const service = input.service?.trim() ?? "";

  if (!service) {
    return {
      status: input.hasError ? "error" : "needs-setup",
      label: BUILDER_STEP_STATUS_LABELS[input.hasError ? "error" : "needs-setup"],
      blocker: CHOOSE_APP_BLOCKER,
    };
  }

  const blocker = getConfigPanelPreviewBlocker({
    service,
    event: input.event?.trim() ?? "",
    nodeType: input.nodeType,
    config: input.config ?? {},
    flowAccountId: input.flowAccountId,
  });

  if (input.hasError) {
    return { status: "error", label: BUILDER_STEP_STATUS_LABELS.error, blocker };
  }
  if (blocker) {
    return { status: "needs-setup", label: BUILDER_STEP_STATUS_LABELS["needs-setup"], blocker };
  }
  return { status: "ready", label: BUILDER_STEP_STATUS_LABELS.ready, blocker: null };
}

export function isBuilderStepReady(input: BuilderStepReadinessInput): boolean {
  return getBuilderStepReadiness(input).status === "ready";
}

export interface BuilderBlockerInput {
  readonly steps: readonly BuilderStepReadinessInput[];
  /** The flow has no trigger, so nothing can ever fire it. */
  readonly isTriggerMissing?: boolean;
}

/**
 * Every gap standing between this automation and a successful run, most
 * important first. The canvas highlights the first entry's step.
 */
export function listBuilderBlockers(input: BuilderBlockerInput): readonly string[] {
  const blockers = input.steps
    .map((step) => getBuilderStepReadiness(step).blocker)
    .filter((blocker): blocker is string => blocker !== null);
  return input.isTriggerMissing ? [MISSING_TRIGGER_BLOCKER, ...blockers] : blockers;
}

export function countBuilderBlockers(input: BuilderBlockerInput): number {
  return listBuilderBlockers(input).length;
}

/** Minimal node shape for flow-level blocker aggregation in the builder chrome. */
export interface BuilderFlowNodeBlockerInput {
  readonly id?: string;
  readonly type?: string;
  readonly service?: string | null;
  readonly event?: string | null;
  readonly config?: Record<string, unknown> | null;
}

export interface BuilderFlowBlockerInput {
  readonly nodes: readonly BuilderFlowNodeBlockerInput[];
  readonly selectedAccountId?: string | null;
}

/**
 * Every setup gap on the current canvas, in display order. Shared by the context
 * bar and the Run control so they cannot disagree on whether a run is allowed.
 */
export function listBuilderBlockersFromFlow(input: BuilderFlowBlockerInput): readonly string[] {
  return listBuilderBlockers({
    steps: input.nodes.map((node) => ({
      service: node.service,
      event: node.event,
      nodeType: node.type,
      config: node.config,
      flowAccountId: input.selectedAccountId,
    })),
    isTriggerMissing: input.nodes.length > 0 && !input.nodes.some((node) => node.type === "trigger"),
  });
}

/**
 * The sentence shown in the builder context bar. Returns null when nothing is
 * blocking, so the caller can render the "Ready to run" state instead.
 */
export function describeBuilderBlockers(count: number): string | null {
  if (count <= 0) return null;
  const noun = count === 1 ? "field" : "fields";
  return `${count} ${noun} to fill before this can run`;
}

/**
 * First canvas node that still has a Setup gap. Used when the context-bar
 * pill is clicked so the editor opens on the field that is blocking a run.
 */
export function findFirstIncompleteNodeId(input: BuilderFlowBlockerInput): string | null {
  for (const node of input.nodes) {
    if (!node.id) continue;
    const readiness = getBuilderStepReadiness({
      service: node.service,
      event: node.event,
      nodeType: node.type,
      config: node.config,
      flowAccountId: input.selectedAccountId,
    });
    if (readiness.blocker) return node.id;
  }
  return null;
}
