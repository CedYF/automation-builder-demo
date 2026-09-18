/** Versioned eval dataset types for the automation-agent scripted responder. */

export const DATASET_VERSION = "2026-09-18.1";

export interface EvalTurn {
  readonly message: string;
  /** Falls back to turn 0's value when omitted — mirrors the app carrying the selected account across turns. */
  readonly adAccountId?: string;
  readonly accountName?: string;
  readonly accountPlatform?: string;
}

export interface EvalExpectation {
  readonly askUser?: boolean;
  readonly builderService?: string;
  readonly closingContainsAll?: readonly string[];
  readonly closingContainsNone?: readonly string[];
  /** True when this turn's beats must contain NO automation_* builder tool calls. */
  readonly noBuilderToolCalls?: boolean;
  /** Index of an earlier turn whose closing text this turn's closing must equal. */
  readonly sameClosingAsTurn?: number;
}

export type EvalProblemCategory =
  | "repeated_confirmation" // C01
  | "schedule_fidelity" // C02
  | "unsupported_platform" // C06
  | "none";

export interface EvalCase {
  readonly id: string;
  readonly problemCategory: EvalProblemCategory;
  readonly description: string;
  /** A must-pass success case so a policy of "refuse everything" cannot pass the suite. */
  readonly control?: boolean;
  /** Kept alongside the newer cases as a small held-out regression guard. */
  readonly heldOut?: boolean;
  /**
   * When true, `expectationsByTurn` describes the CURRENT (undesirable) behavior —
   * this case documents a known, unfixed bug rather than the target behavior.
   * See docs/investigation.md for why it was not fixed in this pass.
   */
  readonly knownLimitation?: boolean;
  readonly turns: readonly EvalTurn[];
  readonly expectationsByTurn: Readonly<Record<number, EvalExpectation>>;
}
