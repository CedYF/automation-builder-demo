import { describe, expect, it } from "vitest";
import { AUTOMATION_HOME_FILTER_LABELS, AUTOMATION_HOME_STATE_LABELS, formatHomeHeaderSummary } from "./home-labels";

describe("automation home labels", () => {
  it("names the needs-you filter Approvals", () => {
    expect(AUTOMATION_HOME_FILTER_LABELS["needs-you"]).toBe("Approvals");
  });

  it("names the needs-you row state Approvals", () => {
    expect(AUTOMATION_HOME_STATE_LABELS["needs-you"]).toBe("Approvals");
  });
});

describe("formatHomeHeaderSummary", () => {
  it("skips running and approvals when both counts are zero", () => {
    expect(formatHomeHeaderSummary({ total: 12, running: 0, needsYou: 0 })).toBe("12 automations");
  });

  it("uses the singular automation noun for a single row", () => {
    expect(formatHomeHeaderSummary({ total: 1, running: 0, needsYou: 0 })).toBe("1 automation");
  });

  it("includes running and approvals when they are present", () => {
    expect(formatHomeHeaderSummary({ total: 12, running: 4, needsYou: 2 })).toBe(
      "12 automations · 4 running · 2 approvals",
    );
  });

  it("uses the singular approval noun for one waiting run", () => {
    expect(formatHomeHeaderSummary({ total: 3, running: 0, needsYou: 1 })).toBe("3 automations · 1 approval");
  });
});
