import type { NodeType } from "../contexts/automation-context";
import { normalizeAssistantStepFields } from "./normalize-assistant-step";
import {
  resolveAutomationStepIdForCanvas,
  type AutomationCanvasStepSnapshot,
} from "@/lib/chat/automation-canvas-context";

/**
 * Maps streamed automation-builder MCP tool calls onto live canvas mutations,
 * mirroring `applyDashboardToolEvent` for the custom-dashboard artifact. The
 * builder tools are ephemeral (no DB writes); this reducer is what makes the
 * canvas build/edit one step at a time as the assistant streams tool calls.
 */

export const AUTOMATION_BUILDER_TOOLS = {
  START: "automation_start_flow",
  ADD: "automation_add_step",
  UPDATE: "automation_update_step",
  REMOVE: "automation_remove_step",
} as const;

const BUILDER_TOOL_NAMES: ReadonlySet<string> = new Set(Object.values(AUTOMATION_BUILDER_TOOLS));

const NODE_TYPES: readonly NodeType[] = ["trigger", "action", "filter", "delay", "approval"];

export interface AssistantStepInput {
  id: string;
  type?: NodeType;
  service?: string;
  event?: string;
  config?: Record<string, unknown>;
  position?: number;
}

/** Canvas surface the reducer drives — structurally satisfied by the automation context. */
export interface AssistantCanvasApi {
  startFlow(input: { name: string; selectedAccountId?: string; selectedAccountName?: string }): void;
  upsertStep(step: AssistantStepInput): void;
  removeStep(id: string): void;
}

export function isAutomationBuilderTool(name: string): boolean {
  return BUILDER_TOOL_NAMES.has(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNodeType(value: unknown): NodeType | undefined {
  return typeof value === "string" && (NODE_TYPES as readonly string[]).includes(value)
    ? (value as NodeType)
    : undefined;
}

function asConfig(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return undefined;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function asPosition(value: unknown, config?: Record<string, unknown>): number | undefined {
  const parse = (raw: unknown): number | undefined => {
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return undefined;
  };
  return parse(value) ?? parse(config?.position);
}

/**
 * The step this tool call targets, when it already exists on the canvas. Agent
 * stepIds (`node-action-1`) do not always match live canvas ids, so this reuses the
 * same resolution the remove path relies on.
 */
function findCanvasStep(
  stepId: string,
  steps: readonly AutomationCanvasStepSnapshot[],
): AutomationCanvasStepSnapshot | undefined {
  if (steps.length === 0) return undefined;
  const resolvedId = resolveAutomationStepIdForCanvas(stepId, steps) ?? stepId;
  return steps.find((step) => step.stepId === resolvedId);
}

/**
 * Applies one streamed builder tool call to the canvas. Returns the id of the
 * step that was just added/edited (for a transient highlight), or null when the
 * tool call is not a builder tool or lacks a usable id.
 */
export function applyAutomationToolCall(
  toolCall: { readonly name: string; readonly args: Record<string, unknown> },
  api: AssistantCanvasApi,
  options: {
    readonly canvasSteps?: readonly AutomationCanvasStepSnapshot[];
    readonly selectedAccountId?: string | null;
    readonly selectedAccountPlatform?: string | null;
  } = {},
): { readonly pendingStepId: string | null } | null {
  if (!isAutomationBuilderTool(toolCall.name)) return null;
  const args = toolCall.args;

  if (toolCall.name === AUTOMATION_BUILDER_TOOLS.START) {
    const name = asString(args.name) ?? "AI automation";
    api.startFlow({
      name,
      selectedAccountId: asString(args.accountId),
      selectedAccountName: asString(args.accountName),
    });
    return { pendingStepId: null };
  }

  if (toolCall.name === AUTOMATION_BUILDER_TOOLS.REMOVE) {
    const requestedId = asString(args.stepId);
    const canvasSteps = options.canvasSteps ?? [];
    const resolvedId =
      requestedId && canvasSteps.length > 0 ? resolveAutomationStepIdForCanvas(requestedId, canvasSteps) : requestedId;
    if (!resolvedId) return { pendingStepId: null };
    api.removeStep(resolvedId);
    return { pendingStepId: null };
  }

  // add_step / update_step both upsert by stepId.
  const id = asString(args.stepId);
  if (!id) return { pendingStepId: null };
  // update_step sends only the fields being changed, so service/event/type are often
  // absent. Normalizing without them skips every service-specific rule (pause target
  // fields, notification defaults, cross-channel launch), so fall back to what the
  // step already is on the canvas. Explicit args always win, which keeps genuine
  // service/event changes working.
  const existingStep = findCanvasStep(id, options.canvasSteps ?? []);
  const type = asNodeType(args.type) ?? asNodeType(existingStep?.type);
  const service = asString(args.service) ?? asString(existingStep?.service);
  const rawEvent = asString(args.event) ?? asString(existingStep?.event);
  const rawConfig = asConfig(args.config);
  const normalized = normalizeAssistantStepFields({
    type,
    service,
    event: rawEvent,
    config: rawConfig,
    selectedAccountId: options.selectedAccountId,
    selectedAccountPlatform: options.selectedAccountPlatform,
  });
  const resolvedPosition = asPosition(args.position, normalized.config ?? rawConfig);
  const step: AssistantStepInput = {
    id,
    type,
    service: normalized.service ?? service,
    event: normalized.event ?? rawEvent,
    config: normalized.config ?? rawConfig,
    ...(resolvedPosition !== undefined ? { position: resolvedPosition } : {}),
  };
  api.upsertStep(step);
  return { pendingStepId: id };
}
