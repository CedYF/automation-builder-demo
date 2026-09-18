"use client";

import { getAutomationSetupIssues } from "@/lib/automation/setup-validation";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { normalizeLaunchAdTargetConfig } from "../lib/normalize-launch-ad-target";
import { sampleAutomations } from "../lib/sample-automations";
import { AUTOMATION_TEMPLATES } from "../lib/automation-templates";
import { appendTerminalLog } from "../lib/execution-log-state";
import { buildCompletionLogsFromStepResults, resolveExecutionLogStatusForStep } from "../lib/execution-step-results";
import { generateAutoName, isDefaultName } from "../lib/generate-auto-name";
import { isAutomationEditorIdentityReady, resolveExistingAutomationRuleId } from "@/lib/automation/editor-identity";
import {
  buildCommentAutomationId,
  buildCommentSavePayloadFromFlow,
  findCommentActionNode,
  findCommentTriggerNode,
  isCommentAutomationFlow,
  mapCommentRuleToFlowNodes,
  parseCommentAutomationId,
  readCommentPageIdsFromFlow,
  readCommentPageNamesFromFlow,
  toCreateRuleParams,
  toSyncGroupParams,
} from "../lib/comment-flow-mapper";
import { runCommentAutomationFlow, type CommentRunLogEvent } from "../lib/run-comment-automation";
import { buildRehydratedCommentRunLogs } from "../_features/comment-automation/lib/comment-run-rehydrate";
import { buildCommentSubscriptionErrorMessage } from "../lib/comment-subscription-failure";
import { automationApi } from "@/app/(dashboard)/comments/lib/api/automation";
import { getFacebookToken } from "@/app/(dashboard)/comments/actions/getFacebookToken";
import { useUser } from "@/lib/providers/user-provider";
import { createAxonCampaignViaApi } from "../lib/create-axon-campaign-via-api";
import { resolveAxonNewCampaignsForSave, type ResolveAxonNewCampaignsResult } from "../lib/resolve-axon-new-campaigns";
import { upsertAssistantNodeInFlow } from "../lib/assistant-step-order";
import {
  isMetaAutomationAccountId,
  warmAutomationSuggestInsightsCache,
} from "@/lib/automation/warm-suggest-insights-cache";
import { type AutomationNodeType, getFlowControlStepDefaults } from "@/lib/automation/flow-control-steps";
import { stripInapplicableScheduleFields } from "@/lib/automation/schedule-field-scope";
import {
  resolveAutomationBuilderAccount,
  isSelectableAutomationBuilderAccount,
} from "../lib/automation-ad-account-options";
import { getAutomationSaveSetupWarning } from "../lib/save-setup-warning";
import { emitTelemetry } from "@/lib/telemetry/emit";

export type NodeType = AutomationNodeType;

export interface AutomationNode {
  id: string;
  type: NodeType;
  service?: string;
  event?: string;
  config?: Record<string, any>;
  position: number;
}

export interface AutomationFlow {
  id: number | string;
  name: string;
  nodes: AutomationNode[];
  isActive: boolean;
  frequency?: string;
  lastRun?: Date;
  selectedAccountId?: string;
  selectedAccountName?: string;
  notificationSettings?: any;
}

/** One incremental step the assistant adds/edits on the canvas (id required). */
export interface AssistantStepInput {
  id: string;
  type?: NodeType;
  service?: string;
  event?: string;
  config?: Record<string, any>;
  position?: number;
}

interface AutomationRuleResponse {
  rule?: SavedAutomationRule | null;
  rules?: SavedAutomationRule[];
}

interface SavedAutomationRule {
  id: number | string;
  name: string;
  flow?: {
    nodes?: SavedAutomationNode[];
    notificationSettings?: AutomationFlow["notificationSettings"];
  } | null;
  accountId?: string | null;
  accountName?: string | null;
  status?: string | null;
  frequency?: string | null;
}

interface SavedAutomationNode {
  id?: string;
  type: NodeType;
  service?: string;
  event?: string;
  config?: AutomationNode["config"];
  position?: number;
}

const DYNAMIC_TEMPLATE_ACTION_EVENTS = new Set([
  "Duplicate Ad Set from Sheet Row",
  "Prepare Dynamic Ad Set from Sheet Row",
  "Create Media from Templates",
  "Create Dynamic Media from Templates",
  "Launch Template Ads",
  "Create Media + Launch Ads from Templates",
]);

function resolveAutomationActionType(event: string | undefined): string {
  if (event && DYNAMIC_TEMPLATE_ACTION_EVENTS.has(event)) return "dynamic-template-ads";
  if (event === "Duplicate Ad Set") return "duplicate-adset";
  if (event === "Duplicate Campaign") return "duplicate-campaign";
  if (event === "Duplicate Ad") return "duplicate-ad";
  if (event === "Launch Campaign") return "launch-campaign";
  if (event === "Pause Campaign") return "pause-campaign";
  if (event === "Launch Ad") return "launch-ad";
  if (event === "Update Value Rules") return "update-value-rules";
  return "unknown";
}

const HUNCH_SHARED_CONFIG_KEYS = [
  "accountId",
  "accountName",
  "accountType",
  "accountCurrency",
  "campaignId",
  "campaignName",
  "sourceAdSetId",
  "sourceAdSetName",
  "targetId",
  "templateIds",
  "locationTargetingMode",
  "locationSource",
  "locationColumn",
  "hiddenGeoColumn",
  "countryColumn",
  "radiusColumn",
  "manualLocation",
  "manualCountry",
  "manualRadius",
  // ADM-10565: ad set schedule, configured once on the Duplicate Ad Set node and
  // shared with the template-launch node that actually creates the row's ad set.
  "scheduleSource",
  "scheduleDateFormat",
  "startDateColumn",
  "endDateColumn",
  "manualStartDate",
  "manualEndDate",
  "leadFormId",
  "pageId",
  "facebookPageId",
  "instagramId",
  "instaId",
  "launchStatus",
  "adStatus",
  "adSetNameTemplate",
  "adNameTemplate",
  "headlineTemplate",
  "descriptionTemplate",
  "linkUrlTemplate",
  "callToActionTemplate",
  "dynamicFieldMappings",
  "defaultDailyBudget",
] as const;

interface AutomationContextType {
  flow: AutomationFlow;
  draftEditVersion: number;
  restoreAssistantDraft: (snapshot: AutomationFlow) => void;
  editorIdentity: AutomationEditorIdentity;
  updateFlowName: (name: string) => void;
  setFlowActive: (isActive: boolean) => void;
  setSelectedAccount: (accountId: string, accountName: string) => void;
  updateNotificationSettings: (settings: any) => void;
  addNode: (type: NodeType, position: number) => void;
  updateNode: (id: string, updates: Partial<AutomationNode>) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, newPosition: number) => void;
  exportFlow: () => string;
  importFlowAsNew: (json: string) => void;
  applyAssistantFlow: (flow: AutomationFlow) => void;
  startAssistantFlow: (input: { name: string; selectedAccountId?: string; selectedAccountName?: string }) => void;
  upsertAssistantStep: (step: AssistantStepInput) => void;
  removeAssistantStep: (id: string) => void;
  /** Node the assistant is currently adding/editing — drives the live "building" highlight. */
  assistantActiveStepId: string | null;
  clearAssistantActiveStep: () => void;
  /**
   * Node a failed save blamed — drives the error highlight on the canvas.
   * Cleared by the next save attempt, or by editing/deleting that node.
   */
  invalidNodeId: string | null;
  saveAutomation: (options: SaveAutomationOptions) => Promise<SaveAutomationResult>;
  /**
   * Runs the automation. `ruleIds` narrows a comment automation's fan-out to
   * the pages the user picked; omitted runs every page, as Run always has.
   */
  runAutomation: (options?: RunAutomationOptions) => Promise<void>;
  cancelExecution: () => void;
  executionLog: ExecutionLog[];
  isExecuting: boolean;
  loadAutomation: (id: string) => void;
  lastExecutionId: number | null;
  fetchLastExecution: () => Promise<void>;
  /**
   * Rehydrates the Execution Results panel from a comment automation's most
   * recent CommentsServer run — the counterpart to `fetchLastExecution` for
   * the automation types whose executions never land in `AutomationExecution`.
   */
  fetchLastCommentRun: () => Promise<void>;
  /**
   * Whether the execution results sheet is open. Shared here (rather than
   * local state in AutomationHeader, which owns the `<ExecutionPanel>`
   * instance) so any Run Now trigger — the header's button or the config
   * panel's per-step footer button — can surface results the same way.
   */
  showExecutionPanel: boolean;
  setShowExecutionPanel: (open: boolean) => void;
}

