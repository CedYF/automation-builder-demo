import { getPermissionsByRole, type PermissionAction } from "@/lib/api/rbac/permissions";
import { USER_ROLES_ENUM } from "@/lib/auth/constants";

type Role = (typeof USER_ROLES_ENUM)[number];

export const MANAGE_AUTOMATIONS_PERMISSION: PermissionAction = "adaccounts.write";

/** Where an automation is stored, which decides which access gate applies. */
export type AutomationSource = "flow" | "comment";

/**
 * How much of the Automations area a role can reach.
 *
 * - `full`: flow automations and comment automations.
 * - `comments-only`: comment automations only (ADM-11300). The area renders the
 *   comment rows, comment templates and comment approvals, and the flow list
 *   is never requested.
 * - `none`: the area is hidden and its routes refuse the role.
 */
export type AutomationAccessScope = "full" | "comments-only" | "none";

export function isKnownRole(role: string | null | undefined): role is Role {
  return USER_ROLES_ENUM.some((knownRole) => knownRole === role);
}

/**
 * Roles that must not see or open flow automations at all (sidebar link + page
 * route), per ADM-8415 (analyst, commenter) and Ced's 2026-07-02 request
 * (launcher). This is a deny-list, intentionally separate from
 * MANAGE_AUTOMATIONS_PERMISSION (which gates create/edit/run): the manage
 * permission (`adaccounts.write`) excludes `owner` and `member`, so reusing it
 * as a view gate would wrongly lock those roles out of automations entirely.
 *
 * `drafter` (ADM-9894) is here for the same reason as `launcher`: it holds
 * `adaccounts.write` so it can save launch drafts, but an agency's client must
 * not author automations against the ad account.
 *
 * A role listed here AND in COMMENT_AUTOMATIONS_ONLY_ROLES keeps the flow
 * restriction but is let into the comment-only slice of the area.
 */
export const AUTOMATIONS_RESTRICTED_ROLES: readonly Role[] = ["analyst", "commenter", "launcher", "drafter"];

/**
 * Roles whose automation access is limited to comment automations (ADM-11300).
 *
 * Analysts and commenters managed comment automations from the Comments page
 * until that tab moved into /automation on 2026-08-19; this restores the same
 * reach without opening flow automations, which neither role ever had.
 */
export const COMMENT_AUTOMATIONS_ONLY_ROLES: readonly Role[] = ["analyst", "commenter"];

export function isCommentAutomationsOnlyRole(role: string | null | undefined): boolean {
  return COMMENT_AUTOMATIONS_ONLY_ROLES.some((scopedRole) => scopedRole === role);
}

/**
 * Resolves the automation access scope for a role.
 *
 * Permissive by default: unknown / missing roles (e.g. while the user is still
 * loading) resolve to `full` so we never flash an access-denied screen or an
 * empty list before the real role resolves. Server routes see the real role.
 */
export function resolveAutomationAccessScope(role: string | null | undefined): AutomationAccessScope {
  if (isCommentAutomationsOnlyRole(role)) return "comments-only";
  if (AUTOMATIONS_RESTRICTED_ROLES.some((restrictedRole) => restrictedRole === role)) return "none";
  return "full";
}

/** Whether a role is allowed to view/navigate to the Automations area at all. */
export function canViewAutomations(role: string | null | undefined): boolean {
  return resolveAutomationAccessScope(role) !== "none";
}

/** Whether a role may read flow automations (the Prisma `AutomationRule` list). */
export function canViewFlowAutomations(role: string | null | undefined): boolean {
  return resolveAutomationAccessScope(role) === "full";
}

/** Whether a role may create, edit, run or delete flow automations. */
export function canManageAutomationRules(role: string | null | undefined): boolean {
  if (!isKnownRole(role)) {
    return false;
  }

  // Roles hidden from flow automations must not manage them either, even when
  // they hold the write permission (launchers keep `adaccounts.write` for
  // launching but are denied here).
  if (!canViewFlowAutomations(role)) {
    return false;
  }

  return getPermissionsByRole(role).includes(MANAGE_AUTOMATIONS_PERMISSION);
}

/**
 * Whether a role may create, edit or delete comment automations.
 *
 * Every flow manager can, plus the comment-only roles: their whole reason for
 * being in the area is to manage these.
 */
export function canManageCommentAutomations(role: string | null | undefined): boolean {
  return canManageAutomationRules(role) || isCommentAutomationsOnlyRole(role);
}

/** One gate for surfaces that show both kinds of automation side by side. */
export function canManageAutomationBySource(role: string | null | undefined, source: AutomationSource): boolean {
  return source === "comment" ? canManageCommentAutomations(role) : canManageAutomationRules(role);
}

/**
 * The manage gate for a list that carries one boolean for every row it shows.
 * A comment-only role only ever sees comment rows, so its comment gate is the
 * right answer for the whole list; everyone else is judged on flow rules.
 */
export function canManageAutomationsForScope(role: string | null | undefined): boolean {
  return resolveAutomationAccessScope(role) === "comments-only"
    ? canManageCommentAutomations(role)
    : canManageAutomationRules(role);
}
