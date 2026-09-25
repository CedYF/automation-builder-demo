import { describe, expect, it } from "vitest";
import { previewDemoComments } from "./comment-examples";

const conditions = {
  matchMode: "any",
  sentimentMax: 40,
  brandStances: ["undermining"],
  customIntents: ["custom-comment-scan"],
};

describe("demo comment preview", () => {
  it("only previews selected pages and explains each hidden comment", () => {
    const decisions = previewDemoComments({ pageIds: ["demo-page-1"], conditions });
    expect(decisions).toHaveLength(3);
    expect(decisions.map((decision) => decision.willHide)).toEqual([true, true, false]);
    expect(decisions[0].reasons).toEqual(["Negative tone"]);
    expect(decisions[1].reasons).toEqual(["Undermines the brand"]);
  });

  it("updates the result when pages and checks change", () => {
    const decisions = previewDemoComments({
      pageIds: ["demo-ig-1"],
      conditions: { matchMode: "any", customIntents: ["custom-comment-scan"] },
    });
    expect(decisions.map((decision) => decision.willHide)).toEqual([true, false, false]);
    expect(decisions[0].reasons).toEqual(["Hostile pile-on"]);
  });
});
