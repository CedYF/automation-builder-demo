"use client";

import { useState, useEffect } from "react";
import { type AutomationNode, useAutomation } from "../contexts/automation-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getServiceInfo } from "../lib/service-icons";
import { useUser } from "@/lib/providers/user-provider";
import { useIsEssentialAutomationPlan } from "@/lib/automation/use-essential-automation-plan";
import {
  ESSENTIAL_PLAN_META_TRIGGER_EVENT,
  isTriggerServiceAllowedOnEssentialPlan,
} from "@/lib/automation/essential-plan-automation-access";
import { useQueryState, parseAsString } from "nuqs";
import Image from "next/image";
import { StepPreview } from "./step-preview";
import { DemoCommentPreview } from "./config-sections/comments-demo-config";
import { TikTokDuplicationCompatAlert } from "./tiktok-duplication-compat-alert";
import { PerformanceThresholdPreview } from "./performance-threshold-preview";
import { TikTokPerformanceThresholdPreview } from "./tiktok-performance-threshold-preview";
import { PerformanceMonitoringPreview } from "./performance-monitoring-preview";
import { NotificationPreview } from "./notification-preview";
import { DuplicateAdPreview } from "./duplicate-ad-preview";
import { DuplicateSourcePreview } from "./duplicate-source-preview";
import { CrossChannelLaunchPreview } from "./cross-channel-launch-preview";
import { TriggerOutputSummary } from "./trigger-output-summary";
import { NOTION_AUTOMATION_TRIGGER } from "@/lib/integrations/notion/automation-trigger";

// Import extracted config sections
import {
  ManualTriggerConfig,
  MediaLibraryTriggerConfig,
  GoogleDriveTriggerConfig,
  MetaAdsActionConfig,
  DynamicTemplateAdsConfig,
  MetaAdsPerformanceThresholdConfig,
  BestOrganicPostConfig,
  GoogleSheetsTriggerConfig,
  GoogleSheetsLaunchConfig,
  GoogleSheetsCatalogConfig,
  GoogleSheetsActionConfig,
  GoogleSheetsUpdateRowConfig,
  GoogleDriveActionConfig,
  BoxTriggerConfig,
  DropboxTriggerConfig,
  SharePointTriggerConfig,
  AirTriggerConfig,
  FrameioTriggerConfig,
  NotionStatusTriggerConfig,
  AdscanCompetitorAdConfig,
  AdscanAdvertiserLaunchVolumeConfig,
  HubSpotTriggerConfig,
  FilterConfig,
  TimerConfig,
  DelayConfig,
  TestTab,
  ApplyRuleConfig,
  RuleConditionTriggerConfig,
  SetMinimumSpendConfig,
  ApprovalStepConfig,
  AdApprovedConfig,
  CampaignStatusChangeConfig,
  AdLaunchedConfig,
  CrossChannelLaunchConfig,
  PerformanceMonitoringConfig,
  WebhookConfig,
  TikTokPerformanceThresholdConfig,
  TikTokNewAuthorizedPostConfig,
  TikTokActionConfig,
  SnapchatPerformanceThresholdConfig,
  SnapchatActionConfig,
  NotificationActionConfig,
  GoogleAdsLaunchConfig,
  GoogleAdsPerformanceThresholdConfig,
  GoogleAdsActionConfig,
  ReportActionConfig,
  MediaLibraryUploadConfig,
  CommentsTriggerConfig,
  CommentsActionConfig,
} from "./config-sections";
import { isMetaTargetAdSetMissing } from "./config-sections/target-ad-set-validation";

