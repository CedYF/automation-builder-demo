import {
  getToneValueLabel,
  inferToneValue,
} from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";
import type { AutomationConditions } from "@/app/(dashboard)/comments/lib/api/automation";
import type { AutomationNode } from "../contexts/automation-context";
import { findCommentTriggerNode } from "./comment-flow-mapper";

export interface CommentActionEffectCopy {
  readonly headline: string;
  readonly detail: string;
}

export interface CommentActionRuleSummary {
  readonly pagesLabel: string;
  readonly toneLabel: string;
  readonly triggerLabel: string;
  readonly hasPages: boolean;
}

const EFFECT_BY_EVENT: Readonly<Record<string, CommentActionEffectCopy>> = {
  "Hide Comment": {
    headline: "We hide it on the page",
    detail: "Only you and the commenter can still see it.",
  },
  "Delete Comment": {
    headline: "We delete it permanently",
    detail: "This cannot be undone.",
  },
  "Like Comment": {
    headline: "We like it as your page",
    detail: "Comments already liked are skipped.",
  },
  "Reply to Comment": {
    headline: "We reply as your page",
    detail: "Your reply is posted publicly under the comment.",
  },
};

const DEFAULT_EFFECT = EFFECT_BY_EVENT["Hide Comment"]!;

/** Plain-language outcome for Hide / Delete / Like actions. */
export function getCommentActionEffectCopy(event: string | undefined): CommentActionEffectCopy {
  if (!event) return DEFAULT_EFFECT;
  return EFFECT_BY_EVENT[event] ?? DEFAULT_EFFECT;
}

function readConditions(config: Record<string, unknown>): AutomationConditions {
  const raw = config.conditions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as AutomationConditions;
}

function readPageIds(config: Record<string, unknown>): string[] {
  const raw = config.pageIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function readPageNames(config: Record<string, unknown>): Record<string, string> {
  const raw = config.pageNames;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const names: Record<string, string> = {};
  for (const [pageId, name] of Object.entries(raw)) {
    if (typeof name === "string" && name.trim()) {
      names[pageId] = name.trim();
    }
  }
  return names;
}

/** How many resolved page names to spell out before collapsing the rest into "+N more". */
const MAX_PAGE_NAMES_SHOWN = 3;

function pluralizePages(count: number): string {
  return count === 1 ? "1 page" : `${count} pages`;
}

/**
 * Joins known page names, collapsing anything past `MAX_PAGE_NAMES_SHOWN`
 * (plus any pages whose name hasn't resolved yet) into a trailing "+N more"
 * instead of letting the label grow unbounded for a large page set.
 */
function joinPageNames(knownNames: readonly string[], unresolvedCount: number): string {
  const shown = knownNames.slice(0, MAX_PAGE_NAMES_SHOWN);
  const overflow = unresolvedCount + (knownNames.length - shown.length);
  return overflow > 0 ? `${shown.join(", ")} +${overflow} more` : shown.join(", ");
}

export interface SelectedPagesLabel {
  readonly label: string;
  readonly hasPages: boolean;
}

/**
 * Real page names when they're available, never a bare page count on its
 * own — a multi-page rule watching "2 pages" tells the user nothing about
 * *which* two, which is exactly the ambiguity that erodes trust on the run
 * screen. Falls back to an explicit "not loaded yet" label (still page-count
 * scoped) only when no name has resolved at all, and to an explicit warning
 * state — never a silent blank — when no page is selected.
 */
export function formatPagesLabel(
  pageIds: readonly string[],
  pageNames: Readonly<Record<string, string>>,
): SelectedPagesLabel {
  if (pageIds.length === 0) {
    return { label: "Not set yet", hasPages: false };
  }
  const knownNames = pageIds.map((pageId) => pageNames[pageId]).filter((name): name is string => Boolean(name));
  if (knownNames.length === 0) {
    const nameWord = pageIds.length === 1 ? "name" : "names";
    return { label: `${pluralizePages(pageIds.length)} (${nameWord} not loaded yet)`, hasPages: true };
  }
  return { label: joinPageNames(knownNames, pageIds.length - knownNames.length), hasPages: true };
}

/**
 * The History sheet's page label from the pages CommentsServer reports with
 * an automation's runs. That list starts from the automation's rules, so it
 * names every page — zero-run ones included — even when the builder config
 * never stored the names. Null when there is nothing to name yet.
 */
export function formatRunPagesLabel(
  pages: ReadonlyArray<{ readonly pageId: string; readonly pageName?: string | null }>,
): string | null {
  if (pages.length === 0) return null;
  const pageNames: Record<string, string> = {};
  for (const page of pages) {
    const name = page.pageName?.trim();
    if (name) pageNames[page.pageId] = name;
  }
  return formatPagesLabel(
    pages.map((page) => page.pageId),
    pageNames,
  ).label;
}

function formatToneLabel(config: Record<string, unknown>): string {
  const toneValue = inferToneValue(readConditions(config));
  const toneWord = getToneValueLabel(toneValue);
  if (toneWord === "anything") return "Any tone";
  return `${toneWord.charAt(0).toUpperCase()}${toneWord.slice(1)} tone`;
}

function formatTriggerLabel(event: string | undefined): string {
  switch (event?.trim()) {
    case "Scheduled scan":
      return "On a schedule";
    case "Manual Run":
      return "When you run it";
    default:
      return "When new comments arrive";
  }
}

/** Read-only summary of the upstream Comments trigger for the action step. */
export function buildCommentActionRuleSummary(flowNodes: readonly AutomationNode[]): CommentActionRuleSummary | null {
  const trigger = findCommentTriggerNode(flowNodes);
  if (!trigger) return null;

  const config = trigger.config ?? {};
  const pages = formatPagesLabel(readPageIds(config), readPageNames(config));

  return {
    pagesLabel: pages.label,
    hasPages: pages.hasPages,
    toneLabel: formatToneLabel(config),
    triggerLabel: formatTriggerLabel(trigger.event),
  };
}
