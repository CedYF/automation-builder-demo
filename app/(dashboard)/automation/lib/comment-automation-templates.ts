/**
 * Maps Comments recipe library entries into /automation Templates tab cards.
 * Seeds open in the flow builder (service: "comments") without creating a rule until save.
 */

import { RECIPE_LIBRARY } from "@/app/(dashboard)/comments/_features/automation/components/AutomationNewTab/recipes";
import { inferToneValue } from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";
import type { AutomationActionConfig, AutomationConditions } from "@/app/(dashboard)/comments/lib/api/automation";
import type { AutomationFlow } from "../contexts/automation-context";
import {
  COMMENT_ACTION_EVENTS,
  COMMENT_TRIGGER_EVENTS,
  COMMENTS_SERVICE,
  type CommentActionType,
  type CommentTriggerType,
} from "./comment-flow-mapper";

export const COMMENT_TEMPLATE_CATEGORY = "comments" as const;

const RECIPE_EMOJI_BY_ID: Readonly<Record<string, string>> = {
  "thank-kind": "❤️",
  "like-positive": "👍",
  "auto-hide-negative": "🙈",
  "auto-hide-spam": "🛡️",
  "catch-complaints": "😟",
  "answer-faqs": "❓",
  "promote-on-positive": "🏷️",
  "hide-off-topic": "🚫",
};

const DEFAULT_COMMENT_TEMPLATE_EMOJI = "💬";

/** Recipe IDs surfaced as "Featured" cards on the Templates tab. */
const FEATURED_RECIPE_IDS: ReadonlySet<string> = new Set(["auto-hide-negative"]);

export type CommentAutomationTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: typeof COMMENT_TEMPLATE_CATEGORY;
  readonly emoji: string;
  readonly services: string[];
  readonly displaySteps: Array<{ service: string; label: string }>;
  readonly featured?: boolean;
  readonly flow: AutomationFlow;
};

function isCommentTriggerType(value: string): value is CommentTriggerType {
  return value in COMMENT_TRIGGER_EVENTS;
}

function isCommentActionType(value: string): value is CommentActionType {
  return value in COMMENT_ACTION_EVENTS;
}

function buildReplyActionConfig(
  actionConfig: AutomationActionConfig | undefined,
  requiresApproval: boolean | undefined,
): AutomationActionConfig {
  const config: AutomationActionConfig = { ...(actionConfig ?? {}) };
  if (config.useAI === false) {
    return {
      ...config,
      useAI: false,
      autoSend: true,
    };
  }
  return {
    ...config,
    useAI: true,
    autoSend: requiresApproval === false,
  };
}

function buildCommentTemplateFlow(options: {
  readonly templateId: string;
  readonly name: string;
  readonly triggerType: string;
  readonly conditions: AutomationConditions | undefined;
  readonly actionType: string;
  readonly actionConfig: AutomationActionConfig | undefined;
  readonly requiresApproval: boolean | undefined;
}): AutomationFlow {
  const triggerType = isCommentTriggerType(options.triggerType) ? options.triggerType : "realtime";
  const actionType = isCommentActionType(options.actionType) ? options.actionType : "hide";
  const conditions = options.conditions ?? {};

  return {
    id: options.templateId,
    name: options.name,
    isActive: false,
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        service: COMMENTS_SERVICE,
        event: COMMENT_TRIGGER_EVENTS[triggerType],
        position: 0,
        config: {
          pageIds: [],
          platform: "facebook",
          conditions,
          toneValue: inferToneValue(conditions),
        },
      },
      {
        id: "action-1",
        type: "action",
        service: COMMENTS_SERVICE,
        event: COMMENT_ACTION_EVENTS[actionType],
        position: 1,
        config: {
          actionConfig:
            actionType === "reply" ? buildReplyActionConfig(options.actionConfig, options.requiresApproval) : {},
        },
      },
    ],
  };
}

/**
 * Builds automation template cards from the Comments recipe library.
 */
export function buildCommentAutomationTemplates(): CommentAutomationTemplate[] {
  return RECIPE_LIBRARY.map((recipe) => {
    const templateId = `template-comment-${recipe.id}`;
    const triggerEvent =
      COMMENT_TRIGGER_EVENTS[isCommentTriggerType(recipe.seed.triggerType) ? recipe.seed.triggerType : "realtime"];
    const actionEvent =
      COMMENT_ACTION_EVENTS[isCommentActionType(recipe.seed.actionType) ? recipe.seed.actionType : "hide"];

    return {
      id: templateId,
      name: recipe.title,
      description: recipe.longDescription || recipe.oneLiner,
      category: COMMENT_TEMPLATE_CATEGORY,
      emoji: RECIPE_EMOJI_BY_ID[recipe.id] ?? DEFAULT_COMMENT_TEMPLATE_EMOJI,
      services: [COMMENTS_SERVICE],
      featured: FEATURED_RECIPE_IDS.has(recipe.id),
      displaySteps: [
        { service: COMMENTS_SERVICE, label: triggerEvent },
        { service: COMMENTS_SERVICE, label: actionEvent },
      ],
      flow: buildCommentTemplateFlow({
        templateId,
        name: recipe.seed.name,
        triggerType: recipe.seed.triggerType,
        conditions: recipe.seed.conditions,
        actionType: recipe.seed.actionType,
        actionConfig: recipe.seed.actionConfig,
        requiresApproval: recipe.seed.requiresApproval,
      }),
    };
  });
}

export const COMMENT_AUTOMATION_TEMPLATES: CommentAutomationTemplate[] = buildCommentAutomationTemplates();

export function isCommentAutomationTemplate(template: {
  readonly flow?: { readonly nodes?: ReadonlyArray<{ readonly service?: string }> };
}): boolean {
  return Boolean(template.flow?.nodes?.some((node) => node.service === COMMENTS_SERVICE));
}
