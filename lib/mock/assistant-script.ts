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
  readonly accountPlatform?: string;
  readonly mode?: "suggest" | "build";
  readonly resume?: boolean;
  /** Turns already completed in this conversation, supplied by the route. */
  readonly turnIndex?: number;
  /** Scenario the conversation started in, supplied by the route. */
  readonly activeScenario?: MockScenarioId;
}

/** One unit of visible work: think, optionally say something, optionally call tools. */
export interface MockBeat {
  readonly thinkingMs?: number;
  readonly text?: string;
  readonly toolCalls?: ToolCallRecord[];
}

export type MockScenarioId =
  | "comment-hide"
  | "faq-loop"
  | "platform-mismatch"
  | "competitor-retry"
  | "scheduled-pause"
  | "pause"
  | "scale"
  | "fallback";

export interface MockTurn {
  readonly conversationId: string;
  readonly scenario: MockScenarioId;
  readonly title: string;
  readonly beats: MockBeat[];
  readonly closing: string;
}

type TurnBody = Omit<MockTurn, "conversationId" | "scenario">;

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
function thresholdConfig(comparison: "less_than" | "greater_than", threshold: number, metric = "roas") {
  return {
    level: "ad",
    metric,
    comparison,
    threshold,
    minimumSpend: DEFAULT_MIN_SPEND,
    lookbackWindow: DEFAULT_LOOKBACK_DAYS,
    checkFrequency: "daily",
    checkTime: "09:00",
  };
}

function pauseTurn(message: string, accountId?: string, accountName?: string): TurnBody {
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

function scaleTurn(message: string, accountId?: string, accountName?: string): TurnBody {
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


/** Fictional Facebook page every comment scenario runs on. */
const DEMO_PAGE_ID = "demo_page_001";

function commentTrigger(conditions: Record<string, unknown>, resultText: string): ToolCallRecord {
  return builderTool(
    "call-2",
    AUTOMATION_BUILDER_TOOLS.ADD,
    {
      stepId: "node-trigger-1",
      type: "trigger",
      service: "comments",
      event: "New Comment",
      position: 0,
      config: { pageIds: [DEMO_PAGE_ID], conditions, processExisting: false },
    },
    resultText,
  );
}

function commentAction(event: "Hide Comment" | "Delete Comment", resultText: string): ToolCallRecord {
  return builderTool(
    "call-3",
    AUTOMATION_BUILDER_TOOLS.ADD,
    { stepId: "node-action-1", type: "action", service: "comments", event, position: 1, config: {} },
    resultText,
  );
}

/**
 * Scenario: a completed build. The flow is a draft, but the closing message reads as
 * if it were live. Baseline behaviour, kept on purpose.
 */
function commentHideTurn(accountId?: string, accountName?: string): TurnBody {
  return {
    title: "Hide negative comments",
    beats: [
      {
        text: "Setting up a rule that hides negative comments on your page.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Hide negative comments", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      {
        text: "Adding the trigger.",
        toolCalls: [commentTrigger({ sentimentFilter: "negative" }, "Trigger: new comment with negative sentiment")],
      },
      { text: "And the action.", toolCalls: [commentAction("Hide Comment", "Action: hide the comment")] },
    ],
    closing: "All set! Your automation is live and will now hide negative comments on your page.",
  };
}

/** Scenario: hide comments naming a competitor. Used for the dropped-connection retry. */
function competitorTurn(accountId?: string, accountName?: string): TurnBody {
  return {
    title: "Hide competitor mentions",
    beats: [
      {
        text: "Setting up a rule that hides comments naming CompetitorCo.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Hide competitor mentions", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      {
        text: "Adding the trigger.",
        toolCalls: [
          commentTrigger({ keywords: ["CompetitorCo", "Competitor Co"] }, "Trigger: comment mentions CompetitorCo"),
        ],
      },
      { text: "And the action.", toolCalls: [commentAction("Hide Comment", "Action: hide the comment")] },
    ],
    closing:
      "Done. Comments that mention **CompetitorCo** will be hidden.\n\nReview the steps and hit Save when it looks right.",
  };
}

const FAQ_QUESTIONS: readonly string[] = [
  "Which Facebook page should this run on?",
  "Thanks. Just to confirm, which page should I use for this automation?",
  "Got it. Before I build it, can you confirm the page and which FAQ topics to reply to?",
];

/**
 * Scenario: a clarification loop. The account and page are already known, yet the
 * assistant asks for them again on every turn before it finally builds.
 */
function faqTurn(
  turnIndex: number,
  accountId?: string,
  accountName?: string,
): TurnBody {
  if (turnIndex < FAQ_QUESTIONS.length) {
    return { title: "Reply to FAQ comments", beats: [], closing: FAQ_QUESTIONS[turnIndex] };
  }
  return {
    title: "Reply to FAQ comments",
    beats: [
      {
        text: "Building the reply rule.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Reply to FAQ comments", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      {
        toolCalls: [
          commentTrigger({ intents: ["question"] }, "Trigger: new comment that asks a question"),
          builderTool(
            "call-3",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-action-1",
              type: "action",
              service: "comments",
              event: "Reply to Comment",
              position: 1,
              config: { replyText: "Thanks for asking! Shipping takes 3-5 working days." },
            },
            "Action: reply to the comment",
          ),
        ],
      },
    ],
    closing: "Your FAQ reply automation is ready.",
  };
}

/**
 * Scenario: platform mismatch. A Pinterest request on a Meta account is silently
 * built as a Meta action, and the closing message says Pinterest.
 */
function mismatchTurn(accountId?: string, accountName?: string): TurnBody {
  return {
    title: "Pause Pinterest ads",
    beats: [
      {
        text: "Setting up a check that pauses your Pinterest ads with low spend.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Pause Pinterest ads", accountId, accountName },
            "Started a new automation",
          ),
          builderTool(
            "call-2",
            AUTOMATION_BUILDER_TOOLS.ADD,
            {
              stepId: "node-trigger-1",
              type: "trigger",
              service: "meta-ads",
              event: "Performance Threshold",
              position: 0,
              config: thresholdConfig("less_than", 5, "spend"),
            },
            "Trigger: spend below 5",
          ),
          builderTool(
            "call-3",
            AUTOMATION_BUILDER_TOOLS.ADD,
            { stepId: "node-action-1", type: "action", service: "meta-ads", event: "Pause Ad", position: 1, config: {} },
            "Action: pause the matching ads",
          ),
        ],
      },
    ],
    closing: "Built it: your **Pinterest** ads that spent under 5 in the last 7 days will be paused every morning.",
  };
}

/** Scenario: scheduled pause. First turn keeps the Friday window, the timezone answer discards it. */
function scheduledPauseTurn(
  turnIndex: number,
  accountId?: string,
  accountName?: string,
): TurnBody {
  const answeredTimezone = turnIndex > 0;
  const trigger = builderTool(
    "call-2",
    AUTOMATION_BUILDER_TOOLS.ADD,
    {
      stepId: "node-trigger-1",
      type: "trigger",
      service: "meta-ads",
      event: "Performance Threshold",
      position: 0,
      config: answeredTimezone
        ? thresholdConfig("less_than", 5, "spend")
        : { ...thresholdConfig("less_than", 5, "spend"), checkFrequency: "weekly", checkDays: ["friday"], checkTime: "23:00" },
    },
    answeredTimezone ? "Trigger: spend below 5, checked daily" : "Trigger: spend below 5, Fridays at 23:00",
  );

  return {
    title: "Scheduled pause",
    beats: [
      {
        text: answeredTimezone ? "Updating the schedule with your timezone." : "Setting up a weekly pause for low-spend ads.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Scheduled pause", accountId, accountName },
            "Started a new automation",
          ),
        ],
      },
      { toolCalls: [trigger] },
      {
        toolCalls: [
          builderTool(
            "call-3",
            AUTOMATION_BUILDER_TOOLS.ADD,
            { stepId: "node-action-1", type: "action", service: "meta-ads", event: "Pause Ad", position: 1, config: {} },
            "Action: pause the matching ads",
          ),
        ],
      },
    ],
    closing: answeredTimezone
      ? "Timezone noted. Your automation is updated."
      : "Built it: ads under 5 spend in the last 7 days get paused on Fridays at 23:00.\n\nWhich timezone should I use for that?",
  };
}

