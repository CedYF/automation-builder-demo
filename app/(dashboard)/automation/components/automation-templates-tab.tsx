"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Lock, Star } from "lucide-react";
import { toast } from "sonner";
import {
  AUTOMATION_TEMPLATES,
  TEMPLATE_CATEGORIES,
  requiresAccountBeforeSave,
  type AutomationTemplate,
  type TemplateCategory,
} from "../lib/automation-templates";
import { HIDE_NEGATIVE_COMMENTS_TEMPLATE_ID, isCommentAutomationTemplate } from "../lib/comment-automation-templates";
import { remapNodeIdPills } from "../lib/remap-node-id-pills";
import { ServiceIcon } from "../lib/service-icons";
import { useIsEssentialAutomationPlan } from "@/lib/automation/use-essential-automation-plan";
import { getEssentialPlanAutomationBlockReason } from "@/lib/automation/essential-plan-automation-access";
import { canManageAutomationBySource } from "@/lib/automation/automation-access";
import { useUser } from "@/lib/providers/user-provider";
import type { AutomationNode } from "../contexts/automation-context";

interface AutomationTemplatesTabProps {
  onUseTemplate: (templateId: string) => void;
  /** Controlled search text, typically owned by the tab strip above. */
  searchQuery?: string;
}

interface AutomationTemplatesContentProps {
  onUseTemplate: (templateId: string) => void;
  searchQuery?: string;
}

const categoryColors: Record<TemplateCategory, string> = {
  scaling: "bg-blue-100 text-blue-700",
  optimization: "bg-amber-100 text-amber-700",
  reporting: "bg-green-100 text-green-700",
  comments: "bg-sky-100 text-sky-700",
};

