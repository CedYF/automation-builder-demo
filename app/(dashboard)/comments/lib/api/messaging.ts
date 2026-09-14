import { apiClient } from "../../_lib/api/client";

export type ConversationPlatform = "facebook" | "instagram";

export interface PageConversation {
  readonly id: number;
  /** FB Page id for Messenger threads; IG professional account id for Instagram DMs. */
  readonly pageId: string;
  readonly platform: ConversationPlatform;
  readonly participantId: string;
  readonly participantName: string | null;
  readonly participantProfilePicture: string | null;
  readonly lastMessageText: string | null;
  readonly lastMessageAt: string | null;
  readonly lastInboundAt: string | null;
  readonly windowExpiresAt: string | null;
  readonly isWithinMessagingWindow: boolean;
  readonly unreadCount: number;
}

export type PageMessageDirection = "inbound" | "outbound";

export interface PageMessage {
  readonly id: number;
  readonly conversationId: number;
  readonly mid: string | null;
  readonly direction: PageMessageDirection;
  readonly text: string | null;
  readonly attachmentsJson: string | null;
  readonly senderId: string;
  readonly timestamp: string;
}

export interface ConversationsListResponse {
  readonly conversations: PageConversation[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface ConversationMessagesResponse {
  readonly conversation: PageConversation;
  readonly messages: PageMessage[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface ReplyToConversationResponse {
  readonly conversation: PageConversation;
  readonly message: PageMessage;
}

export interface SyncConversationsResponse extends ConversationsListResponse {
  readonly sync: {
    readonly conversationsSeen: number;
    readonly messagesIngested: number;
  };
}

interface ApiSuccess<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
}

export interface FetchConversationsParams {
  readonly pageId: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * CommentsServer Messenger API — Facebook Page + Instagram DMs (ADM-9511).
 * `pageId` is the selected page/account id from the comments header; the
 * server derives the platform from its subscription row.
 */
export const messagingApi = {
  async fetchConversations(
    params: FetchConversationsParams,
    token?: string | null,
  ): Promise<ConversationsListResponse> {
    const response = await apiClient.get<ApiSuccess<ConversationsListResponse>>(
      "/messaging/conversations",
      {
        pageId: params.pageId,
        search: params.search,
        page: params.page,
        limit: params.limit,
      },
      { token },
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || "Failed to load conversations");
    }
    return response.data;
  },

  async fetchMessages(
    conversationId: number,
    token?: string | null,
    options?: { readonly page?: number; readonly limit?: number },
  ): Promise<ConversationMessagesResponse> {
    const response = await apiClient.get<ApiSuccess<ConversationMessagesResponse>>(
      `/messaging/conversations/${conversationId}/messages`,
      {
        page: options?.page,
        limit: options?.limit,
      },
      { token },
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || "Failed to load messages");
    }
    return response.data;
  },

  /**
   * Explicit Meta Graph backfill (Refresh button). Blocking on the server, so
   * the client timeout is lifted — Graph can take longer than the 30s default.
   */
  async syncConversations(pageId: string, token?: string | null): Promise<SyncConversationsResponse> {
    const response = await apiClient.post<ApiSuccess<SyncConversationsResponse>>(
      "/messaging/sync",
      { pageId },
      { token, timeoutMs: null },
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || "Failed to sync conversations");
    }
    return response.data;
  },

  async reply(conversationId: number, message: string, token?: string | null): Promise<ReplyToConversationResponse> {
    const response = await apiClient.post<ApiSuccess<ReplyToConversationResponse>>(
      `/messaging/conversations/${conversationId}/reply`,
      { message },
      { token },
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || "Failed to send message");
    }
    return response.data;
  },
};
