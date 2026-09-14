import { apiClient } from "../../_lib/api/client";
import type { AnalyticsFilters, AnalyticsResponse } from "./types";

export const fetchAnalytics = async (
  filters: AnalyticsFilters = {},
  token?: string | null,
): Promise<{ success: boolean; data: AnalyticsResponse }> => {
  const params: Record<string, string | undefined> = {
    pageId: filters.pageId || "all",
  };

  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.adAccountId) params.ad_account_id = filters.adAccountId;
  if (filters.platform) params.platform = filters.platform;

  return apiClient.get<{ success: boolean; data: AnalyticsResponse }>("/comments/analytics", params, { token });
};

export const analyticsApi = {
  fetch: fetchAnalytics,
};

export default analyticsApi;