export function AutomationTemplatesContent({ onUseTemplate, searchQuery = "" }: AutomationTemplatesContentProps) {
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const isEssentialPlan = useIsEssentialAutomationPlan();
  const { extendedUser } = useUser();
  const offeredTemplates = AUTOMATION_TEMPLATES.filter((template) => template.id === HIDE_NEGATIVE_COMMENTS_TEMPLATE_ID);
  const canUseTemplate = (template: AutomationTemplate): boolean =>
    canManageAutomationBySource(extendedUser?.role, isCommentAutomationTemplate(template) ? "comment" : "flow");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = normalizedQuery
    ? offeredTemplates.filter(
        (t) => t.name.toLowerCase().includes(normalizedQuery) || t.description.toLowerCase().includes(normalizedQuery),
      )
    : offeredTemplates;

  const creatingTemplate = filtered.find((template) => template.id === creatingTemplateId);

  return (
    <div className="relative flex-1 overflow-auto p-4 md:p-8">
      {creatingTemplate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 text-center shadow-lg" aria-live="polite">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Creating automation</h3>
            <p className="mt-1 text-xs text-muted-foreground">{creatingTemplate.name}</p>
          </div>
        </div>
      )}

      {/* Template cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const canManageAutomations = canUseTemplate(template);
          const essentialBlockReason = isEssentialPlan ? getEssentialPlanAutomationBlockReason(template.flow) : null;
          const displaySteps =
            template.displaySteps ??
            template.flow.nodes.map((node) => ({ service: node.service ?? "", label: node.event ?? "" }));
          const isCreating = creatingTemplateId === template.id;
          return (
            <Card
              key={template.id}
              className={cn(
                "group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md",
                template.featured && "ring-2 ring-purple-500/50",
                essentialBlockReason && "opacity-90",
              )}
            >
              {template.featured && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5">
                  <Star className="h-3.5 w-3.5 text-white fill-white" />
                  <span className="text-[11px] font-semibold tracking-wide text-white uppercase">Featured</span>
                </div>
              )}
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                {/* Header: branded service icon (when provided) or template emoji + name */}
                <div className="flex items-start gap-3">
                  {template.iconService ? (
                    <ServiceIcon service={template.iconService} size={24} />
                  ) : (
                    <span className="text-2xl leading-none">{template.emoji}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-snug">{template.name}</h3>
                    <Badge
                      variant="secondary"
                      className={cn("mt-1 text-[10px] px-1.5 py-0", categoryColors[template.category])}
                    >
                      {TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{template.description}</p>

                {/* Service icons + step count */}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <div className="flex items-center gap-1.5">
                    {displaySteps.map((step, i) => (
                      <Fragment key={`${template.id}-${step.label}-${i}`}>
                        {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        <ServiceIcon service={step.service} size={18} />
                      </Fragment>
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">{displaySteps.length} steps</span>
                  </div>

                  <Button
                    size="sm"
                    variant={essentialBlockReason || !canManageAutomations ? "secondary" : "outline"}
                    className="h-7 gap-1 text-xs"
                    disabled={isCreating}
                    onClick={async () => {
                      if (!canManageAutomations) {
                        toast.message("Permission required", {
                          description: "Your role cannot create automations.",
                        });
                        return;
                      }
                      if (essentialBlockReason) {
                        toast.message("Upgrade required", { description: essentialBlockReason });
                        return;
                      }
                      setCreatingTemplateId(template.id);
                      try {
                        // Comment templates need a page before they can persist — open the
                        // seeded flow builder instead of creating a draft rule immediately.
                        if (isCommentAutomationTemplate(template)) {
                          onUseTemplate(template.id);
                          return;
                        }
                        // Same treatment for templates whose ad account cloneTemplateNodes
                        // cannot prefill (it only knows Meta). Persisting one immediately
                        // would create a rule the table's on/off toggle can activate while
                        // its trigger still has accountId: "", which then fails on every
                        // scheduled run.
                        if (requiresAccountBeforeSave(template)) {
                          onUseTemplate(template.id);
                          toast.success(`${template.name} loaded`, {
                            description: "Pick your ad account, then save to create this automation.",
                          });
                          return;
                        }
                        const createdRuleId = await createAutomationFromTemplate(template, extendedUser);
                        onUseTemplate(String(createdRuleId));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to create automation");
                      } finally {
                        setCreatingTemplateId(null);
                      }
                    }}
                  >
                    {!canManageAutomations ? (
                      <>
                        <Lock className="h-3 w-3" />
                        Locked
                      </>
                    ) : essentialBlockReason ? (
                      <>
                        <Lock className="h-3 w-3" />
                        In-house+
                      </>
                    ) : isCreating ? (
                      "Creating..."
                    ) : (
                      <>
                        Use
                        <ArrowRight className="h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12 text-sm">
          {normalizedQuery ? "No templates match your search." : "No templates in this category yet."}
        </div>
      )}
    </div>
  );
}

export function AutomationTemplatesTab({ onUseTemplate, searchQuery }: AutomationTemplatesTabProps) {
  return <AutomationTemplatesContent onUseTemplate={onUseTemplate} searchQuery={searchQuery} />;
}

async function createAutomationFromTemplate(template: AutomationTemplate, extendedUser: unknown): Promise<number> {
  const defaultAccount = resolveDefaultMetaAccount(extendedUser);
  const workspaceId = readObjectString(extendedUser, "defaultWorkspaceId");
  const triggerNode = template.flow.nodes.find((node) => node.type === "trigger");
  const actionNode = template.flow.nodes.find((node) => node.type === "action");
  const payload = {
    name: template.flow.name,
    flow: {
      nodes: cloneTemplateNodes(template.flow.nodes, defaultAccount),
      notificationSettings: template.flow.notificationSettings || undefined,
    },
    actionType: resolveActionType(actionNode?.event),
    targetId: actionNode?.config?.targetId || null,
    accountId: defaultAccount?.accountId || actionNode?.config?.accountId || "",
    newName: actionNode?.config?.newName || null,
    frequency: resolveTemplateFrequency(triggerNode),
    scheduledDate: null,
    scheduledTime: null,
    dayOfWeek: null,
    dayOfMonth: null,
    startDate: null,
    endDate: null,
    status: "draft",
    workspaceId: workspaceId || null,
  };

  const response = await fetch("/api/automation-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    const message = readObjectString(responseBody, "error") || "Failed to create automation";
    throw new Error(message);
  }
  const rule = readObject(responseBody, "rule");
  const ruleId = readObjectNumber(rule, "id");
  if (!ruleId) throw new Error("Created automation response did not include an ID");
  return ruleId;
}

/**
 * Copies template nodes into a new flow: fresh node ids, the default ad account
 * filled in, and every cross-step `{{nodeId.field}}` re-pointed at the new ids.
 *
 * Exported for tests — re-minting ids without re-mapping the references silently
 * breaks any template whose steps refer to each other (ADM-10104).
 */
export function cloneTemplateNodes(
  nodes: ReadonlyArray<AutomationNode>,
  defaultAccount: { accountId: string; accountName: string } | null,
): AutomationNode[] {
  // Node ids are re-minted below, so any `{{oldId.field}}` a template config
  // uses to reference a sibling step has to be re-pointed at the same step's
  // new id. Without this the reference dangles and resolves to nothing at
  // execution time (ADM-10104).
  const clonedIdByTemplateId = new Map(nodes.map((node, index) => [node.id, `node-${Date.now()}-${index}`]));

  return nodes.map((node, index) => {
    const config = { ...(node.config || {}) };
    if (node.service === "meta-ads" && defaultAccount) {
      if (!config.accountId) config.accountId = defaultAccount.accountId;
      if (!Array.isArray(config.accountIds) || config.accountIds.length === 0) {
        config.accountIds = [defaultAccount.accountId];
      }
      if (!config.accountName) config.accountName = defaultAccount.accountName;
    }
    return {
      ...node,
      id: clonedIdByTemplateId.get(node.id) as string,
      config: remapNodeIdPills(config, clonedIdByTemplateId) as AutomationNode["config"],
      position: index,
    };
  });
}

function resolveActionType(event: string | undefined): string {
  if (event === "Duplicate Ad Set") return "duplicate-adset";
  if (event === "Duplicate Campaign") return "duplicate-campaign";
  if (event === "Duplicate Ad") return "duplicate-ad";
  if (event === "Launch Ad") return "launch-ad";
  if (event === "Duplicate Ad Set from Sheet Row") return "dynamic-template-ads";
  if (event === "Prepare Dynamic Ad Set from Sheet Row") return "dynamic-template-ads";
  if (event === "Create Media from Templates") return "dynamic-template-ads";
  if (event === "Create Dynamic Media from Templates") return "dynamic-template-ads";
  if (event === "Launch Template Ads") return "dynamic-template-ads";
  if (event === "Create Media + Launch Ads from Templates") return "dynamic-template-ads";
  return "unknown";
}

function resolveTemplateFrequency(triggerNode: AutomationNode | undefined): string {
  const config = triggerNode?.config || {};
  if (typeof config.checkFrequency === "string") return config.checkFrequency;
  if (typeof config.frequency === "string") return config.frequency;
  return "one-time";
}

function resolveDefaultMetaAccount(extendedUser: unknown): { accountId: string; accountName: string } | null {
  const defaultAccountId = readObjectString(extendedUser, "defaultAccountId");
  const defaultWorkspaceId = readObjectString(extendedUser, "defaultWorkspaceId");
  const settings = readObjectArray(extendedUser, "settings");
  if (!defaultWorkspaceId) return null;
  const relevantSettings = settings.filter(
    (setting) => readObjectString(setting, "workspaceId") === defaultWorkspaceId,
  );
  const defaultSetting = relevantSettings.find(
    (setting) => readObjectString(setting, "businessId") === defaultAccountId,
  );
  const selectedSetting =
    defaultSetting || relevantSettings.find((setting) => readObjectString(setting, "type") !== "google_ads");
  if (!selectedSetting) return null;
  const accountId = readObjectString(selectedSetting, "businessId");
  if (!accountId) return null;
  return {
    accountId,
    accountName: readObjectString(selectedSetting, "businessName") || accountId,
  };
}

function readObject(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const nested = Reflect.get(value, key);
  return nested && typeof nested === "object" && !Array.isArray(nested) ? (nested as Record<string, unknown>) : null;
}

function readObjectString(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidate = Reflect.get(value, key);
  return typeof candidate === "string" ? candidate : "";
}

function readObjectNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = Reflect.get(value, key);
  return typeof candidate === "number" ? candidate : null;
}

function readObjectArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const candidate = Reflect.get(value, key);
  return Array.isArray(candidate) ? candidate : [];
}
