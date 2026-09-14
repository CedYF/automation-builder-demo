import type { CreateAxonCampaign } from "./resolve-axon-new-campaigns";

/**
 * The resolver's `createCampaign` boundary, implemented by delegating to the
 * api-admanage public API (which owns AppLovin campaign creation) via a thin Next
 * route — so the browser never talks to AppLovin directly and the UI shares the
 * same server-side create path as MCP/chat. ADM-9094.
 */
export const createAxonCampaignViaApi: CreateAxonCampaign = async (options) => {
  try {
    const response = await fetch("/api/automation-rules/axon-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      campaignId?: string;
      campaign?: unknown;
      error?: string;
    } | null;
    if (!response.ok || !data?.success || !data.campaignId) {
      return { success: false, error: data?.error || "Failed to create the AppLovin campaign." };
    }
    return { success: true, campaignId: data.campaignId, campaign: data.campaign };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create the AppLovin campaign.",
    };
  }
};
