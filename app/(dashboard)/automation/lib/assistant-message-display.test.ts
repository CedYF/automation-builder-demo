import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MESSAGE_COLLAPSE_CHARS,
  collapseAssistantMessage,
  shouldCollapseAssistantMessage,
  summarizeToolResultText,
} from "./assistant-message-display";

describe("shouldCollapseAssistantMessage", () => {
  it("returns false for short messages", () => {
    expect(shouldCollapseAssistantMessage("Preview failed. Building the canvas anyway.")).toBe(false);
  });

  it("returns true when the message exceeds the collapse threshold", () => {
    expect(shouldCollapseAssistantMessage("x".repeat(ASSISTANT_MESSAGE_COLLAPSE_CHARS + 1))).toBe(true);
  });
});

describe("collapseAssistantMessage", () => {
  it("returns the full text when under the limit", () => {
    expect(collapseAssistantMessage("Short update")).toBe("Short update");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "a".repeat(ASSISTANT_MESSAGE_COLLAPSE_CHARS + 40);
    const collapsed = collapseAssistantMessage(long);
    expect(collapsed.endsWith("…")).toBe(true);
    expect(collapsed.length).toBeLessThan(long.length);
  });
});

describe("summarizeToolResultText", () => {
  it("extracts the message field from an MCP error envelope", () => {
    expect(
      summarizeToolResultText(
        JSON.stringify({
          ok: false,
          code: "UPSTREAM_ERROR",
          message: "conditions is not iterable",
        }),
      ),
    ).toBe("conditions is not iterable");
  });

  it("returns null for empty input", () => {
    expect(summarizeToolResultText(undefined)).toBeNull();
    expect(summarizeToolResultText("   ")).toBeNull();
  });
});
