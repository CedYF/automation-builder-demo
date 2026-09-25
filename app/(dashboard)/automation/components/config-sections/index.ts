// Types
export * from "./types";

import { createNotPortedConfig } from "./not-ported-config";

// ---------------------------------------------------------------------------
// Ported verbatim. These are the sections with no live-API dependency, which is
// why they survive the move to a standalone repo intact.
// ---------------------------------------------------------------------------
export { ManualTriggerConfig } from "./manual-trigger-config";
export {
  GoogleDriveActionConfig,
  BoxTriggerConfig,
  HubSpotTriggerConfig,
  FilterConfig,
  TimerConfig,
  DelayConfig,
} from "./generic-service-configs";
export { ApplyRuleConfig } from "./apply-rule-config";
export { WebhookConfig } from "./webhook-config";
export { CommentsTriggerConfig, CommentsActionConfig } from "./comments-demo-config";

// ---------------------------------------------------------------------------
// Stubbed. Each names the real file so the shape of the page stays legible.
// See not-ported-config.tsx for why these could not come across.
// ---------------------------------------------------------------------------
const S = "components/config-sections";

export const MediaLibraryTriggerConfig = createNotPortedConfig(
  "MediaLibraryTriggerConfig",
  `${S}/media-library-trigger-config.tsx`,
);
export const GoogleDriveTriggerConfig = createNotPortedConfig(
  "GoogleDriveTriggerConfig",
  `${S}/google-drive-trigger-config.tsx`,
);
export const DropboxTriggerConfig = createNotPortedConfig("DropboxTriggerConfig", `${S}/dropbox-trigger-config.tsx`);
export const SharePointTriggerConfig = createNotPortedConfig(
  "SharePointTriggerConfig",
  `${S}/sharepoint-trigger-config.tsx`,
);
export const AirTriggerConfig = createNotPortedConfig("AirTriggerConfig", `${S}/air-trigger-config.tsx`);
export const FrameioTriggerConfig = createNotPortedConfig("FrameioTriggerConfig", `${S}/frameio-trigger-config.tsx`);
export const NotionStatusTriggerConfig = createNotPortedConfig(
  "NotionStatusTriggerConfig",
  `${S}/notion-status-trigger-config.tsx`,
);
export const AdscanCompetitorAdConfig = createNotPortedConfig(
  "AdscanCompetitorAdConfig",
  `${S}/adscan-competitor-ad-config.tsx`,
);
export const AdscanAdvertiserLaunchVolumeConfig = createNotPortedConfig(
  "AdscanAdvertiserLaunchVolumeConfig",
  `${S}/adscan-advertiser-launch-volume-config.tsx`,
);
export const MetaAdsActionConfig = createNotPortedConfig("MetaAdsActionConfig", `${S}/meta-ads-action-config.tsx`);
export const DynamicTemplateAdsConfig = createNotPortedConfig(
  "DynamicTemplateAdsConfig",
  `${S}/dynamic-template-ads-config.tsx`,
);
export const MetaAdsPerformanceThresholdConfig = createNotPortedConfig(
  "MetaAdsPerformanceThresholdConfig",
  `${S}/meta-ads-performance-threshold-config.tsx`,
);
export const BestOrganicPostConfig = createNotPortedConfig("BestOrganicPostConfig", `${S}/best-organic-post-config.tsx`);
export const GoogleSheetsTriggerConfig = createNotPortedConfig(
  "GoogleSheetsTriggerConfig",
  `${S}/google-sheets-config.tsx`,
);
export const GoogleSheetsActionConfig = createNotPortedConfig(
  "GoogleSheetsActionConfig",
  `${S}/google-sheets-config.tsx`,
);
export const GoogleSheetsLaunchConfig = createNotPortedConfig(
  "GoogleSheetsLaunchConfig",
  `${S}/google-sheets-launch-config.tsx`,
);
export const GoogleSheetsCatalogConfig = createNotPortedConfig(
  "GoogleSheetsCatalogConfig",
  `${S}/google-sheets-catalog-config.tsx`,
);
export const GoogleSheetsUpdateRowConfig = createNotPortedConfig(
  "GoogleSheetsUpdateRowConfig",
  `${S}/google-sheets-update-row-config.tsx`,
);
export const TestTab = createNotPortedConfig("TestTab", `${S}/test-tab.tsx`);
export const RuleConditionTriggerConfig = createNotPortedConfig(
  "RuleConditionTriggerConfig",
  `${S}/rule-condition-trigger-config.tsx`,
);
export const SetMinimumSpendConfig = createNotPortedConfig("SetMinimumSpendConfig", `${S}/set-minimum-spend-config.tsx`);
export const ApprovalStepConfig = createNotPortedConfig("ApprovalStepConfig", `${S}/approval-step-config.tsx`);
export const AdApprovedConfig = createNotPortedConfig("AdApprovedConfig", `${S}/ad-approved-config.tsx`);
export const CampaignStatusChangeConfig = createNotPortedConfig(
  "CampaignStatusChangeConfig",
  `${S}/campaign-status-change-config.tsx`,
);
export const AdLaunchedConfig = createNotPortedConfig("AdLaunchedConfig", `${S}/ad-launched-config.tsx`);
export const CrossChannelLaunchConfig = createNotPortedConfig(
  "CrossChannelLaunchConfig",
  `${S}/cross-channel-launch-config.tsx`,
);
export const PerformanceMonitoringConfig = createNotPortedConfig(
  "PerformanceMonitoringConfig",
  `${S}/performance-monitoring-config.tsx`,
);
export const TikTokPerformanceThresholdConfig = createNotPortedConfig(
  "TikTokPerformanceThresholdConfig",
  `${S}/tiktok-performance-threshold-config.tsx`,
);
export const TikTokNewAuthorizedPostConfig = createNotPortedConfig(
  "TikTokNewAuthorizedPostConfig",
  `${S}/tiktok-new-authorized-post-config.tsx`,
);
export const TikTokActionConfig = createNotPortedConfig("TikTokActionConfig", `${S}/tiktok-action-config.tsx`);
export const SnapchatPerformanceThresholdConfig = createNotPortedConfig(
  "SnapchatPerformanceThresholdConfig",
  `${S}/snapchat-performance-threshold-config.tsx`,
);
export const SnapchatActionConfig = createNotPortedConfig("SnapchatActionConfig", `${S}/snapchat-action-config.tsx`);
export const NotificationActionConfig = createNotPortedConfig(
  "NotificationActionConfig",
  `${S}/notification-action-config.tsx`,
);
export const GoogleAdsLaunchConfig = createNotPortedConfig("GoogleAdsLaunchConfig", `${S}/google-ads-launch-config.tsx`);
export const GoogleAdsPerformanceThresholdConfig = createNotPortedConfig(
  "GoogleAdsPerformanceThresholdConfig",
  `${S}/google-ads-performance-threshold-config.tsx`,
);
export const GoogleAdsActionConfig = createNotPortedConfig("GoogleAdsActionConfig", `${S}/google-ads-action-config.tsx`);
export const ReportActionConfig = createNotPortedConfig("ReportActionConfig", `${S}/report-action-config.tsx`);
export const MediaLibraryUploadConfig = createNotPortedConfig(
  "MediaLibraryUploadConfig",
  `${S}/media-library-upload-config.tsx`,
);
