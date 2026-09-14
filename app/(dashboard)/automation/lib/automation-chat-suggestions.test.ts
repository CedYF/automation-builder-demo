import { describe, expect, it } from "vitest";
import { AUTOMATION_CHAT_SUGGESTION_LIMIT, suggestionsForChatCategory } from "./automation-chat-suggestions";

describe("suggestionsForChatCategory", () => {
  it("returns three optimization starters by default", () => {
    const suggestions = suggestionsForChatCategory("optimization");
    expect(suggestions).toHaveLength(AUTOMATION_CHAT_SUGGESTION_LIMIT);
    expect(suggestions[0]?.text).toContain("ROAS");
  });

  it("marks the reporting scan prompt as suggest mode", () => {
    const suggestions = suggestionsForChatCategory("reporting");
    expect(suggestions.some((suggestion) => suggestion.mode === "suggest")).toBe(true);
  });
});
