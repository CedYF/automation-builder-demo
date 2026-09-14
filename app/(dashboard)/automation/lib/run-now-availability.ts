import { listBuilderBlockersFromFlow, type BuilderFlowBlockerInput } from "./builder-readiness";

/**
 * Whether the automation is actually runnable right now — the same gate the
 * header's Run button uses (`canRun` in automation-header.tsx). The header's
 * Save button and the config panel's step Save button both resolve "should
 * this button offer Run now once it's saved?" through this one function so
 * none of the three can disagree: missing manage permission, a still-loading
 * editor identity, or any unresolved builder blocker (missing trigger,
 * incomplete step config, no ad account) all block it the same way a manual
 * Run click would.
 */
export interface RunNowAvailabilityInput extends BuilderFlowBlockerInput {
  readonly canManageAutomations: boolean;
  readonly canMutate: boolean;
}

export function isRunNowAvailable(input: RunNowAvailabilityInput): boolean {
  if (!input.canManageAutomations || !input.canMutate) return false;
  return listBuilderBlockersFromFlow(input).length === 0;
}
