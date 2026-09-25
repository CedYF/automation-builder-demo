import { describe, expect, it } from "vitest";
import { buildMockTurn } from "./assistant-script";

describe("auto-hide negative comments agent turn", () => {
  const canvasDraft = {
    name: "Auto-hide negative comments",
    steps: [
      { stepId: "trigger-1", type: "trigger", service: "comments", event: "New Comment", position: 0 },
      { stepId: "action-1", type: "action", service: "comments", event: "Hide Comment", position: 1 },
    ],
  };

  it("asks for the page choice before editing the canvas", () => {
    const turn = buildMockTurn({ message: "Help me set up Auto-hide negative comments" });
    const calls = turn.beats.flatMap((beat) => beat.toolCalls ?? []);

    expect(calls.map((call) => call.name)).toEqual(["list_pages", "ask_user"]);
    expect(calls[1].args).toMatchObject({
      kind: "choice",
      question: "Which pages should I watch for comments on your ads?",
      options: [{ label: "UK Facebook" }, { label: "US Facebook" }, { label: "UK Instagram" }, { label: "All three pages" }],
    });
    expect(turn.meta?.askedQuestion).toBe(true);
    expect(turn.closing).toContain("No pages have been added yet");
  });

  it("adds only confirmed pages, then configures the rule and hide action", () => {
    const turn = buildMockTurn({ message: "UK Facebook", canvasDraft });
    const calls = turn.beats.flatMap((beat) => beat.toolCalls ?? []);

    expect(calls.map((call) => [call.name, call.args.stepId])).toEqual([
      ["automation_update_step", "trigger-1"],
      ["automation_update_step", "trigger-1"],
      ["automation_update_step", "action-1"],
    ]);
    expect(calls[0].args.config).toMatchObject({ pageIds: ["demo-page-1"] });
    expect(calls[1].args.config).toMatchObject({
      conditions: {
        matchMode: "any",
        sentimentMax: 40,
        brandStances: ["undermining"],
        customIntents: ["custom-comment-scan"],
      },
    });
    expect(turn.closing).toContain("pages you confirmed");
  });

  it("recognizes all three even when the reply also mentions auto-hide comments", () => {
    const turn = buildMockTurn({ message: "Use all three pages for Auto-hide negative comments", canvasDraft });
    expect(turn.beats[0].toolCalls?.[0].args.config).toMatchObject({ pageIds: ["demo-page-1", "demo-ig-1", "demo-page-2"] });
  });
});
