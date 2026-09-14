/**
 * Copy for the builder context bar's "2 steps · Meta comments" line.
 *
 * The bar sits directly under the header and answers "what is this thing wired
 * to?" without the user opening a single step, so the summary has to stay short
 * and stable as steps are added.
 */

const MAX_SUMMARY_SERVICE_LABELS = 2;
const SUMMARY_SEPARATOR = " · ";

export function formatBuilderStepCount(count: number): string {
  if (count <= 0) return "No steps";
  return count === 1 ? "1 step" : `${count} steps`;
}

/**
 * Distinct service labels, capped so a long flow does not push the toggle off
 * screen. Overflow collapses into "+N".
 */
export function summarizeBuilderServices(
  labels: readonly (string | null | undefined)[],
  maxLabels: number = MAX_SUMMARY_SERVICE_LABELS,
): string | null {
  const distinct: string[] = [];
  for (const label of labels) {
    const trimmed = label?.trim();
    if (!trimmed) continue;
    if (!distinct.includes(trimmed)) distinct.push(trimmed);
  }
  if (distinct.length === 0) return null;
  if (maxLabels <= 0 || distinct.length <= maxLabels) return distinct.join(SUMMARY_SEPARATOR);
  const shown = distinct.slice(0, maxLabels);
  return `${shown.join(SUMMARY_SEPARATOR)} +${distinct.length - maxLabels}`;
}

export interface BuilderContextSummaryInput {
  readonly stepCount: number;
  readonly serviceLabels: readonly (string | null | undefined)[];
}

export function buildBuilderContextSummary(input: BuilderContextSummaryInput): string {
  const stepCount = formatBuilderStepCount(input.stepCount);
  const services = summarizeBuilderServices(input.serviceLabels);
  return services ? `${stepCount}${SUMMARY_SEPARATOR}${services}` : stepCount;
}
