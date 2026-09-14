import { AUTOMATION_BUILDER_TOOLS } from "@/app/(dashboard)/automation/lib/assistant-canvas";
import type { ToolCallRecord } from "@/lib/chat/types";

/**
 * Scripts a fake assistant turn.
 *
 * Pure: it maps a message to the beats the stream should emit, with no timing,
 * no IO and no model. The route owns the delays. That split is what makes the
 * script readable and lets you extend it without touching the transport.
 *
 * The tool calls are the real canvas builder tools, so a scripted turn genuinely
 * builds the flow step by step on screen — which is the behaviour the challenge
 * is about.
 */

export interface MockTurnRequest {
  readonly message?: string;
  readonly conversationId?: string;
  readonly adAccountId?: string;
  readonly accountName?: string;
  readonly mode?: "suggest" | "build";
}

/** One unit of visible work: think, optionally say something, optionally call tools. */
export interface MockBeat {
  readonly thinkingMs?: number;
  readonly text?: string;
  readonly toolCalls?: ToolCallRecord[];
}

export interface MockTurn {
  readonly conversationId: string;
  readonly title: string;
  readonly beats: MockBeat[];
  readonly closing: string;
}

/** ROAS floor used when a request asks to pause losers without naming a number. */
const DEFAULT_LOSER_ROAS = 1;
/** ROAS a winner must clear when the request does not say. */
const DEFAULT_WINNER_ROAS = 3;
/** Spend floor applied so thin data cannot trigger a rule. */
const DEFAULT_MIN_SPEND = 50;
/** Lookback window, in days. */
const DEFAULT_LOOKBACK_DAYS = 7;
/** Budget increase applied when scaling. */
const DEFAULT_BUDGET_INCREASE = 20;
/** Upper bound on a ROAS parsed out of a message. */
const MAX_PARSEABLE_ROAS = 100;

/** Reads a ROAS threshold from phrases like "below 1.2" or "above 3". */
function readThreshold(message: string, cues: readonly string[]): number | null {
  const lower = message.toLowerCase();
  for (const cue of cues) {
    const index = lower.indexOf(cue);
    if (index === -1) continue;
    const match = /(\d+(?:\.\d+)?)/.exec(lower.slice(index + cue.length));
    if (match === null) continue;
    const value = Number.parseFloat(match[1]);
    if (Number.isNaN(value) || value <= 0 || value > MAX_PARSEABLE_ROAS) continue;
    return value;
  }
  return null;
}

function builderTool(
  id: string,
  name: string,
  args: Record<string, unknown>,
  resultText: string,
): ToolCallRecord {
  return { id, name, args, isWrite: false, status: "running", resultText };
}

/** Threshold-trigger args shared by the pause and scale scripts. */
function thresholdConfig(comparison: "less_than" | "greater_than", threshold: number) {
  return {
    level: "ad",
    metric: "roas",
    comparison,
    threshold,
    minimumSpend: DEFAULT_MIN_SPEND,
    lookbackWindow: DEFAULT_LOOKBACK_DAYS,
    checkFrequency: "daily",
    checkTime: "09:00",
  };
}

function pauseTurn(message: string, accountId?: string, accountName?: string): Omit<MockTurn, "conversationId"> {
  const threshold = readThreshold(message, ["below", "under", "less than"]) ?? DEFAULT_LOSER_ROAS;

  return {
    title: "Pause underperforming ads",
    beats: [
      {
        text: `Setting up a daily check that pauses ads under ${threshold} ROAS. I'll add a spend floor so ads with almost no delivery can't trip it.`,
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Pause underperforming ads", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      {
        text: "Adding the trigger.",
        toolCalls: [
          builderTool(
            "call-2",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-trigger-1",
              type: "trigger",
              service: "meta-ads",
              event: "Performance Threshold",
              position: 0,
              config: thresholdConfig("less_than", threshold),
            },
            `Trigger: ROAS below ${threshold}, minimum spend ${DEFAULT_MIN_SPEND}`,
          ),
        ],
      },
      {
        text: "Now the action, and a Slack summary so you can see what it touched.",
        toolCalls: [
          builderTool(
            "call-3",
            AUTOMATION_BUILDER_TOOLS.ADD,
            { stepId: "node-action-1", type: "action", service: "meta-ads", event: "Pause Ad", position: 1, config: {} },
            "Action: pause the matching ads",
          ),
          builderTool(
            "call-4",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-action-2",
              type: "action",
              service: "notification",
              event: "Send Notification",
              position: 2,
              config: {
                notificationMethod: "slack",
                customMessage: "Paused {{node-trigger-1.adName}} — ROAS {{node-trigger-1.roas}} over the last 7 days.",
              },
            },
            "Action: post a Slack summary",
          ),
        ],
      },
    ],
    closing: `Built it: any ad under **${threshold} ROAS** that has spent at least ${DEFAULT_MIN_SPEND} over ${DEFAULT_LOOKBACK_DAYS} days gets paused, checked daily at 09:00, with a Slack note each run.\n\nOne thing worth knowing: the spend floor is what stops a brand-new ad with two impressions being judged and paused on day one. Lower it and you will pause things early.\n\nReview the steps and hit Save when it looks right.`,
  };
}

