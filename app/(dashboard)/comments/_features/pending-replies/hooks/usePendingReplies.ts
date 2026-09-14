import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDemoSession as useSession } from "@/lib/mock/demo-session";
import { toast } from "sonner";
import { pendingRepliesApi, type PendingRepliesResponse, type PendingReplyCountsResponse } from "../../../lib/api";
import type { PendingReply } from "../types";
import { useFacebookToken } from "../../account-management/hooks/useFacebookToken";

// ============================================
// Query Keys
// ============================================

export const pendingRepliesKeys = {
  all: ["pendingReplies"] as const,
  lists: () => [...pendingRepliesKeys.all, "list"] as const,
  list: (scope: PendingRepliesListScope, page?: number, limit?: number) =>
    [
      ...pendingRepliesKeys.lists(),
      scope.adAccountId ?? null,
      scope.groupId ?? null,
      scope.ruleIds?.join(",") ?? null,
      scope.pageId,
      page,
      limit,
    ] as const,
  counts: (adAccountId: string, pageId?: string) => [...pendingRepliesKeys.all, "counts", adAccountId, pageId] as const,
  detail: (id: number) => [...pendingRepliesKeys.all, "detail", id] as const,
};

// ============================================
// Query Hooks
// ============================================

/** What a queue read is scoped to: an ad account (the inbox) or an automation's rules. */
export interface PendingRepliesListScope {
  adAccountId?: string;
  /** The automation's group id, covering every page rule it owns (ADM-11260). */
  groupId?: string;
  /** Explicit per-page rules, for automations that predate grouping. */
  ruleIds?: readonly number[];
  pageId?: string;
}

export interface UsePendingRepliesParams extends PendingRepliesListScope {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

/** A read with neither an account nor a rule has nothing to list. */
function hasPendingRepliesScope(scope: PendingRepliesListScope): boolean {
  return Boolean(scope.adAccountId) || Boolean(scope.groupId) || (scope.ruleIds?.length ?? 0) > 0;
}

/**
 * Hook to fetch pending replies
 * - If ruleIds is provided, fetches the drafts of those automation rules
 * - If pageId is provided, fetches replies for that specific page
 * - If pageId is "all" or not provided, fetches all replies for the ad account
 */
export function usePendingReplies(params: UsePendingRepliesParams) {
  const { adAccountId, groupId, ruleIds, pageId, page, limit, enabled = true } = params;
  const scope: PendingRepliesListScope = { adAccountId, groupId, ruleIds, pageId };

  return useQuery<PendingRepliesResponse>({
    queryKey: pendingRepliesKeys.list(scope, page, limit),
    queryFn: () => pendingRepliesApi.getPendingReplies({ adAccountId, groupId, ruleIds, pageId, page, limit }),
    enabled: enabled && hasPendingRepliesScope(scope),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch a single pending reply by id (e.g. to show the drafted text
 * behind a History run whose processed comment has a `pending:<id>` replyId).
 */
export function usePendingReply(id: number, enabled = true) {
  return useQuery<PendingReply>({
    queryKey: pendingRepliesKeys.detail(id),
    queryFn: () => pendingRepliesApi.getPendingReply(id),
    enabled: enabled && id > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch pending reply counts for badges
 */
export function usePendingReplyCounts(adAccountId: string, pageId?: string) {
  return useQuery<PendingReplyCountsResponse>({
    queryKey: pendingRepliesKeys.counts(adAccountId, pageId),
    queryFn: () => pendingRepliesApi.getPendingReplyCounts(adAccountId, pageId),
    enabled: !!adAccountId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Hook to approve a pending reply
 */
export function useApprovePendingReply() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { data: token } = useFacebookToken();

  return useMutation({
    mutationFn: async ({ id, editedReply }: { id: number; editedReply?: string }) => {
      if (!token) throw new Error("Facebook token not available");
      if (!session?.user?.email) throw new Error("User email not available");

      return pendingRepliesApi.approvePendingReply(id, token, session.user.email, editedReply);
    },
    onSuccess: (data) => {
      if (data.status === "posted") {
        toast.success("Reply posted successfully!");
      } else if (data.status === "failed") {
        toast.error(`Failed to post: ${data.errorMessage}`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve reply");
    },
    // Refetch on success AND error: when the server rejects an approve because
    // the reply is no longer pending (e.g. already posted by the scheduler),
    // the list is stale and must refetch so the dead card disappears.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

/**
 * Hook to reject a pending reply
 */
export function useRejectPendingReply() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!session?.user?.email) throw new Error("User email not available");

      return pendingRepliesApi.rejectPendingReply(id, session.user.email);
    },
    onSuccess: () => {
      // Spell out that nothing was published — the whole point of declining a
      // draft is that it never reaches the live comment (see ADM-8031, where a
      // customer believed a declined reply had gone live).
      toast.success("Reply not sent", {
        description: "You declined this draft, so it was never posted to the comment.",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to reject reply");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

/**
 * Hook to bulk approve pending replies
 */
export function useBulkApprovePendingReplies() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { data: token } = useFacebookToken();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!token) throw new Error("Facebook token not available");
      if (!session?.user?.email) throw new Error("User email not available");

      return pendingRepliesApi.bulkApprovePendingReplies(ids, token, session.user.email);
    },
    onSuccess: (data) => {
      toast.success(`Approved ${data.success} replies${data.failed > 0 ? `, ${data.failed} failed` : ""}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to bulk approve");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

/**
 * Hook to bulk reject pending replies
 */
export function useBulkRejectPendingReplies() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!session?.user?.email) throw new Error("User email not available");

      return pendingRepliesApi.bulkRejectPendingReplies(ids, session.user.email);
    },
    onSuccess: (data) => {
      toast.success(`${data.success} ${data.success === 1 ? "reply" : "replies"} not sent`, {
        description: "Declined drafts were not posted to any comments.",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to bulk reject");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

/**
 * Hook to update pending reply text
 */
export function useUpdatePendingReplyText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, editedReply }: { id: number; editedReply: string }) => {
      return pendingRepliesApi.updatePendingReplyText(id, editedReply);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
      toast.success("Reply updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update reply");
    },
  });
}

/**
 * Hook to retry a failed pending reply
 */
/**
 * Hook to undo a posted reply — deletes the live reply on the platform and
 * moves the pending reply back to the review queue (status "pending").
 */
export function useUndoPendingReply() {
  const queryClient = useQueryClient();
  const { data: token } = useFacebookToken();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!token) throw new Error("Facebook token not available");

      return pendingRepliesApi.undoPendingReply(id, token);
    },
    onSuccess: () => {
      toast.success("Reply removed", {
        description: "The reply was deleted and the draft moved back to Pending for review.",
      });
    },
    onError: (error) => {
      toast.error("Couldn't undo this reply", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

export function useRetryPendingReply() {
  const queryClient = useQueryClient();
  const { data: token } = useFacebookToken();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!token) throw new Error("Facebook token not available");

      return pendingRepliesApi.retryPendingReply(id, token);
    },
    onSuccess: (data) => {
      if (data.status === "posted") {
        toast.success("Reply posted successfully!");
      } else {
        toast.error(`Retry failed: ${data.errorMessage}`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to retry");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
    },
  });
}

/**
 * Hook to delete a pending reply
 */
export function useDeletePendingReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return pendingRepliesApi.deletePendingReply(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingRepliesKeys.all });
      toast.success("Draft deleted", {
        description: "This draft was removed and was not posted to the comment.",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete reply");
    },
  });
}
