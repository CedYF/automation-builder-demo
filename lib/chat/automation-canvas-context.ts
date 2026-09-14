/**
 * Serializes the live automation builder canvas for the assistant agent. The MCP
 * builder tools are write-only echoes — there is no server-side draft store — so
 * each turn must carry the current canvas snapshot in the system prompt.
 */

/** One unresolved Setup requirement, flattened for the prompt. */
export interface AutomationCanvasSlot {
  readonly label: string;
  readonly message: string;
}

export interface CanvasOpenSlotsLike {
  readonly isTriggerMissing: boolean;
  readonly isActionMissing: boolean;
  readonly steps: readonly { readonly stepId: string; readonly slots: readonly AutomationCanvasSlot[] }[];
}

export interface AutomationCanvasStepSnapshot {
  readonly stepId: string;
  readonly type: string;
  readonly service?: string;
  readonly event?: string;
  readonly position: number;
  /** Unresolved Setup requirements on this step. Client-computed, so read defensively. */
  readonly openSlots?: readonly AutomationCanvasSlot[];
}

export interface AutomationCanvasDraftSnapshot {
  readonly name: string;
  readonly selectedAccountId?: string;
  readonly steps: readonly AutomationCanvasStepSnapshot[];
  readonly isTriggerMissing?: boolean;
  readonly isActionMissing?: boolean;
}

interface AutomationCanvasNodeLike {
  readonly id?: string;
  readonly type?: string;
  readonly service?: string;
  readonly event?: string;
  readonly position?: number;
}

interface AutomationCanvasFlowLike {
  readonly name?: string;
  readonly selectedAccountId?: string;
  readonly nodes?: readonly AutomationCanvasNodeLike[];
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** Builds a compact, stable snapshot from the live automation flow. Never returns null when `flow` is provided. */
export function buildAutomationCanvasDraftSnapshot(
  flow: AutomationCanvasFlowLike | null | undefined,
): AutomationCanvasDraftSnapshot | null {
  if (!flow) return null;
  const nodes = flow.nodes ?? [];

  const steps = nodes
    .map((node, index) => {
      const stepId = asNonEmptyString(node.id);
      const type = asNonEmptyString(node.type);
      if (!stepId || !type) return null;
      return {
        stepId,
        type,
        ...(asNonEmptyString(node.service) ? { service: asNonEmptyString(node.service) } : {}),
        ...(asNonEmptyString(node.event) ? { event: asNonEmptyString(node.event) } : {}),
        position: typeof node.position === "number" && Number.isFinite(node.position) ? node.position : index,
      } satisfies AutomationCanvasStepSnapshot;
    })
    .filter((step): step is AutomationCanvasStepSnapshot => step !== null)
    .sort((left, right) => left.position - right.position);

  if (nodes.length === 0 && steps.length === 0 && !asNonEmptyString(flow.name)) {
    return null;
  }

  const accountId = asNonEmptyString(flow.selectedAccountId);
  return {
    name: asNonEmptyString(flow.name) ?? "Untitled automation",
    ...(accountId ? { selectedAccountId: accountId } : {}),
    steps,
  };
}

/** Snapshot for assistant API requests — always serializable, never omitted from JSON bodies. */
export function buildAutomationCanvasDraftForRequest(
  flow: AutomationCanvasFlowLike | null | undefined,
): AutomationCanvasDraftSnapshot {
  const fallbackAccountId = asNonEmptyString(flow?.selectedAccountId);
  return (
    buildAutomationCanvasDraftSnapshot(flow) ?? {
      name: asNonEmptyString(flow?.name) ?? "Untitled automation",
      ...(fallbackAccountId ? { selectedAccountId: fallbackAccountId } : {}),
      steps: [],
    }
  );
}

/**
 * Attaches client-computed open slots to a snapshot. Kept as a pure merge so the
 * chat modules never import the automation registry to build one.
 *
 * Each slot is rebuilt from `label` and `message` rather than forwarded, because
 * callers pass richer gap objects and only these two fields may cross the network.
 */
export function withAutomationCanvasOpenSlots(
  draft: AutomationCanvasDraftSnapshot,
  openSlots: CanvasOpenSlotsLike,
): AutomationCanvasDraftSnapshot {
  const slotsByStepId = new Map(openSlots.steps.map((step) => [step.stepId, step.slots]));
  return {
    ...draft,
    isTriggerMissing: openSlots.isTriggerMissing,
    isActionMissing: openSlots.isActionMissing,
    steps: draft.steps.map((step) => {
      const slots = slotsByStepId.get(step.stepId) ?? [];
      if (slots.length === 0) return step;
      return { ...step, openSlots: slots.map((slot) => ({ label: slot.label, message: slot.message })) };
    }),
  };
}

const AGENT_STEP_ID_PATTERN = /^node-(trigger|action|filter|delay|approval)-(\d+)$/;

/**
 * Maps agent stepIds (`node-action-1`) onto live canvas ids (`node-1730000000-1` or
 * template `action-1`). Returns null when nothing matches.
 */
export function resolveAutomationStepIdForCanvas(
  requestedId: string,
  steps: readonly AutomationCanvasStepSnapshot[],
): string | null {
  if (!requestedId || steps.length === 0) return null;
  if (steps.some((step) => step.stepId === requestedId)) return requestedId;

  const withoutNodePrefix = requestedId.replace(/^node-/, "");
  const byLegacyId = steps.find((step) => step.stepId === withoutNodePrefix);
  if (byLegacyId) return byLegacyId.stepId;

  const conventionMatch = requestedId.match(AGENT_STEP_ID_PATTERN);
  if (conventionMatch) {
    const type = conventionMatch[1];
    const index = Number(conventionMatch[2]) - 1;
    const ofType = steps.filter((step) => step.type === type).sort((left, right) => left.position - right.position);
    const matched = ofType[index];
    if (matched) return matched.stepId;
  }

  const mintedIndexMatch = requestedId.match(/^node-\d+-(\d+)$/);
  if (mintedIndexMatch) {
    const position = Number(mintedIndexMatch[1]);
    const byPosition = steps.find((step) => step.position === position);
    if (byPosition) return byPosition.stepId;
  }

  return null;
}

export function resolveLastAutomationStepId(steps: readonly AutomationCanvasStepSnapshot[]): string | null {
  if (steps.length === 0) return null;
  return [...steps].sort((left, right) => right.position - left.position)[0]?.stepId ?? null;
}

const SLOT_INTERIOR_WHITESPACE_PATTERN = /\s+/g;

/** Slot text lands in a high-trust prompt region, so it must not be able to add lines of its own. */
function readSlotText(value: unknown): string | undefined {
  return asNonEmptyString(value)?.replace(SLOT_INTERIOR_WHITESPACE_PATTERN, " ");
}

function readCanvasSlots(value: unknown): readonly AutomationCanvasSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const label = readSlotText((entry as { label?: unknown }).label);
    const message = readSlotText((entry as { message?: unknown }).message);
    return label && message ? [{ label, message }] : [];
  });
}

