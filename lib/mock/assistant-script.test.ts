import { describe, expect, it } from "vitest";
import { buildMockTurn, pickScenario } from "./assistant-script";

describe("scripted assistant baseline", () => {
  it("routes the flagship comment request to the comment scenario", () => {
    expect(pickScenario({ message: "Hide negative comments" })).toBe("comment-hide");
  });

  it("builds a comment trigger and a hide action for negative comments", () => {
    const turn = buildMockTurn({ message: "Hide negative comments" });
    const steps = turn.beats.flatMap((beat) => beat.toolCalls ?? []).map((call) => call.args.event);
    expect(steps).toContain("New Comment");
    expect(steps).toContain("Hide Comment");
  });

  it("keeps asking for the page on the first three FAQ turns", () => {
    const closings = [0, 1, 2].map((turnIndex) => buildMockTurn({ message: "Reply to FAQ comments", turnIndex }));
    expect(closings.every((turn) => turn.beats.length === 0)).toBe(true);
    expect(buildMockTurn({ message: "Reply to FAQ comments", turnIndex: 3 }).beats.length).toBeGreaterThan(0);
  });

  it("stays in the FAQ loop whatever the customer answers", () => {
    const scenario = pickScenario({ message: "the main page", turnIndex: 1, activeScenario: "faq-loop" });
    expect(scenario).toBe("faq-loop");
  });

  it("builds a Meta action for a Pinterest request on a Meta account (baseline defect)", () => {
    const turn = buildMockTurn({ message: "Pause my Pinterest ads under $5", accountPlatform: "meta" });
    const services = turn.beats.flatMap((beat) => beat.toolCalls ?? []).map((call) => call.args.service);
    expect(turn.scenario).toBe("platform-mismatch");
    expect(services).toContain("meta-ads");
    expect(turn.closing).toContain("Pinterest");
  });

  it("drops the Friday schedule when the timezone is answered (baseline defect)", () => {
    const first = buildMockTurn({ message: "Pause ads under CHF 5 spend, Friday 23:00 to Saturday 00:00" });
    const second = buildMockTurn({ message: "Zurich time", turnIndex: 1, activeScenario: "scheduled-pause" });
    const configOf = (turn: ReturnType<typeof buildMockTurn>) =>
      turn.beats.flatMap((beat) => beat.toolCalls ?? []).find((call) => call.args.stepId === "node-trigger-1")?.args
        .config as Record<string, unknown>;
    expect(configOf(first).checkDays).toEqual(["friday"]);
    expect(configOf(second).checkDays).toBeUndefined();
  });
});
