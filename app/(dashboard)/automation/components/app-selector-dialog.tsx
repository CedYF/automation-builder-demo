"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getServiceInfo } from "../lib/service-icons";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Image from "next/image";
import Meta from "@/components/ui/icons/meta";
import { toast } from "sonner";
import { type AutomationNodeType, isStepNodeType } from "@/lib/automation/flow-control-steps";

interface AppSelectorDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  nodeType: AutomationNodeType;
  onSelectApp(appId: string): void;
  /** When set, only these services are offered for the pending node. */
  allowedServices?: readonly string[];
  disabledServices?: string[];
  /** Shown as locked; Essential plan only allows Performance Monitoring (Meta Ads). */
  planLockedServices?: string[];
}

const services = {
  trigger: [
    { value: "media-library", label: "Media Library" },
    { value: "google-sheets", label: "Google Sheets" },
    { value: "google-drive", label: "Google Drive" },
    { value: "notion", label: "Notion" },
    { value: "monday", label: "Monday.com" },
    { value: "dropbox", label: "Dropbox" },
    { value: "sharepoint", label: "SharePoint" },
    { value: "air", label: "AIR" },
    { value: "frameio", label: "Frame.io" },
    { value: "adscan", label: "Adscan" },
    { value: "meta-ads", label: "Meta Ads" },
    { value: "tiktok-ads", label: "TikTok Ads" },
    { value: "snapchat-ads", label: "Snapchat Ads" },
    { value: "pinterest-ads", label: "Pinterest Ads" },
    { value: "x-ads", label: "X (Twitter) Ads" },
    { value: "axon-ads", label: "AppLovin Ads" },
    { value: "google-ads", label: "Google Ads" },
    { value: "triplewhale-ads", label: "Triple Whale" },
    { value: "triplewhale-account", label: "Triple Whale (Account)" },
    { value: "admanage", label: "AdManage" },
    { value: "comments", label: "Comments" },
    // { value: "box", label: "Box" },
    { value: "scheduled", label: "Scheduled (Daily/Weekly)" },
    { value: "manual", label: "Manual Trigger" },
  ],
  action: [
    { value: "media-library", label: "Media Library" },
    { value: "google-sheets", label: "Google Sheets" },
    { value: "google-drive", label: "Google Drive" },
    { value: "monday", label: "Monday.com" },
    { value: "meta-ads", label: "Meta Ads" },
    { value: "tiktok-ads", label: "TikTok Ads" },
    { value: "snapchat-ads", label: "Snapchat Ads" },
    { value: "chatgpt-ads", label: "ChatGPT Ads" },
    { value: "pinterest-ads", label: "Pinterest Ads" },
    { value: "x-ads", label: "X (Twitter) Ads" },
    { value: "axon-ads", label: "AppLovin Ads" },
    { value: "google-ads", label: "Google Ads" },
    { value: "comments", label: "Comments" },
    { value: "webhook", label: "Webhook" },
    { value: "notification", label: "Notification" },
    { value: "slack", label: "Slack" },
    { value: "email", label: "Email" },
    { value: "report", label: "Report" },
    // Flow control — selecting these retypes the node (see flow-control-steps).
    { value: "delay", label: "Delay" },
    { value: "approval", label: "Approval" },
  ],
  filter: [],
};

/**
 * Delay and approval nodes share the action list so that "Change app" on one of
 * them can reach every step app, including converting back to a real action.
 */
function getServicesForNodeType(nodeType: AutomationNodeType) {
  if (nodeType === "trigger") return services.trigger;
  if (nodeType === "filter") return services.filter;
  return isStepNodeType(nodeType) ? services.action : [];
}

const ESSENTIAL_TRIGGER_UPGRADE_HINT =
  "Your Essential plan includes Performance Monitoring (Meta Ads) only. Upgrade to In-house or higher for other triggers.";

export function AppSelectorDialog({
  open,
  onOpenChange,
  nodeType,
  onSelectApp,
  allowedServices,
  disabledServices = [],
  planLockedServices = [],
}: AppSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const availableServices = getServicesForNodeType(nodeType);
  const filteredServices = availableServices.filter(
    (service) =>
      (allowedServices === undefined || allowedServices.includes(service.value)) &&
      service.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelect = (appId: string) => {
    if (planLockedServices.includes(appId)) {
      toast.message("Upgrade required", { description: ESSENTIAL_TRIGGER_UPGRADE_HINT });
      return;
    }
    if (disabledServices.includes(appId)) return;
    onSelectApp(appId);
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose an app</DialogTitle>
          <DialogDescription>
            Select the app you want to use for this{" "}
            {nodeType === "delay" || nodeType === "approval" ? "step" : nodeType}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-9 text-base md:h-11"
          />
        </div>

        <div className="mt-4 grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 md:max-h-[400px]">
          {filteredServices.map((service) => {
            const serviceInfo = getServiceInfo(service.value);
            const iconType = serviceInfo.iconType || "emoji";

            const renderIcon = () => {
              if (serviceInfo.icon === "meta") {
                return <Meta className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0" grayscale={false} />;
              }
              if (iconType === "image") {
                return (
                  <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 relative">
                    <Image src={serviceInfo.icon} alt={serviceInfo.label} fill className="object-contain" />
                  </div>
                );
              }
              // Default to emoji
              return <span className="text-2xl flex-shrink-0 md:text-3xl">{serviceInfo.icon}</span>;
            };

            const isDuplicateDisabled = disabledServices.includes(service.value);
            const isPlanLocked = planLockedServices.includes(service.value);
            const isDisabled = isDuplicateDisabled;

            return (
              <button
                key={service.value}
                type="button"
                onClick={() => handleSelect(service.value)}
                disabled={isDisabled}
                className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition-all md:p-4 ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : isPlanLocked
                      ? "opacity-60 cursor-pointer hover:border-muted-foreground/30"
                      : "hover:border-primary hover:bg-primary/5 active:bg-primary/10"
                }`}
              >
                {renderIcon()}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm md:text-base">{serviceInfo.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {isDuplicateDisabled
                      ? "Already added"
                      : isPlanLocked
                        ? "In-house+ — Essential includes Meta Performance Monitoring only"
                        : serviceInfo.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