function scaleTurn(message: string, accountId?: string, accountName?: string): Omit<MockTurn, "conversationId"> {
  const threshold = readThreshold(message, ["above", "over", "exceeds", "greater than"]) ?? DEFAULT_WINNER_ROAS;

  return {
    title: "Scale winning ads",
    beats: [
      {
        text: `Setting up a daily check that raises budget on ad sets clearing ${threshold} ROAS.`,
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Scale winning ads", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      {
        text: "Adding the trigger.",
        toolCalls: [
          builderTool(
            "call-2",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-trigger-1",
              type: "trigger",
              service: "meta-ads",
              event: "Performance Threshold",
              position: 0,
              config: thresholdConfig("greater_than", threshold),
            },
            `Trigger: ROAS above ${threshold}`,
          ),
        ],
      },
      {
        text: `And the budget increase — ${DEFAULT_BUDGET_INCREASE}% a day, which is gentle enough not to reset learning.`,
        toolCalls: [
          builderTool(
            "call-3",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-action-1",
              type: "action",
              service: "meta-ads",
              event: "Increase Budget",
              position: 1,
              config: { budgetChangeType: "percentage", budgetChangeValue: DEFAULT_BUDGET_INCREASE },
            },
            `Action: increase budget by ${DEFAULT_BUDGET_INCREASE}%`,
          ),
        ],
      },
    ],
    closing: `Built it: ad sets above **${threshold} ROAS** get a ${DEFAULT_BUDGET_INCREASE}% daily budget bump, checked each morning.\n\nWorth deciding before you turn it on: this compounds. Left alone it doubles a budget in about four days, so consider a ceiling.\n\nReview the steps and hit Save when it looks right.`,
  };
}

function fallbackTurn(): Omit<MockTurn, "conversationId"> {
  return {
    title: "Automation assistant",
    beats: [
      {
        text: "This build ships a scripted assistant rather than a model, so it only knows two requests end to end.",
      },
    ],
    closing: `Try one of these and watch the steps land on the canvas:\n\n- **Pause ads under 1.5 ROAS**\n- **Scale winners above 3 ROAS**\n\nThe streaming, the tool calls and the canvas updates are all real — only the intent matching is scripted. See \`lib/mock/assistant-script.ts\`, and \`TASK.md\` for what to build on top.`,
  };
}

/** True when the message is asking to stop or slow down bad ads. */
function wantsPause(message: string): boolean {
  return /\b(pause|stop|turn off|kill|losing|underperform|bad|waste)\b/i.test(message);
}

/** True when the message is asking to put more money behind good ads. */
function wantsScale(message: string): boolean {
  return /\b(scale|increase|raise|boost|winner|best|top perform)\b/i.test(message);
}

/**
 * Builds the turn for one message.
 *
 * @param request - The body the assistant client posted.
 * @returns The beats to stream, plus a conversation id and closing message.
 */
export function buildMockTurn(request: MockTurnRequest): MockTurn {
  const message = request.message ?? "";
  const conversationId = request.conversationId ?? "mock-conversation";

  const turn = wantsPause(message)
    ? pauseTurn(message, request.adAccountId, request.accountName)
    : wantsScale(message)
      ? scaleTurn(message, request.adAccountId, request.accountName)
      : fallbackTurn();

  return { conversationId, ...turn };
}
