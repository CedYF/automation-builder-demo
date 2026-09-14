"use client";
import { useCallback, useMemo, useState } from "react";
import { FlowBuilder } from "./components/flow-builder";
import { AutomationHeader } from "./components/automation-header";
import { AutomationHome } from "./components/automation-home";
import { AutomationChatTab } from "./components/automation-chat-tab";
import { AutomationProvider } from "./contexts/automation-context";
import { AutomationsTable } from "./components/automations-table";
import { AutomationHistory } from "./components/automation-history";
import { PendingApprovalsTab } from "./components/pending-approvals-tab";
import { ActiveAutomationsTab } from "./components/active-automations-tab";
import { YouTubeUploadQueuePanel } from "./components/youtube-upload-queue-panel";
import { AutomationTemplatesTab } from "./components/automation-templates-tab";
import { NotificationApprovalHistory } from "./components/notification-approval-history";
import { RateLimitBanner } from "./components/rate-limit-banner";
import { AutomationTrialBanner } from "./components/automation-trial-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatHomeHeaderSummary, type HomeHeaderCounts } from "./lib/home-labels";
import { AUTOMATION_TEMPLATES } from "./lib/automation-templates";
import { AUTOMATION_TAB_CHAT, listAutomationTabsForScope, resolveAutomationTabForScope } from "./lib/automation-tabs";
import { HOME_SHELL_PADDING_CLASS, homeTabContentClass } from "./lib/home-shell-layout";
import { CreateAutomationMenu } from "./components/create-automation-menu";
import { CommentAutomationHistoryView } from "./_features/comment-automation";
import { parseCommentAutomationId } from "@/lib/automation/editor-identity";
import { useQueryState, parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";
import { ArrowLeft, Lock, Plus, Search } from "lucide-react";
import { useUser } from "@/lib/providers/user-provider";
import { resolveAutomationAccessScope } from "@/lib/automation/automation-access";

/**
 * Reachable from Home, but kept out of the strip so the primary tabs stay put.
 *
 * `active` keeps the only surface that can cancel a pending delayed execution —
 * the Home list reports the countdown but does not own that action.
 */
const SECONDARY_TAB_LABELS: Readonly<Record<string, string>> = {
  all: "All automations",
  approvals: "Approvals queue",
  active: "Active & delayed",
};

const EMPTY_HOME_COUNTS: HomeHeaderCounts = { total: 0, running: 0, needsYou: 0 };

export default function Home() {
  const [view, setView] = useQueryState("view", parseAsString.withDefault("table"));
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedAutomationId, setSelectedAutomationId] = useQueryState("automationId", parseAsString);
  const [requestedTab, setActiveTab] = useQueryState("tab", parseAsString.withDefault("automations"));
  const [historyId, setHistoryId] = useQueryState("historyId", parseAsInteger);
  const [assistantOpen, setAssistantOpen] = useQueryState("assistant", parseAsBoolean.withDefault(false));
  const [assistantSeed, setAssistantSeed] = useQueryState("assistantSeed", parseAsString);
  const [assistantSeedMode, setAssistantSeedMode] = useQueryState("assistantSeedMode", parseAsString);
  const [automationRuleId, setAutomationRuleId] = useQueryState("automationRuleId", parseAsInteger);
  // Live totals for the page header, reported up by the Home list. The header no
  // longer polls its own counts: the Home payload already resolves every state.
  const [homeCounts, setHomeCounts] = useState<HomeHeaderCounts>(EMPTY_HOME_COUNTS);

  // Launchers and drafters are blocked from the Automations area (ADM-8415);
  // analysts and commenters reach the comment-only slice of it (ADM-11300). The
  // scope is permissive while the role is still loading, so this never flashes
  // the access-denied screen before the real role resolves.
  const { extendedUser } = useUser();
  const accessScope = resolveAutomationAccessScope(extendedUser?.role);
  const canView = accessScope !== "none";
  const isCommentsOnly = accessScope === "comments-only";
  const visibleTabs = listAutomationTabsForScope(accessScope);
  // A deep link to a hidden tab lands on Home rather than an empty flow surface.
  const activeTab = resolveAutomationTabForScope(requestedTab, accessScope);

  const handleOpenAutomation = useCallback(
    (id: number | string) => {
      setSelectedAutomationId(String(id));
      setView("builder");
    },
    [setSelectedAutomationId, setView],
  );

  const handleBackToTable = () => {
    setView("table");
    setSelectedAutomationId(null);
    setHistoryId(null);
    setAssistantOpen(null);
    setAssistantSeed(null);
    setAssistantSeedMode(null);
  };

  // Composer submit → open a fresh builder with the assistant dock, seeded with the goal.
  // "suggest" chips ask the assistant to scan the account and recommend automations first.
  const handleBuildWithAi = useCallback(
    (goal: string, mode?: "suggest" | "build") => {
      setSelectedAutomationId("new");
      setAssistantSeed(goal);
      setAssistantSeedMode(mode === "suggest" ? "suggest" : null);
      setAssistantOpen(true);
      setView("builder");
    },
    [setSelectedAutomationId, setAssistantSeed, setAssistantSeedMode, setAssistantOpen, setView],
  );

  const handleCreate = () => {
    setSelectedAutomationId("new");
    setView("builder");
  };

  const goToTab = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      setHistoryId(null);
      setAutomationRuleId(null);
    },
    [setActiveTab, setHistoryId, setAutomationRuleId],
  );

  const headerSummary = useMemo(() => formatHomeHeaderSummary(homeCounts), [homeCounts]);
  const secondaryTabLabel = SECONDARY_TAB_LABELS[activeTab] ?? null;
  // Only Home runs the fixed-height shell: every other tab renders content of
  // unknown length and needs the page scroller.
  const isHomeTab = activeTab === "automations";

  // Parse automationId - could be numeric or "new"
  const parsedAutomationId = selectedAutomationId
    ? selectedAutomationId === "new"
      ? "new"
      : isNaN(Number(selectedAutomationId))
        ? selectedAutomationId
        : Number(selectedAutomationId)
    : null;
  const handleAutomationIdChange = useCallback(
    (id: number | string | null) => setSelectedAutomationId(id == null ? null : String(id)),
    [setSelectedAutomationId],
  );

  // Run history is a view of its own rather than a dialog over the builder, so
  // it survives a reload, can be linked to and reads at full page width. Only
  // comment automations have one: a flow automation's history is the Prisma
  // sheet the builder header still opens.
  const commentHistoryRuleId = view === "history" ? parseCommentAutomationId(selectedAutomationId) : null;
  // A flow automation has no comment history, so a stale `view=history` URL for
  // one lands on its builder rather than on the Home shell with a dangling id.
  // With no automation at all there is nothing to build or show: that falls
  // back to the Home table instead of an empty builder.
  const showBuilder = view === "builder" || (view === "history" && selectedAutomationId !== null);

  if (!canView) {
    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col items-center justify-center bg-background px-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Automations are not available for your role</h2>
          <p className="text-sm text-muted-foreground">
            Your current role does not include access to Automations. Contact an admin or editor on your team if you
            need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AutomationProvider automationId={parsedAutomationId} onAutomationIdChange={handleAutomationIdChange}>
      <div className="flex h-[calc(100vh-1rem)] flex-col bg-background">
        {commentHistoryRuleId !== null ? (
          <CommentAutomationHistoryView ruleId={commentHistoryRuleId} onBack={() => setView("builder")} />
        ) : !showBuilder ? (
          <div className="flex h-full flex-col">
            {/* Rate-limit warning banner (current workspace) */}
            <div className="space-y-3 px-4 pt-4 empty:hidden md:px-8 md:pt-6">
              <AutomationTrialBanner />
              <RateLimitBanner />
            </div>

            {/* Page title, live state summary and the primary Create action */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Automate</h1>
                <p className="text-sm text-muted-foreground">{headerSummary}</p>
              </div>
              <div className="flex items-center gap-2">
                {isCommentsOnly ? (
                  // Comment automations start from a recipe (they need a page
                  // before they can persist); the AI composer and the blank
                  // canvas only produce flow automations this role cannot save.
                  <Button type="button" onClick={() => goToTab("templates")} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Create
                  </Button>
                ) : (
                  <CreateAutomationMenu
                    onSubmitGoal={handleBuildWithAi}
                    onBrowseTemplates={() => goToTab("templates")}
                    onStartBlank={handleCreate}
                    templateCount={AUTOMATION_TEMPLATES.length}
                  />
                )}
              </div>
            </div>

            {/* Underlined tab strip */}
            <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 md:px-8">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => goToTab(tab.value)}
                  className={cn(
                    "whitespace-nowrap px-3.5 pb-3 text-sm transition-colors",
                    activeTab === tab.value
                      ? "font-semibold text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              {secondaryTabLabel && (
                <span className="whitespace-nowrap px-3.5 pb-3 text-sm font-semibold text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]">
                  {secondaryTabLabel}
                </span>
              )}
              {activeTab === "templates" && (
                <div className="relative ml-auto mb-2 w-48 shrink-0 md:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="h-8 pl-8 text-sm"
                    aria-label="Search templates"
                  />
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className={homeTabContentClass(isHomeTab)}>
              {activeTab === "automations" ? (
                <div className={HOME_SHELL_PADDING_CLASS}>
                  <AutomationHome
                    onOpenAutomation={handleOpenAutomation}
                    onSubmitGoal={handleBuildWithAi}
                    onBrowseTemplates={() => goToTab("templates")}
                    onCountsChange={setHomeCounts}
                  />
                </div>
              ) : activeTab === AUTOMATION_TAB_CHAT ? (
                <div className="px-4 md:px-8">
                  <AutomationChatTab onSubmitGoal={handleBuildWithAi} onBrowseTemplates={() => goToTab("templates")} />
                </div>
              ) : activeTab === "templates" ? (
                <AutomationTemplatesTab onUseTemplate={(id) => handleOpenAutomation(id)} searchQuery={templateSearch} />
              ) : activeTab === "queue" ? (
                <div className={HOME_SHELL_PADDING_CLASS}>
                  <YouTubeUploadQueuePanel showEmptyState />
                </div>
              ) : activeTab === "notifications" ? (
                <NotificationApprovalHistory
                  automationRuleId={automationRuleId}
                  onClearAutomationRuleId={() => setAutomationRuleId(null)}
                />
              ) : secondaryTabLabel ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="px-4 pt-4 md:px-8">
                    <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => goToTab("automations")}>
                      <ArrowLeft className="h-4 w-4" />
                      Back to Home
                    </Button>
                  </div>
                  {activeTab === "all" ? (
                    <AutomationsTable callbacks={{ onOpenAutomation: handleOpenAutomation }} />
                  ) : activeTab === "approvals" ? (
                    <PendingApprovalsTab />
                  ) : (
                    <ActiveAutomationsTab onOpenAutomation={handleOpenAutomation} />
                  )}
                </div>
              ) : (
                <AutomationHistory
                  selectedHistoryId={historyId}
                  onClearHistoryId={() => setHistoryId(null)}
                  automationRuleId={automationRuleId}
                  onClearAutomationRuleId={() => setAutomationRuleId(null)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <AutomationHeader onBackToTable={handleBackToTable} />
            <div className="flex flex-1 overflow-hidden min-h-0">
              <main className="flex-1 overflow-hidden min-h-0">
                <FlowBuilder
                  assistantOpen={Boolean(assistantOpen)}
                  onAssistantOpenChange={(open) => setAssistantOpen(open ? true : null)}
                  assistantSeed={assistantSeed}
                  assistantSeedMode={assistantSeedMode === "suggest" ? "suggest" : "build"}
                  onAssistantSeedConsumed={() => {
                    setAssistantSeed(null);
                    setAssistantSeedMode(null);
                  }}
                />
              </main>
            </div>
          </div>
        )}
      </div>
    </AutomationProvider>
  );
}