/**
 * The slot contract. Everything the assistant still has to resolve, named, so a
 * clarifying question is a lookup rather than a judgement call.
 */
function appendOpenSlotLines(lines: string[], snapshot: AutomationCanvasDraftSnapshot): void {
  const structural: string[] = [];
  if (snapshot.isTriggerMissing) structural.push("This flow has no trigger step, so nothing can fire it.");
  if (snapshot.isActionMissing) structural.push("This flow has no action step, so it would fire and do nothing.");

  const stepLines = snapshot.steps.flatMap((step) =>
    readCanvasSlots(step.openSlots).map((slot) => `- ${step.stepId} — ${slot.label}: ${slot.message}`),
  );

  if (structural.length === 0 && stepLines.length === 0) {
    // A snapshot that skipped the merge sets neither flag, and is otherwise
    // indistinguishable from a complete one. Staying silent there keeps the agent's
    // pre-feature judgement instead of asserting a completeness we never computed.
    const wasMerged = snapshot.isTriggerMissing !== undefined || snapshot.isActionMissing !== undefined;
    if (wasMerged) lines.push("OPEN SLOTS: none — every required field on this draft is filled.");
    return;
  }

  lines.push("OPEN SLOTS (unresolved required fields — resolve these before you call this automation ready):");
  lines.push(...structural.map((entry) => `- ${entry}`), ...stepLines);
  lines.push(
    "Ask about these with ask_user (one question per turn, then STOP) or fill them from a discovery tool. Never tell the user the automation is ready while any slot above is open — say which field is still needed instead.",
  );
}

/** Appends the live canvas snapshot block to the automation system prompt. */
export function formatAutomationCanvasDraftForPrompt(snapshot: AutomationCanvasDraftSnapshot): string {
  const lines = [
    "Current automation canvas draft (authoritative for edits — use these stepIds; do not ask the user for ids already listed here):",
    `Draft name: ${snapshot.name}`,
  ];
  if (snapshot.selectedAccountId) {
    lines.push(`Selected account: ${snapshot.selectedAccountId}`);
  }
  if (snapshot.steps.length === 0) {
    lines.push("Steps: (empty — call automation_start_flow before adding steps)");
  } else {
    lines.push("Steps (execution order):");
    snapshot.steps.forEach((step, index) => {
      const label = [step.type, step.service, step.event].filter(Boolean).join(" / ");
      lines.push(`${index + 1}. stepId=${step.stepId} — ${label || step.type} (position ${step.position})`);
    });
    lines.push(
      "To remove the last step, call automation_remove_step with that step's stepId. To edit, call automation_update_step. Do NOT call automation_start_flow unless the user asks to start over.",
    );
  }
  appendOpenSlotLines(lines, snapshot);
  return lines.join("\n");
}
