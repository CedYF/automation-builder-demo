"use client";

import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAutomation } from "../contexts/automation-context";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Download,
  Upload,
  MoreHorizontal,
  FileJson,
  Copy,
  Check,
  FileCode,
  ArrowLeft,
  Save,
  Loader2,
  X,
  History,
  AlertTriangle,
  Bell,
  Ban,
  Eye,
  Sparkles,
  Pencil,
  ChevronDown,
  Activity,
  Layers,
  MessageSquareDot,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ExecutionPanel } from "./execution-panel";
import { ImportExportDialog } from "./import-export-dialog";
import { AutomationHistorySheet } from "./automation-history-sheet";
import { getRunHistoryAvailability, getRunHistoryTitle } from "../lib/run-history-availability";
import { NotificationSettingsSheet } from "./notification-settings-sheet";
import { CommentPendingRepliesSheet } from "./comment-pending-replies-sheet";
import {
  useCommentAutomationMembers,
  useCommentPendingReplyCount,
} from "../_features/comment-automation/hooks/use-comment-automation-members";
import { RunPagesDialog } from "../_features/comment-automation/components/run-pages-dialog";
import { automationTemplates } from "../lib/automation-templates";
import { actionEventToType, isCommentAutomationFlow, readCommentPageIdsFromFlow } from "../lib/comment-flow-mapper";
import { buildCommentActionRuleSummary } from "../lib/comment-action-setup-summary";
import { useUser } from "@/lib/providers/user-provider";
import { canManageAutomationBySource, canManageAutomationRules } from "@/lib/automation/automation-access";
import { BuilderContextBar } from "./builder-context-bar";
import { buildBuilderIdentityLine } from "../lib/builder-identity-line";
import { listBuilderBlockersFromFlow } from "../lib/builder-readiness";
import { isRunNowAvailable } from "../lib/run-now-availability";
import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";
import { cn } from "@/lib/utils";

/** How often the "saved 2m ago" line re-renders. */
const IDENTITY_LINE_REFRESH_MS = 30_000;
/** Placeholder clock for the pre-save case, where recency is never rendered. */
const EPOCH = new Date(0);

interface AutomationHeaderProps {
  onBackToTable?: () => void;
  isAssistantActive?: boolean;
  onAskAiToggle?: () => void;
}

