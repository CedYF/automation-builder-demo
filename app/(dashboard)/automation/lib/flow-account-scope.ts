/**
 * Reconciles the builder header's "Runs on" account with the accounts the steps
 * actually target.
 *
 * The header picks one account and seeds new steps from it, but a step can
 * select many of its own (Performance Threshold monitors up to every account in
 * the workspace). When they disagree the header was still showing one name, so
 * a rule watching 24 accounts read as "Runs on Pini Parma" — the step is what
 * runs, so the header was the misleading half.
 */

/** Config fields a step may use to name the accounts it runs against. */
const STEP_ACCOUNT_FIELDS = ["accountIds", "accountId", "adAccountId", "advertiserId"] as const;

export interface FlowScopeNode {
  readonly config?: Record<string, unknown> | null;
}

function readNodeAccountIds(config: Record<string, unknown> | null | undefined): string[] {
  if (!config) return [];
  const found: string[] = [];

  for (const field of STEP_ACCOUNT_FIELDS) {
    const value = config[field];
    if (typeof value === "string" && value.trim().length > 0) {
      found.push(value.trim());
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim().length > 0) found.push(entry.trim());
      }
    }
  }
  return found;
}

/** Every distinct account id any step on the flow targets. */
export function listFlowStepAccountIds(nodes: readonly FlowScopeNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    for (const id of readNodeAccountIds(node.config)) ids.add(id);
  }
  return [...ids];
}

export interface FlowAccountScopeInput {
  readonly nodes: readonly FlowScopeNode[];
  readonly selectedAccountId?: string | null;
}

/**
 * A short note for the context bar when the steps' real account scope is not
 * the single header account, or null when the two agree and the header alone
 * tells the truth.
 *
 * Deliberately not worded as "not applicable": the header account is still
 * written to the rule record and is what the AI assistant is pointed at. What
 * stops applying is its influence over *these steps*, which choose their own.
 */
export function describeFlowAccountScopeOverride(input: FlowAccountScopeInput): string | null {
  const stepAccountIds = listFlowStepAccountIds(input.nodes);
  if (stepAccountIds.length === 0) return null;

  if (stepAccountIds.length > 1) {
    return `Not used · steps pick ${stepAccountIds.length} accounts`;
  }

  const only = stepAccountIds[0];
  if (!input.selectedAccountId || only === input.selectedAccountId) return null;
  return "Not used · step picks its own account";
}

/** Whether the header selector should recede, because the steps override it. */
export function isFlowAccountScopeOverridden(input: FlowAccountScopeInput): boolean {
  return describeFlowAccountScopeOverride(input) !== null;
}