const events = {
  "media-library": {
    trigger: ["Media Uploaded to Board"],
    action: ["Upload to Media Library"],
  },
  "google-sheets": {
    trigger: ["Cell Value Changed", "New Rows to Launch", "New Rows to Catalog"],
    action: ["Add Row", "Update Cell", "Update Row"],
  },
  "google-drive": {
    trigger: ["New File in Folder", "New Folder in Folder"],
    action: ["Read File Metadata", "Download File", "Move File"],
  },
  dropbox: {
    trigger: ["New File in Folder"],
  },
  sharepoint: {
    trigger: ["New File in Folder"],
  },
  air: {
    trigger: ["New Asset in Board"],
  },
  frameio: {
    trigger: ["New File in Project"],
  },
  notion: {
    trigger: [NOTION_AUTOMATION_TRIGGER.event],
  },
  adscan: {
    trigger: ["New Competitor Ad", "Advertiser Launch Volume"],
  },
  "meta-ads": {
    trigger: [
      "Ad Approved",
      "Campaign Status Change",
      "Performance Monitoring",
      "Performance Threshold",
      "Best Performing Organic Post",
    ],
    action: [
      "Duplicate Campaign",
      "Duplicate Ad Set",
      "Duplicate Ad",
      "Pause Ad",
      "Pause Campaign",
      "Pause Ad Set",
      "Enable Ad",
      "Enable Campaign",
      "Enable Ad Set",
      "Launch Ad",
      "Duplicate Ad Set from Sheet Row",
      "Prepare Dynamic Ad Set from Sheet Row",
      "Create Media from Templates",
      "Create Dynamic Media from Templates",
      "Launch Template Ads",
      "Create Media + Launch Ads from Templates",
      "Swap Creative from Shortlist",
      "Create Rule",
      "Toggle Rule",
      "Update Rule",
      "Change Budget",
      "Apply Existing Rule",
      "Set Minimum Spend",
    ],
  },
  "facebook-rules": {
    trigger: ["Rule Condition Check"],
  },
  app: {
    trigger: ["Ad Launched via the app"],
  },
  comments: {
    trigger: ["New Comment", "Scheduled", "Manual Run"],
    action: ["Hide Comment", "Delete Comment", "Reply to Comment", "Like Comment", "Export to Google Sheet"],
  },
  // box: {
  //   trigger: ["New File in Folder"],
  //   action: ["Upload File", "Download File", "Move File"],
  // },
  // hubspot: {
  //   trigger: ["New Contact Created", "Deal Updated"],
  //   action: ["Create Contact", "Update Deal", "Add to List"],
  // },
  "tiktok-ads": {
    trigger: ["Performance Threshold", "New Authorized Post"],
    action: [
      "Launch on TikTok",
      "Pause Ad",
      "Enable Ad",
      "Pause Ad Group",
      "Enable Ad Group",
      "Pause Campaign",
      "Enable Campaign",
      "Change Budget",
      "Push Creatives to Ad Group",
      "Duplicate Campaign",
      "Duplicate Ad Group",
    ],
  },
  "snapchat-ads": {
    trigger: ["Performance Threshold"],
    action: ["Launch on Snapchat", "Pause Ad"],
  },
  "pinterest-ads": {
    action: ["Launch on Pinterest"],
  },
  "axon-ads": {
    action: ["Launch on Axon"],
  },
  "google-ads": {
    trigger: ["Performance Threshold"],
    action: [
      "Launch on Google Ads",
      "Pause Campaign",
      "Enable Campaign",
      "Pause Ad Group",
      "Enable Ad Group",
      "Change Budget",
      "Update Target CPA/ROAS",
    ],
  },
  webhook: {
    action: ["Send Webhook"],
  },
  notification: {
    action: ["Send Notification"],
  },
  report: {
    action: ["Generate Report Link"],
  },
  scheduled: {
    trigger: ["Scheduled Run"],
  },
  manual: {
    trigger: ["Manual Trigger"],
  },
  condition: {
    filter: ["If/Else Condition"],
  },
  timer: {
    action: ["Schedule at Date/Time"],
  },
  delay: {
    action: ["Wait for Duration"],
  },
  approval: {
    approval: ["Approval Required"],
  },
};

function getAvailableEventsForNode(serviceKey: string | undefined, nodeType: AutomationNode["type"]): string[] {
  if (!serviceKey || !(serviceKey in events)) return [];
  const svc = events[serviceKey as keyof typeof events];
  if (nodeType === "trigger" && "trigger" in svc) return [...svc.trigger];
  if (nodeType === "action" && "action" in svc) return [...svc.action];
  if (nodeType === "filter" && "filter" in svc) return [...svc.filter];
  if (nodeType === "approval" && "approval" in svc) return [...svc.approval];
  return [];
}

function isHunchTemplateEvent(event: string | undefined): boolean {
  return (
    event === "Duplicate Ad Set from Sheet Row" ||
    event === "Prepare Dynamic Ad Set from Sheet Row" ||
    event === "Create Media from Templates" ||
    event === "Create Dynamic Media from Templates" ||
    event === "Launch Template Ads" ||
    event === "Create Media + Launch Ads from Templates"
  );
}

interface ConfigPanelCallbacks {
  onClose: () => void;
  onContinue?: (nextNodeId: string) => void;
}

interface ConfigPanelProps {
  node: AutomationNode | null;
  callbacks: ConfigPanelCallbacks;
}

