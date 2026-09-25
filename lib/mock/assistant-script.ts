import { AUTOMATION_BUILDER_TOOLS } from "@/app/(dashboard)/automation/lib/assistant-canvas";
import type { AutomationCanvasDraftSnapshot } from "@/lib/chat/automation-canvas-context";
import { DEMO_COMMENT_PAGES } from "./comment-pages";
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
  readonly canvasDraft?: AutomationCanvasDraftSnapshot;
}

/** Metadata the scripted turn wants surfaced on the response for telemetry — never rendered raw. */
export interface MockTurnMeta {
  readonly problemCategory?: "repeated_confirmation" | "schedule_fidelity" | "unsupported_platform" | "none";
  readonly askedQuestion?: boolean;
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
  readonly meta?: MockTurnMeta;
}

/**
 * Fixture directory of connected accounts, standing in for the workspace's real
 * connections. Used by the platform-mismatch check (C06) to offer a real inline
 * picker instead of a raw id prompt.
 */
export interface DemoAccount {
  readonly accountId: string;
  readonly accountName: string;
  readonly platform: "meta" | "pinterest" | "tiktok";
}

export const DEMO_ACCOUNT_DIRECTORY: readonly DemoAccount[] = [
  { accountId: "act_100200300", accountName: "Northwind Coffee — UK (Meta)", platform: "meta" },
  { accountId: "pin_500600700", accountName: "Northwind Coffee — Pinterest", platform: "pinterest" },
  { accountId: "tt_700800900", accountName: "Northwind Coffee — TikTok", platform: "tiktok" },
];

const PLATFORM_KEYWORDS: ReadonlyArray<readonly [DemoAccount["platform"], RegExp]> = [
  ["pinterest", /\bpinterest\b/i],
  ["tiktok", /\btiktok\b/i],
  ["meta", /\b(meta|facebook|instagram)\b/i],
];

/** Platform the currently-selected account belongs to, defaulting to the seeded Meta demo account. */
function resolveCurrentPlatform(accountId?: string, accountPlatform?: string): DemoAccount["platform"] {
  if (accountPlatform === "pinterest" || accountPlatform === "tiktok" || accountPlatform === "meta") {
    return accountPlatform;
  }
  const match = DEMO_ACCOUNT_DIRECTORY.find((account) => account.accountId === accountId);
  return match?.platform ?? "meta";
}

/** Platform explicitly named in the request text, if any. */
function resolveRequestedPlatform(message: string): DemoAccount["platform"] | null {
  for (const [platform, pattern] of PLATFORM_KEYWORDS) {
    if (pattern.test(message)) return platform;
  }
  return null;
}

/** True when the message text is exactly (or "use ") one of the directory's account names — an answered picker. */
function pickedDirectoryAccount(message: string): DemoAccount | null {
  const normalized = message.trim().toLowerCase().replace(/^use\s+/, "");
  return DEMO_ACCOUNT_DIRECTORY.find((account) => account.accountName.toLowerCase() === normalized) ?? null;
}

const PLATFORM_SERVICE: Record<DemoAccount["platform"], string> = {
  meta: "meta-ads",
  pinterest: "pinterest-ads",
  tiktok: "tiktok-ads",
};

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

