"use client";

import { useMemo } from "react";
import { useUser } from "@/lib/providers/user-provider";
import { getEffectiveOrganizationLimits } from "@/lib/billing/organization-limits";
import { isStaffEmail } from "@/lib/auth/is-staff";

const normalizeWorkspaceId = (workspaceId: string | null | undefined) => (workspaceId ?? "").replace(/^ws_/, "");

/** Effective billing plan for the current workspace's organization (matches server-side limits). */
export function useEffectiveOrganizationPlanName(): string {
  const { extendedUser, currentWorkspace } = useUser();
  return useMemo(() => {
    if (!extendedUser) return "free";
    const wsId = normalizeWorkspaceId(currentWorkspace?.id);
    const orgEntry = extendedUser.organizations.find((o) =>
      o.organization.workspaces.some((w) => normalizeWorkspaceId(w.id) === wsId),
    );
    const org = orgEntry?.organization;
    if (!org) return "free";
    return getEffectiveOrganizationLimits(org).effectivePlanName;
  }, [extendedUser, currentWorkspace?.id]);
}

/**
 * Pure helper: decide whether essential-plan automation restrictions apply.
 * Automation Builder staff (and debug-list members) bypass, matching server-side behavior.
 * During impersonation, `sessionEmail` is the real app staff email from `extendedUser.debug`.
 */
export function shouldApplyEssentialAutomationRestrictions(
  sessionEmail: string | null | undefined,
  effectivePlanName: string,
): boolean {
  if (isStaffEmail(sessionEmail)) return false;
  return effectivePlanName === "essential";
}

export function useIsEssentialAutomationPlan(): boolean {
  const { extendedUser } = useUser();
  const effectivePlanName = useEffectiveOrganizationPlanName();
  const sessionEmail = extendedUser?.debug || extendedUser?.email;
  return shouldApplyEssentialAutomationRestrictions(sessionEmail, effectivePlanName);
}

/** The standalone demo has no billing trial. */
export function useAutomationTrialStatus(): { state: "none" | "active" | "expired"; daysRemaining: number } { return { state: "none", daysRemaining: 0 }; }
