export type AutomationChatSurface = "empty-home" | "chat-tab";

const EMPTY_HOME_INTRO =
  "You currently have no automations. Tell me what's eating your time and I'll draft the flow — you approve before anything runs.";

const CHAT_TAB_INTRO = "Tell me what's eating your time and I'll draft the flow — you approve before anything runs.";

/**
 * Body copy under the greeting. Empty home mentions the zero state; the Chat
 * tab does not, because that surface is also used when automations already exist.
 */
export function automationChatIntro(surface: AutomationChatSurface): string {
  return surface === "empty-home" ? EMPTY_HOME_INTRO : CHAT_TAB_INTRO;
}
