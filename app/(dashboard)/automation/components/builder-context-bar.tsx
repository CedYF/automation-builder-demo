"use client";

import { useMemo, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/providers/user-provider";
import { canManageAutomationBySource } from "@/lib/automation/automation-access";
import { useAutomation } from "../contexts/automation-context";
import { useAutomationActivation } from "../hooks/use-automation-activation";
import { getServiceInfo } from "../lib/service-icons";
import { shouldShowAccountSelector } from "../lib/automation-platform-labels";
import { BUILDER_AUTOMATION_ACCOUNT_PLATFORMS } from "../lib/automation-account-platform";
import { buildBuilderContextSummary } from "../lib/builder-context-summary";
import { describeFlowAccountScopeOverride } from "../lib/flow-account-scope";
import { isCommentAutomationFlow } from "../lib/comment-flow-mapper";
import { AutomationAdAccountSelector } from "./automation-ad-account-selector";
import { DeleteActivationConfirmDialog } from "./delete-activation-confirm-dialog";

interface WorkspaceAccountSetting {
  readonly workspaceId?: string | number | null;
  readonly businessId?: string | null;
  readonly businessName?: string | null;
}

/**
 * The on/off switch's text label. Bare "On"/"Off" reads as a passive status
 * next to a control that's actually clickable, so both states use the same
 * call-to-action shape. An unsaved automation no longer gets its own
 * "Save to turn on" label: flipping the switch saves it first.
 */
function getActiveToggleLabel(isActive: boolean): string {
  return isActive ? "Turn off Automation" : "Turn on Automation";
}

/**
 * The strip under the builder header: what this automation runs on, how big it
 * is, the one sentence standing between it and a run, and the on/off switch.
 *
 * It exists so the two questions users previously had to reverse-engineer from
 * the canvas — "which account is this pointed at?" and "why won't it run?" —
 * are answered before they open a single step.
 */
export function BuilderContextBar(): ReactElement {
  const { flow, editorIdentity, setSelectedAccount } = useAutomation();
  const { extendedUser } = useUser();
  const canManageAutomations = canManageAutomationBySource(
    extendedUser?.role,
    isCommentAutomationFlow(flow.nodes) ? "comment" : "flow",
  );
  const {
    isTogglingActive,
    isToggleDisabled,
    showDeleteActivationConfirm,
    setShowDeleteActivationConfirm,
    handleToggleActive,
    handleConfirmDeleteActivation,
  } = useAutomationActivation();

  const isEditorIdentityReady = editorIdentity.canMutate;
  const existingRuleId = editorIdentity.existingRuleId;
  const showAccountSelector = useMemo(() => shouldShowAccountSelector(flow.nodes ?? []), [flow.nodes]);

  const summary = useMemo(
    () =>
      buildBuilderContextSummary({
        stepCount: flow.nodes.length,
        serviceLabels: flow.nodes.map((node) => (node.service ? getServiceInfo(node.service).label : null)),
      }),
    [flow.nodes],
  );

  // The header selector seeds new steps, but a step can target many accounts of
  // its own. Saying "Runs on Pini Parma" above a step watching 24 accounts made
  // the bar the misleading half, so the real scope is stated next to it.
  const accountScopeOverride = useMemo(
    () => describeFlowAccountScopeOverride({ nodes: flow.nodes, selectedAccountId: flow.selectedAccountId }),
    [flow.nodes, flow.selectedAccountId],
  );

  const handleAccountChange = (businessId: string) => {
    if (!isEditorIdentityReady) {
      toast.error(editorIdentity.error || "Automation is still loading. Try again in a moment.");
      return;
    }
    // `extendedUser.settings` is untyped on the provider; narrow to the three
    // fields the account lookup needs rather than propagating `any`.
    const settings = (extendedUser?.settings ?? []) as readonly WorkspaceAccountSetting[];
    const matchingSetting = settings.find(
      (setting) => setting.workspaceId === extendedUser?.defaultWorkspaceId && setting.businessId === businessId,
    );
    setSelectedAccount(businessId, matchingSetting?.businessName || businessId);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-card px-3 py-2.5 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {showAccountSelector && (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Runs on
              </span>
              <div className={cn("w-[220px]", accountScopeOverride && "opacity-50")}>
                <AutomationAdAccountSelector
                  value={flow.selectedAccountId ?? ""}
                  onChange={handleAccountChange}
                  placeholder="Select ad account..."
                  allowedPlatforms={BUILDER_AUTOMATION_ACCOUNT_PLATFORMS}
                  disabled={!canManageAutomations || !isEditorIdentityReady}
                />
              </div>
            </>
          )}
          <span className="truncate text-xs text-muted-foreground" data-testid="builder-context-summary">
            {summary}
          </span>
          {accountScopeOverride && (
            <span
              className="inline-flex flex-shrink-0 items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              data-testid="builder-account-scope-override"
              title="The steps below pick their own ad accounts, so this one does not decide what they run on. It is still saved on the automation and used by the AI assistant."
            >
              {accountScopeOverride}
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          {/* The readiness pill ("1 field to fill before this can run" / "Ready to
              run") lived here next to the activation toggle, repeating what the
              step cards and the Setup panel already say on the field itself. */}
          <label
            className={cn(
              "flex items-center gap-2 text-xs font-medium",
              isToggleDisabled ? "text-muted-foreground" : "text-foreground",
            )}
            title={
              flow.isActive
                ? "Turn this automation off"
                : existingRuleId === null
                  ? "Saves this automation and turns it on"
                  : "Turn this automation on"
            }
          >
            {isTogglingActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <span>{getActiveToggleLabel(flow.isActive)}</span>
            )}
            <Switch
              data-testid="builder-active-toggle"
              checked={flow.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isToggleDisabled}
              aria-label={flow.isActive ? "Turn this automation off" : "Turn this automation on"}
            />
          </label>
        </div>
      </div>

      <DeleteActivationConfirmDialog
        open={showDeleteActivationConfirm}
        onOpenChange={setShowDeleteActivationConfirm}
        onConfirm={handleConfirmDeleteActivation}
      />
    </>
  );
}
