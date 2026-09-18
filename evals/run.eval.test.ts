/**
 * Runnable eval suite for the automation-agent scripted responder.
 *
 * `pnpm eval` runs this file only, prints a human-readable pass/fail summary
 * (vitest's own reporter) grouped by case id/category, and writes a
 * machine-readable JSON result to `evals/results/latest.json` (see the
 * `--reporter=json` flag in the `eval` package.json script).
 *
 * This calls `buildMockTurn` directly — no server, no network, no API key —
 * so it is exactly the function the real `/api/automation-assistant/stream`
 * route serves over SSE, just invoked without the transport.
 */

import { describe, expect, it } from "vitest";
import { buildMockTurn, type MockTurn } from "@/lib/mock/assistant-script";
import { AUTOMATION_BUILDER_TOOLS } from "@/app/(dashboard)/automation/lib/assistant-canvas";
import { EVAL_CASES } from "./fixtures";
import { DATASET_VERSION } from "./types";
import type { EvalExpectation } from "./types";

function hasAskUser(turn: MockTurn): boolean {
  return turn.beats.some((beat) => beat.toolCalls?.some((call) => call.name === "ask_user"));
}

function hasBuilderToolCalls(turn: MockTurn): boolean {
  return turn.beats.some((beat) =>
    beat.toolCalls?.some((call) => Object.values(AUTOMATION_BUILDER_TOOLS).includes(call.name as never)),
  );
}

function builderServices(turn: MockTurn): string[] {
  return turn.beats.flatMap(
    (beat) =>
      beat.toolCalls
        ?.filter((call) => call.name === AUTOMATION_BUILDER_TOOLS.ADD || call.name === AUTOMATION_BUILDER_TOOLS.UPDATE)
        .map((call) => (typeof call.args.service === "string" ? call.args.service : ""))
        .filter(Boolean) ?? [],
  );
}

function checkExpectation(turn: MockTurn, allTurns: readonly MockTurn[], expectation: EvalExpectation): void {
  if (expectation.askUser !== undefined) {
    expect(hasAskUser(turn), "ask_user presence").toBe(expectation.askUser);
  }
  if (expectation.builderService) {
    expect(builderServices(turn), "builder step services").toContain(expectation.builderService);
  }
  if (expectation.noBuilderToolCalls !== undefined) {
    expect(hasBuilderToolCalls(turn), "builder tool calls present").toBe(!expectation.noBuilderToolCalls);
  }
  if (expectation.closingContainsAll) {
    const closing = turn.closing.toLowerCase();
    for (const needle of expectation.closingContainsAll) {
      expect(closing, `closing should mention "${needle}"`).toContain(needle.toLowerCase());
    }
  }
  if (expectation.closingContainsNone) {
    const closing = turn.closing.toLowerCase();
    for (const needle of expectation.closingContainsNone) {
      expect(closing, `closing should NOT mention "${needle}"`).not.toContain(needle.toLowerCase());
    }
  }
  if (expectation.sameClosingAsTurn !== undefined) {
    expect(turn.closing, `closing should equal turn ${expectation.sameClosingAsTurn}'s closing`).toBe(
      allTurns[expectation.sameClosingAsTurn]?.closing,
    );
  }
}

describe(`automation-agent eval suite (dataset ${DATASET_VERSION})`, () => {
  for (const evalCase of EVAL_CASES) {
    const label = `[${evalCase.problemCategory}]${evalCase.knownLimitation ? "[known-limitation]" : ""} ${evalCase.id}`;

    describe(label, () => {
      // Run every turn once per case (sequential, stateless mock — each turn
      // carries forward turn 0's account context unless it overrides it, the
      // same way the real client keeps the selected account across messages).
      const results: MockTurn[] = [];
      for (const [index, turnInput] of evalCase.turns.entries()) {
        const base = evalCase.turns[0];
        results.push(
          buildMockTurn({
            conversationId: `eval-${evalCase.id}`,
            message: turnInput.message,
            adAccountId: turnInput.adAccountId ?? base.adAccountId,
            accountName: turnInput.accountName ?? base.accountName,
            accountPlatform: turnInput.accountPlatform ?? base.accountPlatform,
          }),
        );
        void index;
      }

      for (const [index, expectation] of Object.entries(evalCase.expectationsByTurn)) {
        const turnIndex = Number(index);
        it(`turn ${turnIndex}: ${evalCase.description}`, () => {
          checkExpectation(results[turnIndex], results, expectation);
        });
      }
    });
  }

  it("dataset includes a successful control case (guards against a 'refuse everything' agent)", () => {
    expect(EVAL_CASES.some((evalCase) => evalCase.control)).toBe(true);
  });

  it("dataset includes a held-out regression case", () => {
    expect(EVAL_CASES.some((evalCase) => evalCase.heldOut)).toBe(true);
  });

  it("dataset covers all three investigated cases (C01, C02, C06)", () => {
    const categories = new Set(EVAL_CASES.map((evalCase) => evalCase.problemCategory));
    expect(categories.has("repeated_confirmation")).toBe(true);
    expect(categories.has("schedule_fidelity")).toBe(true);
    expect(categories.has("unsupported_platform")).toBe(true);
  });
});