function fallbackTurn(): TurnBody {
  return {
    title: "Automation assistant",
    beats: [
      {
        text: "This build ships a scripted assistant rather than a model, so it only knows two requests end to end.",
      },
    ],
    closing: `Try one of these and watch the steps land on the canvas:\n\n- **Hide negative comments**\n- **Reply to FAQ comments**\n- **Pause ads under CHF 5 spend, Friday 23:00 to Saturday 00:00**\n- **Pause ads under 1.5 ROAS**\n\nThe streaming, the tool calls and the canvas updates are all real — only the intent matching is scripted. See \`lib/mock/assistant-script.ts\`, and \`TASK.md\` for what to build on top.`,
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

/** Picks the scenario for a message. Order matters: the specific cases run before the generic ones. */
export function pickScenario(request: MockTurnRequest): MockScenarioId {
  const message = request.message ?? "";
  const turnIndex = request.turnIndex ?? 0;

  if (turnIndex > 0 && (request.activeScenario === "faq-loop" || request.activeScenario === "scheduled-pause")) {
    return request.activeScenario;
  }
  if (/pinterest/i.test(message) && request.accountPlatform !== "pinterest") return "platform-mismatch";
  if (/\b(faq|frequently asked)\b/i.test(message)) return "faq-loop";
  if (/competitor/i.test(message)) return "competitor-retry";
  if (/\b(hide|delete)\b.*\bcomments?\b|\bcomments?\b.*\b(hide|delete|negative)\b/i.test(message)) {
    return "comment-hide";
  }
  if (/\b(friday|saturday|chf)\b/i.test(message)) return "scheduled-pause";
  if (wantsPause(message)) return "pause";
  if (wantsScale(message)) return "scale";
  return "fallback";
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
  const turnIndex = request.turnIndex ?? 0;
  const { adAccountId, accountName } = request;
  const scenario = pickScenario(request);

  const turns: Record<MockScenarioId, () => TurnBody> = {
    "comment-hide": () => commentHideTurn(adAccountId, accountName),
    "faq-loop": () => faqTurn(turnIndex, adAccountId, accountName),
    "platform-mismatch": () => mismatchTurn(adAccountId, accountName),
    "competitor-retry": () => competitorTurn(adAccountId, accountName),
    "scheduled-pause": () => scheduledPauseTurn(turnIndex, adAccountId, accountName),
    pause: () => pauseTurn(message, adAccountId, accountName),
    scale: () => scaleTurn(message, adAccountId, accountName),
    fallback: () => fallbackTurn(),
  };

  return { conversationId, scenario, ...turns[scenario]() };
}
