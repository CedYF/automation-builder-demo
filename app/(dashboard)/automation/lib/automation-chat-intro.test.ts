import { describe, expect, it } from "vitest";
import { automationChatIntro } from "./automation-chat-intro";

describe("automationChatIntro", () => {
  it("tells a first-time visitor they have no automations yet", () => {
    expect(automationChatIntro("empty-home")).toContain("You currently have no automations");
  });

  it("keeps the Chat tab copy valid when automations already exist", () => {
    expect(automationChatIntro("chat-tab")).not.toContain("no automations");
    expect(automationChatIntro("chat-tab")).toContain("draft the flow");
  });
});
