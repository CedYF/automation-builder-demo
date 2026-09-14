import { listStepConfigGaps, type ConfigPanelPreviewInput } from "./step-config-gaps";

export { isAutomationEventMissing } from "./step-config-gaps";
export type { ConfigPanelPreviewInput } from "./step-config-gaps";

export function isConfigPanelPreviewReady(input: ConfigPanelPreviewInput): boolean {
  return getConfigPanelPreviewBlocker(input) === null;
}

/**
 * First Setup gap that should keep Preview disabled. Event and target ad set
 * keep their existing footer copy; required registry fields use "Fill in {label}".
 */
export function getConfigPanelPreviewBlocker(input: ConfigPanelPreviewInput): string | null {
  return listStepConfigGaps(input)[0]?.message ?? null;
}
