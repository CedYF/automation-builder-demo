/** Conservative routing: a one-off lookup should not silently become a recurring rule. */
export type AutomationChatDestination = "mcp" | "chat";

export function resolveAutomationChatDestination(text: string): AutomationChatDestination | null {
  if (
    /\b(mcp)\b/i.test(text) &&
    /\b(connect|connection|setup|set up|install|get|claude|cursor|codex)\b/i.test(text) &&
    !/\b(build|create|schedule|automate)\b/i.test(text)
  )
    return "mcp";
  if (
    /\b(weekly|daily|hourly|automatically|automation|whenever|schedule|duplicate|copy|launch|pause)\b/i.test(text) ||
    /\bevery\s+(?:day|week|month|hour|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+)\b/i.test(text)
  )
    return null;
  if (/\b(top|best)[\s\S]{0,45}\bads\b/i.test(text) && /\b(get|show|find|list|need|report)\b/i.test(text))
    return "chat";
  if (/\butm\b/i.test(text) && /\b(check|audit|scan)\b/i.test(text)) return "chat";
  if (/\bpreset\b/i.test(text)) return "chat";
  return null;
}

export function hasExplicitAutomationBuildIntent(text: string): boolean {
  if (resolveAutomationChatDestination(text)) return false;
  if (/^\s*(?:what|why|where|which|explain|list|tell me|test|hi\b|hello\b)/i.test(text)) return false;
  if (/\b(?:don'?t|do not)\s+(?:build|create|change|want.*automation)/i.test(text)) return false;
  return /\b(?:build|automate|automation|schedule|every|whenever|when|automatically|pause|hide|delete|reply|duplicate|launch)\b/i.test(
    text,
  );
}

/** Narrow, explicit explanations and greetings never authorize draft mutation. */
export function isAutomationExplanationRequest(text: string): boolean {
  if (/\b(?:please|then|and|also)\s+(?:build|create|add|remove|update|change|replace)\b/i.test(text)) return false;
  return /^\s*(?:what (?:are|is|does)|explain\b|list (?:all )?(?:options|triggers)\b|test(?: the agent)?[.!]?\s*$|hi[.!]?\s*$|hello[.!]?\s*$)/i.test(
    text,
  );
}
