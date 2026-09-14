import { apiClient } from "../../_lib/api/client";
import type { AdsFilters, AdsResponse, AdCommentsParams, AdCommentsResponse } from "./types";

// ============================================
// Ads API
// ============================================

/**
 * Fetch ads with filters and pagination
 */
export const fetchAds = async (filters: AdsFilters = {}, token?: string | null): Promise<AdsResponse> => {
  const params: Record<string, string | undefined> = {};

  if (filters.search) params.search = filters.search;
  if (filters.sentiment && filters.sentiment !== "all") {
    params.sentiment = filters.sentiment;
  }
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.pageId && filters.pageId !== "all") {
    params.pageId = filters.pageId;
  }
  if (filters.page) params.page = filters.page.toString();
  if (filters.limit) params.limit = filters.limit.toString();

  return apiClient.get<AdsResponse>("/ads", params, { token });
};

/**
 * Fetch more comments for a specific ad
 */
export const fetchAdComments = async (params: AdCommentsParams, token?: string | null): Promise<AdCommentsResponse> => {
  const queryParams: Record<string, string | undefined> = {};

  if (params.offset !== undefined) queryParams.offset = params.offset.toString();
  if (params.limit !== undefined) queryParams.limit = params.limit.toString();
  if (params.pageId) queryParams.pageId = params.pageId;

  return apiClient.get<AdCommentsResponse>(`/ads/${params.postId}/comments`, queryParams, { token });
};

// Export all ads API methods
export const adsApi = {
  fetch: fetchAds,
  fetchComments: fetchAdComments,
};

export default adsApi;