export function AutomationHeader({ onBackToTable, isAssistantActive, onAskAiToggle }: AutomationHeaderProps) {
  const {
    flow,
    editorIdentity,
    updateFlowName,
    setFlowActive,
    exportFlow,
    importFlowAsNew,
    saveAutomation,
    runAutomation,
    cancelExecution,
    isExecuting,
    lastExecutionId,
    showExecutionPanel,
    setShowExecutionPanel,
  } = useAutomation();
  const { extendedUser } = useUser();
  // Only a saved comment automation that replies can have drafts waiting; the
  // menu entry is hidden for everything else so it never reads as a dead item.
  const isCommentAutomation = isCommentAutomationFlow(flow.nodes);
  // Comment automations answer to the comment gate, which comment-only roles
  // (analysts, ADM-11300) pass; JSON import and flow templates stay on the
  // flow gate because they only ever produce flow automations.
  const canManageAutomations = canManageAutomationBySource(
    extendedUser?.role,
    isCommentAutomation ? "comment" : "flow",
  );
  const canManageFlowAutomations = canManageAutomationRules(extendedUser?.role);
  const [fullPreviewOpen, setFullPreviewOpen] = useQueryState("fullPreview", parseAsBoolean.withDefault(false));
  const [assistantOpen, setAssistantOpen] = useQueryState("assistant", parseAsBoolean.withDefault(false));
  // A comment automation's history is its own view on this page, not a sheet.
  const [, setView] = useQueryState("view", parseAsString.withDefault("table"));
  const assistantButtonActive = isAssistantActive ?? Boolean(assistantOpen);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showPendingReplies, setShowPendingReplies] = useState(false);
  const [showRunPages, setShowRunPages] = useState(false);
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(flow.name);
  const initialNameRef = useRef(flow.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Drives the "saved 2m ago" half of the identity line. Only this session's
  // saves are known, so it stays null until the user saves.
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [identityNow, setIdentityNow] = useState<Date | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<"waiting" | "pending" | "saving" | "saved" | "error">("waiting");
  const [autoSaveRetry, setAutoSaveRetry] = useState(0);
  const lastAutoSavedFingerprintRef = useRef<string | null>(null);
  const failedAutoSaveFingerprintRef = useRef<string | null>(null);

  const isEditorIdentityReady = editorIdentity.canMutate;
  const getExistingAutomationId = (): number | null => editorIdentity.existingRuleId;
  const commentPageCount = isCommentAutomation ? readCommentPageIdsFromFlow(flow.nodes).length : 0;
  const commentFingerprint = JSON.stringify({ name: flow.name, nodes: flow.nodes, accountId: flow.selectedAccountId });

  useEffect(() => {
    if (!isCommentAutomation || !canManageAutomations || !isEditorIdentityReady) return;
    if (lastAutoSavedFingerprintRef.current === null && editorIdentity.origin === "persisted") {
      lastAutoSavedFingerprintRef.current = commentFingerprint;
      setAutoSaveState("saved");
      return;
    }
    if (commentPageCount === 0) {
      setAutoSaveState("waiting");
      return;
    }
    if (commentFingerprint === lastAutoSavedFingerprintRef.current) {
      setAutoSaveState("saved");
      return;
    }
    if (commentFingerprint === failedAutoSaveFingerprintRef.current || isSaving) return;
    setAutoSaveState("pending");
    const timer = setTimeout(() => {
      setIsSaving(true);
      setAutoSaveState("saving");
      void saveAutomation({ mode: editorIdentity.existingRuleId === null ? "create" : "update", name: flow.name })
        .then((result) => {
          if (result.ok) {
            lastAutoSavedFingerprintRef.current = commentFingerprint;
            failedAutoSaveFingerprintRef.current = null;
            setSavedAt(new Date());
            setAutoSaveState("saved");
          } else {
            failedAutoSaveFingerprintRef.current = commentFingerprint;
            setAutoSaveState("error");
            toast.error(`Changes could not be saved: ${result.error}`);
          }
        })
        .finally(() => setIsSaving(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [autoSaveRetry, canManageAutomations, commentFingerprint, commentPageCount, editorIdentity.existingRuleId, editorIdentity.origin, flow.name, isCommentAutomation, isEditorIdentityReady, isSaving, saveAutomation]);

  // Run history used to be a grey button with no explanation on an unsaved
  // draft, which reads as broken rather than "there is nothing to show yet".
  // The controls stay clickable and say why instead.
  const runHistoryAvailability = getRunHistoryAvailability({
    existingRuleId: editorIdentity.existingRuleId,
    identityStatus: editorIdentity.status,
    identityError: editorIdentity.error,
  });
  const openRunHistory = (): void => {
    if (!runHistoryAvailability.isAvailable) {
      toast.info("Run history isn't available yet", { description: runHistoryAvailability.blockedReason ?? undefined });
      return;
    }
    // A comment automation's runs span every page rule in its group and read
    // far better full width, so they get a view of their own the URL can point
    // at. Flow automations keep the sheet: their history is a different source.
    if (isCommentAutomation) {
      void setView("history");
      return;
    }
    setShowHistoryPanel(true);
  };

  const runBlockers = useMemo(
    () => listBuilderBlockersFromFlow({ nodes: flow.nodes, selectedAccountId: flow.selectedAccountId }),
    [flow.nodes, flow.selectedAccountId],
  );
  // Which page(s) a comment rule watches so the History sheet can show it
  // above the run list, the same context execution-panel.tsx already leads
  // with — a rule's page selection doesn't vary per past run, so it only
  // needs to be stated once rather than repeated on every row.
  const commentRuleSummary = useMemo(
    () => (isCommentAutomationFlow(flow.nodes) ? buildCommentActionRuleSummary(flow.nodes) : null),
    [flow.nodes],
  );
  const primaryRunBlocker = runBlockers[0] ?? null;
  // Single source of truth for "is this automation runnable right now" —
  // gates the persistent Run button below.
  const canRun = isRunNowAvailable({
    nodes: flow.nodes,
    selectedAccountId: flow.selectedAccountId,
    canManageAutomations,
    canMutate: isEditorIdentityReady,
  });
  const commentActionType = actionEventToType(flow.nodes.find((node) => node.type === "action")?.event);
  const canReviewReplies =
    isCommentAutomation && commentActionType === "reply" && editorIdentity.existingRuleId !== null;
  const pendingReplyCount = useCommentPendingReplyCount(editorIdentity.existingRuleId, canReviewReplies);
  // Every per-page rule of this automation, so Run can offer a subset. Only
  // fetched for a saved comment automation — there is nothing to pick before.
  const commentMembers = useCommentAutomationMembers(
    isCommentAutomation ? editorIdentity.existingRuleId : null,
    isCommentAutomation && editorIdentity.existingRuleId !== null,
  );
  const runnablePages = commentMembers.data?.members ?? [];
  // One page needs no picker: plain Run already does exactly that.
  const canPickRunPages = isCommentAutomation && runnablePages.length > 1;

  const rejectStaleEditorAction = (): boolean => {
    if (isEditorIdentityReady) return false;
    toast.error(editorIdentity.error || "Automation is still loading. Try again in a moment.");
    return true;
  };

  // Check if this is an actively running recurring/polling automation
  const isActivelyRunning =
    flow.isActive && !!flow.frequency && ["hourly", "daily", "weekly", "monthly"].includes(flow.frequency);

  // Sync local name when flow.name changes externally
  useEffect(() => {
    setLocalName(flow.name);
    initialNameRef.current = flow.name;
  }, [flow.name]);

  // Re-tick the "saved 2m ago" clock. Reading the clock on the client only
  // (never during render) keeps the server and first client paint identical.
  useEffect(() => {
    if (!savedAt) return;
    setIdentityNow(new Date());
    const interval = setInterval(() => setIdentityNow(new Date()), IDENTITY_LINE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [savedAt]);

  const identityLine = buildBuilderIdentityLine({
    ruleId: getExistingAutomationId(),
    savedAt: identityNow ? savedAt : null,
    now: identityNow ?? savedAt ?? EPOCH,
  });

  // Check if name has been modified - show buttons whenever name changes
  const isNameModified = localName !== initialNameRef.current && localName.trim() !== "";

  const handleSaveName = async () => {
    if (!isNameModified) return;
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    if (isCommentAutomation) {
      const nextName = localName.trim();
      initialNameRef.current = nextName;
      updateFlowName(nextName);
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const result = await saveAutomation({ mode: "update", name: localName });
      if (!result.ok) {
        toast.error(result.error);
        setLocalName(initialNameRef.current); // Revert on error
        return;
      }

      setLocalName(result.name);
      initialNameRef.current = result.name;
      setSavedAt(new Date());
      setIsEditingName(false);
      toast.success(`${result.name} saved`);
      if (result.warning) toast.warning(result.warning);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setLocalName(initialNameRef.current);
    setIsEditingName(false);
  };

  const handleStartEditingName = () => {
    if (!canManageAutomations || !isEditorIdentityReady) return;
    setIsEditingName(true);
  };

  const handleNameInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSaveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelName();
    }
  };

  // Comment names join the automatically saved draft on blur. Other flow
  // automations retain their explicit name confirmation controls.
  const handleNameInputBlur = () => {
    if (isCommentAutomation) {
      if (isNameModified) void handleSaveName();
      else setIsEditingName(false);
      return;
    }
    if (!isNameModified) {
      setIsEditingName(false);
    }
  };

  const handleExport = () => {
    const json = exportFlow();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Automation exported");
  };

  const handleImport = () => {
    if (!canManageFlowAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = event.target?.result as string;
            importFlowAsNew(json);
            toast.success("Automation imported");
          } catch {
            toast.error("Invalid JSON file format");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleCopyJSON = async () => {
    const json = exportFlow();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast.success("Copied to clipboard");
  };

  const handleLoadTemplate = (template: any) => {
    if (!canManageFlowAutomations) {
      toast.error("You do not have permission to manage automations", { position: "top-right" });
      return;
    }

    importFlowAsNew(JSON.stringify(template));
    toast.success(`${template.name} loaded`);
  };

  const handleSave = async () => {
    if (rejectStaleEditorAction()) return;
    const existingId = getExistingAutomationId();

    // If editing an actively running recurring automation, show warning dialog
    if (existingId !== null && isActivelyRunning) {
      setShowActiveWarning(true);
      return;
    }

    await performSave("update");
  };

  // Core save logic, used by handleSave, handleSaveAsNew, handlePauseAndSave
  // and handleRun. Returns whether the automation is persisted afterwards.
  const performSave = async (mode: "update" | "create"): Promise<boolean> => {
    if (rejectStaleEditorAction()) return false;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return false;
    }

    setIsSaving(true);
    try {
      const result = await saveAutomation({ mode, name: localName });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }

      setLocalName(result.name);
      initialNameRef.current = result.name;
      setSavedAt(new Date());
      toast.success(`${result.name} saved`);
      if (result.warning) toast.warning(result.warning);
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  // "Save as New" — creates a copy via POST, leaves the original running
  const handleSaveAsNew = async () => {
    setShowActiveWarning(false);
    await performSave("create");
  };

  // "Pause & Save" — pauses the original, then saves edits to it
  const handlePauseAndSave = async () => {
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    setShowActiveWarning(false);
    const existingId = getExistingAutomationId();
    if (existingId === null) return;

    try {
      // Pause the original automation first
      const pauseResponse = await fetch("/api/automation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existingId, status: "paused" }),
      });

      if (!pauseResponse.ok) {
        toast.error("Failed to pause automation");
        return;
      }

      // Update local state to reflect paused status
      setFlowActive(false);

      // Now save the edits to the same automation
      await performSave("update");
    } catch {
      toast.error("An error occurred while pausing");
    }
  };

  const handleRun = async () => {
    if (rejectStaleEditorAction()) return;
    if (!canManageAutomations) {
      toast.error("You do not have permission to run automations");
      return;
    }
    if (primaryRunBlocker) {
      toast.error(primaryRunBlocker);
      return;
    }

    // Run uses the current in-memory flow. Comment edits save automatically;
    // other recurring flow automations retain their explicit save behavior.
    if (isActivelyRunning) {
      setShowExecutionPanel(true);
      await runAutomation();
      return;
    }

    setShowExecutionPanel(true);
    await runAutomation();
  };

  return (
    <>
      <header className="border-b border-border bg-card">
        {/* Identity on the left, one action cluster on the right */}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 md:px-6 md:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {onBackToTable && (
              <Button
                onClick={onBackToTable}
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                title="Back to all automations"
                aria-label="Back to all automations"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-2">
                {isEditingName ? (
                  <Input
                    ref={nameInputRef}
                    autoFocus
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onKeyDown={handleNameInputKeyDown}
                    onBlur={handleNameInputBlur}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-8 min-w-0 flex-1 border-primary bg-background px-1.5 text-[17px] font-bold tracking-[-0.01em] shadow-none ring-2 ring-primary/20 sm:max-w-sm"
                    placeholder="Automation name"
                    aria-label="Automation name"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditingName}
                    disabled={!canManageAutomations || !isEditorIdentityReady}
                    className={cn(
                      "group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors",
                      canManageAutomations && isEditorIdentityReady && "hover:bg-muted/40",
                    )}
                    title={
                      canManageAutomations && isEditorIdentityReady
                        ? "Click to rename this automation"
                        : "Automation name"
                    }
                    aria-label={
                      canManageAutomations && isEditorIdentityReady ? `Rename automation: ${localName}` : undefined
                    }
                  >
                    <span className="truncate text-[17px] font-bold tracking-[-0.01em]">{localName}</span>
                    {canManageAutomations && isEditorIdentityReady && (
                      <Pencil
                        aria-hidden="true"
                        className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      />
                    )}
                  </button>
                )}
                {isNameModified && !isCommentAutomation && (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <Button
                      onClick={handleSaveName}
                      disabled={isSavingName || !canManageAutomations || !isEditorIdentityReady}
                      size="sm"
                      className="h-7 gap-1.5 whitespace-nowrap bg-green-600 px-2.5 text-white hover:bg-green-700"
                      title="Save name"
                    >
                      {isSavingName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden text-xs font-medium sm:inline">Save</span>
                    </Button>
                    <Button
                      onClick={handleCancelName}
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 whitespace-nowrap border-red-300 px-2.5 text-red-600 hover:border-red-400 hover:bg-red-50"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="hidden text-xs font-medium sm:inline">Cancel</span>
                    </Button>
                  </div>
                )}
              </div>
              <span className="truncate px-1.5 font-mono text-[11px] text-muted-foreground" role="status">
                {isCommentAutomation
                  ? autoSaveState === "waiting" ? "Choose a page to start · changes save automatically"
                    : autoSaveState === "pending" ? "Changes saving shortly…"
                      : autoSaveState === "saving" ? "Saving changes…"
                        : autoSaveState === "error" ? "Changes not saved"
                          : `${getExistingAutomationId() !== null ? `#${getExistingAutomationId()} · ` : ""}Changes saved automatically`
                  : identityLine}
              </span>
              {isCommentAutomation && autoSaveState === "error" && (
                <button type="button" className="self-start px-1.5 text-xs font-medium text-primary underline" onClick={() => {
                  failedAutoSaveFingerprintRef.current = null;
                  setAutoSaveRetry((value) => value + 1);
                }}>Retry</button>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Ask AI — toggles the MCP assistant dock */}
            <Button
              onClick={() => {
                if (onAskAiToggle) {
                  onAskAiToggle();
                  return;
                }
                setAssistantOpen(assistantOpen ? null : true);
              }}
              // An outlined assistant control keeps Run as the main action.
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              // The open/closed state is still announced, just not painted.
              aria-pressed={assistantButtonActive}
              title="Ask the AI assistant"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden lg:inline">Ask AI</span>
            </Button>
            {!isCommentAutomation && <Button
              onClick={handleSave}
              disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              title="Save this automation"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
            </Button>}

            {/* Run — the only filled button. The caret carries the run variants. */}
            {isExecuting ? (
              <div className="flex items-center gap-2">
                <Button onClick={() => setShowExecutionPanel(true)} size="sm" variant="outline" className="h-8 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Running...</span>
                </Button>
                <Button onClick={cancelExecution} size="sm" variant="destructive" className="h-8 gap-2">
                  <Ban className="h-4 w-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
                <Button
                  onClick={openRunHistory}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  title={getRunHistoryTitle(runHistoryAvailability)}
                  aria-label="Run history"
                  aria-disabled={!runHistoryAvailability.isAvailable}
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-stretch overflow-hidden rounded-md">
                <Button
                  onClick={handleRun}
                  size="sm"
                  className="h-8 gap-2 rounded-none rounded-l-md"
                  disabled={!canRun}
                  title={primaryRunBlocker ?? "Run this automation now"}
                >
                  <Play className="h-4 w-4" />
                  Run
                </Button>
                <span className="w-px bg-primary-foreground/30" aria-hidden="true" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 w-7 rounded-none rounded-r-md p-0"
                      disabled={!canRun}
                      title={primaryRunBlocker ?? "More run options"}
                      aria-label="More run options"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleRun} disabled={!canRun}>
                      <Play className="mr-2 h-4 w-4" />
                      {canPickRunPages ? `Run on all ${runnablePages.length} pages` : "Run now"}
                    </DropdownMenuItem>
                    {canPickRunPages && (
                      <DropdownMenuItem onClick={() => setShowRunPages(true)} disabled={!canRun}>
                        <Layers className="mr-2 h-4 w-4" />
                        Run on selected pages…
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      data-testid="header-full-preview"
                      onClick={() => setFullPreviewOpen(fullPreviewOpen ? null : true)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {fullPreviewOpen ? "Hide full preview" : "Preview without running"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowExecutionPanel(true)}
                      disabled={lastExecutionId === null && !isExecuting}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      View last run
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openRunHistory} title={getRunHistoryTitle(runHistoryAvailability)}>
                      <History className="mr-2 h-4 w-4" />
                      <span className="flex min-w-0 flex-col">
                        <span>Run history</span>
                        {runHistoryAvailability.blockedReason ? (
                          <span className="text-xs text-muted-foreground">{runHistoryAvailability.blockedReason}</span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Everything else — Preview and Notifications were pulling
                weight they don't deserve in the top bar. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={openRunHistory} title={getRunHistoryTitle(runHistoryAvailability)}>
                  <History className="mr-2 h-4 w-4" />
                  <span className="flex min-w-0 flex-col">
                    <span>Run history</span>
                    {runHistoryAvailability.blockedReason ? (
                      <span className="text-xs text-muted-foreground">{runHistoryAvailability.blockedReason}</span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFullPreviewOpen(fullPreviewOpen ? null : true)}
                  disabled={flow.nodes.length === 0}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {fullPreviewOpen ? "Hide full preview" : "Full preview"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowNotificationSettings(true)}>
                  <Bell className="mr-2 h-4 w-4" />
                  Notification settings
                </DropdownMenuItem>
                {canReviewReplies && (
                  <DropdownMenuItem onClick={() => setShowPendingReplies(true)}>
                    <MessageSquareDot className="mr-2 h-4 w-4" />
                    Review replies
                    {pendingReplyCount !== null && pendingReplyCount > 0 && (
                      <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {pendingReplyCount.toLocaleString("en-US")}
                      </span>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setShowImportExport(true)} disabled={!canManageFlowAutomations}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Import/Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyJSON}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied!" : "Copy JSON"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImport} disabled={!canManageFlowAutomations}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Load Template</DropdownMenuLabel>
                {automationTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleLoadTemplate(template)}
                    disabled={!canManageFlowAutomations}
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    {template.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Context bar — account, size, blocker and the on/off switch */}
        <BuilderContextBar />
      </header>

      <ExecutionPanel open={showExecutionPanel} onOpenChange={setShowExecutionPanel} />
      <ImportExportDialog open={showImportExport} onOpenChange={setShowImportExport} />
      <AutomationHistorySheet
        open={showHistoryPanel}
        onOpenChange={setShowHistoryPanel}
        automationRuleId={getExistingAutomationId()}
        automationName={flow.name}
        isCommentAutomation={isCommentAutomationFlow(flow.nodes)}
        commentActionType={commentActionType}
        commentRuleSummary={commentRuleSummary}
      />
      <NotificationSettingsSheet open={showNotificationSettings} onOpenChange={setShowNotificationSettings} />
      <RunPagesDialog
        open={showRunPages}
        onOpenChange={setShowRunPages}
        members={runnablePages}
        isStarting={isExecuting}
        onRun={(ruleIds) => {
          setShowRunPages(false);
          setShowExecutionPanel(true);
          void runAutomation({ ruleIds });
        }}
      />
      <CommentPendingRepliesSheet
        open={showPendingReplies}
        onOpenChange={setShowPendingReplies}
        automationRuleId={editorIdentity.existingRuleId}
        automationName={flow.name}
      />

      {/* Active automation warning dialog */}
      <AlertDialog open={showActiveWarning} onOpenChange={setShowActiveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Editing Active Automation
            </AlertDialogTitle>
            <AlertDialogDescription>
              This automation is currently running on a <strong>{flow.frequency}</strong> schedule. How would you like
              to save your changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleSaveAsNew} variant="outline" disabled={isSaving || !isEditorIdentityReady}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Save as New
            </Button>
            <Button onClick={handlePauseAndSave} disabled={isSaving || !canManageAutomations || !isEditorIdentityReady}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Pause &amp; Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
