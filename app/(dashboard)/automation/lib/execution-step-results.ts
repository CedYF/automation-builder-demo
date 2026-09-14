import type { ExecutionLog } from "../contexts/automation-context";

export interface FlowStepResult {
  readonly nodeId: string;
  readonly event?: string;
  readonly success?: boolean;
  readonly skipped?: boolean;
  readonly status?: string;
  readonly stepType?: string;
  readonly service?: string;
  readonly summary?: string;
  readonly error?: string;
  readonly durationMs?: number;
  readonly outputs?: Record<string, unknown>;
}

interface FlowNodeLike {
  readonly id: string;
  readonly type: string;
  readonly service?: string;
  readonly event?: string;
}

/** Pull the persisted step list off any log entry that carries it. */
export function extractStepResultsFromLogs(logs: ReadonlyArray<ExecutionLog>): FlowStepResult[] | undefined {
  for (const log of logs) {
    const results = log.data?.stepResults;
    if (Array.isArray(results) && results.length > 0) {
      return results as FlowStepResult[];
    }
  }

  const fromStream = logs
    .map((log) => log.data?.stepResult as FlowStepResult | undefined)
    .filter((step): step is FlowStepResult => Boolean(step?.nodeId));

  return fromStream.length > 0 ? fromStream : undefined;
}

export function resolveExecutionLogStatusForStep(
  step: FlowStepResult | undefined,
  fallbackSuccess: boolean,
): ExecutionLog["status"] {
  if (!step) return fallbackSuccess ? "success" : "error";
  if (step.skipped || step.status === "skipped") return "skipped";
  if (step.success === false) return "error";
  return "success";
}

function completionMessage(
  node: FlowNodeLike,
  step: FlowStepResult | undefined,
  status: ExecutionLog["status"],
): string {
  if (step?.summary) return step.summary;
  if (status === "skipped") {
    const reason = step?.outputs?.skippedReason;
    return typeof reason === "string" ? reason : "Skipped — trigger did not qualify";
  }
  if (status === "error") {
    return step?.error || (node.event ? `Failed ${node.type}: ${node.event}` : `Failed ${node.type}`);
  }
  const eventSuffix = node.event ? ` - ${node.event}` : "";
  return `Completed ${node.type}: ${node.service ?? "system"}${eventSuffix}`;
}

/** One log row per flow node after a run completes, aligned with backend stepResults. */
export function buildCompletionLogsFromStepResults(params: {
  nodes: readonly FlowNodeLike[];
  stepResults?: readonly FlowStepResult[];
  runSuccess: boolean;
  sharedData?: Record<string, unknown>;
  timestamp?: Date;
}): ExecutionLog[] {
  const byNodeId = new Map((params.stepResults ?? []).map((step) => [step.nodeId, step]));
  const timestamp = params.timestamp ?? new Date();

  return params.nodes.map((node) => {
    const step = byNodeId.get(node.id);
    const status = resolveExecutionLogStatusForStep(step, params.runSuccess);
    return {
      id: `log-${node.id}-complete-${timestamp.getTime()}`,
      nodeId: node.id,
      status,
      message: completionMessage(node, step, status),
      timestamp,
      data: { ...params.sharedData, stepResults: params.stepResults, stepResult: step },
      duration: step?.durationMs,
    };
  });
}