function pauseTurn(
  message: string,
  accountId?: string,
  accountName?: string,
  platform: DemoAccount["platform"] = "meta",
): Omit<MockTurn, "conversationId"> {
  const threshold = readThreshold(message, ["below", "under", "less than"]) ?? DEFAULT_LOSER_ROAS;
  const service = PLATFORM_SERVICE[platform];
  const platformLabel = platform === "meta" ? "Meta" : platform === "pinterest" ? "Pinterest" : "TikTok";

  return {
    title: "Pause underperforming ads",
    beats: [
      {
        text: `Setting up a daily check on **${accountName ?? "the selected account"}** that pauses ${platformLabel} ads under ${threshold} ROAS. I'll add a spend floor so ads with almost no delivery can't trip it.`,
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
              service,
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
            { stepId: "node-action-1", type: "action", service, event: "Pause Ad", position: 1, config: {} },
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
    closing: `Built it: any ${platformLabel} ad under **${threshold} ROAS** that has spent at least ${DEFAULT_MIN_SPEND} over ${DEFAULT_LOOKBACK_DAYS} days gets paused, checked daily at 09:00, with a Slack note each run.\n\nOne thing worth knowing: the spend floor is what stops a brand-new ad with two impressions being judged and paused on day one. Lower it and you will pause things early.\n\nReview the steps and hit Save when it looks right.`,
  };
}

/**
 * C01 repro — "repeated confirmation". The mock is stateless per request, which
 * mirrors the real bug closely: a confirmation-only reply ("build", "go ahead")
 * re-runs the *same* build from scratch and repeats the *same* closing summary,
 * instead of recognizing the draft already exists and giving one final answer.
 * This is intentionally NOT fixed in this pass — see docs/investigation.md.
 */
function isConfirmationOnly(message: string): boolean {
  return /^\s*(build|go ahead|yes|do it|confirm|please build|sounds good)\.?\s*$/i.test(message);
}

/**
 * C02 repro — "schedule fidelity". A Sheets automation request naming explicit
 * weekdays/time/timezone gets substituted with a generic polling trigger that
 * drops the timezone and asks for an unrelated source ad-set id instead of
 * confirming the schedule. Not fixed in this pass — see docs/investigation.md.
 */
function sheetsScheduleTurn(): Omit<MockTurn, "conversationId"> {
  return {
    title: "Sheets automation",
    beats: [
      {
        text: "I'll set this up to poll your Sheet on a recurring schedule.",
        toolCalls: [
          builderTool(
            "call-1",
            AUTOMATION_BUILDER_TOOLS.START,
            { name: "Launch new rows from Sheet" },
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
              service: "google-sheets",
              event: "New Row Added",
              position: 0,
              // Bug: no explicit weekdays/timezone captured from "Monday, Tuesday, Wednesday
              // at 9am EEST" — silently substituted with a generic daily poll.
              config: { checkFrequency: "daily", checkTime: "09:00" },
            },
            "Trigger: check the sheet daily",
          ),
        ],
      },
    ],
    closing: "Before I add the launch action — what's the source ad set ID I should duplicate rows from?",
    meta: { problemCategory: "schedule_fidelity", askedQuestion: true },
  };
}

/** C06 fix — offers a real inline picker instead of silently building the wrong platform. */
function platformMismatchTurn(
  requestedPlatform: DemoAccount["platform"],
  currentAccountName: string | undefined,
): Omit<MockTurn, "conversationId"> {
  const matches = DEMO_ACCOUNT_DIRECTORY.filter((account) => account.platform === requestedPlatform);
  const platformLabel = requestedPlatform === "pinterest" ? "Pinterest" : requestedPlatform === "tiktok" ? "TikTok" : "Meta";

  if (matches.length === 0) {
    return {
      title: "Unsupported platform",
      beats: [],
      closing: `${platformLabel} isn't connected to this workspace yet, so I can't build that automation. Connect a ${platformLabel} account first, or tell me what you'd like to do on **${currentAccountName ?? "the selected Meta account"}** instead.`,
      meta: { problemCategory: "unsupported_platform" },
    };
  }

  return {
    title: "Platform mismatch",
    beats: [
      {
        toolCalls: [
          builderTool(
            "ask-platform-mismatch",
            "ask_user",
            {
              kind: "choice",
              question: `"${platformLabel}" isn't the selected account's platform. Pick a connected ${platformLabel} account to continue:`,
              options: matches.map((account) => ({
                id: account.accountId,
                label: account.accountName,
                description: `${platformLabel} · ${account.accountId}`,
              })),
            },
            "Waiting on a platform/account choice",
          ),
        ],
      },
    ],
    closing: `**${currentAccountName ?? "The selected account"}** is a Meta account, but this request is for ${platformLabel} ads — Meta can't run that action. Pick a connected ${platformLabel} account above and I'll build it there instead of silently building a Meta action and calling it ${platformLabel}.`,
    meta: { problemCategory: "unsupported_platform", askedQuestion: true },
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

/** Discover demo pages and ask for their scope before editing the seeded template. */
function commentTemplateTurn(): Omit<MockTurn, "conversationId"> {
  return {
    title: "Set up auto-hide negative comments",
    beats: [
      {
        text: "I found the **New Comment → Hide Comment** template. I’ll check the available pages before setting its scope.",
        toolCalls: [
          builderTool(
            "comment-find-pages",
            "list_pages",
            { platform: "facebook,instagram" },
            `Found ${DEMO_COMMENT_PAGES.length} connected demo pages`,
          ),
        ],
      },
      {
        text: `I found **${DEMO_COMMENT_PAGES.length} connected demo pages**. Which ones should this automation watch? I’ll wait for your choice before adding any pages.`,
        toolCalls: [
          builderTool(
            "comment-confirm-pages",
            "ask_user",
            {
              kind: "choice",
              question: "Which pages should Auto-hide negative comments watch?",
              options: [
                { id: "all", label: "All three pages", description: "UK Facebook, UK Instagram, and US Facebook" },
                { id: "uk-facebook", label: "UK Facebook", description: "Northwind Coffee — UK" },
                { id: "uk-instagram", label: "UK Instagram", description: "Northwind Coffee — UK" },
                { id: "us-facebook", label: "US Facebook", description: "Northwind Coffee — US" },
              ],
            },
            "Waiting for your page choice",
          ),
        ],
      },
    ],
    closing: "**Suggested setup**\n\n1. Confirm the Facebook and Instagram pages to watch below.\n2. Use negative tone, brand-undermining comments, and hostile pile-ons as the starting checks. You can adjust them in the trigger.\n3. Preview the mock matches before saving and turning it on.\n\n**No pages have been added yet.**",
    meta: { problemCategory: "none", askedQuestion: true },
  };
}

function chosenCommentPages(message: string) {
  const lower = message.toLowerCase();
  if (/\b(all|every)\s+(three|3|pages)\b/.test(lower)) return [...DEMO_COMMENT_PAGES];
  const wantsInstagram = /\b(instagram|ig)\b/.test(lower);
  const wantsFacebook = /\b(facebook|fb)\b/.test(lower);
  const wantsUK = /\b(uk|united kingdom)\b/.test(lower);
  const wantsUS = /\b(us|usa|united states)\b/.test(lower);
  return DEMO_COMMENT_PAGES.filter((page) =>
    (page.id === "demo-page-1" && wantsUK && wantsFacebook) ||
    (page.id === "demo-ig-1" && wantsUK && wantsInstagram) ||
    (page.id === "demo-page-2" && wantsUS && wantsFacebook),
  );
}

function commentPagesTurn(message: string): Omit<MockTurn, "conversationId"> {
  const pages = chosenCommentPages(message);
  if (pages.length === 0) {
    return {
      title: "Choose pages",
      beats: [],
      closing: "Please name the demo pages to watch, such as **UK Facebook**, **UK Instagram**, **US Facebook**, or **all three**. I’ll add them to the draft.",
      meta: { problemCategory: "none", askedQuestion: true },
    };
  }
  const names = pages.map((page) => `${page.name} (${page.platform})`);
  return {
    title: "Set comment pages",
    beats: [
      {
        text: `Confirmed: watch new comments on **${names.join("**, **")}**. I’m adding only those pages.`,
        toolCalls: [builderTool(
          "comment-pages",
          AUTOMATION_BUILDER_TOOLS.UPDATE,
          {
            stepId: "trigger-1",
            config: {
              pageIds: pages.map((page) => page.id),
              pagePlatforms: Object.fromEntries(pages.map((page) => [page.id, page.platform])),
              pageNames: Object.fromEntries(pages.map((page) => [page.id, page.name])),
              platform: pages[0].platform,
            },
          },
          `Selected ${pages.length} demo page${pages.length === 1 ? "" : "s"}`,
        )],
      },
      {
        text: "I’ll match **negative tone**, **brand-undermining comments**, or **hostile pile-ons** and keep the action set to **Hide Comment**.",
        toolCalls: [
          builderTool(
            "comment-trigger",
            AUTOMATION_BUILDER_TOOLS.UPDATE,
            {
              stepId: "trigger-1",
              type: "trigger",
              service: "comments",
              event: "New Comment",
              config: {
                conditions: {
                  matchMode: "any",
                  sentimentMax: 40,
                  brandStances: ["undermining"],
                  customIntents: ["custom-comment-scan"],
                },
                toneValue: { mode: "preset", preset: "negative" },
              },
            },
            "Configured the three matching checks",
          ),
          builderTool(
            "comment-action",
            AUTOMATION_BUILDER_TOOLS.UPDATE,
            { stepId: "action-1", type: "action", service: "comments", event: "Hide Comment", config: { actionConfig: {} } },
            "Confirmed the hide action",
          ),
        ],
      },
    ],
    closing: "The draft now watches only the pages you confirmed. Next, **preview the mock matches**, adjust tone or meaning scan if needed, then **Save** and turn it on when you’re ready. No live comments are changed in this demo.",
  };
}

/** True when the message is asking to stop or slow down bad ads. */
function wantsPause(message: string): boolean {
  return /\b(pause|stop|turn off|switch off|kill|losing|underperform|bad|waste|rejected|disapproved)\b/i.test(message);
}

/** True when the message is asking to put more money behind good ads. */
function wantsScale(message: string): boolean {
  return /\b(scale|increase|raise|boost|winner|best|top perform)\b/i.test(message);
}

/** True when the message describes a Sheets-driven schedule with explicit days/time (C02). */
function wantsSheetsSchedule(message: string): boolean {
  const lower = message.toLowerCase();
  const mentionsSheet = /\bsheet(s)?\b/.test(lower);
  const mentionsDay = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower);
  const mentionsTime = /\b\d{1,2}\s*(am|pm)\b/.test(lower);
  return mentionsSheet && mentionsDay && mentionsTime;
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
  const currentPlatform = resolveCurrentPlatform(request.adAccountId, request.accountPlatform);

  const isCommentDraft = request.canvasDraft?.name === "Auto-hide negative comments" &&
    request.canvasDraft.steps.some((step) => step.service === "comments" && step.type === "trigger");
  if (isCommentDraft && chosenCommentPages(message).length > 0) {
    return { conversationId, ...commentPagesTurn(message) };
  }

  if (/auto.?hide negative comments|hide negative comments/i.test(message)) {
    return { conversationId, ...commentTemplateTurn() };
  }

  if (isCommentDraft) {
    return { conversationId, ...commentPagesTurn(message) };
  }

  // C06 fix: the customer just answered the platform-mismatch picker — build on
  // the account they picked instead of the originally-selected (wrong) one.
  const picked = pickedDirectoryAccount(message);
  if (picked) {
    const turn = {
      ...pauseTurn("pause ads", picked.accountId, picked.accountName, picked.platform),
      meta: { problemCategory: "unsupported_platform" as const },
    };
    return { conversationId, ...turn };
  }

  const requestedPlatform = resolveRequestedPlatform(message);
  if (requestedPlatform && requestedPlatform !== currentPlatform && (wantsPause(message) || wantsScale(message))) {
    return { conversationId, ...platformMismatchTurn(requestedPlatform, request.accountName) };
  }

  if (wantsSheetsSchedule(message)) {
    return { conversationId, ...sheetsScheduleTurn() };
  }

  // C01 repro: a confirmation-only reply re-runs the same build and repeats the
  // same closing text, rather than recognizing the draft is already there.
  if (isConfirmationOnly(message)) {
    const turn = {
      ...pauseTurn("pause rejected ads", request.adAccountId, request.accountName, currentPlatform),
      meta: { problemCategory: "repeated_confirmation" as const },
    };
    return { conversationId, ...turn };
  }

  const turn = wantsPause(message)
    ? pauseTurn(message, request.adAccountId, request.accountName, currentPlatform)
    : wantsScale(message)
      ? scaleTurn(message, request.adAccountId, request.accountName)
      : fallbackTurn();

  return { conversationId, ...turn };
}
