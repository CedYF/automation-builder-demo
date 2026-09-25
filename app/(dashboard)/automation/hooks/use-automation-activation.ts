"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/providers/user-provider";
import { canManageAutomationBySource } from "@/lib/automation/automation-access";
import { useAutomation } from "../contexts/automation-context";
import { listBuilderBlockersFromFlow } from "../lib/builder-readiness";
import {
  buildAutomationStatusRequest,
  readAutomationStatusError,
  sendAutomationStatusRequest,
} from "../lib/automation-status-request";
import {
  actionEventToType,
  COMMENTS_SERVICE,
  isCommentAutomationFlow,
  readCommentGroupIdFromFlow,
} from "../lib/comment-flow-mapper";

interface ActionLikeNode {
  readonly type: string;
  readonly service?: string;
  readonly event?: string;
}

/** True once any comments action step on the flow is set to delete. */
function hasDeleteCommentAction(nodes: ReadonlyArray<ActionLikeNode>): boolean {
  return nodes.some(
    (node) => node.type === "action" && node.service === COMMENTS_SERVICE && actionEventToType(node.event) === "delete",
  );
}

export interface AutomationActivationControls {
  readonly isTogglingActive: boolean;
  /** Gates the control itself — permission, editor readiness, an unsaved automation, or a write in flight. */
  readonly isToggleDisabled: boolean;
  readonly showDeleteActivationConfirm: boolean;
  setShowDeleteActivationConfirm: (open: boolean) => void;
  /** Turns the automation on/off. Blocker and destructive-delete checks run inline and surface as a toast or the confirm dialog. */
  handleToggleActive: (nextActive: boolean) => Promise<void>;
  /** Proceeds with activation after the destructive-delete confirmation dialog is accepted. */
  handleConfirmDeleteActivation: () => void;
}

/**
 * Turns an automation on/off from anywhere in the builder. The header
 * context-bar switch and the execution panel's post-run CTA both drive the
 * same optimistic write, permission/blocker checks, and destructive-delete
 * confirmation, so activating from either place behaves identically.
 */
export function useAutomationActivation(): AutomationActivationControls {
  const { flow, editorIdentity, setFlowActive, saveAutomation } = useAutomation();
  const { extendedUser } = useUser();
  const canManageAutomations = canManageAutomationBySource(
    extendedUser?.role,
    isCommentAutomationFlow(flow.nodes) ? "comment" : "flow",
  );
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [showDeleteActivationConfirm, setShowDeleteActivationConfirm] = useState(false);

  const isEditorIdentityReady = editorIdentity.canMutate;
  const existingRuleId = editorIdentity.existingRuleId;
  const blockers = listBuilderBlockersFromFlow({ nodes: flow.nodes, selectedAccountId: flow.selectedAccountId });
  const hasDeleteAction = hasDeleteCommentAction(flow.nodes);

  /**
   * Writes the on/off state. `ruleId` is threaded through explicitly (rather
   * than closing over `existingRuleId`) so its non-null type holds here too —
   * the null case is rejected by `handleToggleActive` before this ever runs.
   */
  const activateAutomation = async (nextActive: boolean, ruleId: number) => {
    // TODO(candidate): logEvent flow_activated. A successful run needs execution evidence and stays simulated here.
    // Optimistic — the switch/button is the primary signal that this thing is
    // live, so it must not lag behind the click. Reverted below if the write fails.
    const previousActive = flow.isActive;
    setFlowActive(nextActive);
    setIsTogglingActive(true);
    try {
      const response = await sendAutomationStatusRequest(
        buildAutomationStatusRequest({
          flowId: flow.id,
          ruleId,
          groupId: readCommentGroupIdFromFlow(flow.nodes),
          // Read from the steps, not from flow.id: activating an unsaved
          // comment automation saves it first, and this closure still holds
          // the pre-save draft id (Codex review, PR #14447).
          isCommentAutomation: isCommentAutomationFlow(flow.nodes),
          nextActive,
        }),
      );
      if (!response.ok) {
        setFlowActive(previousActive);
        toast.error(await readAutomationStatusError(response, "Could not update the automation status"));
        return;
      }
      toast.success(nextActive ? "Automation turned on" : "Automation turned off");
    } catch {
      setFlowActive(previousActive);
      toast.error("Could not update the automation status");
    } finally {
      setIsTogglingActive(false);
    }
  };

  /**
   * The rule id to write the status against, saving first when the automation
   * has never been persisted. Flipping the switch is an unambiguous "I want
   * this live" — making the user click Save first was a second click for
   * something we can infer, so the save happens here instead.
   */
  const resolveRuleIdForActivation = async (): Promise<number | null> => {
    if (existingRuleId !== null) return existingRuleId;

    const result = await saveAutomation({ mode: "update", name: flow.name });
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    if (result.warning) toast.warning(result.warning);
    return result.ruleId;
  };

  const handleToggleActive = async (nextActive: boolean) => {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }
    if (nextActive && blockers.length > 0) {
      toast.error(blockers[0] ?? "Finish the setup before turning this on");
      return;
    }

    // Turning on a delete-action rule starts permanently removing comments with
    // no further checkpoint, so it gets one explicit confirmation. Every other
    // case (turning off, or turning on hide/reply/like) proceeds immediately.
    if (nextActive && hasDeleteAction) {
      setShowDeleteActivationConfirm(true);
      return;
    }

    setIsTogglingActive(true);
    const ruleId = await resolveRuleIdForActivation().finally(() => setIsTogglingActive(false));
    if (ruleId === null) return;

    await activateAutomation(nextActive, ruleId);
  };

  const handleConfirmDeleteActivation = () => {
    setShowDeleteActivationConfirm(false);
    void (async () => {
      setIsTogglingActive(true);
      const ruleId = await resolveRuleIdForActivation().finally(() => setIsTogglingActive(false));
      if (ruleId === null) return;
      await activateAutomation(true, ruleId);
    })();
  };

  // An unsaved automation no longer disables the switch — flipping it saves
  // first (see resolveRuleIdForActivation), so there is nothing to gate on.
  const isToggleDisabled = !canManageAutomations || !isEditorIdentityReady || isTogglingActive;

  return {
    isTogglingActive,
    isToggleDisabled,
    showDeleteActivationConfirm,
    setShowDeleteActivationConfirm,
    handleToggleActive,
    handleConfirmDeleteActivation,
  };
}
