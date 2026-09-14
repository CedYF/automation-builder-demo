import { encrypt } from "@/lib/mock/provider-credentials";
import { apiClient } from "../../_lib/api/client";
import type {
  PendingReply,
  PendingRepliesResponse,
  PendingReplyCountsResponse,
  BulkActionResult,
} from "../../_features/pending-replies/types";

// ============================================
// API Endpoints
// ============================================

const ENDPOINTS = {
  list: "/pending-replies",
  counts: "/pending-replies/counts",
  single: (id: number) => `/pending-replies/${id}`,
  approve: (id: number) => `/pending-replies/${id}/approve`,
  reject: (id: number) => `/pending-replies/${id}/reject`,
  retry: (id: number) => `/pending-replies/${id}/retry`,
  undo: (id: number) => `/pending-replies/${id}/undo`,
  bulkApprove: "/pending-replies/bulk-approve",
  bulkReject: "/pending-replies/bulk-reject",
};

// ============================================
// Request Parameters
// ============================================

export interface GetPendingRepliesParams {
  /** Inbox scope. Optional when `groupId` or `ruleIds` names the automation instead. */
  adAccountId?: string;
  /**
   * The automation's group id. Scopes the queue to every page rule of that
   * automation regardless of ad account, which drafts from /automation-built
   * rules do not record (ADM-11260).
   */
  groupId?: string;
  /** Explicit per-page rules, the fallback for automations that predate grouping. */
  ruleIds?: readonly number[];
  pageId?: string;
  page?: number;
  limit?: number;
}

/** How CommentsServer reads a multi-id query value. */
const ID_LIST_SEPARATOR = ",";

// ============================================
// API Functions
// ============================================

/**
 * Get pending replies with filtering
 * - If groupId / ruleIds is provided, fetches the drafts of that automation
 * - If pageId is provided, fetches replies for that specific page
 * - If pageId is "all" or not provided, fetches all replies for the ad account
 */
export async function getPendingReplies(params: GetPendingRepliesParams): Promise<PendingRepliesResponse> {
  const queryParams: Record<string, string | undefined> = {
    ad_account_id: params.adAccountId,
  };

  if (params.groupId) {
    queryParams.groupId = params.groupId;
  }
  if (params.ruleIds && params.ruleIds.length > 0) {
    queryParams.ruleIds = params.ruleIds.join(ID_LIST_SEPARATOR);
  }

  // Only add pageId if it's not "all"
  if (params.pageId && params.pageId !== "all") {
    queryParams.pageId = params.pageId;
  }

  if (params.page !== undefined) {
    queryParams.page = String(params.page);
  }
  if (params.limit !== undefined) {
    queryParams.limit = String(params.limit);
  }

  return apiClient.get<PendingRepliesResponse>(ENDPOINTS.list, queryParams);
}

/**
 * Get counts by status for UI badges
 */
export async function getPendingReplyCounts(adAccountId: string, pageId?: string): Promise<PendingReplyCountsResponse> {
  const queryParams: Record<string, string | undefined> = {
    ad_account_id: adAccountId,
  };

  if (pageId && pageId !== "all") {
    queryParams.pageId = pageId;
  }

  return apiClient.get<PendingReplyCountsResponse>(ENDPOINTS.counts, queryParams);
}

/**
 * Get a single pending reply
 */
export async function getPendingReply(id: number): Promise<PendingReply> {
  return apiClient.get<PendingReply>(ENDPOINTS.single(id));
}

/**
 * Approve and post a pending reply
 */
export async function approvePendingReply(
  id: number,
  facebookToken: string,
  userEmail: string,
  editedReply?: string,
): Promise<PendingReply> {
  const encryptedToken = encrypt(facebookToken);
  if (!encryptedToken) {
    throw new Error("Failed to encrypt token");
  }

  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.approve(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-encrypted-token": encryptedToken,
      "x-user-email": userEmail,
    },
    body: JSON.stringify({ editedReply }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to approve pending reply");
  }

  return response.json();
}

/**
 * Reject a pending reply
 */
export async function rejectPendingReply(id: number, userEmail: string): Promise<PendingReply> {
  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.reject(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": userEmail,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to reject pending reply");
  }

  return response.json();
}

/**
 * Bulk approve multiple pending replies
 */
export async function bulkApprovePendingReplies(
  ids: number[],
  facebookToken: string,
  userEmail: string,
): Promise<BulkActionResult> {
  const encryptedToken = encrypt(facebookToken);
  if (!encryptedToken) {
    throw new Error("Failed to encrypt token");
  }

  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.bulkApprove}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-encrypted-token": encryptedToken,
      "x-user-email": userEmail,
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to bulk approve pending replies");
  }

  return response.json();
}

/**
 * Bulk reject multiple pending replies
 */
export async function bulkRejectPendingReplies(ids: number[], userEmail: string): Promise<{ success: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.bulkReject}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": userEmail,
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to bulk reject pending replies");
  }

  return response.json();
}

/**
 * Update the edited reply text
 */
export async function updatePendingReplyText(id: number, editedReply: string): Promise<PendingReply> {
  return apiClient.patch<PendingReply>(ENDPOINTS.single(id), { editedReply });
}

/**
 * Retry a failed pending reply
 */
export async function retryPendingReply(id: number, facebookToken: string): Promise<PendingReply> {
  const encryptedToken = encrypt(facebookToken);
  if (!encryptedToken) {
    throw new Error("Failed to encrypt token");
  }

  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.retry(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-encrypted-token": encryptedToken,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to retry pending reply");
  }

  return response.json();
}

/**
 * Undo a posted reply: deletes the live reply comment on the platform and
 * moves the pending reply back to the review queue (status "pending").
 */
export async function undoPendingReply(id: number, facebookToken: string): Promise<PendingReply> {
  const encryptedToken = encrypt(facebookToken);
  if (!encryptedToken) {
    throw new Error("Failed to encrypt token");
  }

  const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_MANAGEMENT_API_URL;
  const response = await fetch(`${baseUrl}${ENDPOINTS.undo(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-encrypted-token": encryptedToken,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to undo the posted reply");
  }

  return response.json();
}

/**
 * Delete a pending reply
 */
export async function deletePendingReply(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.single(id));
}
