import type { EvalCase } from "./types";

const META_ACCOUNT = { adAccountId: "act_100200300", accountName: "Northwind Coffee — UK (Meta)", accountPlatform: "meta" };
const TIKTOK_ACCOUNT = { adAccountId: "tt_700800900", accountName: "Northwind Coffee — TikTok", accountPlatform: "tiktok" };

/**
 * The eval dataset: three investigated customer cases (C01, C02, C06) plus one
 * successful control and one held-out regression case. Run with `pnpm eval`.
 * See docs/investigation.md for how each case was reproduced and
 * docs/improvement.md for the C06 before/after.
 */
export const EVAL_CASES: readonly EvalCase[] = [
  // ── Control: must pass, or a "refuse everything" agent would sail through ──
  {
    id: "control-pause-underperformers",
    problemCategory: "none",
    control: true,
    description: "Baseline success case: pause Meta ads under a stated ROAS, on the already-selected account.",
    turns: [{ message: "pause ads under 1.5 roas", ...META_ACCOUNT }],
    expectationsByTurn: {
      0: {
        askUser: false,
        builderService: "meta-ads",
        closingContainsAll: ["1.5"],
      },
    },
  },

  // ── Held-out regression guard: the other scripted intent must keep working ──
  {
    id: "regression-scale-winners",
    problemCategory: "none",
    heldOut: true,
    description: "Held-out regression case unrelated to C01/C02/C06 — guards against breaking the scale-ads script.",
    turns: [{ message: "scale winners above 3 roas", ...META_ACCOUNT }],
    expectationsByTurn: {
      0: {
        askUser: false,
        builderService: "meta-ads",
        closingContainsAll: ["3"],
      },
    },
  },

  // ── C06 — unsupported platform: FIXED in this pass ──
  {
    id: "c06-unsupported-platform",
    problemCategory: "unsupported_platform",
    description:
      "Customer asks to switch off Pinterest ads while a Meta account is selected. Fixed: the agent detects the " +
      "mismatch, offers an inline picker of connected Pinterest accounts, and only builds once one is chosen — " +
      "it never silently builds a Meta action and calls it Pinterest.",
    turns: [
      { message: "switch off specific pinterest ads", ...META_ACCOUNT },
      { message: "Northwind Coffee — Pinterest" }, // answers the inline picker
    ],
    expectationsByTurn: {
      0: {
        askUser: true,
        noBuilderToolCalls: true,
        closingContainsAll: ["pinterest", "meta"],
      },
      1: {
        askUser: false,
        builderService: "pinterest-ads",
      },
    },
  },

  // ── C01 — repeated confirmation: documented, NOT fixed this pass ──
  {
    id: "c01-repeated-confirmation",
    problemCategory: "repeated_confirmation",
    knownLimitation: true,
    description:
      "Customer asks to pause rejected TikTok ads with the TikTok account already selected, then confirms twice " +
      "with 'build'. KNOWN BUG (not fixed this pass, see docs/investigation.md): the mock is stateless, so each " +
      "confirmation-only reply re-runs the same build and repeats the exact same closing text — this assertion " +
      "documents that current behavior so a future fix has something concrete to break.",
    turns: [
      { message: "pause my rejected tiktok ads", ...TIKTOK_ACCOUNT },
      { message: "build" },
    ],
    expectationsByTurn: {
      0: { askUser: false, builderService: "tiktok-ads" },
      // Documents the bug: turn 1's closing is byte-identical to turn 0's, i.e. no
      // acknowledgement that a draft already exists.
      1: { sameClosingAsTurn: 0 },
    },
  },

  // ── C02 — schedule fidelity: documented, NOT fixed this pass ──
  {
    id: "c02-schedule-fidelity",
    problemCategory: "schedule_fidelity",
    knownLimitation: true,
    description:
      "Customer wants a Sheets automation on Monday/Tuesday/Wednesday at 9am EEST. KNOWN BUG (not fixed this pass): " +
      "the requested weekdays and timezone are dropped in favor of a generic daily poll, and the agent asks for an " +
      "unrelated source ad-set id instead of confirming the schedule. This assertion documents that the requested " +
      "schedule terms are ABSENT from the response — flip this to closingContainsAll once fixed.",
    turns: [{ message: "Set up a Sheets automation to launch new rows every Monday, Tuesday and Wednesday at 9am EEST" }],
    expectationsByTurn: {
      0: {
        askUser: false,
        closingContainsNone: ["monday", "tuesday", "wednesday", "eest"],
      },
    },
  },
];
