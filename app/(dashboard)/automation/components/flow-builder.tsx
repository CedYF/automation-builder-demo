"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactElement } from "react";
import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";
import { useSearchParams } from "next/navigation";
import { useAutomation, type AutomationNode } from "../contexts/automation-context";
import { FlowNode } from "./flow-node";
import { AddNodeButton } from "./add-node-button";
import { ConfigPanel } from "./config-panel";
import { AppSelectorDialog } from "./app-selector-dialog";
import { FlowConnectorSection } from "./flow-connector";
import { FullPreviewPanel } from "./full-preview-panel";
import { AssistantPanel } from "./assistant-panel";
import { BuilderDock, type BuilderDockTab } from "./builder-dock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2, Zap, Plus, Minus, Maximize } from "lucide-react";
import type { AssistantMode } from "../hooks/use-automation-assistant";
import { useIsEssentialAutomationPlan } from "@/lib/automation/use-essential-automation-plan";
import { getPlanLockedTriggerServiceIdsForEssential } from "@/lib/automation/essential-plan-automation-access";
import { resolveAutomationAccessScope } from "@/lib/automation/automation-access";
import { useUser } from "@/lib/providers/user-provider";
import { getAutomationNodeEditorKey } from "@/lib/automation/editor-identity";
import {
  type AutomationNodeType,
  getFlowControlServiceEvent,
  isStepNodeType,
  resolveNodeTypeForService,
} from "@/lib/automation/flow-control-steps";
import { findFirstIncompleteNodeId, getBuilderStepReadiness } from "../lib/builder-readiness";
import { onBuilderFocusIncomplete } from "../lib/builder-focus-events";
import {
  CANVAS_ZOOM_DEFAULT,
  canZoomCanvasIn,
  canZoomCanvasOut,
  formatCanvasZoom,
  zoomCanvasIn,
  zoomCanvasOut,
} from "../lib/canvas-zoom";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 700;
const PANEL_DEFAULT_WIDTH = 420;
const LOADING_STEP_COUNT = 4;
const CANVAS_DOT_SIZE = "22px 22px";
/** Fixed step-card column width, matching the inspector's field rhythm. */
const FLOW_COLUMN_WIDTH = 520;
const COMMENTS_ACTION_SERVICES = ["comments"] as const;
const COMMENTS_TRIGGER_SERVICES = ["comments"] as const;

interface ResolveAllowedServicesOptions {
  readonly isCommentsOnly: boolean;
  readonly hasCommentsTrigger: boolean;
  readonly pendingNodeType: AutomationNodeType | null;
}

/**
 * Which apps the selector offers for the node being added.
 *
 * A comment-only role (ADM-11300) only gets the Comments trigger and its
 * actions: anything else would build a flow automation it cannot save. For
 * everyone else, a flow that starts from a Comments trigger keeps its steps on
 * Comments actions.
 */
function resolveAllowedServices({
  isCommentsOnly,
  hasCommentsTrigger,
  pendingNodeType,
}: ResolveAllowedServicesOptions): readonly string[] | undefined {
  if (isCommentsOnly) {
    return pendingNodeType === "trigger" ? COMMENTS_TRIGGER_SERVICES : COMMENTS_ACTION_SERVICES;
  }
  const isAddingStep = pendingNodeType !== null && pendingNodeType !== "trigger" && isStepNodeType(pendingNodeType);
  return hasCommentsTrigger && isAddingStep ? COMMENTS_ACTION_SERVICES : undefined;
}

/**
 * Atmospheric builder backdrop: a subtle violet dot-grid with a faint vignette
 * so the flow cards read as floating above depth.
 */
function CanvasBackground(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(99, 102, 241, 0.13) 1px, transparent 1px)",
          backgroundSize: CANVAS_DOT_SIZE,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_55%,rgba(15,23,42,0.035))]" />
    </div>
  );
}

interface CanvasZoomControlProps {
  readonly zoom: number;
  readonly onZoomChange: (zoom: number) => void;
}

/**
 * Bottom-left zoom cluster. A long flow does not fit on one screen, and the
 * canvas has no other way to pull back and see the whole thing.
 */
