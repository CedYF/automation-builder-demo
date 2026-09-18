"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { USER_ROLES_ENUM } from "@/lib/auth/constants";

type Role = (typeof USER_ROLES_ENUM)[number];

/**
 * Mock user provider.
 *
 * The real provider (`lib/providers/user-provider.tsx` in the app) resolves the
 * signed-in user over SWR from `/api/user`, then derives the workspace, the
 * organization and the billing plan from it. There is no auth in this repo, so
 * this serves one fixed user instead.
 *
 * The exported surface is deliberately identical — `useUser()` returns the same
 * shape with the same field names — so every consumer that was ported (the config
 * panel, the plan gate, the assistant) compiles and behaves without edits.
 */

export interface Workspace {
  id: string;
  name: string;
  icon?: string | null;
  metaAccountId: number | null;
  tiktokAccountId: number | null;
  multiAdAccountLaunch?: boolean | null;
  metaAdAccount: unknown | null;
  createdAt: string;
  updatedAt: string;
  adAccounts: Array<{
    id: number;
    customName?: string | null;
    accountName: string;
    accountId: string;
    currency: string;
    amountSpent: number;
    businessName: string | null;
    type: string | null;
    updatedAt: string;
  }>;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  logo: string | null;
  plan: string;
  slackChannel?: { id: string; name: string } | null;
  planOverride?: string | null;
  company: string | null;
  workspaces: Workspace[];
}

export interface UserOrganization {
  role: Role;
  organization: Organization;
}

export interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  company: string | null;
  defaultOrganization: string;
  defaultWorkspaceId: string | null;
  defaultAccountId: string | null;
  organizations: UserOrganization[];
  workspaces: Workspace[];
  role: Role;
  debug?: string;
  /** Per-workspace connected-account rows. Selectors filter this by workspaceId. */
  settings: Array<{
    workspaceId?: string;
    businessId?: string;
    businessName?: string | null;
    type?: string | null;
  }>;
  companyAdAccounts?: Array<{
    businessId: string;
    accountId: string;
    businessName: string | null;
    accountName: string;
    type: string | null;
    company?: string | null;
    workspaceId?: string | null;
  }>;
  hasConnectedToken?: boolean;
}

interface UserContextType {
  extendedUser: ExtendedUser | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  currentWorkspace: Workspace | null;
  setCurrentWorkspaceById: (workspaceId: string) => Promise<void>;
  workspaces: Workspace[];
  role: string;
}

const MOCK_WORKSPACE: Workspace = {
  id: "ws_demo",
  name: "Demo Store",
  icon: null,
  metaAccountId: 1,
  tiktokAccountId: null,
  multiAdAccountLaunch: false,
  metaAdAccount: null,
  createdAt: "2026-01-05T09:00:00.000Z",
  updatedAt: "2026-01-05T09:00:00.000Z",
  adAccounts: [
    {
      id: 1,
      accountName: "Demo Store — UK",
      accountId: "act_100200300",
      currency: "GBP",
      amountSpent: 184320,
      businessName: "Demo Store Ltd",
      type: "OWNED",
      updatedAt: "2026-01-05T09:00:00.000Z",
    },
    {
      id: 2,
      accountName: "Demo Store — US",
      accountId: "act_100200301",
      currency: "USD",
      amountSpent: 96140,
      businessName: "Demo Store Ltd",
      type: "OWNED",
      updatedAt: "2026-01-05T09:00:00.000Z",
    },
  ],
};

const MOCK_ORGANIZATION: Organization = {
  id: "org_demo",
  name: "Demo Store",
  createdAt: "2026-01-05T09:00:00.000Z",
  logo: null,
  // Must be a name `lib/billing/plans.ts` recognises, and not "essential":
  // an unknown value normalises to "free" and the essential-plan gate then
  // padlocks every template.
  plan: "in-house",
  planOverride: null,
  company: "demo-store",
  slackChannel: null,
  workspaces: [MOCK_WORKSPACE],
};

const MOCK_USER: ExtendedUser = {
  id: "user_demo",
  email: "demo@example.com",
  name: "Demo User",
  company: "demo-store",
  defaultOrganization: MOCK_ORGANIZATION.id,
  defaultWorkspaceId: MOCK_WORKSPACE.id,
  defaultAccountId: "act_100200300",
  organizations: [{ role: "admin" as Role, organization: MOCK_ORGANIZATION }],
  workspaces: [MOCK_WORKSPACE],
  // "admin", not "owner": the RBAC table grants `adaccounts.write` (which gates
  // creating and running automations) to admin/editor/launcher/drafter only, so
  // an owner sees every template padlocked.
  role: "admin" as Role,
  // One row per connected ad account. The selectors read this list, not
  // `workspaces[].adAccounts`, and match a row to an account by `businessId`,
  // so these ids must be the same ones the accounts carry.
  settings: MOCK_WORKSPACE.adAccounts.map((account) => ({
    workspaceId: MOCK_WORKSPACE.id,
    businessId: account.accountId,
    businessName: account.accountName,
    type: "facebook",
  })),
  hasConnectedToken: true,
  companyAdAccounts: MOCK_WORKSPACE.adAccounts.map((account) => ({
    businessId: account.accountId,
    accountId: account.accountId,
    businessName: account.businessName,
    accountName: account.accountName,
    type: account.type,
    company: "demo-store",
    workspaceId: MOCK_WORKSPACE.id,
  })),
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const contextValue = useMemo<UserContextType>(
    () => ({
      extendedUser: MOCK_USER,
      isLoading: false,
      error: null,
      refetch: async () => undefined,
      currentWorkspace: MOCK_WORKSPACE,
      setCurrentWorkspaceById: async () => undefined,
      workspaces: [MOCK_WORKSPACE],
      role: MOCK_USER.role,
    }),
    [],
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export function useUserOptional(): UserContextType | undefined {
  return useContext(UserContext);
}
