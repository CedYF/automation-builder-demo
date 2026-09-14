"use client";

import { useCallback, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ChevronsLeftRight, ChevronsRight, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type BuilderDockTab = "config" | "agent";

const DOCK_MIN_WIDTH = 340;
const DOCK_MAX_WIDTH = 720;
const DOCK_DEFAULT_WIDTH = 440;
const DOCK_WIDE_WIDTH = 640;
const DOCK_RAIL_WIDTH = 56;
/** Snap point above which the widen toggle reports "already wide" and flips back down. */
const DOCK_WIDE_THRESHOLD = 600;

interface DockTabButtonProps {
  readonly active: boolean;
  readonly label: string;
  readonly icon: ReactElement;
  readonly dotClassName?: string;
  readonly activeClassName: string;
  readonly onClick: () => void;
}

/** One pill in the top switcher — solid tint when active, ghost with an optional status dot when not. */
function DockTabButton({ active, label, icon, dotClassName, activeClassName, onClick }: DockTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
        active ? activeClassName : "text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
      {!active && dotClassName && <span className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />}
    </button>
  );
}

interface DockRailProps {
  readonly activeTab: BuilderDockTab;
  readonly showConfigTab: boolean;
  readonly showAgentTab: boolean;
  readonly configBlocked: boolean;
  readonly onOpen: (tab: BuilderDockTab) => void;
}

/** Collapsed state: a narrow icon rail so the canvas can reclaim the dock's width without losing context. */
function DockRail({ activeTab, showConfigTab, showAgentTab, configBlocked, onOpen }: DockRailProps): ReactElement {
  return (
    <div className="flex h-full w-full flex-col items-center gap-2 border-l bg-card py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onOpen(activeTab)}
        title="Open dock"
        aria-label="Open dock"
      >
        <ChevronsLeftRight className="h-4 w-4" />
      </Button>
      {showConfigTab && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative mt-1 h-9 w-9",
            activeTab === "config" && "bg-primary/10 text-primary hover:bg-primary/15",
          )}
          onClick={() => onOpen("config")}
          title="Step"
          aria-label="Step"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {configBlocked && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
          )}
        </Button>
      )}
      {showAgentTab && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", activeTab === "agent" && "bg-violet-100 text-violet-700 hover:bg-violet-100/80")}
          onClick={() => onOpen("agent")}
          title="Agent"
          aria-label="Agent"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface BuilderDockProps {
  readonly activeTab: BuilderDockTab;
  readonly onActiveTabChange: (tab: BuilderDockTab) => void;
  readonly showConfigTab: boolean;
  readonly configBlocked: boolean;
  readonly configContent: ReactNode;
  readonly showAgentTab: boolean;
  readonly agentContent: ReactNode;
}

/**
 * The single right-hand dock for the flow builder: one resizable column that switches
 * between "Step" and "Agent" instead of the two competing side-by-side panels
 * this replaces — the canvas keeps its width regardless of which tab is open.
 */
export function BuilderDock({
  activeTab,
  onActiveTabChange,
  showConfigTab,
  configBlocked,
  configContent,
  showAgentTab,
  agentContent,
}: BuilderDockProps): ReactElement | null {
  const [width, setWidth] = useState(DOCK_DEFAULT_WIDTH);
  const [minimized, setMinimized] = useState(false);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isResizing.current = true;
      const startX = event.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        // Dock sits on the right, so dragging left grows it.
        const delta = startX - moveEvent.clientX;
        setWidth(Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, startWidth + delta)));
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
    [width],
  );

  const toggleWide = useCallback(() => {
    setWidth((current) => (current >= DOCK_WIDE_THRESHOLD ? DOCK_DEFAULT_WIDTH : DOCK_WIDE_WIDTH));
  }, []);

  const openTab = useCallback(
    (tab: BuilderDockTab) => {
      setMinimized(false);
      onActiveTabChange(tab);
    },
    [onActiveTabChange],
  );

  if (!showConfigTab && !showAgentTab) return null;

  const resolvedTab: BuilderDockTab =
    activeTab === "config" && !showConfigTab ? "agent" : activeTab === "agent" && !showAgentTab ? "config" : activeTab;

  const tabStrip = (
    <div className="flex h-12 flex-none items-center gap-1 border-b px-2">
      {showConfigTab && (
        <DockTabButton
          active={resolvedTab === "config"}
          label="Step"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          dotClassName={configBlocked ? "bg-destructive" : undefined}
          activeClassName="bg-blue-50 text-blue-700"
          onClick={() => openTab("config")}
        />
      )}
      {showAgentTab && (
        <DockTabButton
          active={resolvedTab === "agent"}
          label="Agent"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          activeClassName="bg-violet-50 text-violet-700"
          onClick={() => openTab("agent")}
        />
      )}
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden h-7 w-7 md:inline-flex"
        onClick={toggleWide}
        title="Widen dock"
        aria-label="Widen dock"
      >
        <ChevronsLeftRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setMinimized(true)}
        title="Collapse dock"
        aria-label="Collapse dock"
      >
        <ChevronsRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const tabPanes = (
    <>
      <div className={cn("min-h-0 flex-1", resolvedTab === "config" ? "flex flex-col" : "hidden")}>
        {showConfigTab && configContent}
      </div>
      <div className={cn("min-h-0 flex-1", resolvedTab === "agent" ? "flex flex-col" : "hidden")}>
        {showAgentTab && agentContent}
      </div>
    </>
  );

  return (
    /*
     * ONE element for both layouts: a bottom sheet below `md`, a resizable side
     * dock at `md` and up.
     *
     * This used to be two sibling containers (`md:flex` desktop + `md:hidden`
     * mobile sheet) that each rendered the same `tabPanes` element. The split is
     * CSS-only, so React mounted BOTH — giving `AssistantPanel` two live
     * instances, each with its own seed latch, and one seeded goal fired two
     * `/api/automation-assistant/stream` requests and created two conversations.
     * Keep this as a single subtree; do not reintroduce a second render.
     *
     * The dock width can't be a plain inline `width` (that would apply to the
     * mobile sheet too), so it rides on a CSS variable the `md:` class consumes.
     */
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border-t bg-card shadow-2xl",
        "md:relative md:inset-auto md:z-auto md:h-full md:max-h-none md:w-[var(--builder-dock-width)] md:flex-shrink-0 md:flex-row md:overflow-visible md:rounded-none md:border-t-0 md:bg-transparent md:shadow-none",
        // Collapsed: the rail is desktop-only, so the sheet goes away entirely below `md`.
        minimized && "hidden md:flex",
      )}
      style={{ "--builder-dock-width": `${minimized ? DOCK_RAIL_WIDTH : width}px` } as CSSProperties}
    >
      {minimized ? (
        <DockRail
          activeTab={resolvedTab}
          showConfigTab={showConfigTab}
          showAgentTab={showAgentTab}
          configBlocked={configBlocked}
          onOpen={openTab}
        />
      ) : (
        <div
          className="group relative hidden w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/30 md:block"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/40" />
        </div>
      )}
      <div
        className={cn("min-w-0 flex-1 flex-col overflow-hidden md:border-l md:bg-card", minimized ? "hidden" : "flex")}
      >
        {tabStrip}
        {tabPanes}
      </div>
    </div>
  );
}