export function ConfigPanel({ node, callbacks }: ConfigPanelProps) {
  const { onClose } = callbacks;
  const { updateNode, flow, editorIdentity } = useAutomation();
  const { currentWorkspace } = useUser();
  const isEssentialPlan = useIsEssentialAutomationPlan();
  const [panelTab, setPanelTab] = useQueryState("panel", parseAsString.withDefault("setup"));
  const [service, setService] = useState(node?.service || "");
  const [event, setEvent] = useState(node?.event || "");
  const [config, setConfig] = useState(node?.config || {});
  const nodeId = node?.id;
  const activeTab: "setup" | "preview" = panelTab === "preview" ? "preview" : "setup";
  const setActiveTab = (t: "setup" | "preview") => setPanelTab(t === "setup" ? null : t);
  const [currentNodeId, setCurrentNodeId] = useState(node?.id || "");
  // Short skeleton window while child selectors (ad accounts, campaigns) boot up,
  // so users don't see the content shift as each piece mounts.
  const [isHydrating, setIsHydrating] = useState(true);

  // Push local edits into flow state. Depend only on local state — not the `node`
  // prop reference — or every updateNode() would recreate the node object and
  // retrigger this effect in an infinite loop (Maximum update depth exceeded).
  useEffect(() => {
    if (nodeId && nodeId === currentNodeId && (service || event || Object.keys(config).length > 0)) {
      updateNode(nodeId, { service, event, config });
    }
  }, [service, event, config, nodeId, currentNodeId, updateNode]);

  // Re-arm the skeleton window whenever a different node is loaded into the panel.
  useEffect(() => {
    setIsHydrating(true);
    const timer = setTimeout(() => setIsHydrating(false), 220);
    return () => clearTimeout(timer);
  }, [node?.id]);

  // Load state when switching to a different node (react only to node id changes)
  useEffect(() => {
    if (node && node.id !== currentNodeId) {
      setCurrentNodeId(node.id);
      setService(node.service || "");
      setEvent(node.event || "");
      setConfig(node.config || {});
      // Don't force-reset the tab — respect the URL `panel` param so shareable
      // links like `&panel=preview` land directly in Preview.
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync when the selected node id changes
  }, [node?.id, currentNodeId]);

  // Pre-populate account ID from flow's selected account for meta-ads nodes
  // Only when accountId is truly unset (undefined/null), not when explicitly cleared to "" (All accounts)
  useEffect(() => {
    if (service === "meta-ads" && config.accountId == null && flow.selectedAccountId) {
      setConfig((prev) => ({
        ...prev,
        accountId: flow.selectedAccountId,
        accountName: flow.selectedAccountName,
      }));
    }
  }, [service, config.accountId, flow.selectedAccountId, flow.selectedAccountName]);

  // Auto-set event for services with only one option
  useEffect(() => {
    if (service === "manual" && !event) {
      setEvent("Manual Trigger");
    }
    if (service === "media-library" && !event && node?.type === "trigger") {
      setEvent("Media Uploaded to Board");
    }
    if (service === "media-library" && !event && node?.type === "action") {
      setEvent("Upload to Media Library");
    }
    // tiktok-ads and snapchat-ads now have multiple events, no auto-set
    if (service === "pinterest-ads" && !event) {
      setEvent("Launch on Pinterest");
    }
    if (service === "axon-ads" && !event) {
      setEvent("Launch on Axon");
    }
    // google-ads is multi-event since an earlier fix; default each node type to its
    // most common event rather than forcing the launch action on triggers too.
    if (service === "google-ads" && !event && node?.type === "trigger") {
      setEvent("Performance Threshold");
    }
    if (service === "google-ads" && !event && node?.type === "action") {
      setEvent("Launch on Google Ads");
    }
    if (service === "webhook" && !event) {
      setEvent("Send Webhook");
    }
    if (service === "notification" && !event) {
      setEvent("Send Notification");
    }
    if (service === "report" && !event) {
      setEvent("Generate Report Link");
    }
    if (service === "air" && !event && node?.type === "trigger") {
      setEvent("New Asset in Board");
    }
    if (service === "frameio" && !event && node?.type === "trigger") {
      setEvent("New File in Project");
    }
    if (service === NOTION_AUTOMATION_TRIGGER.service && !event && node?.type === "trigger") {
      setEvent(NOTION_AUTOMATION_TRIGGER.event);
    }
    if (service === "adscan" && node?.type === "trigger") {
      // Auto-migrate legacy rules persisted with the pre-an earlier fix event string so
      // the trigger picker resolves to a valid SelectItem and the saved rule
      // normalises on next save.
      if (!event || event === "New Competitor Ad Matches Filters") {
        setEvent("New Competitor Ad");
      }
    }
  }, [service, event, node?.type]);

  // Load default naming from Settings when ad account is selected
  useEffect(() => {
    async function loadNamingDefault() {
      if (config.accountId && !config.adNameTemplate && service === "meta-ads") {
        try {
          // Scope to the active workspace so the lookup doesn't fall back to the
          // user's persisted defaultWorkspaceId (which can diverge and 404).
          const params = new URLSearchParams({ businessId: config.accountId });
          if (currentWorkspace?.id) params.set("workspaceId", currentWorkspace.id);
          const res = await fetch(`/api/settings?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            if (data.naming) {
              setConfig((prev) => ({ ...prev, adNameTemplate: data.naming }));
            }
          }
        } catch (error) {
          console.error("Failed to load naming default:", error);
        }
      }
    }
    loadNamingDefault();
  }, [config.accountId, service, currentWorkspace?.id]);

  // Essential / Starter: only Meta Ads → Performance Monitoring for triggers
  useEffect(() => {
    if (isEssentialPlan && node?.type === "trigger" && service === "meta-ads" && !event) {
      setEvent(ESSENTIAL_PLAN_META_TRIGGER_EVENT);
    }
  }, [isEssentialPlan, node?.type, service, event]);

  useEffect(() => {
    if (
      isEssentialPlan &&
      node?.type === "trigger" &&
      service === "meta-ads" &&
      event &&
      event !== ESSENTIAL_PLAN_META_TRIGGER_EVENT
    ) {
      setEvent(ESSENTIAL_PLAN_META_TRIGGER_EVENT);
    }
  }, [isEssentialPlan, node?.type, service, event]);

  if (!node) {
    return null;
  }

  const rawAvailableEvents = getAvailableEventsForNode(service, node.type);
  const availableEvents =
    isEssentialPlan && node.type === "trigger" && service === "meta-ads"
      ? rawAvailableEvents.filter((e: string) => e === ESSENTIAL_PLAN_META_TRIGGER_EVENT)
      : rawAvailableEvents;

  const nodeIndex = flow.nodes.findIndex((n) => n.id === node.id) + 1;
  const currentService = getServiceInfo(service);

  // Find Google Sheets trigger node for data mappings
  const sheetsTriggerNode = flow.nodes.find((n) => n.type === "trigger" && n.service === "google-sheets");
  const sheetsDataMappings = (
    (sheetsTriggerNode?.config?.dataMappings || []) as {
      label: string;
      cell: string;
    }[]
  ).filter((m) => m.label);
  // hasSheetsTrigger: true for legacy triggers (with dataMappings) OR "New Rows to Launch" triggers (with sheetConfig)
  const hasSheetsTrigger =
    sheetsTriggerNode != null &&
    (sheetsDataMappings.length > 0 ||
      (sheetsTriggerNode.event === "New Rows to Launch" && !!sheetsTriggerNode.config?.spreadsheetId));

  // Helper function to render service icons
  const renderServiceIcon = (serviceInfo: ReturnType<typeof getServiceInfo>, size: "small" | "medium" = "medium") => {
    const iconType = serviceInfo.iconType || "emoji";
    const sizeClasses = size === "small" ? "h-5 w-5" : "h-5 w-5 md:h-6 md:w-6";

    if (iconType === "image") {
      return (
        <div className={`${sizeClasses} relative flex-shrink-0`}>
          <Image src={serviceInfo.icon} alt={serviceInfo.label} fill className="object-contain" />
        </div>
      );
    }
    return <span className={`text-lg ${size === "medium" ? "md:text-xl" : ""}`}>{serviceInfo.icon}</span>;
  };

  const stepTypeLabel =
    node.type === "trigger"
      ? "Trigger"
      : node.type === "action"
        ? "Action"
        : node.type === "filter"
          ? "Filter"
          : node.type === "delay"
            ? "Delay"
            : "Approval";
  const isCommentStep = service === "comments" && Boolean(event);
  const commentStepTitle = node.type === "trigger"
    ? event === "Scheduled scan" ? "Scan comments on a schedule" : event === "Manual Run" ? "Run on comments manually" : "When comments match"
    : event === "Delete Comment" ? "Delete comments"
      : event === "Reply to Comment" ? "Reply to comments"
        : event === "Like Comment" ? "Like comments"
          : event === "Export to Google Sheet" ? "Export comments" : "Hide comments";
  const stepSubtitle = isCommentStep
    ? node.type === "trigger"
      ? "Choose pages and set the rule, then preview which comments match"
      : ""
    : node.type === "trigger" ? "When does this step fire?" : "What happens when it fires?";

  // Footer CTA gating: an event must be chosen (except for services configured
  // without one), and Meta Launch/Duplicate Ad steps must have a target ad set.
  const eventMissing =
    !event &&
    service !== "media-library" &&
    service !== "google-drive" &&
    service !== "google-sheets" &&
    service !== "delay" &&
    service !== "approval" &&
    service !== "notification" &&
    service !== "report" &&
    service !== "manual";
  const targetAdSetMissing = isMetaTargetAdSetMissing(service, event, config);
  const commentPagesMissing = service === "comments" && node.type === "trigger" &&
    (!Array.isArray(config.pageIds) || config.pageIds.length === 0);
  const footerDisabled = eventMissing || targetAdSetMissing || commentPagesMissing || !editorIdentity.canMutate;

  return (
    <div className="flex h-full max-h-[85vh] flex-col border-l bg-card md:max-h-none">
      <div className="flex justify-center py-2 md:hidden">
        <div className="h-1 w-10 rounded-full bg-gray-300" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex items-center gap-2.5 md:gap-3">
          {service && renderServiceIcon(currentService, "medium")}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold md:text-[15px]">
              {isCommentStep ? commentStepTitle : `${nodeIndex}. ${event || node.event || stepTypeLabel}`}
            </h2>
            {stepSubtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{stepSubtitle}</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(["setup", "preview"] as const).map((t) => (
          <button
            key={t}
            data-testid={`config-panel-tab-${t}`}
            onClick={() => setActiveTab(t)}
            className={cn(
              "relative flex-1 px-1 py-2.5 text-xs font-medium capitalize transition-colors md:py-3 md:text-sm",
              activeTab === t ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
            {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
        {isHydrating && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-8 w-3/4" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {!isHydrating && activeTab === "setup" && (
          <div className="space-y-5">
            {/* Comment steps keep the single setup surface used in AdManage. */}
            {!isCommentStep && <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">App</Label>
              {service ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {renderServiceIcon(currentService, "medium")}
                    <span className="truncate text-sm font-medium">{currentService.label}</span>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                    onClick={() => {
                      setService("");
                      setEvent("");
                      setConfig({});
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted uppercase">{node.type}</span>
                    <p className="text-sm text-muted-foreground">Select an app:</p>
                  </div>
                  {isEssentialPlan && node.type === "trigger" && (
                    <p className="text-xs text-muted-foreground">
                      Essential plan includes Meta Ads Performance Monitoring only. Upgrade to In-house for Sheets,
                      Drive, TikTok, scheduled runs, and other triggers.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(events)
                      .filter((s) => {
                        const svcEvents = events[s as keyof typeof events];
                        if (node.type === "trigger") {
                          if (!("trigger" in svcEvents)) return false;
                          if (isEssentialPlan && !isTriggerServiceAllowedOnEssentialPlan(s)) return false;
                          return true;
                        }
                        if (node.type === "action") return "action" in svcEvents;
                        if (node.type === "filter") return "filter" in svcEvents;
                        if (node.type === "approval") return "approval" in svcEvents;
                        return false;
                      })
                      .map((s) => {
                        const svc = getServiceInfo(s);
                        return (
                          <button
                            key={s}
                            onClick={() => setService(s)}
                            className="flex items-center gap-2 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            {renderServiceIcon(svc, "small")}
                            <span className="text-sm font-medium">{svc.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>}

            {/* Event selector - hide for media-library, delay, google-drive, frameio, manual, and single-event action services */}
            {service &&
              service !== "media-library" &&
              service !== "delay" &&
              service !== "google-drive" &&
              service !== "frameio" &&
              service !== NOTION_AUTOMATION_TRIGGER.service &&
              service !== "manual" &&
              service !== "pinterest-ads" &&
              service !== "axon-ads" &&
              service !== "webhook" &&
              service !== "notification" &&
              service !== "report" &&
              service !== "comments" &&
              service !== "approval" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {node.type === "trigger"
                      ? "Trigger event"
                      : node.type === "action"
                        ? "Action event"
                        : "Filter condition"}
                  </Label>
                  <Select value={event ?? ""} onValueChange={(v) => setEvent(v)}>
                    <SelectTrigger className="h-10 text-sm md:h-10">
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.map((e: string) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {/* Generic Account section - for services without special handling */}
            {service &&
              service !== "meta-ads" &&
              service !== "scheduled" &&
              service !== "delay" &&
              service !== "media-library" &&
              service !== "google-sheets" &&
              service !== "google-drive" &&
              service !== "dropbox" &&
              service !== "sharepoint" &&
              service !== "air" &&
              service !== "frameio" &&
              service !== NOTION_AUTOMATION_TRIGGER.service &&
              service !== "adscan" &&
              service !== "app" &&
              service !== "comments" &&
              service !== "manual" &&
              service !== "tiktok-ads" &&
              service !== "snapchat-ads" &&
              service !== "pinterest-ads" &&
              service !== "axon-ads" &&
              service !== "google-ads" &&
              service !== "webhook" &&
              service !== "notification" &&
              service !== "report" &&
              service !== "approval" && (
                <div className="space-y-2 md:space-y-3">
                  <Label className="text-sm font-medium">
                    Account <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1 h-10 text-base md:h-11"
                      placeholder={`Connect ${currentService.label}`}
                      disabled
                    />
                    <Button variant="default" size="sm">
                      Sign in
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentService.description}</p>
                </div>
              )}

            {/* Service-specific configurations */}
            {service === "scheduled" && event === "Scheduled Run" && (
              <ManualTriggerConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "manual" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This automation will only run when you manually click &ldquo;Run Now&rdquo;. No automatic triggers.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Description (optional)
                  </Label>
                  <Input
                    value={config.description || ""}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    placeholder="e.g., Scale winning ad sets by 20%"
                    className="h-10"
                  />
                </div>
              </div>
            )}

            {service === "media-library" && node.type === "trigger" && (
              <MediaLibraryTriggerConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
                ruleId={typeof flow.id === "number" ? flow.id : null}
              />
            )}

            {service === "media-library" && node.type === "action" && (
              <MediaLibraryUploadConfig config={config} setConfig={setConfig} />
            )}

            {service === "google-drive" && node.type === "trigger" && (
              <GoogleDriveTriggerConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "dropbox" && node.type === "trigger" && (
              <DropboxTriggerConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "sharepoint" && node.type === "trigger" && (
              <SharePointTriggerConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "air" && node.type === "trigger" && (
              <AirTriggerConfig config={config} setConfig={setConfig} node={node} event={event} setEvent={setEvent} />
            )}

            {service === "frameio" && node.type === "trigger" && (
              <FrameioTriggerConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === NOTION_AUTOMATION_TRIGGER.service && node.type === "trigger" && (
              <NotionStatusTriggerConfig config={config} setConfig={setConfig} node={node} setEvent={setEvent} />
            )}

            {service === "adscan" && node.type === "trigger" && event === "Advertiser Launch Volume" && (
              <AdscanAdvertiserLaunchVolumeConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "adscan" && node.type === "trigger" && event !== "Advertiser Launch Volume" && (
              <AdscanCompetitorAdConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "meta-ads" && node.type === "action" && event && !isHunchTemplateEvent(event) && (
              <MetaAdsActionConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                flowNodes={flow.nodes}
                sheetsDataMappings={sheetsDataMappings}
                hasSheetsTrigger={hasSheetsTrigger}
              />
            )}

            {service === "meta-ads" && node.type === "action" && isHunchTemplateEvent(event) && (
              <DynamicTemplateAdsConfig config={config} setConfig={setConfig} node={node} event={event} />
            )}

            {service === "delay" && <DelayConfig config={config} setConfig={setConfig} node={node} />}

            {service === "meta-ads" && node.type === "trigger" && event === "Ad Approved" && (
              <AdApprovedConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "meta-ads" && node.type === "trigger" && event === "Campaign Status Change" && (
              <CampaignStatusChangeConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "meta-ads" && node.type === "trigger" && event === "Performance Threshold" && (
              <MetaAdsPerformanceThresholdConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "meta-ads" && node.type === "trigger" && event === "Performance Monitoring" && (
              <PerformanceMonitoringConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "meta-ads" && node.type === "trigger" && event === "Best Performing Organic Post" && (
              <BestOrganicPostConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "facebook-rules" && node.type === "trigger" && event === "Rule Condition Check" && (
              <RuleConditionTriggerConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "app" && node.type === "trigger" && event === "Ad Launched via the app" && (
              <AdLaunchedConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "meta-ads" && node.type === "action" && event === "Apply Existing Rule" && (
              <ApplyRuleConfig config={config} setConfig={setConfig} node={node} flowNodes={flow.nodes} />
            )}

            {service === "meta-ads" && node.type === "action" && event === "Set Minimum Spend" && (
              <SetMinimumSpendConfig config={config} setConfig={setConfig} node={node} flowNodes={flow.nodes} />
            )}

            {service === "google-sheets" && node.type === "action" && event && event !== "Update Row" && (
              <GoogleSheetsActionConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                flowNodes={flow.nodes}
              />
            )}

            {service === "google-sheets" && node.type === "action" && event === "Update Row" && (
              <GoogleSheetsUpdateRowConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                flowNodes={flow.nodes}
              />
            )}

            {service === "google-drive" && node.type === "action" && event && (
              <GoogleDriveActionConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "google-sheets" &&
              node.type === "trigger" &&
              event !== "New Rows to Launch" &&
              event !== "New Rows to Catalog" && (
                <GoogleSheetsTriggerConfig
                  config={config}
                  setConfig={setConfig}
                  node={node}
                  event={event}
                  setEvent={setEvent}
                />
              )}

            {service === "google-sheets" && node.type === "trigger" && event === "New Rows to Launch" && (
              <GoogleSheetsLaunchConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
                flowNodes={flow.nodes}
              />
            )}

            {service === "google-sheets" && node.type === "trigger" && event === "New Rows to Catalog" && (
              <GoogleSheetsCatalogConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                setEvent={setEvent}
              />
            )}

            {service === "box" && node.type === "trigger" && event && (
              <BoxTriggerConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "hubspot" && node.type === "trigger" && event && (
              <HubSpotTriggerConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service && event && node.type === "filter" && (
              <FilterConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "timer" && event && <TimerConfig config={config} setConfig={setConfig} node={node} />}

            {service === "approval" && <ApprovalStepConfig config={config} setConfig={setConfig} node={node} />}

            {service === "tiktok-ads" && node.type === "trigger" && event === "Performance Threshold" && (
              <TikTokPerformanceThresholdConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "tiktok-ads" && node.type === "trigger" && event === "New Authorized Post" && (
              <TikTokNewAuthorizedPostConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "tiktok-ads" && node.type === "action" && event === "Launch on TikTok" && (
              <CrossChannelLaunchConfig
                platform="tiktok"
                config={config}
                setConfig={setConfig}
                node={node}
                flowNodes={flow.nodes}
              />
            )}

            {service === "tiktok-ads" &&
              node.type === "action" &&
              (event === "Pause Ad" ||
                event === "Enable Ad" ||
                event === "Pause Ad Group" ||
                event === "Enable Ad Group" ||
                event === "Pause Campaign" ||
                event === "Enable Campaign" ||
                event === "Change Budget" ||
                event === "Push Creatives to Ad Group" ||
                event === "Duplicate Campaign" ||
                event === "Duplicate Ad Group") && (
                <TikTokActionConfig
                  config={config}
                  setConfig={setConfig}
                  node={node}
                  event={event}
                  flowNodes={flow.nodes}
                />
              )}

            {service === "snapchat-ads" && node.type === "trigger" && event === "Performance Threshold" && (
              <SnapchatPerformanceThresholdConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "snapchat-ads" && node.type === "action" && event === "Pause Ad" && (
              <SnapchatActionConfig
                config={config}
                setConfig={setConfig}
                node={node}
                event={event}
                flowNodes={flow.nodes}
              />
            )}

            {service === "snapchat-ads" && node.type === "action" && event === "Launch on Snapchat" && (
              <CrossChannelLaunchConfig
                platform="snapchat"
                config={config}
                setConfig={setConfig}
                node={node}
                flowNodes={flow.nodes}
              />
            )}

            {service === "pinterest-ads" && node.type === "action" && event && (
              <CrossChannelLaunchConfig
                platform="pinterest"
                config={config}
                setConfig={setConfig}
                node={node}
                flowNodes={flow.nodes}
              />
            )}

            {service === "axon-ads" && node.type === "action" && event && (
              <CrossChannelLaunchConfig
                platform="axon"
                config={config}
                setConfig={setConfig}
                node={node}
                flowNodes={flow.nodes}
              />
            )}

            {service === "google-ads" && node.type === "trigger" && (
              <GoogleAdsPerformanceThresholdConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "google-ads" && node.type === "action" && event === "Launch on Google Ads" && (
              <GoogleAdsLaunchConfig config={config} setConfig={setConfig} node={node} />
            )}

            {service === "google-ads" && node.type === "action" && event && event !== "Launch on Google Ads" && (
              <GoogleAdsActionConfig config={config} setConfig={setConfig} node={node} event={event} />
            )}

            {service === "webhook" && node.type === "action" && <WebhookConfig config={config} setConfig={setConfig} />}

            {service === "comments" && node.type === "trigger" && (
              <CommentsTriggerConfig config={config} setConfig={setConfig} node={node} event={event} setEvent={setEvent} />
            )}

            {service === "comments" && node.type === "action" && (
              <CommentsActionConfig config={config} setConfig={setConfig} node={node} event={event} setEvent={setEvent} />
            )}

            {service === "notification" && node.type === "action" && (
              <NotificationActionConfig config={config} setConfig={setConfig} node={node} flowNodes={flow.nodes} />
            )}

            {service === "report" && node.type === "action" && (
              <ReportActionConfig config={config} setConfig={setConfig} node={node} />
            )}
          </div>
        )}

        {!isHydrating && activeTab === "preview" && (
          <div className="space-y-4">
            {/* Compact config summary — uses LIVE config so channel chip updates instantly */}
            {service !== "comments" && <StepPreview node={{ ...node, service, event, config }} index={nodeIndex - 1} />}

            {service === "tiktok-ads" && (event === "Duplicate Campaign" || event === "Duplicate Ad Group") && (
              <TikTokDuplicationCompatAlert
                advertiserId={config.advertiserId}
                entityType={event === "Duplicate Campaign" ? "campaign" : "adgroup"}
                entityId={config.targetId}
              />
            )}

            {/* Systematic: non-trigger steps auto-show upstream trigger output.
                 Skipped when an action has its own custom preview (Duplicate Ad /
                 Duplicate Campaign / Duplicate Ad Set / Duplicate Ad Group /
                 cross-channel Launch / Notification) since those already embed
                 the source list — rendering both causes a duplicate fetch. */}
            {node.type !== "trigger" &&
              !(service === "meta-ads" && event === "Duplicate Ad") &&
              !(service === "meta-ads" && (event === "Duplicate Campaign" || event === "Duplicate Ad Set")) &&
              !(service === "tiktok-ads" && (event === "Duplicate Campaign" || event === "Duplicate Ad Group")) &&
              !(
                (service === "tiktok-ads" ||
                  service === "snapchat-ads" ||
                  service === "pinterest-ads" ||
                  service === "axon-ads") &&
                event?.startsWith("Launch on")
              ) &&
              service !== "notification" && service !== "comments" && (
                <TriggerOutputSummary
                  triggerNode={flow.nodes.find((n) => n.type === "trigger")}
                  selectedAccountId={flow.selectedAccountId}
                  selectedAccountName={flow.selectedAccountName}
                  flowName={flow.name}
                  adContext={
                    service === "meta-ads" && event === "Launch Ad"
                      ? {
                          adSource: typeof config.adSource === "string" ? config.adSource : undefined,
                          headline: typeof config.headline === "string" ? config.headline : undefined,
                          primaryText: typeof config.description === "string" ? config.description : undefined,
                          linkUrl: typeof config.linkUrl === "string" ? config.linkUrl : undefined,
                          callToAction: typeof config.callToAction === "string" ? config.callToAction : undefined,
                        }
                      : undefined
                  }
                  // Change Budget acts per ad set / campaign, so collapse the matched
                  // ads to the entities it will actually touch. Campaign level groups by
                  // campaign; ad-set and Automatic group by ad set (Automatic's targets
                  // are ad sets, even when it routes the write up to a CBO campaign).
                  dedupeBy={
                    service === "meta-ads" && event === "Change Budget"
                      ? config.budgetEntityLevel === "campaign"
                        ? "campaign"
                        : "adset"
                      : undefined
                  }
                />
              )}

            {service === "comments" && (
              <DemoCommentPreview
                showStats
                config={flow.nodes.find((candidate) => candidate.type === "trigger" && candidate.service === "comments")?.config ?? config}
                actionEvent={node.type === "action" ? event : flow.nodes.find((candidate) => candidate.type === "action" && candidate.service === "comments")?.event}
              />
            )}

            {((service === "meta-ads" && (event === "Duplicate Campaign" || event === "Duplicate Ad Set")) ||
              (service === "tiktok-ads" && (event === "Duplicate Campaign" || event === "Duplicate Ad Group"))) && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What would be duplicated
                </p>
                <DuplicateSourcePreview
                  node={{ ...node, service, event, config }}
                  level={event === "Duplicate Campaign" ? "campaign" : "adset"}
                  platform={service === "tiktok-ads" ? "tiktok" : "meta"}
                  triggerNode={flow.nodes.find((n) => n.type === "trigger")}
                  selectedAccountId={flow.selectedAccountId}
                  selectedAccountName={flow.selectedAccountName}
                  flowName={flow.name}
                />
              </div>
            )}

            {/* Type-specific live preview — always the focus of this tab */}
            {service === "meta-ads" && event === "Performance Threshold" && (
              <PerformanceThresholdPreview config={config} setConfig={setConfig} />
            )}

            {service === "tiktok-ads" && event === "Performance Threshold" && (
              <TikTokPerformanceThresholdPreview config={config} setConfig={setConfig} />
            )}

            {node.type === "trigger" && service === "meta-ads" && event === "Best Performing Organic Post" && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What the trigger sees
                </p>
                <TriggerOutputSummary
                  triggerNode={{ ...node, service, event, config }}
                  selectedAccountId={flow.selectedAccountId}
                  selectedAccountName={flow.selectedAccountName}
                  flowName={flow.name}
                />
              </div>
            )}

            {/* Adscan trigger — surface the live matched-ad count + sample ads on the
                trigger's own preview tab. an earlier fix. The generic TriggerOutputSummary
                above is gated to non-trigger nodes; replicate its behaviour here so the
                trigger card shows more than just its title. */}
            {node.type === "trigger" &&
              service === "adscan" &&
              (event === "New Competitor Ad" || event === "New Competitor Ad Matches Filters") && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    What the trigger sees
                  </p>
                  <TriggerOutputSummary
                    triggerNode={{ ...node, service, event, config }}
                    selectedAccountId={flow.selectedAccountId}
                    selectedAccountName={flow.selectedAccountName}
                    flowName={flow.name}
                  />
                </div>
              )}

            {service === "meta-ads" && event === "Performance Monitoring" && (
              <PerformanceMonitoringPreview
                // Pass a synthesized node with the LIVE config so the preview reacts
                // to user edits in Setup without needing a save round-trip.
                node={{ ...node, service, event, config }}
                selectedAccountId={flow.selectedAccountId}
                selectedAccountName={flow.selectedAccountName}
                flowName={flow.name}
              />
            )}

            {service === "meta-ads" && event === "Duplicate Ad" && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What would be duplicated
                </p>
                <DuplicateAdPreview
                  node={{ ...node, service, event, config }}
                  triggerNode={flow.nodes.find((n) => n.type === "trigger")}
                  selectedAccountId={flow.selectedAccountId}
                  selectedAccountName={flow.selectedAccountName}
                />
              </div>
            )}

            {(service === "tiktok-ads" ||
              service === "snapchat-ads" ||
              service === "pinterest-ads" ||
              service === "axon-ads") &&
              event?.startsWith("Launch on") && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    What would be launched
                  </p>
                  <CrossChannelLaunchPreview
                    node={{ ...node, service, event, config }}
                    triggerNode={flow.nodes.find((n) => n.type === "trigger")}
                    selectedAccountId={flow.selectedAccountId}
                    selectedAccountName={flow.selectedAccountName}
                    platform={
                      service === "tiktok-ads"
                        ? "tiktok"
                        : service === "snapchat-ads"
                          ? "snapchat"
                          : service === "pinterest-ads"
                            ? "pinterest"
                            : "axon"
                    }
                  />
                </div>
              )}

            {service === "notification" && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What will get sent
                </p>
                <NotificationPreview
                  // Pass the LIVE config so method changes (email/slack/both) are
                  // reflected in the Preview immediately without a save round-trip.
                  node={{ ...node, service, event, config }}
                  triggerNode={flow.nodes.find((n) => n.type === "trigger")}
                  flowName={flow.name}
                  selectedAccountId={flow.selectedAccountId}
                  selectedAccountName={flow.selectedAccountName}
                />
              </div>
            )}

            {/* Live tester — only for trigger services that genuinely need a test-data picker
                 (media-library, google-drive, google-sheets). Meta triggers get their own preview above
                 and notifications render the rendered payload — the generic tester is noise for them. */}
            {(service === "media-library" || service === "google-drive" || service === "google-sheets") && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Test with live data
                </p>
                <TestTab service={service} event={event} config={config} node={node} flow={flow} />
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "preview" && isCommentStep && (
        <div className="border-t px-4 py-3 md:px-5">
          <p className="text-xs text-muted-foreground">Changes save automatically. Turn on the automation when the preview looks right.</p>
        </div>
      )}
      {/* Setup continues to the preview before a comment automation can be turned on. */}
      {activeTab === "setup" && (
        <div className="border-t px-4 py-3 md:px-5 md:py-3.5">
          <Button
            disabled={footerDisabled}
            className="h-10 w-full md:h-11"
            size="lg"
            onClick={() => setActiveTab("preview")}
          >
            {eventMissing
              ? "To continue, choose an event"
              : targetAdSetMissing
                ? "Add a target ad set to continue"
                : commentPagesMissing
                  ? "Choose pages to preview"
                  : isCommentStep ? "Preview matches" : "Preview →"}
          </Button>
        </div>
      )}
    </div>
  );
}