export type AutomationEditorOrigin = "persisted" | "new" | "template" | "import";

export interface AutomationEditorIdentity {
  status: "loading" | "ready" | "error";
  origin: AutomationEditorOrigin;
  requestedId: number | string | null;
  loadedFlowId: number | string;
  existingRuleId: number | null;
  canMutate: boolean;
  error?: string;
}

export interface SaveAutomationOptions {
  mode: "update" | "create";
  name?: string;
}

export type SaveAutomationResult =
  | {
      ok: true;
      name: string;
      ruleId: number | null;
      /** Comment automations only: every per-page rule the save covered. */
      memberRuleIds?: readonly number[];
      warning?: string;
    }
  | { ok: false; error: string; nodeId?: string };

/** Rule ids CommentsServer returned for a comment automation save (one per page). */
function readSavedMemberRuleIds(result: unknown): number[] {
  const rules = (result as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => Number((rule as { id?: unknown } | null)?.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

/** Options for one manual run. */
export interface RunAutomationOptions {
  /** Comment automations only: the per-page rules to run, instead of all of them. */
  readonly ruleIds?: readonly number[];
}

export interface ExecutionLog {
  id: string;
  nodeId: string;
  status: "success" | "error" | "running" | "skipped" | "cancelled";
  message: string;
  timestamp: Date;
  data?: any;
  duration?: number;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({
  children,
  automationId,
  onAutomationIdChange,
}: {
  children: ReactNode;
  automationId?: number | string | null;
  onAutomationIdChange?: (id: number | string | null) => void;
}) {
  const { extendedUser, currentWorkspace } = useUser();

  const [draftEditVersion, setDraftEditVersion] = useState(0);
  const [flow, setFlow] = useState<AutomationFlow>({
    id: "flow-1",
    name: "Untitled Zap",
    nodes: [
      {
        id: "node-trigger-1",
        type: "trigger",
        position: 0,
      },
      {
        id: "node-action-1",
        type: "action",
        position: 1,
      },
    ],
    isActive: false,
  });

  const [executionLog, setExecutionLog] = useState<ExecutionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingFlow, setIsLoadingFlow] = useState(Boolean(automationId));
  const [flowOrigin, setFlowOrigin] = useState<AutomationEditorOrigin>("new");
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null);
  const [lastExecutionId, setLastExecutionId] = useState<number | null>(null);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [assistantActiveStepId, setAssistantActiveStepId] = useState<string | null>(null);
  const [invalidNodeId, setInvalidNodeId] = useState<string | null>(null);
  const executionAbortRef = useRef<AbortController | null>(null);

  // Derive default account from UserProvider context (no extra fetch)
  const getDefaultAccount = useCallback(() => {
    if (!extendedUser) return null;
    return resolveAutomationBuilderAccount({
      workspaceId: currentWorkspace?.id ?? extendedUser.defaultWorkspaceId,
      defaultAccountId: extendedUser.defaultAccountId,
      settings: extendedUser.settings ?? [],
      workspaceAccounts: currentWorkspace?.adAccounts ?? [],
    });
  }, [currentWorkspace, extendedUser]);

  // Track which automationId we last initialized to avoid re-running on extendedUser changes
  // but still re-initialize when automationId actually changes (client-side navigation)
  const lastLoadedAutomationIdRef = useRef<string | number | null | undefined>(undefined);

  // When "new"/template initialized before extendedUser was ready, lastLoaded skips re-init.
  // Backfill a picker-valid account so the assistant seed does not send a stale id.
  useEffect(() => {
    if (flowOrigin !== "new" && flowOrigin !== "template") return;
    const defaultAccount = getDefaultAccount();
    if (!defaultAccount?.accountId) return;
    const workspaceId = currentWorkspace?.id ?? extendedUser?.defaultWorkspaceId;
    const accountScope = {
      workspaceId,
      settings: extendedUser?.settings ?? [],
      workspaceAccounts: currentWorkspace?.adAccounts ?? [],
    };
    setFlow((prev) => {
      if (prev.selectedAccountId === defaultAccount.accountId) return prev;
      if (isSelectableAutomationBuilderAccount(prev.selectedAccountId, accountScope)) return prev;
      return {
        ...prev,
        selectedAccountId: defaultAccount.accountId,
        selectedAccountName: defaultAccount.accountName,
      };
    });
  }, [flow.selectedAccountId, flowOrigin, getDefaultAccount, currentWorkspace, extendedUser]);

  // Warm the 1-day Redis cache for suggest-mode account insights when a Meta account
  // is available (builder selection or default account on table/home).
  useEffect(() => {
    const accountId = flow.selectedAccountId ?? getDefaultAccount()?.accountId;
    if (!accountId || !isMetaAutomationAccountId(accountId)) return;

    const timer = window.setTimeout(() => {
      warmAutomationSuggestInsightsCache(accountId);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [flow.selectedAccountId, getDefaultAccount]);

  // Initialize flow based on automationId and user data
  useEffect(() => {
    const requestedAutomationId = automationId ?? null;

    // Skip if we already loaded this exact automationId
    if (lastLoadedAutomationIdRef.current === requestedAutomationId) return;

    setIsLoadingFlow(Boolean(automationId));
    setFlowLoadError(null);

    // Reset execution state when switching automations — previously `isExecuting`
    // stayed true if the user navigated away mid-run, causing every other
    // automation's Run button to look "Running...".
    if (executionAbortRef.current) {
      executionAbortRef.current.abort();
      executionAbortRef.current = null;
    }
    setIsExecuting(false);
    setExecutionLog([]);
    setLastExecutionId(null);

    // Abort controller to cancel in-flight fetches when automationId changes
    const abortController = new AbortController();

    if (automationId && automationId !== "new") {
      // First check if it's a template
      if (typeof automationId === "string" && automationId.startsWith("template-")) {
        const template = AUTOMATION_TEMPLATES.find((t) => t.id === automationId);
        if (template) {
          console.log("[v0] Loading template:", template.name);
          const defaultAccount = getDefaultAccount();
          const accId = defaultAccount?.accountId;
          const accName = defaultAccount?.accountName;
          setFlow({
            id: template.id,
            name: template.flow.name,
            nodes: template.flow.nodes.map((node, idx) => {
              // Pre-fill the workspace's default ad account into each meta-ads node's config
              // so templates don't prompt the user to re-pick the account they're already on.
              const isMetaAds = node.service === "meta-ads";
              const isComments = node.service === "comments";
              const cfg = { ...(node.config || {}) };
              if (isMetaAds && accId) {
                if (!cfg.accountId) cfg.accountId = accId;
                if (!cfg.accountIds || cfg.accountIds.length === 0) cfg.accountIds = [accId];
                if (!cfg.accountName && accName) cfg.accountName = accName;
              }
              if (isComments && accId && !cfg.adAccountId) {
                cfg.adAccountId = accId;
              }
              return {
                ...node,
                config: cfg,
                position: idx,
              };
            }),
            isActive: false,
            selectedAccountId: accId,
            selectedAccountName: accName,
          });
          setFlowOrigin("template");
          lastLoadedAutomationIdRef.current = requestedAutomationId;
          setIsLoadingFlow(false);
          return;
        }
      }

      // Then check sample automations
      const sampleAutomation = sampleAutomations.find((a) => a.id === automationId);
      if (sampleAutomation) {
        console.log("[v0] Loading sample automation:", sampleAutomation.name);
        setFlow({
          id: sampleAutomation.id,
          name: sampleAutomation.name,
          nodes: sampleAutomation.nodes.map((node, idx) => ({
            id: node.id,
            type: node.type,
            service: node.service,
            event: node.config?.event || node.config?.action,
            config: node.config,
            position: idx,
          })),
          isActive: sampleAutomation.status === "on",
        });
        setFlowOrigin("template");
        lastLoadedAutomationIdRef.current = requestedAutomationId;
        setIsLoadingFlow(false);
      } else {
        const commentRuleId = parseCommentAutomationId(String(automationId));
        if (commentRuleId !== null) {
          console.log("[v0] Fetching comment automation from API:", commentRuleId);
          fetch(`/api/comment-automation-rules?id=${commentRuleId}`, { signal: abortController.signal })
            .then((res) => res.json())
            .then(
              (data: {
                rule?: Record<string, unknown> | null;
                groupId?: string | null;
                pageIds?: string[];
                pagePlatforms?: Record<string, "facebook" | "instagram">;
                pageNames?: Record<string, string>;
                error?: string;
              }) => {
                if (abortController.signal.aborted) return;
                const rule = data.rule;
                if (!rule || typeof rule.id !== "number") {
                  setFlowLoadError(data.error || "Comment automation could not be found.");
                  lastLoadedAutomationIdRef.current = requestedAutomationId;
                  setIsLoadingFlow(false);
                  return;
                }

                const nodes = mapCommentRuleToFlowNodes({
                  id: rule.id,
                  name: typeof rule.name === "string" ? rule.name : "Comment Automation",
                  status: typeof rule.status === "string" ? rule.status : undefined,
                  platform: rule.platform === "instagram" ? "instagram" : "facebook",
                  triggerType: typeof rule.triggerType === "string" ? rule.triggerType : "realtime",
                  conditions:
                    rule.conditions && typeof rule.conditions === "object" && !Array.isArray(rule.conditions)
                      ? (rule.conditions as import("@/app/(dashboard)/comments/lib/api/automation").AutomationConditions)
                      : {},
                  actionType: typeof rule.actionType === "string" ? rule.actionType : "hide",
                  actionConfig:
                    rule.actionConfig && typeof rule.actionConfig === "object" && !Array.isArray(rule.actionConfig)
                      ? (rule.actionConfig as import("@/app/(dashboard)/comments/lib/api/automation").AutomationActionConfig)
                      : {},
                  frequency: typeof rule.frequency === "string" ? rule.frequency : undefined,
                  scheduledTime: typeof rule.scheduledTime === "string" ? rule.scheduledTime : undefined,
                  adAccountId: typeof rule.adAccountId === "string" ? rule.adAccountId : null,
                  pageId: typeof rule.pageId === "string" ? rule.pageId : null,
                  // One automation is one rule per page; the route returns them all
                  // so the builder shows every page instead of just the one opened.
                  pageIds: data.pageIds,
                  pagePlatforms: data.pagePlatforms,
                  pageNames: data.pageNames,
                  groupId: data.groupId ?? null,
                });

                setFlow({
                  id: buildCommentAutomationId(rule.id),
                  name: typeof rule.name === "string" ? rule.name : "Comment Automation",
                  nodes: nodes.map((node, idx) => ({ ...node, position: idx })),
                  isActive: rule.status === "active" || rule.status === "executing",
                  selectedAccountId: typeof rule.adAccountId === "string" ? rule.adAccountId : undefined,
                });
                setFlowOrigin("persisted");
                lastLoadedAutomationIdRef.current = requestedAutomationId;
                setIsLoadingFlow(false);
              },
            )
            .catch((err) => {
              if (err.name === "AbortError") return;
              console.error("[v0] Failed to fetch comment automation:", err);
              setFlowLoadError("Comment automation could not be loaded. Try again.");
              lastLoadedAutomationIdRef.current = requestedAutomationId;
              setIsLoadingFlow(false);
            });
          return;
        }

        // Fetch from API if not a sample automation
        console.log("[v0] Fetching automation from API:", automationId);
        const automationRuleUrl =
          typeof automationId === "number" || /^\d+$/.test(String(automationId))
            ? `/api/automation-rules?id=${encodeURIComponent(String(automationId))}`
            : "/api/automation-rules";
        fetch(automationRuleUrl, { signal: abortController.signal })
          .then((res) => res.json())
          .then((data: AutomationRuleResponse) => {
            if (abortController.signal.aborted) return;
            const rule =
              data.rule ??
              data.rules?.find((automationRule) => String(automationRule.id) === String(automationId)) ??
              null;
            if (rule) {
              console.log("[v0] Loaded automation from API:", rule.name);
              // Parse nodes from flow
              const flowNodes = rule.flow?.nodes ?? [];

              // If no accountId in the rule, use user's default from context
              let accountId = rule.accountId;
              let accountName = rule.accountName;

              if (!accountId) {
                const defaultAccount = getDefaultAccount();
                if (defaultAccount) {
                  accountId = defaultAccount.accountId;
                  accountName = defaultAccount.accountName;
                  console.log("[v0] Using default account for automation:", accountId);
                }
              }

              setFlow({
                id: rule.id,
                name: rule.name,
                nodes: flowNodes.map((node, idx) => ({
                  id: node.id || `node-${idx}`,
                  type: node.type,
                  service: node.service,
                  event: node.event,
                  config: node.config,
                  position: node.position ?? idx,
                })),
                isActive: rule.status === "active",
                frequency: rule.frequency || undefined,
                selectedAccountId: accountId || undefined,
                selectedAccountName: accountName || undefined,
                notificationSettings: rule.flow?.notificationSettings || undefined,
              });
              setFlowOrigin("persisted");

              // Hydrate "View last run" from the automation's real history —
              // lastExecutionId otherwise only reflects runs triggered in this
              // browser tab, leaving the button disabled for automations that
              // ran before this session (e.g. on a schedule, or last visit).
              // Fire-and-forget: a failure just leaves the button disabled,
              // same as before this hydration existed.
              fetch(`/api/automation-rules?history=true&automationRuleId=${rule.id}&limit=1`, {
                signal: abortController.signal,
              })
                .then((res) => res.json())
                .then((historyData: { rules?: Array<{ id: number }> }) => {
                  if (abortController.signal.aborted) return;
                  setLastExecutionId(historyData.rules?.[0]?.id ?? null);
                })
                .catch((err) => {
                  if (err.name === "AbortError") return;
                  console.error("[v0] Failed to fetch last execution id:", err);
                });
            } else {
              console.warn("[v0] Automation not found:", automationId);
              setFlowLoadError("Automation could not be found.");
            }
            lastLoadedAutomationIdRef.current = requestedAutomationId;
            setIsLoadingFlow(false);
          })
          .catch((err) => {
            if (err.name === "AbortError") return;
            console.error("[v0] Failed to fetch automation:", err);
            setFlowLoadError("Automation could not be loaded. Try again.");
            lastLoadedAutomationIdRef.current = requestedAutomationId;
            setIsLoadingFlow(false);
          });
      }
    } else if (automationId === "new") {
      console.log("[v0] Creating new automation");
      const defaultAccount = getDefaultAccount();
      setFlow((prev) => ({
        id: `flow-${Date.now()}`,
        name: "Untitled Zap",
        nodes: [
          {
            id: "node-trigger-1",
            type: "trigger",
            position: 0,
          },
          {
            id: "node-action-1",
            type: "action",
            position: 1,
          },
        ],
        isActive: false,
        selectedAccountId: prev.selectedAccountId ?? defaultAccount?.accountId,
        selectedAccountName: prev.selectedAccountName ?? defaultAccount?.accountName,
      }));
      setFlowOrigin("new");
      lastLoadedAutomationIdRef.current = requestedAutomationId;
      setIsLoadingFlow(false);
    } else {
      lastLoadedAutomationIdRef.current = requestedAutomationId;
      setIsLoadingFlow(false);
    }

    return () => {
      abortController.abort();
    };
  }, [automationId, extendedUser, getDefaultAccount]);

  const editorIdentity = useMemo<AutomationEditorIdentity>(() => {
    const requestedId = automationId ?? null;
    const identityReady = isAutomationEditorIdentityReady({
      flowId: flow.id,
      selectedAutomationId: requestedId == null ? null : String(requestedId),
      isLoadingFlow,
    });
    const status: AutomationEditorIdentity["status"] = flowLoadError ? "error" : identityReady ? "ready" : "loading";
    const canMutate = status === "ready";

    return {
      status,
      origin: flowOrigin,
      requestedId,
      loadedFlowId: flow.id,
      existingRuleId:
        flowOrigin === "persisted"
          ? resolveExistingAutomationRuleId({ flowId: flow.id, isIdentityReady: canMutate })
          : null,
      canMutate,
      ...(flowLoadError ? { error: flowLoadError } : {}),
    };
  }, [automationId, flow.id, flowLoadError, flowOrigin, isLoadingFlow]);

  const updateFlowName = useCallback((name: string) => {
    setDraftEditVersion((version) => version + 1);
    setFlow((prev) => ({ ...prev, name }));
  }, []);

  const setFlowActive = useCallback(
    (isActive: boolean) => {
      setDraftEditVersion((version) => version + 1);
      setFlow((prev) => ({ ...prev, isActive }));
      emitTelemetry({
        type: "automation_activated",
        attemptId: `flow-${String(flow.id)}`,
        ruleId: String(flow.id),
        active: isActive,
      });
    },
    [flow.id],
  );

  const setSelectedAccount = useCallback((accountId: string, accountName: string) => {
    setDraftEditVersion((version) => version + 1);
    setFlow((prev) => ({
      ...prev,
      selectedAccountId: accountId,
      selectedAccountName: accountName,
    }));
  }, []);

  const updateNotificationSettings = useCallback((settings: any) => {
    setDraftEditVersion((version) => version + 1);
    setFlow((prev) => ({ ...prev, notificationSettings: settings }));
  }, []);

  const addNode = useCallback((type: NodeType, position: number) => {
    setDraftEditVersion((version) => version + 1);
    const newNode: AutomationNode = {
      id: `node-${Date.now()}`,
      type,
      position,
      // Delay/approval nodes are fully determined by their type, so skip the app picker.
      ...getFlowControlStepDefaults(type),
    };
    setFlow((prev) => ({
      ...prev,
      nodes: [...prev.nodes.slice(0, position), newNode, ...prev.nodes.slice(position)].map((node, idx) => ({
        ...node,
        position: idx,
      })),
    }));
  }, []);

  // Editing or removing the blamed step clears its error highlight: the user has
  // acted on the feedback, so leaving the card red would be stale.
  const clearInvalidNodeIfMatches = useCallback((id: string) => {
    setInvalidNodeId((current) => (current === id ? null : current));
  }, []);

  const updateNode = useCallback(
    (id: string, updates: Partial<AutomationNode>) => {
      setDraftEditVersion((version) => version + 1);
      clearInvalidNodeIfMatches(id);
      setFlow((prev) => ({
        ...prev,
        nodes: syncHunchNodeConfigs(
          prev.nodes.map((node) => (node.id === id ? { ...node, ...updates } : node)),
          id,
          updates.config,
        ),
      }));
    },
    [clearInvalidNodeIfMatches],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setDraftEditVersion((version) => version + 1);
      clearInvalidNodeIfMatches(id);
      setFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((node) => node.id !== id).map((node, idx) => ({ ...node, position: idx })),
      }));
    },
    [clearInvalidNodeIfMatches],
  );

  const moveNode = useCallback((id: string, newPosition: number) => {
    setDraftEditVersion((version) => version + 1);
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes
        .map((node) => (node.id === id ? { ...node, position: newPosition } : node))
        .sort((a, b) => a.position - b.position),
    }));
  }, []);

  const exportFlow = useCallback(() => {
    return JSON.stringify(flow, null, 2);
  }, [flow]);

  const importFlowAsNew = useCallback(
    (json: string) => {
      try {
        const imported = JSON.parse(json);
        // Always assign a new flow ID so imported automations cannot target the source rule.
        imported.id = `flow-${Date.now()}`;
        if (imported.name && !imported.name.endsWith("(Copy)")) {
          imported.name = `${imported.name} (Copy)`;
        }
        delete imported.ruleId;
        delete imported.savedRuleId;
        setFlow(imported);
        setFlowOrigin("import");
        setFlowLoadError(null);
        setIsLoadingFlow(false);
        onAutomationIdChange?.(null);
      } catch (error) {
        console.error("[v0] Import failed:", error);
        throw error;
      }
    },
    [onAutomationIdChange],
  );

  // Render an assistant-proposed flow onto the canvas as a fresh, unsaved draft.
  // Unlike importFlowAsNew it keeps the assistant's name (no "(Copy)" suffix) and
  // assigns a new client id so save/activate stay explicit user actions.
  const applyAssistantFlow = useCallback(
    (assistantFlow: AutomationFlow) => {
      setFlow({
        ...assistantFlow,
        id: `flow-${Date.now()}`,
        isActive: false,
        nodes: assistantFlow.nodes.map((node, idx) => ({ ...node, position: idx })),
      });
      setFlowOrigin("new");
      setFlowLoadError(null);
      setIsLoadingFlow(false);
      onAutomationIdChange?.(null);
    },
    [onAutomationIdChange],
  );

  // Begin a fresh assistant-built draft on the canvas (empty nodes). Used by the
  // live builder tools before steps stream in. Nothing is persisted.
  const startAssistantFlow = useCallback(
    (input: { name: string; selectedAccountId?: string; selectedAccountName?: string }) => {
      setFlow({
        id: `flow-${Date.now()}`,
        name: input.name,
        nodes: [],
        isActive: false,
        selectedAccountId: input.selectedAccountId,
        selectedAccountName: input.selectedAccountName,
      });
      setFlowOrigin("new");
      setFlowLoadError(null);
      setIsLoadingFlow(false);
      setAssistantActiveStepId(null);
      onAutomationIdChange?.(null);
    },
    [onAutomationIdChange],
  );

  // Restoring never writes to the server. If a fresh draft replaced a saved rule,
  // restore its content as a new draft rather than silently changing persistence identity.
  const restoreAssistantDraft = useCallback(
    (snapshot: AutomationFlow) => {
      if (snapshot.id !== flow.id) {
        applyAssistantFlow(snapshot);
      } else {
        setFlow(structuredClone(snapshot));
      }
      setAssistantActiveStepId(null);
      setInvalidNodeId(null);
      setDraftEditVersion((version) => version + 1);
    },
    [flow.id, applyAssistantFlow],
  );

  const clearAssistantActiveStep = useCallback(() => setAssistantActiveStepId(null), []);

  // Insert a new node, or merge into an existing one by id, then reindex. Drives
  // the live "node appears / node edits" animation as builder tool calls stream.
  const upsertAssistantStep = useCallback((step: AssistantStepInput) => {
    setFlow((prev) => ({
      ...prev,
      nodes: upsertAssistantNodeInFlow(prev.nodes, step),
    }));
    setAssistantActiveStepId(step.id);
  }, []);

  const removeAssistantStep = useCallback((id: string) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== id).map((node, index) => ({ ...node, position: index })),
    }));
  }, []);

  const saveAutomationInner = useCallback(
    async ({ mode, name }: SaveAutomationOptions): Promise<SaveAutomationResult> => {
      if (!editorIdentity.canMutate) {
        return { ok: false, error: editorIdentity.error || "Automation is still loading. Try again." };
      }

      const nameToSave = isDefaultName(name ?? flow.name) ? generateAutoName(flow.nodes) : (name ?? flow.name);

      // Each save attempt re-derives the blame, so drop any highlight from the last one.
      setInvalidNodeId(null);

      // Comment automations persist to CommentsServer, not Prisma AutomationRule.
      if (isCommentAutomationFlow(flow.nodes)) {
        // A rejected save can name the pages that blocked it; resolve those ids to
        // the names shown in the trigger's picker so the toast is actionable.
        const describeCommentSaveError = (body: unknown, fallback: string): string => {
          const responseError = (body as { error?: unknown } | null)?.error;
          return buildCommentSubscriptionErrorMessage({
            body,
            pageNames: readCommentPageNamesFromFlow(flow.nodes),
            selectedPageCount: readCommentPageIdsFromFlow(flow.nodes).length,
            fallback: typeof responseError === "string" && responseError ? responseError : fallback,
          });
        };

        const mapped = buildCommentSavePayloadFromFlow({
          name: nameToSave,
          nodes: flow.nodes,
          requirePages: false,
        });
        if (!mapped.ok) {
          if (mapped.nodeId) setInvalidNodeId(mapped.nodeId);
          return { ok: false, error: mapped.error, nodeId: mapped.nodeId };
        }

        const existingId = mode === "update" ? editorIdentity.existingRuleId : null;
        const isExisting = existingId !== null;

        try {
          if (isExisting) {
            const response = await fetch("/api/comment-automation-rules", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              // Always the group shape: with a group id the save covers every
              // page, and without one the server adopts the automation's rules
              // into a new group first. `id` is the rule the builder opened,
              // which is what identifies the automation being adopted.
              body: JSON.stringify({ id: existingId, ...toSyncGroupParams(mapped.value) }),
            });
            const result = await response.json();
            if (!response.ok) {
              return { ok: false, error: describeCommentSaveError(result, "Failed to save comment automation") };
            }

            const savedId = buildCommentAutomationId(existingId);
            setFlow((previous) => ({ ...previous, id: savedId, name: nameToSave }));
            setFlowOrigin("persisted");
            // The flow we just persisted is already the freshest state — mark this id
            // "loaded" so the automationId-change effect below doesn't turn around and
            // refetch it from the server, which would flash a loading state and reset
            // execution/log state right after the user clicked Save.
            lastLoadedAutomationIdRef.current = savedId;
            onAutomationIdChange?.(savedId);
            return { ok: true, name: nameToSave, ruleId: existingId, memberRuleIds: readSavedMemberRuleIds(result) };
          }

          const createParams = toCreateRuleParams(mapped.value, {
            userId: extendedUser?.email || "",
            company: extendedUser?.company || "",
            workspaceId: extendedUser?.defaultWorkspaceId || undefined,
          });
          const response = await fetch("/api/comment-automation-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createParams),
          });
          const result = await response.json();
          if (!response.ok) {
            return { ok: false, error: describeCommentSaveError(result, "Failed to create comment automation") };
          }

          const returnedRuleId = Number(result.rule?.id ?? result.rules?.[0]?.id);
          if (!Number.isSafeInteger(returnedRuleId) || returnedRuleId <= 0) {
            return { ok: false, error: "Comment automation was created but no id was returned" };
          }

          const savedId = buildCommentAutomationId(returnedRuleId);
          setFlow((previous) => ({ ...previous, id: savedId, name: nameToSave }));
          setFlowOrigin("persisted");
          // Same reasoning as the update branch above: avoid an immediate,
          // redundant refetch of the automation we just created.
          lastLoadedAutomationIdRef.current = savedId;
          onAutomationIdChange?.(savedId);
          return {
            ok: true,
            name: nameToSave,
            ruleId: returnedRuleId,
            memberRuleIds: readSavedMemberRuleIds(result),
          };
        } catch {
          return { ok: false, error: "An error occurred while saving the comment automation" };
        }
      }

      const setupIssues = getAutomationSetupIssues(flow.nodes, flow.selectedAccountId);
      if (setupIssues.length) return { ok: false, error: setupIssues.map((issue) => issue.message).join("\n") };

      // Create any pending "new AppLovin campaign" up-front so the saved flow carries a
      // resolved campaignId (ADM-9094); creation errors surface via the normal toast.
      const campaignResolution = await resolveAxonNewCampaignsForSave(flow.nodes, {
        company: extendedUser?.company ?? "",
        workspaceId: extendedUser?.defaultWorkspaceId ?? "",
        createCampaign: createAxonCampaignViaApi,
        now: new Date(),
      }).catch(
        (error): ResolveAxonNewCampaignsResult => ({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to create the AppLovin campaign.",
        }),
      );
      if (!campaignResolution.ok) {
        return { ok: false, error: campaignResolution.error };
      }
      const nodesToSave = campaignResolution.nodes;
      if (campaignResolution.changed) {
        setFlow((previous) => ({ ...previous, nodes: nodesToSave }));
      }

      const existingId = mode === "update" ? editorIdentity.existingRuleId : null;
      const isExisting = existingId !== null;
      // Derive the payload from the SAME normalized nodes that get persisted, so
      // the rule columns and the stored flow can never disagree (ADM-11225).
      const normalizedNodes = normalizeAutomationNodesForSave(nodesToSave);
      const saveSetupWarning = getAutomationSaveSetupWarning(normalizedNodes, flow.selectedAccountId);
      const scheduledTriggerNode = normalizedNodes.find(
        (node) => node.type === "trigger" && node.service === "scheduled",
      );
      const anyTriggerNode = normalizedNodes.find((node) => node.type === "trigger");
      const actionNode = normalizedNodes.find((node) => node.type === "action");
      const scheduledConfig = scheduledTriggerNode?.config || {};
      const triggerConfig = anyTriggerNode?.config || {};
      const effectiveFrequency =
        anyTriggerNode?.service === "manual"
          ? "one-time"
          : scheduledConfig.frequency || triggerConfig.checkFrequency || "one-time";
      const flowNameToSave = isDefaultName(name ?? flow.name) ? generateAutoName(nodesToSave) : (name ?? flow.name);

      const payload = {
        ...(isExisting ? { id: existingId } : {}),
        name: flowNameToSave,
        flow: {
          nodes: normalizedNodes,
          notificationSettings: flow.notificationSettings || undefined,
        },
        actionType: resolveAutomationActionType(actionNode?.event),
        targetId: actionNode?.config?.targetId || null,
        accountId: flow.selectedAccountId || actionNode?.config?.accountId || "",
        newName: actionNode?.config?.newName || null,
        frequency: effectiveFrequency,
        scheduledDate: scheduledConfig.scheduledDate || null,
        scheduledTime: scheduledConfig.scheduledTime || null,
        dayOfWeek: scheduledConfig.dayOfWeek || null,
        dayOfMonth: scheduledConfig.dayOfMonth || null,
        startDate: scheduledConfig.startDate || null,
        endDate: scheduledConfig.endDate || null,
        company: extendedUser?.company || null,
        workspaceId: extendedUser?.defaultWorkspaceId || null,
      };

      try {
        const response = await fetch("/api/automation-rules", {
          method: isExisting ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
          return { ok: false, error: result.error || "Failed to save automation" };
        }

        const returnedRuleId = Number(result.rule?.id);
        const savedRuleId = Number.isSafeInteger(returnedRuleId) && returnedRuleId > 0 ? returnedRuleId : existingId;
        setFlow((previous) => ({
          ...previous,
          ...(savedRuleId !== null ? { id: savedRuleId } : {}),
          name: flowNameToSave,
        }));

        if (savedRuleId !== null) {
          setFlowOrigin("persisted");
          // Same reasoning as the comment-automation branches above: the flow we
          // just persisted is already current, so mark it "loaded" before telling
          // the parent about the new id to skip a redundant refetch/state reset.
          lastLoadedAutomationIdRef.current = savedRuleId;
          onAutomationIdChange?.(savedRuleId);
        }

        return {
          ok: true,
          name: flowNameToSave,
          ruleId: savedRuleId,
          ...(saveSetupWarning ? { warning: saveSetupWarning } : {}),
        };
      } catch {
        return { ok: false, error: "An error occurred while saving" };
      }
    },
    [editorIdentity, extendedUser, flow, onAutomationIdChange],
  );

  /** Wraps `saveAutomationInner` to emit a `draft_saved` telemetry event without touching its save logic. */
  const saveAutomation = useCallback(
    async (options: SaveAutomationOptions): Promise<SaveAutomationResult> => {
      const result = await saveAutomationInner(options);
      if (result.ok) {
        emitTelemetry({
          type: "draft_saved",
          attemptId: `flow-${String(flow.id)}`,
          ruleId: String(result.ruleId ?? flow.id),
          nodeCount: flow.nodes.length,
        });
      }
      return result;
    },
    [saveAutomationInner, flow.id, flow.nodes.length],
  );

  // Comment automations execute on CommentsServer, not the Prisma automation
  // executor: save the rule there, start a manual run, and poll run status so
  // the panel shows real per-step progress (previously Run showed only a
  // "manage runs in Comments" note that the panel never rendered).
  const runCommentAutomation = useCallback(
    async (onlyRuleIds?: readonly number[]) => {
      const mapped = buildCommentSavePayloadFromFlow({
        name: flow.name,
        nodes: flow.nodes,
        requirePages: true,
      });
      if (!mapped.ok) {
        if (mapped.nodeId) setInvalidNodeId(mapped.nodeId);
        setExecutionLog([
          {
            id: `log-${Date.now()}-comment-invalid`,
            nodeId: mapped.nodeId ?? "system",
            status: "error",
            message: mapped.error,
            timestamp: new Date(),
            // Flags a pre-flight rejection rather than a run that failed partway.
            // Nothing executed here, so the panel says "can't run yet" and points
            // at the step to fix instead of reporting a failed step.
            data: { validation: true },
          },
        ]);
        return;
      }

      const triggerNode = flow.nodes.find((node) => node.type === "trigger");
      const actionNode = flow.nodes.find((node) => node.type === "action");
      const existingRuleId = editorIdentity.existingRuleId;

      const abortController = new AbortController();
      executionAbortRef.current = abortController;
      setIsExecuting(true);
      setExecutionLog([]);

      const appendCommentLog = (event: CommentRunLogEvent): void => {
        setExecutionLog((prev) => {
          const entry: ExecutionLog = {
            id: `log-${Date.now()}-${event.nodeId}-${event.status}`,
            nodeId: event.nodeId,
            status: event.status,
            message: event.message,
            timestamp: new Date(),
            // Feeds the Execution Results panel's live comment feed (see
            // findLatestProcessedComments). Omitted when the event carries no
            // comments so the panel keeps showing its last known snapshot.
            data: event.comments ? { comments: event.comments } : undefined,
          };
          // Terminal failures drop every running entry so the derived spinner stops.
          if (event.status === "error" || event.status === "cancelled") {
            return appendTerminalLog(prev, entry);
          }
          return [...prev.filter((log) => !(log.nodeId === event.nodeId && log.status === "running")), entry];
        });
      };

      try {
        const result = await runCommentAutomationFlow({
          // Set when the user picked pages from the Run menu; omitted runs them all.
          onlyRuleIds,
          triggerNodeId: triggerNode?.id ?? "system",
          actionNodeId: actionNode?.id ?? "system",
          hasExistingRule: existingRuleId !== null,
          processExistingOnCreate: mapped.value.processExisting === true,
          saveRule: async () => {
            const saved = await saveAutomation({ mode: existingRuleId !== null ? "update" : "create" });
            return saved.ok
              ? { ok: true, ruleId: saved.ruleId, memberRuleIds: saved.memberRuleIds }
              : { ok: false, error: saved.error };
          },
          getAccessToken: getFacebookToken,
          startExecution: (ruleId, accessToken, runGroupId) =>
            automationApi.executeRule(ruleId, {
              adAccountId: mapped.value.adAccountId,
              pageId: mapped.value.pageIds[0],
              encryptedUserToken: accessToken,
              runGroupId,
            }),
          fetchLatestRun: async (ruleId) => {
            const response = await automationApi.getRuleRuns(ruleId, 1, 0);
            return response.runs[0] ?? null;
          },
          fetchRunComments: async (runId) => {
            const response = await automationApi.getRunDetails(runId);
            return response.comments;
          },
          requestCancel: (ruleId) => automationApi.cancelRuleExecution(ruleId),
          onLog: appendCommentLog,
          signal: abortController.signal,
        });
        if (
          result.outcome === "completed" ||
          result.outcome === "completed-with-failures" ||
          result.outcome === "still-running"
        ) {
          setFlow((prev) => ({ ...prev, lastRun: new Date() }));
        }
        if (result.outcome === "completed") {
          emitTelemetry({
            type: "run_succeeded",
            attemptId: `flow-${String(flow.id)}`,
            ruleId: String(flow.id),
            durationMs: 0,
            evidence: "simulated",
          });
        }
      } catch (error) {
        appendCommentLog({
          nodeId: "system",
          status: "error",
          message: `Run failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        executionAbortRef.current = null;
        setIsExecuting(false);
      }
    },
    [editorIdentity.existingRuleId, flow.name, flow.nodes, flow.selectedAccountId, saveAutomation],
  );

  const runAutomation = useCallback(
    async (options?: RunAutomationOptions) => {
      if (!editorIdentity.canMutate) return;

      if (isCommentAutomationFlow(flow.nodes)) {
        await runCommentAutomation(options?.ruleIds);
        return;
      }

      const abortController = new AbortController();
      executionAbortRef.current = abortController;

      setIsExecuting(true);
      setExecutionLog([]);
      console.log("[v0] Starting automation execution (SSE)");

      try {
        const setupIssues = getAutomationSetupIssues(flow.nodes, flow.selectedAccountId);
        if (setupIssues.length) throw new Error(setupIssues.map((issue) => issue.message).join("\n"));

        // Create any pending "new AppLovin campaign" before executing so the run targets a
        // real campaignId, mirroring save (ADM-9094).
        const campaignResolution = await resolveAxonNewCampaignsForSave(flow.nodes, {
          company: extendedUser?.company ?? "",
          workspaceId: extendedUser?.defaultWorkspaceId ?? "",
          createCampaign: createAxonCampaignViaApi,
          now: new Date(),
        }).catch(
          (error): ResolveAxonNewCampaignsResult => ({
            ok: false,
            error: error instanceof Error ? error.message : "Failed to create the AppLovin campaign.",
          }),
        );
        if (!campaignResolution.ok) {
          setExecutionLog([
            {
              id: `log-${Date.now()}-campaign-error`,
              nodeId: "system",
              status: "error",
              message: campaignResolution.error,
              timestamp: new Date(),
            },
          ]);
          setIsExecuting(false);
          return;
        }
        if (campaignResolution.changed) {
          setFlow((previous) => ({ ...previous, nodes: campaignResolution.nodes }));
        }
        const runNodes = campaignResolution.nodes;

        const triggerNode = runNodes.find((n) => n.type === "trigger");
        const actionNode = runNodes.find((n) => n.type === "action");

        const actionType = resolveAutomationActionType(actionNode?.event);

        // Show initial running status
        const initialLog: ExecutionLog = {
          id: `log-${Date.now()}-init`,
          nodeId: "system",
          status: "running",
          message: "Starting automation...",
          timestamp: new Date(),
        };
        setExecutionLog([initialLog]);

        const isMediaLibraryTrigger = triggerNode?.service === "media-library";

        const executePayload = {
          name: flow.name,
          flow: { nodes: runNodes, notificationSettings: flow.notificationSettings || undefined },
          actionType,
          targetId: actionNode?.config?.targetId || null,
          accountId: flow.selectedAccountId || actionNode?.config?.accountId || null,
          newName: actionNode?.config?.newName || null,
          ruleId: editorIdentity.existingRuleId,
          dryRun: triggerNode?.config?.dryRun || false,
          testWithLatestAsset: isMediaLibraryTrigger,
        };

        // Try SSE streaming endpoint first
        const response = await fetch("/api/automation-rules/execute/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(executePayload),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          // Fallback to standard endpoint
          console.log("[v0] SSE failed, falling back to standard endpoint");
          const fallbackResponse = await fetch("/api/automation-rules/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(executePayload),
            signal: abortController.signal,
          });
          const executeResult = await fallbackResponse.json();
          const completionTimestamp = new Date();
          const sharedCompletionData = {
            resultId: executeResult.resultId,
            logs: executeResult.logs,
            actionType: executeResult.actionType,
            accountId: executeResult.accountId,
            stepResults: executeResult.stepResults,
          };
          const completionLogs = buildCompletionLogsFromStepResults({
            nodes: flow.nodes,
            stepResults: executeResult.stepResults,
            runSuccess: executeResult.success,
            sharedData: sharedCompletionData,
            timestamp: completionTimestamp,
          });
          const historyLogEntry: ExecutionLog = {
            id: `log-history-${Date.now()}`,
            nodeId: "history",
            status: executeResult.executionId ? "success" : "error",
            message: executeResult.executionId ? "Saved to history" : "History save failed",
            timestamp: completionTimestamp,
            data: {
              historyId: executeResult.executionId,
              resultId: executeResult.resultId,
              actionType,
              accountId: actionNode?.config?.accountId,
              stepResults: executeResult.stepResults,
              logs: executeResult.logs,
            },
          };
          setExecutionLog([...completionLogs, historyLogEntry]);
          // Store execution ID for later retrieval
          if (executeResult.executionId) {
            setLastExecutionId(executeResult.executionId);
          }
          setFlow((prev) => ({ ...prev, lastRun: new Date() }));
          if (executeResult.success) {
            emitTelemetry({
              type: "run_succeeded",
              attemptId: `flow-${String(flow.id)}`,
              ruleId: String(flow.id),
              durationMs: 0,
              evidence: "simulated",
            });
          }
          return;
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // A clean EOF is not the same as a finished run. When the server is killed
        // mid-execution (Vercel's `maxDuration = 300`) or a proxy reaps the
        // connection, the stream just ends: no complete/cancelled/error event ever
        // arrives. Track whether we saw a terminal event so the loop's exit can
        // tell "the run ended" from "the run was cut off". See ADM-12378.
        let sawTerminalEvent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));

                if (event.type === "progress") {
                  // Update the latest progress message
                  setExecutionLog((prev) => {
                    const progressEntry: ExecutionLog = {
                      id: `log-progress-${Date.now()}`,
                      nodeId: event.nodeId || "system",
                      status: "running",
                      message: event.message,
                      timestamp: new Date(),
                      data: event.data,
                    };
                    // Replace the last "running" entry or add new
                    const withoutOldRunning = prev.filter((log) => log.status !== "running" || log.nodeId === "system");
                    // Keep "system" running entry for the spinner, add new progress
                    return [...withoutOldRunning, progressEntry];
                  });
                } else if (event.type === "step_result") {
                  const stepResult = event.data?.stepResult;
                  const status = resolveExecutionLogStatusForStep(stepResult, true);
                  setExecutionLog((prev) => [
                    ...prev,
                    {
                      id: `log-step-${Date.now()}`,
                      nodeId: event.nodeId || stepResult?.nodeId || "system",
                      status,
                      message: event.message,
                      timestamp: new Date(),
                      data: event.data,
                    },
                  ]);
                } else if (event.type === "complete") {
                  sawTerminalEvent = true;
                  const completeData = event.data || {};

                  // Media-library watch mode activation - no execution, just activation
                  if (completeData.activated) {
                    setExecutionLog((prev) => [
                      ...prev.filter((log) => log.status !== "running"),
                      {
                        id: `log-activated-${Date.now()}`,
                        nodeId: "system",
                        status: "success",
                        message: completeData.message || "Automation activated - watching for new uploads",
                        timestamp: new Date(),
                        data: { description: completeData.description },
                      },
                    ]);
                    setFlow((prev) => ({ ...prev, status: "active" }));
                  } else {
                    const completeData = event.data || {};
                    const completionTimestamp = new Date();
                    const sharedCompletionData = {
                      resultId: completeData.resultId,
                      logs: completeData.logs,
                      actionType: completeData.actionType || actionType,
                      accountId: completeData.accountId || actionNode?.config?.accountId,
                      stepResults: completeData.stepResults,
                    };
                    const completionLogs = buildCompletionLogsFromStepResults({
                      nodes: flow.nodes,
                      stepResults: completeData.stepResults,
                      runSuccess: completeData.success !== false,
                      sharedData: sharedCompletionData,
                      timestamp: completionTimestamp,
                    });
                    const historyLogEntry: ExecutionLog = {
                      id: `log-history-${Date.now()}`,
                      nodeId: "history",
                      status: completeData.executionId ? "success" : "error",
                      message: completeData.executionId ? "Saved to history" : "History save failed",
                      timestamp: completionTimestamp,
                      data: {
                        historyId: completeData.executionId,
                        resultId: completeData.resultId,
                        actionType: completeData.actionType || actionType,
                        accountId: completeData.accountId || actionNode?.config?.accountId,
                        stepResults: completeData.stepResults,
                        logs: completeData.logs,
                      },
                    };
                    setExecutionLog((prev) => [
                      ...prev.filter((log) => log.status !== "running"),
                      ...completionLogs,
                      historyLogEntry,
                    ]);
                    // Store execution ID for later retrieval
                    if (completeData.executionId) {
                      setLastExecutionId(completeData.executionId);
                    }
                    setFlow((prev) => ({ ...prev, lastRun: new Date() }));
                    if (completeData.success !== false) {
                      emitTelemetry({
                        type: "run_succeeded",
                        attemptId: `flow-${String(flow.id)}`,
                        ruleId: String(flow.id),
                        durationMs: 0,
                        evidence: "simulated",
                      });
                    }
                  }
                } else if (event.type === "cancelled") {
                  sawTerminalEvent = true;
                  setExecutionLog((prev) => [
                    ...prev.filter((log) => log.status !== "running"),
                    {
                      id: `log-cancelled-${Date.now()}`,
                      nodeId: "system",
                      status: "cancelled",
                      message: event.message || "Execution was cancelled",
                      timestamp: new Date(),
                      data: event.data,
                    },
                  ]);
                  if (event.data?.executionId) {
                    setLastExecutionId(event.data.executionId);
                  }
                } else if (event.type === "error") {
                  sawTerminalEvent = true;
                  // `data` carries the run's logs and executionId. Dropping it cost a failed
                  // run its Technical details panel twice over: `debugLogs` is derived from
                  // `log.data.logs`, and without `executionId` the history rehydrate in
                  // `fetchLastExecution` never fires either — so a failure had no path to
                  // its own logs. Mirrors the `cancelled` branch above.
                  setExecutionLog((prev) => [
                    ...prev.filter((log) => log.status !== "running"),
                    {
                      id: `log-error-${Date.now()}`,
                      nodeId: "system",
                      status: "error",
                      message: event.message || "Execution failed",
                      timestamp: new Date(),
                      data: event.data,
                    },
                  ]);
                  if (event.data?.executionId) {
                    setLastExecutionId(event.data.executionId);
                  }
                }
              } catch {
                // Ignore malformed SSE lines
              }
            }
          }
        }

        console.log("[v0] SSE stream complete");

        // The stream ended without ever telling us how the run finished. Without
        // this, the lingering "running" log entry survives, `deriveIsExecuting`
        // stays true, and the panel shows a spinner and a live Cancel button
        // forever — the run "never completes" purely in the UI. Every other
        // terminal path already drops that entry; this one used to fall through.
        if (!sawTerminalEvent) {
          setExecutionLog((prev) =>
            appendTerminalLog(prev, {
              id: `log-error-${Date.now()}`,
              nodeId: "system",
              status: "error",
              message:
                "The run stopped responding before it finished — it most likely exceeded the server time limit. Any steps that already ran were still applied; check Run history and your ads manager before re-running.",
              timestamp: new Date(),
            }),
          );
        }
      } catch (error) {
        // AbortError means user cancelled — handle gracefully
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("[v0] Automation execution cancelled by user");
          setExecutionLog((prev) => {
            // Only add cancelled log if we didn't already receive a cancelled SSE event
            if (prev.some((log) => log.status === "cancelled")) return prev;
            return [
              ...prev.filter((log) => log.status !== "running"),
              {
                id: `log-cancelled-${Date.now()}`,
                nodeId: "system",
                status: "cancelled",
                message: "Execution was cancelled",
                timestamp: new Date(),
              },
            ];
          });
        } else {
          console.error("[v0] Automation execution failed:", error);
          const errorLog: ExecutionLog = {
            id: `log-error-${Date.now()}`,
            nodeId: "system",
            status: "error",
            message: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date(),
          };
          // Drop any lingering "running" entries so the panel's derived
          // `isExecuting` flips false — otherwise the spinner keeps spinning and
          // the now-inert Cancel button stays on screen forever.
          setExecutionLog((prev) => appendTerminalLog(prev, errorLog));
        }
      } finally {
        executionAbortRef.current = null;
        setIsExecuting(false);
      }
    },
    [
      editorIdentity.canMutate,
      editorIdentity.existingRuleId,
      flow.nodes,
      flow.name,
      flow.selectedAccountId,
      runCommentAutomation,
    ],
  );

  const cancelExecution = useCallback(() => {
    if (executionAbortRef.current) {
      executionAbortRef.current.abort();
      executionAbortRef.current = null;
    }
  }, []);

  const loadAutomation = useCallback((id: string) => {
    const sampleAutomation = sampleAutomations.find((a) => a.id === id);
    if (sampleAutomation) {
      setFlow({
        id: sampleAutomation.id,
        name: sampleAutomation.name,
        nodes: sampleAutomation.nodes.map((node, idx) => ({
          id: node.id,
          type: node.type,
          service: node.service,
          event: node.config?.event || node.config?.action,
          config: node.config,
          position: idx,
        })),
        isActive: sampleAutomation.status === "on",
      });
      setFlowOrigin("template");
    }
  }, []);

  // Fetch last execution results from database
  const fetchLastExecution = useCallback(async () => {
    if (!lastExecutionId || isExecuting) return;

    try {
      const response = await fetch(`/api/automation/execution/${lastExecutionId}`);
      if (!response.ok) return;

      const execution = await response.json();

      // Convert database execution to execution logs
      const logs: ExecutionLog[] = [];

      // Add step results as logs
      if (execution.stepResults && Array.isArray(execution.stepResults)) {
        const completionLogs = buildCompletionLogsFromStepResults({
          nodes: flow.nodes,
          stepResults: execution.stepResults,
          runSuccess: execution.status === "completed",
          sharedData: {
            stepResults: execution.stepResults,
            logs: execution.executionLogs,
          },
          timestamp: new Date(execution.executedAt),
        });
        logs.push(...completionLogs);
      }

      // Add history log entry
      logs.push({
        id: `log-history-${Date.now()}`,
        nodeId: "history",
        status: execution.status === "completed" ? "success" : execution.status === "failed" ? "error" : "running",
        message: execution.status === "scheduled_delay" ? "Scheduled for later" : "Loaded from history",
        timestamp: new Date(execution.executedAt),
        data: {
          historyId: execution.id,
          resultId: execution.resultId,
          actionType: execution.actionType,
          accountId: execution.accountId,
          stepResults: execution.stepResults,
          logs: execution.executionLogs,
        },
      });

      setExecutionLog(logs);
    } catch (error) {
      console.error("Failed to fetch last execution:", error);
    }
  }, [lastExecutionId, isExecuting, flow.nodes]);

  // Fetch a comment automation's last run from CommentsServer. Comment rules
  // never write to AutomationExecution, so `fetchLastExecution` above has
  // nothing to find for them — this is what lets the Execution Results panel
  // show a comment automation's outcome and matched comments after a refresh
  // or a fresh page load, not just while its run is still live in this tab.
  const fetchLastCommentRun = useCallback(async () => {
    if (isExecuting) return;
    const ruleId = editorIdentity.existingRuleId;
    if (ruleId === null) return;
    const triggerNode = findCommentTriggerNode(flow.nodes);
    const actionNode = findCommentActionNode(flow.nodes);
    if (!triggerNode || !actionNode) return;

    try {
      const { runs } = await automationApi.getRuleRuns(ruleId, 1, 0);
      const latestRun = runs[0];
      if (!latestRun) return;

      const { comments } = await automationApi.getRunDetails(latestRun.id);
      const logs = buildRehydratedCommentRunLogs({
        triggerNodeId: triggerNode.id,
        actionNodeId: actionNode.id,
        run: latestRun,
        comments,
      });
      if (logs) setExecutionLog(logs);
    } catch (error) {
      console.error("Failed to fetch last comment automation run:", error);
    }
  }, [editorIdentity.existingRuleId, flow.nodes, isExecuting]);

  return (
    <AutomationContext.Provider
      value={{
        flow,
        draftEditVersion,
        restoreAssistantDraft,
        editorIdentity,
        updateFlowName,
        setFlowActive,
        setSelectedAccount,
        updateNotificationSettings,
        addNode,
        updateNode,
        deleteNode,
        moveNode,
        exportFlow,
        importFlowAsNew,
        applyAssistantFlow,
        startAssistantFlow,
        upsertAssistantStep,
        removeAssistantStep,
        assistantActiveStepId,
        invalidNodeId,
        clearAssistantActiveStep,
        saveAutomation,
        runAutomation,
        cancelExecution,
        executionLog,
        isExecuting,
        loadAutomation,
        lastExecutionId,
        fetchLastExecution,
        fetchLastCommentRun,
        showExecutionPanel,
        setShowExecutionPanel,
      }}
    >
      {children}
    </AutomationContext.Provider>
  );
}

export function useAutomation() {
  const context = useContext(AutomationContext);
  if (!context) {
    throw new Error("useAutomation must be used within AutomationProvider");
  }
  return context;
}

function syncHunchNodeConfigs(
  nodes: AutomationNode[],
  updatedNodeId: string,
  updatedConfig: AutomationNode["config"] | undefined,
): AutomationNode[] {
  const hunchGroupId = readConfigString(updatedConfig, "hunchGroupId");
  if (!hunchGroupId) return nodes;

  const sharedConfig = buildHunchSharedConfig(updatedConfig || {});
  if (Object.keys(sharedConfig).length === 0) return nodes;

  return nodes.map((node) => {
    if (node.id === updatedNodeId) return node;
    if (readConfigString(node.config, "hunchGroupId") !== hunchGroupId) return node;
    return { ...node, config: { ...node.config, ...sharedConfig } };
  });
}

function buildHunchSharedConfig(config: Record<string, any>): Record<string, any> {
  const sharedConfig: Record<string, any> = {};
  for (const key of HUNCH_SHARED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      sharedConfig[key] = config[key];
    }
  }
  if (sharedConfig.targetId && !sharedConfig.sourceAdSetId) {
    sharedConfig.sourceAdSetId = sharedConfig.targetId;
  }
  if (sharedConfig.sourceAdSetId && !sharedConfig.targetId) {
    sharedConfig.targetId = sharedConfig.sourceAdSetId;
  }
  if (sharedConfig.targetId && !sharedConfig.targetAdSetId) {
    sharedConfig.targetAdSetId = sharedConfig.targetId;
  }
  if (sharedConfig.targetAdSetId && !sharedConfig.targetId) {
    sharedConfig.targetId = sharedConfig.targetAdSetId;
  }
  return sharedConfig;
}

function normalizeAutomationNodesForSave(nodes: AutomationNode[]): AutomationNode[] {
  return nodes.map((node) => {
    if (node.type === "action" && node.event === "Launch Ad") {
      return { ...node, config: normalizeLaunchAdTargetConfig(node.config || {}) };
    }
    // ADM-11225: drop schedule fields the chosen frequency does not use. The
    // panel hides "Scheduled Date" for recurring rules but never cleared it, so
    // a stale one-time date rode along on every save and ended up overwriting
    // the dayOfWeek-derived occurrence.
    if (node.type === "trigger" && node.service === "scheduled") {
      const config = node.config || {};
      const stripped = stripInapplicableScheduleFields(config);
      return stripped === config ? node : { ...node, config: stripped };
    }
    return node;
  });
}

function readConfigString(config: AutomationNode["config"] | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}