function CanvasZoomControl({ zoom, onZoomChange }: CanvasZoomControlProps): ReactElement {
  return (
    <div className="absolute bottom-4 left-4 z-20 hidden items-center gap-1 rounded-lg border bg-card p-1 shadow-sm md:flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onZoomChange(zoomCanvasOut(zoom))}
        disabled={!canZoomCanvasOut(zoom)}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-foreground">
        {formatCanvasZoom(zoom)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onZoomChange(zoomCanvasIn(zoom))}
        disabled={!canZoomCanvasIn(zoom)}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onZoomChange(CANVAS_ZOOM_DEFAULT)}
        disabled={zoom === CANVAS_ZOOM_DEFAULT}
        title="Reset zoom to 100%"
        aria-label="Reset zoom to 100%"
      >
        <Maximize className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface FlowBuilderProps {
  /** Whether the Agent tab has anything to show — mirrors the header's "Ask AI" toggle. */
  readonly assistantOpen?: boolean;
  readonly onAssistantOpenChange?: (open: boolean) => void;
  readonly assistantSeed?: string | null;
  readonly assistantSeedMode?: AssistantMode;
  readonly onAssistantSeedConsumed?: () => void;
}

export function FlowBuilder({
  assistantOpen = false,
  onAssistantOpenChange,
  assistantSeed,
  assistantSeedMode,
  onAssistantSeedConsumed,
}: FlowBuilderProps = {}) {
  const { flow, editorIdentity, updateNode, addNode } = useAutomation();
  const { extendedUser } = useUser();
  const isCommentsOnly = resolveAutomationAccessScope(extendedUser?.role) === "comments-only";
  const searchParams = useSearchParams();
  const isEssentialPlan = useIsEssentialAutomationPlan();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [, setAssistantPanelTab] = useQueryState("panel", parseAsString.withDefault("setup"));
  const [dockTab, setDockTab] = useState<BuilderDockTab>("config");
  const [appSelectorOpen, setAppSelectorOpen] = useState(false);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useQueryState("fullPreview", parseAsBoolean.withDefault(false));
  const pendingSelectNodeId = useRef<string | null>(null);
  // Seeded false, not with `assistantOpen`: the builder is often mounted with
  // ?assistant=true already set (Home's "build with AI" composer does exactly that),
  // and seeding true meant the open transition never fired. `dockTab` then stayed
  // "config" while BuilderDock's showConfigTab fallback made it *look* like Agent —
  // so the dock snapped to Configure step the moment any node got selected.
  const wasAssistantOpen = useRef(false);

  // Ask AI opening the agent should actually surface it — jump the dock to the
  // Agent tab on the open transition, but leave it alone on later re-renders so a
  // user who switches back to Configure step isn't yanked away by an unrelated update.
  useEffect(() => {
    if (assistantOpen && !wasAssistantOpen.current) {
      setDockTab("agent");
    }
    wasAssistantOpen.current = assistantOpen;
  }, [assistantOpen]);

  useEffect(() => {
    return onBuilderFocusIncomplete(() => {
      const incompleteNodeId = findFirstIncompleteNodeId({
        nodes: flow.nodes,
        selectedAccountId: flow.selectedAccountId,
      });
      if (!incompleteNodeId) return;
      setSelectedNodeId(incompleteNodeId);
      setDockTab("config");
    });
  }, [flow.nodes, flow.selectedAccountId]);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [canvasZoom, setCanvasZoom] = useState(CANVAS_ZOOM_DEFAULT);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        // Panel is on the right, so dragging left increases width
        const delta = startX - e.clientX;
        const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + delta));
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelWidth],
  );

  // Auto-select node when flow is imported from copilot
  useEffect(() => {
    if (pendingSelectNodeId.current && flow.nodes.length > 0) {
      const nodeToSelect = flow.nodes.find((n) => n.id === pendingSelectNodeId.current);
      if (nodeToSelect) {
        if (!nodeToSelect.service) {
          setPendingNodeId(nodeToSelect.id);
          setAppSelectorOpen(true);
        } else {
          setSelectedNodeId(nodeToSelect.id);
        }
        pendingSelectNodeId.current = null;
      }
    }
  }, [flow.nodes]);

  // Landing in the builder (opening a different automation, a template, or a
  // fresh flow) should auto-select the first configured step so the dock opens
  // straight to Configure instead of the "No step selected" empty state.
  //
  // `flow.id` also changes when Save reassigns it — a brand-new automation's
  // draft id (`flow-<timestamp>`) becomes the persisted id the moment the first
  // save succeeds, and an update-save recomputes the same persisted id — in
  // both cases without touching `flow.nodes` (same array reference). That's the
  // signal used below to tell "just got an id" apart from "this is actually a
  // different flow": `lastRenderedNodesRef` is kept in sync with `flow.nodes` on
  // every render (even ones where `flow.id` didn't change, e.g. ordinary step
  // edits), so the comparison below only ever sees a "different" reference when
  // the very update that changed `flow.id` also swapped the nodes array — never
  // because of edits made earlier in the session. Without this, Save was
  // deselecting whatever step the user had open and dropping them on
  // "No step selected" instead of leaving them in place.
  const lastRenderedNodesRef = useRef<AutomationNode[]>(flow.nodes);
  const needsAutoSelectRef = useRef(false);
  useEffect(() => {
    if (lastRenderedNodesRef.current !== flow.nodes) {
      setSelectedNodeId(null);
      setPendingNodeId(null);
      needsAutoSelectRef.current = true;
    }
    // else: Save reassigned flow.id without touching nodes — keep the selection.
  }, [flow.id]);

  // Runs after every render (declared after the effect above, so it always
  // records this render's nodes *after* that effect compared against last
  // render's) to keep the "did nodes actually change" comparison accurate.
  useEffect(() => {
    lastRenderedNodesRef.current = flow.nodes;
  });

  useEffect(() => {
    if (!needsAutoSelectRef.current) return;
    if (flow.nodes.length === 0) return;
    needsAutoSelectRef.current = false;
    const firstConfigured = flow.nodes.find((node) => !!node.service) || flow.nodes[0];
    if (!firstConfigured?.service) return;
    setSelectedNodeId(firstConfigured.id);
    // The agent owns which dock tab is showing while it is open — every
    // automation_start_flow mints a fresh flow.id, which re-arms the flag above,
    // and pulling the dock to Configure on each streamed step would fight the
    // user. Selecting the node itself is still safe (and is what makes the
    // Editor tab show the first step instead of "No step selected" when the
    // builder is opened with ?assistant=true).
    if (assistantOpen) return;
    setDockTab("config");
  }, [assistantOpen, flow.nodes]);

  // Tracked synchronously during render, not inside an effect: this component's
  // layout effects for a commit all run *before* any of its passive effects, so
  // a flag only set inside the `flow.id`-watching `useEffect` above wouldn't be
  // visible yet to the layout effect below on the very render where `flow.id`
  // changes. Reading/writing a ref during render like this is the documented
  // way to compare against "last render"'s props without that one-render lag.
  const previousFlowIdRef = useRef(flow.id);
  const isFlowSwapRender = previousFlowIdRef.current !== flow.id;
  previousFlowIdRef.current = flow.id;

  // Never let the Configure tab go blank while the flow still has configured
  // steps. This is the general-purpose backstop behind the two effects above
  // (landing and Save): it also catches deleting the selected node — the
  // node's id survives in `selectedNodeId` but stops resolving on `flow.nodes`,
  // which is exactly the "No step selected" trigger this file's earlier fixes
  // were chasing case by case. `useLayoutEffect` so the fallback selection
  // commits before paint — no flash of the empty state in between.
  //
  // Skipped on a flow-swap render: the two effects above already own that
  // transition (null the selection, defer to an auto-select keyed off the
  // *new* flow's nodes). Without this guard, this effect would run first
  // (layout effects precede passive effects within a commit) using the old
  // selection's index against the unrelated new flow's node list, picking an
  // arbitrary node there before the swap effects correct it — a real second
  // flicker, not the one this effect exists to remove.
  useLayoutEffect(() => {
    if (isFlowSwapRender) return;
    if (dockTab !== "config") return;
    if (pendingNodeId) return; // app selector is choosing a service for a pending node
    if (assistantOpen) return; // agent owns the dock while streaming a flow in
    if (flow.nodes.length === 0) return;
    const selectionIsValid = selectedNodeId ? flow.nodes.some((node) => node.id === selectedNodeId) : false;
    if (selectionIsValid) return;

    // Prefer whichever step now sits where the missing one used to be (e.g.
    // the step that slid up after a delete), then fall back to the first
    // configured step. `lastRenderedNodesRef` still holds the pre-update
    // order at this point — the effect that refreshes it runs after this one.
    const previousIndex = selectedNodeId
      ? lastRenderedNodesRef.current.findIndex((node) => node.id === selectedNodeId)
      : -1;
    const neighbor = previousIndex >= 0 ? flow.nodes[Math.min(previousIndex, flow.nodes.length - 1)] : null;
    const fallback = (neighbor?.service ? neighbor : null) || flow.nodes.find((node) => !!node.service) || null;
    if (fallback) setSelectedNodeId(fallback.id);
  }, [isFlowSwapRender, dockTab, pendingNodeId, assistantOpen, flow.nodes, selectedNodeId]);

  const handleNodeClick = (node: AutomationNode) => {
    setDockTab("config");
    if (!node.service) {
      setPendingNodeId(node.id);
      setAppSelectorOpen(true);
    } else {
      setSelectedNodeId(node.id);
    }
  };

  const handleAppSelect = (appId: string) => {
    if (!pendingNode) return;
    // Slack and Email are aliases that route to the notification action
    const resolvedAppId = appId === "slack" || appId === "email" ? "notification" : appId;
    // Delay/Approval are node types, not action services — retype the node so the
    // executor dispatches it as a wait/approval step rather than a plain action.
    const nextType = resolveNodeTypeForService(resolvedAppId, pendingNode.type);
    const impliedEvent = getFlowControlServiceEvent(resolvedAppId);
    updateNode(pendingNode.id, {
      service: resolvedAppId,
      type: nextType,
      ...(impliedEvent ? { event: impliedEvent } : {}),
    });
    setSelectedNodeId(pendingNode.id);
    setPendingNodeId(null);
    setDockTab("config");
  };

  const handleAddTrigger = () => {
    addNode("trigger", 0);
  };

  const selectedNode = selectedNodeId ? flow.nodes.find((node) => node.id === selectedNodeId) || null : null;
  const pendingNode = pendingNodeId ? flow.nodes.find((node) => node.id === pendingNodeId) || null : null;
  const selectedNodeReadiness = getBuilderStepReadiness({
    service: selectedNode?.service,
    event: selectedNode?.event,
    nodeType: selectedNode?.type,
    config: selectedNode?.config,
    flowAccountId: flow.selectedAccountId,
  });
  const showConfigPanel = !fullPreviewOpen && selectedNode && selectedNode.service;
  const showFullPreview = fullPreviewOpen && flow.nodes.length > 0;
  const hasTrigger = flow.nodes.some((node) => node.type === "trigger");

  const closeFullPreview = () => setFullPreviewOpen(null);

  // Determine which services should be disabled for the app selector
  // Scheduled trigger can only be added once
  const hasScheduledTrigger = flow.nodes.some((node) => node.type === "trigger" && node.service === "scheduled");
  const disabledServices = hasScheduledTrigger && pendingNode?.type === "trigger" ? ["scheduled"] : [];
  const hasCommentsTrigger = flow.nodes.some((node) => node.type === "trigger" && node.service === "comments");
  const allowedServices = resolveAllowedServices({
    isCommentsOnly,
    hasCommentsTrigger,
    pendingNodeType: pendingNode?.type ?? null,
  });
  const planLockedTriggerServices =
    isEssentialPlan && pendingNode?.type === "trigger" ? getPlanLockedTriggerServiceIdsForEssential() : [];

  if (editorIdentity.status === "loading") {
    return <FlowBuilderLoadingState />;
  }

  if (editorIdentity.status === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h3 className="font-semibold text-foreground">Automation could not be loaded</h3>
          <p className="text-sm text-muted-foreground">{editorIdentity.error || "Try opening it again."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col md:flex-row">
      <CanvasBackground />

      {/* Flow area. An empty canvas swaps only this branch: it must never early-return
          past BuilderDock, or the assistant chat is destroyed every time the agent
          calls automation_start_flow (which resets nodes to []) before its first step. */}
      {flow.nodes.length === 0 ? (
        <FlowBuilderEmptyCanvas onAddTrigger={handleAddTrigger} />
      ) : (
        <div
          className={`flex flex-1 items-start justify-center overflow-auto p-3 pt-4 transition-all md:p-6 relative z-10 ${showConfigPanel ? "md:pr-0" : ""}`}
        >
          <div
            className="mx-auto w-full max-w-md py-4 md:py-8"
            style={{
              maxWidth: FLOW_COLUMN_WIDTH,
              zoom: canvasZoom,
            }}
          >
            <div className="space-y-0">
              {/* Show "Add Trigger" placeholder when no trigger exists */}
              {!hasTrigger && flow.nodes.length > 0 && (
                <div>
                  <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                    <p className="mb-2 text-sm text-muted-foreground">No trigger configured</p>
                    <Button onClick={handleAddTrigger} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Trigger
                    </Button>
                  </div>
                  <FlowConnectorSection animated={true}>
                    <div />
                  </FlowConnectorSection>
                </div>
              )}
              {flow.nodes.map((node, index) => {
                const isLastNode = index === flow.nodes.length - 1;
                return (
                  <div key={node.id}>
                    <FlowNode
                      node={node}
                      index={index}
                      onNodeClick={handleNodeClick}
                      isSelected={selectedNodeId === node.id}
                    />

                    {/* Connector with AddNodeButton - disable animation on last one */}
                    <FlowConnectorSection animated={!isLastNode}>
                      <AddNodeButton position={index + 1} isLast={isLastNode} />
                    </FlowConnectorSection>
                  </div>
                );
              })}
            </div>
          </div>

          <CanvasZoomControl zoom={canvasZoom} onZoomChange={setCanvasZoom} />
        </div>
      )}

      {showFullPreview && (
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeFullPreview} />

          {/* Mobile: bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-hidden rounded-t-2xl bg-card md:hidden">
            <FullPreviewPanel onClose={closeFullPreview} />
          </div>

          {/* Desktop: resizable side panel — its own handle now that the config dock has one of its own */}
          <div className="relative hidden h-full flex-shrink-0 md:flex" style={{ width: panelWidth }}>
            <div
              className="group relative w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/30"
              onMouseDown={handleResizeStart}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/40" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <FullPreviewPanel onClose={closeFullPreview} />
            </div>
          </div>
        </>
      )}

      {/* BuilderDock renders both the desktop side dock and its own mobile bottom
          sheet for the Editor/Agent tabs, so there is no separate mobile-only
          config sheet here anymore — it doubled up with the dock's mobile sheet. */}
      <BuilderDock
        activeTab={dockTab}
        onActiveTabChange={(tab) => {
          setDockTab(tab);
          // Keep the header's "Ask AI" pill and the ?assistant= URL state in sync when
          // the Agent tab is opened straight from the dock rather than the header button.
          if (tab === "agent") onAssistantOpenChange?.(true);
        }}
        // Always shown, unlike the old `Boolean(showConfigPanel)` gate — the Editor tab
        // used to vanish entirely whenever nothing was selected, leaving only Agent and
        // making it look like the Editor tab was missing. It now stays put and falls
        // back to an empty state instead of disappearing.
        showConfigTab
        configBlocked={selectedNodeReadiness.blocker !== null}
        configContent={
          selectedNode && selectedNode.service ? (
            <ConfigPanel
              key={getAutomationNodeEditorKey(flow.id, selectedNode.id)}
              node={selectedNode}
              callbacks={{
                // "Collapse step settings" used to null the selection outright, which
                // is exactly the "No step selected" state this file works hard to
                // avoid everywhere else. Step sideways to a neighboring configured
                // step instead; the layout-effect backstop above covers the rare
                // case where none exists (e.g. this is the only step in the flow).
                onClose: () => {
                  const currentIndex = flow.nodes.findIndex((n) => n.id === selectedNode.id);
                  const neighbor = flow.nodes[currentIndex + 1] || flow.nodes[currentIndex - 1] || null;
                  const fallback =
                    (neighbor?.service ? neighbor : null) ||
                    flow.nodes.find((n) => n.id !== selectedNode.id && !!n.service) ||
                    null;
                  setSelectedNodeId(fallback?.id ?? null);
                },
                onContinue: (nextNodeId: string) => {
                  const nextNode = flow.nodes.find((n) => n.id === nextNodeId);
                  if (nextNode) {
                    if (!nextNode.service) {
                      setPendingNodeId(nextNode.id);
                      setAppSelectorOpen(true);
                    } else {
                      setSelectedNodeId(nextNode.id);
                    }
                  }
                },
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No step selected</p>
              <p className="text-xs text-muted-foreground">Click a step on the canvas to edit it here.</p>
            </div>
          )
        }
        // Always shown, for the same reason as showConfigTab above: gating this on
        // `assistantOpen` meant the Agent tab only existed once the agent was already
        // open, so anyone landing in the builder (e.g. ?panel=preview deep links) saw a
        // lone "Step" tab and had no way to reach the agent from the dock at all.
        showAgentTab
        agentContent={
          <AssistantPanel
            onOpenStep={(id, tab) => {
              const node = flow.nodes.find((candidate) => candidate.id === id);
              if (!node) return;
              setSelectedNodeId(id);
              if (!node.service) {
                setPendingNodeId(id);
                setAppSelectorOpen(true);
              }
              void setAssistantPanelTab(tab);
              setDockTab("config");
              onAssistantOpenChange?.(false);
            }}
            onClose={() => {
              setDockTab("config");
              onAssistantOpenChange?.(false);
            }}
            seedPrompt={assistantSeed}
            seedMode={assistantSeedMode}
            onSeedConsumed={onAssistantSeedConsumed}
          />
        }
      />

      <AppSelectorDialog
        open={appSelectorOpen}
        onOpenChange={setAppSelectorOpen}
        nodeType={pendingNode?.type || "action"}
        onSelectApp={handleAppSelect}
        allowedServices={allowedServices}
        disabledServices={disabledServices}
        planLockedServices={planLockedTriggerServices}
      />
    </div>
  );
}

/**
 * Canvas placeholder shown while the flow has no steps. Rendered in the flow-area
 * slot of the normal layout rather than as an early return, so the builder dock
 * (and the assistant chat it hosts) stays mounted across an empty canvas.
 */
const EMPTY_CANVAS_STEPS = [
  { title: "Add a trigger", detail: "What starts the run" },
  { title: "Fill the open field", detail: "The step panel highlights what is missing" },
  { title: "Preview, save, turn on", detail: "Check matches, then leave it running" },
] as const;

function FlowBuilderEmptyCanvas({ onAddTrigger }: { readonly onAddTrigger: () => void }): ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center p-6 relative z-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <Zap className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="w-full space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xl font-semibold text-foreground">Finish this automation in three steps</h3>
            <p className="text-sm text-muted-foreground">Start with a trigger. The rest of the path stays on screen.</p>
          </div>
          <ol className="space-y-2 text-left">
            {EMPTY_CANVAS_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-xl border bg-card/80 px-3.5 py-3 shadow-sm"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{step.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Button onClick={onAddTrigger} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-4 w-4" />
          Add a trigger
        </Button>
      </div>
    </div>
  );
}

function FlowBuilderLoadingState(): ReactElement {
  return (
    <div className="relative flex h-full flex-col md:flex-row">
      <CanvasBackground />

      <div className="relative z-10 flex flex-1 items-start justify-center overflow-auto p-3 pt-4 md:p-6">
        <div className="mx-auto w-full max-w-md py-4 md:max-w-xl md:py-8">
          <div className="mb-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading automation template
          </div>
          <div className="space-y-0">
            {Array.from({ length: LOADING_STEP_COUNT }, (_, index) => (
              <div key={index}>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                </div>
                {index < LOADING_STEP_COUNT - 1 && (
                  <div className="flex h-14 items-center justify-center">
                    <div className="h-full w-px bg-primary/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
