"use client";

import { useEffect, useRef, useState } from "react";
import { type AutomationNode, useAutomation } from "../contexts/automation-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreVertical, Zap, Play, Filter, Trash2, Clock, ShieldCheck, Layers, AlertTriangle } from "lucide-react";
import { getServiceInfo } from "../lib/service-icons";
import { getServiceTheme, getNodeTypeAccent, nodeTypeBadgeStyles } from "../lib/service-themes";
import { getNodeSummary } from "../lib/node-summary";
import { getBuilderStepReadiness } from "../lib/builder-readiness";
import { BuilderStepStatusPill } from "./builder-step-status-pill";
import { ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY, ADSCAN_NEW_COMPETITOR_AD_EVENT } from "../lib/adscan-events";
import { useCustomMetricsById } from "../lib/use-custom-metrics-by-id";
import { cn } from "@/lib/utils";
import Meta from "@/components/ui/icons/meta";

interface FlowNodeProps {
  node: AutomationNode;
  index: number;
  onNodeClick(node: AutomationNode): void;
  isSelected?: boolean;
}

const nodeIcons = {
  trigger: Zap,
  action: Play,
  filter: Filter,
  delay: Clock,
  approval: ShieldCheck,
};

const LAUNCH_TEMPLATE_ADS_EVENT = "Launch Template Ads";
const LEGACY_HUNCH_TEMPLATE_EVENT = "Create Media + Launch Ads from Templates";

// Helper to get display text for node events based on config
function getEventDisplayText(node: AutomationNode): string {
  if (!node.event) return "Select an event";

  // Media Library trigger - show board name only if specific board selected
  if (node.service === "media-library" && node.event === "Media Uploaded to Board") {
    if (node.config?.boardName) {
      return `Media Uploaded to ${node.config.boardName}`;
    }
    return "Media Uploaded"; // No specific board = all boards
  }

  // Meta Ads action - show template name for Launch Ad
  if (node.service === "meta-ads" && node.event === "Launch Ad") {
    if (node.config?.templateName) {
      return `Launch Ad • ${node.config.templateName}`;
    }
  }

  if (
    node.service === "meta-ads" &&
    (node.event === LAUNCH_TEMPLATE_ADS_EVENT || node.event === LEGACY_HUNCH_TEMPLATE_EVENT)
  ) {
    const count = Array.isArray(node.config?.templateIds) ? node.config.templateIds.length : 0;
    return count > 0 ? `Launch Template Ads • ${count}` : "Launch Template Ads";
  }

  if (
    node.service === "meta-ads" &&
    (node.event === "Duplicate Ad Set from Sheet Row" || node.event === "Prepare Dynamic Ad Set from Sheet Row")
  ) {
    return "Duplicate Ad Set from Sheet Row";
  }

  if (
    node.service === "meta-ads" &&
    (node.event === "Create Media from Templates" || node.event === "Create Dynamic Media from Templates")
  ) {
    const count = Array.isArray(node.config?.templateIds) ? node.config.templateIds.length : 0;
    return count > 0 ? `Create Media from Templates • ${count}` : "Create Media from Templates";
  }

  // Adscan trigger was renamed in ADM-5914 — render legacy rules with the new label.
  if (node.service === "adscan" && node.event === ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY) {
    return ADSCAN_NEW_COMPETITOR_AD_EVENT;
  }

  return node.event;
}

