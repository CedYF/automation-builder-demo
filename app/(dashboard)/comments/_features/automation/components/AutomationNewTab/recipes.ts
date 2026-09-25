import type { LucideIcon } from "lucide-react";
import { Ban, EyeOff, Heart, ShieldCheck, ShoppingBag, Smile, Frown } from "lucide-react";
import type { CreateRuleParams } from "../../../../lib/api/automation";

export type TokenKind = "when" | "if" | "then";

export type RecipeTemplate = {
  id: string;
  title: string;
  oneLiner: string;
  estimatedSetup: string;
  longDescription: string;
  tag?: "popular" | "new";
  icon: LucideIcon;
  tone: "rose" | "blue" | "amber" | "emerald" | "violet" | "slate";
  // The recipe seeds the builder with these defaults.
  seed: Pick<CreateRuleParams, "name" | "triggerType" | "conditions" | "actionType" | "actionConfig"> & {
    requiresApproval?: boolean;
  };
};

export const TONE_ICON_BG: Record<RecipeTemplate["tone"], string> = {
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const RECIPE_LIBRARY: RecipeTemplate[] = [
  {
    id: "thank-kind",
    title: "Thank kind comments",
    oneLiner: "WHEN tone is positive · THEN AI drafts a thank-you reply",
    estimatedSetup: "30 seconds",
    longDescription:
      "Spot upbeat comments and reply with a warm, on-brand thank-you. Great for boosting engagement on top-performing creatives.",
    tag: "popular",
    icon: Heart,
    tone: "rose",
    seed: {
      name: "Thank kind comments",
      triggerType: "realtime",
      conditions: { sentimentMin: 61 },
      actionType: "reply",
      actionConfig: { useAI: true, aiPrompt: "Write a short, warm thank-you reply matching the brand voice." },
      requiresApproval: true,
    },
  },
  {
    id: "auto-hide-negative",
    title: "Auto-hide negative comments",
    oneLiner: "WHEN tone is negative, the comment undermines the brand, or a hostile pile-on is detected · THEN hide it",
    estimatedSetup: "30 seconds",
    longDescription: "Hide negative comments, brand-undermining remarks, and hostile pile-ons on selected pages.",
    tag: "popular",
    icon: EyeOff,
    tone: "amber",
    seed: {
      name: "Auto-hide negative comments",
      triggerType: "realtime",
      conditions: {
        sentimentMax: 40,
        matchMode: "any",
        brandStances: ["undermining"],
        customIntents: ["custom-comment-scan"],
      },
      actionType: "hide",
      actionConfig: {},
    },
  },
  {
    id: "auto-hide-spam",
    title: "Auto-hide spam",
    oneLiner: "WHEN comment contains spam keywords · THEN hide it from public view",
    estimatedSetup: "30 seconds",
    longDescription: "Quietly hide common spam patterns (links, scams, promo bait) so your ad creatives stay clean.",
    icon: ShieldCheck,
    tone: "blue",
    seed: {
      name: "Auto-hide spam",
      triggerType: "realtime",
      conditions: { keywords: ["http", "click here", "free", "dm me", "telegram"] },
      actionType: "hide",
      actionConfig: {},
    },
  },
  {
    id: "catch-complaints",
    title: "Catch complaints",
    oneLiner: "WHEN tone is negative · THEN AI drafts an empathetic reply",
    estimatedSetup: "1 minute",
    longDescription:
      "Catch unhappy comments early and draft an empathetic, problem-solving reply for your team to approve before sending.",
    icon: Frown,
    tone: "amber",
    seed: {
      name: "Catch complaints",
      triggerType: "realtime",
      conditions: { sentimentMax: 40 },
      actionType: "reply",
      actionConfig: { useAI: true, aiPrompt: "Empathetic, apologetic reply that invites the customer to DM us." },
      requiresApproval: true,
    },
  },
  {
    id: "answer-faqs",
    title: "Answer FAQs",
    oneLiner: "WHEN comment asks a question · THEN AI drafts an answer",
    estimatedSetup: "1 minute",
    longDescription:
      "Detect questions and draft AI answers grounded in your product info — you approve before anything goes live.",
    icon: Smile,
    tone: "emerald",
    seed: {
      name: "Answer FAQs",
      triggerType: "realtime",
      conditions: { keywords: ["?", "how", "when", "where", "price", "cost", "shipping"] },
      actionType: "reply",
      actionConfig: {
        useAI: true,
        aiPrompt: "Answer the question using product knowledge. Keep it under 2 sentences.",
      },
      requiresApproval: true,
    },
  },
  {
    id: "promote-on-positive",
    title: "Promote on positive",
    oneLiner: "WHEN tone is positive · THEN reply with a discount code",
    estimatedSetup: "1 minute",
    longDescription:
      "Reward fans who leave positive comments with a discount code or link — a low-effort upsell on warm traffic.",
    icon: ShoppingBag,
    tone: "violet",
    seed: {
      name: "Promote on positive",
      triggerType: "realtime",
      conditions: { sentimentMin: 70 },
      actionType: "reply",
      actionConfig: { useAI: false, replyTemplate: "Thanks! Use HELLO15 for 15% off your first order." },
      requiresApproval: true,
    },
  },
  {
    id: "hide-off-topic",
    title: "Hide off-topic",
    oneLiner: "WHEN comment contains off-topic keywords · THEN hide it",
    estimatedSetup: "30 seconds",
    longDescription: "Keep ad threads on-topic by quietly hiding tangential or trolling comments.",
    icon: Ban,
    tone: "slate",
    seed: {
      name: "Hide off-topic",
      triggerType: "realtime",
      conditions: { keywords: ["politics", "religion", "off topic"] },
      actionType: "hide",
      actionConfig: {},
    },
  },
];