export function FlowNode({ node, index, onNodeClick, isSelected = false }: FlowNodeProps) {
  const { deleteNode, flow, assistantActiveStepId, invalidNodeId } = useAutomation();
  const isAssistantBuilding = assistantActiveStepId === node.id;
  // Set by a failed save that blamed this step, so the toast has something to point at.
  const isInvalid = invalidNodeId === node.id;
  const cardRef = useRef<HTMLDivElement | null>(null);

  // A long flow can push the blamed step off screen, which would leave the toast
  // referring to a card the user cannot see.
  useEffect(() => {
    if (!isInvalid) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isInvalid]);

  // Live buffered-count badge for media-library triggers with grouping enabled.
  // Polls the backend every 15s so the canvas reflects recent uploads.
  const isMediaBufferTrigger =
    node.type === "trigger" && node.service === "media-library" && !!node.config?.groupingEnabled;
  const groupThreshold = (node.config?.groupThreshold as number | undefined) || 5;
  const savedRuleId = typeof flow.id === "number" ? flow.id : null;
  const [bufferedCount, setBufferedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isMediaBufferTrigger || !savedRuleId) {
      setBufferedCount(null);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/automation-rules/media-buffer-count?ruleId=${savedRuleId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number") {
          setBufferedCount(data.count);
        }
      } catch {
        // Non-critical — leave the badge hidden on error.
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isMediaBufferTrigger, savedRuleId]);

  const Icon = nodeIcons[node.type];
  const serviceInfo = node.service ? getServiceInfo(node.service) : null;
  const theme = getServiceTheme(node.service);
  const accent = getNodeTypeAccent(node.type);
  const typeBadgeStyle = nodeTypeBadgeStyles[node.type];
  const customMetricsById = useCustomMetricsById();
  const summary = getNodeSummary(node, { customMetricsById });

  // Same gate the config panel uses for its Preview CTA, so the card's pill and
  // the step's Setup tab never disagree about whether it is finished.
  const readiness = getBuilderStepReadiness({
    service: node.service,
    event: node.event,
    nodeType: node.type,
    config: node.config,
    flowAccountId: flow.selectedAccountId,
    hasError: isInvalid,
  });
  const isCreateMediaStep =
    node.service === "meta-ads" &&
    (node.event === "Create Media from Templates" || node.event === "Create Dynamic Media from Templates");
  const serviceLabel = isCreateMediaStep ? "AdManage" : serviceInfo?.label;

  // The event now titles the card, so the app it runs on moves to the subtitle
  // alongside whatever the step summarises ("Comments · Daily 9am").
  const subtitle = [serviceLabel, summary.subtitle].filter(Boolean).join(" · ");

  // Render the service icon, sized for the card's 36px mark
  const renderServiceIcon = () => {
    if (!node.service) {
      return <Icon className="h-[18px] w-[18px] text-muted-foreground" />;
    }

    if (isCreateMediaStep) {
      return <Layers className="h-[18px] w-[18px] text-primary" />;
    }

    // Special handling for Meta icon
    if (node.service === "meta-ads") {
      return <Meta className="h-5 w-5" grayscale={false} />;
    }

    // Use emoji or image from service info
    if (serviceInfo) {
      // Handle image icons (local paths or URLs)
      if (
        serviceInfo.iconType === "image" ||
        (typeof serviceInfo.icon === "string" &&
          (serviceInfo.icon.startsWith("/") || serviceInfo.icon.startsWith("http")))
      ) {
        return <img src={serviceInfo.icon} alt={serviceInfo.label} className="h-5 w-5 object-contain" />;
      }
      return <span className="text-lg leading-none">{serviceInfo.icon}</span>;
    }

    return <Icon className="h-[18px] w-[18px] text-muted-foreground" />;
  };

  return (
    <div
      ref={cardRef}
      data-testid={`flow-node-${node.type}-${index}`}
      data-node-type={node.type}
      data-node-service={node.service || ""}
      data-node-event={node.event || ""}
      data-node-invalid={isInvalid ? "true" : undefined}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl bg-card transition-all duration-200 ease-out",
        "border shadow-sm hover:-translate-y-0.5",
        isSelected
          ? cn("border-primary shadow-lg ring-[3px] ring-offset-0", accent.selectedRing)
          : "border-border hover:border-gray-300 hover:shadow-md",
        // Live "assistant is building this step" pulse
        isAssistantBuilding &&
          "border-violet-400 shadow-lg ring-2 ring-violet-400/60 ring-offset-1 ring-offset-background animate-pulse",
        // Blamed by the last failed save. Wins over the selected ring so the card
        // stays obviously wrong even while the user has it open to fix it.
        isInvalid &&
          "border-destructive shadow-lg ring-2 ring-destructive/60 ring-offset-1 ring-offset-background hover:border-destructive",
      )}
      onClick={() => onNodeClick(node)}
    >
      {/* Coloured accent spine — keys the card to its node type at a glance */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-opacity",
          accent.spine,
          isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100",
        )}
      />

      {/* Header — step number, type badge, and the readiness pill */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Step number */}
          <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {index + 1}
          </span>

          {/* Node type badge */}
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em]",
              typeBadgeStyle.bg,
              typeBadgeStyle.text,
              typeBadgeStyle.border,
            )}
          >
            {node.type}
          </Badge>
        </div>

        <BuilderStepStatusPill
          status={readiness.status}
          label={readiness.label}
          title={readiness.blocker ?? undefined}
          className="flex-shrink-0"
        />
      </div>

      {/* Body — service mark, what this step does, and the row menu */}
      <div className="flex items-center gap-3 px-3.5 pb-3 pt-2.5">
        {/* Icon container with colored background */}
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] shadow-sm ring-1 ring-black/[0.04]",
            "transition-all duration-200 group-hover:scale-105 group-hover:shadow-md",
            node.service ? theme.iconBg : "bg-muted",
          )}
        >
          {renderServiceIcon()}
        </div>

        {/* Content — the event leads, the app and its settings sit underneath */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {serviceLabel ? getEventDisplayText(node) : "Choose an app"}
          </h3>
          {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
          {isMediaBufferTrigger && bufferedCount !== null && (
            <div className="mt-1 flex items-center gap-1">
              <Layers className="h-3 w-3 text-muted-foreground/70" />
              <span className="text-[10px] font-medium text-muted-foreground/70">
                Buffered: {bufferedCount} / {groupThreshold}
              </span>
            </div>
          )}
        </div>

        {/* Action menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 flex-shrink-0 p-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Step actions"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips row — the outstanding gap first, then the active settings summary */}
      {(readiness.blocker || summary.badges.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-muted/30 px-3.5 py-2.5">
          {readiness.blocker && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <AlertTriangle className="h-3 w-3" />
              {readiness.blocker}
            </span>
          )}
          {summary.badges.map((badge, i) => {
            const badgeEl = (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                  badge.tone === "warning"
                    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                    : badge.tone === "muted"
                      ? "bg-muted text-muted-foreground ring-1 ring-inset ring-border"
                      : "bg-card text-foreground ring-1 ring-inset ring-border",
                )}
              >
                {badge.label}
              </span>
            );

            if (!badge.details || badge.details.length === 0) {
              return <span key={i}>{badgeEl}</span>;
            }

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>{badgeEl}</TooltipTrigger>
                <TooltipContent side="top">
                  <ul className="list-none space-y-0.5">
                    {badge.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
