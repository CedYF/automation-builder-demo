/**
 * Automation Registry
 *
 * Central source of truth for all available triggers and actions.
 * Used by:
 * - UI components (app selectors, config panels)
 * - API routes (validation)
 * - AI Copilot (system prompt generation)
 *
 * When adding new integrations:
 * 1. Add the trigger/action definition here
 * 2. The AI copilot will automatically learn about it
 */

import { NOTION_AUTOMATION_TRIGGER } from "@/lib/integrations/notion/automation-trigger";
import { MONDAY_AUTOMATION_TRIGGER } from "@/lib/integrations/monday/constants";
import { PERFORMANCE_MONITORING_WEEKDAYS } from "@/lib/automation/performance-monitoring-date-range";
import { AXON_MAX_WINDOW_DAYS } from "@/lib/axon/reporting-types";

// ============================================================================
// TYPES
// ============================================================================

export interface TriggerDefinition {
  service: string;
  event: string;
  label: string;
  description: string;
  config: ConfigField[];
  outputs: OutputField[];
  examples?: string[];
}

export interface ActionDefinition {
  service: string;
  event: string;
  label: string;
  description: string;
  config: ConfigField[];
  examples?: string[];
}

export interface ConfigField {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "array";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  description?: string;
  /**
   * Value the UI and the runtime both fall back to when the stored value is
   * missing or empty. A required field that declares one is never a setup gap:
   * the step renders and runs with the default, so readiness must not demand an
   * explicit write the user has no way to perform (the select already shows the
   * value, so re-picking it fires no change). See config-panel-preview-ready.
   */
  defaultValue?: string | number | boolean;
}

/**
 * Interval fields paired with the "custom" Check Frequency option (ADM-11829).
 * Only read when `checkFrequency` is "custom"; the cron clamps the pair to
 * 5 minutes – 30 days, so "once every 4 days" is `4` + `days`.
 */
const CUSTOM_INTERVAL_CONFIG_FIELDS: readonly ConfigField[] = [
  {
    name: "intervalValue",
    type: "number",
    label: "Run Every",
    required: false,
    placeholder: "4",
    description: 'Interval count for the "custom" check frequency, e.g. 4 with intervalUnit "days". Default: 1',
  },
  {
    name: "intervalUnit",
    type: "select",
    label: "Interval Unit",
    required: false,
    options: [
      { value: "minutes", label: "Minutes" },
      { value: "hours", label: "Hours" },
      { value: "days", label: "Days" },
    ],
    description: 'Unit for the "custom" check frequency. Default: days',
  },
];

export interface OutputField {
  name: string;
  type: string;
  description: string;
}

// ============================================================================
// POLLING SCHEDULE
// ============================================================================

type CadenceOptions = NonNullable<ConfigField["options"]>;

/** Cadences for triggers that can be left fully manual and poll sub-daily. */
export const PERFORMANCE_THRESHOLD_CADENCES: CadenceOptions = [
  { value: "manual", label: "Manual only (Run button)" },
  { value: "hourly", label: "Hourly (Beta)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Cadences for triggers that compare a window and need at least a day between runs. */
export const SCHEDULED_SCAN_CADENCES: CadenceOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface PollingScheduleFieldsOptions {
  /** Cadences this trigger offers. */
  cadences: CadenceOptions;
  /** What the trigger is checking for, e.g. "matching ads". */
  checksFor: string;
  /** Whether a cadence must be chosen. Manual-capable triggers leave it optional. */
  required?: boolean;
}

/**
 * Builds the schedule config fields shared by every trigger the cron polls on a
 * calendar: the cadence plus the per-rule slot it runs in.
 *
 * Declared in one place so the assistant sees the same vocabulary, defaults and
 * value formats that `polling-run-time.ts` and the cron's `run-time.ts` enforce
 * (ADM-9818, ADM-10118). Weekday names and the "last" sentinel are lowercase in
 * all three.
 */
function buildPollingScheduleFields({
  cadences,
  checksFor,
  required = false,
}: PollingScheduleFieldsOptions): ConfigField[] {
  // PollingScheduleField shows the first cadence when nothing is stored, so
  // that cadence is the field's real default. "manual" is the exception: it is
  // stored as an absent value, so an unset cadence there is a genuine choice.
  const fallbackCadence = cadences[0]?.value;
  const defaultValue = fallbackCadence && fallbackCadence !== "manual" ? fallbackCadence : undefined;
  return [
    {
      name: "checkFrequency",
      type: "select",
      label: "Check Frequency",
      required,
      defaultValue,
      options: cadences,
      description: `How often to automatically check for ${checksFor}.`,
    },
    {
      name: "checkTime",
      type: "string",
      label: "Run At",
      required: false,
      placeholder: "09:00",
      description:
        "Hour to run for the daily/weekly/monthly frequencies, 24-hour BST (Europe/London). Runs on the hour. Default: 09:00",
    },
    {
      name: "checkDays",
      type: "array",
      label: "Run On (weekly)",
      required: false,
      placeholder: "monday",
      description:
        'Weekdays for the weekly frequency, lowercase, e.g. ["monday","thursday"]. Every selected day runs at Run At. Default: ["monday"]',
    },
    {
      name: "checkDayOfMonth",
      type: "string",
      label: "Day of Month (monthly)",
      required: false,
      placeholder: "1",
      description: 'Day for the monthly frequency: "1"-"28", or "last" for the final day of the month. Default: "1"',
    },
  ];
}

// ============================================================================
// TRIGGERS
// ============================================================================

export const TRIGGERS: TriggerDefinition[] = [
  {
    service: "media-library",
    event: "Media Uploaded to Board",
    label: "Media Library",
    description: "Triggers when a video or image is uploaded to a Media Library board",
    config: [
      {
        name: "boardNameMatchType",
        type: "select",
        label: "Board Match Type",
        required: false,
        options: [
          { value: "all", label: "All Boards" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match board names. Default: All Boards",
      },
      {
        name: "boardNameFilter",
        type: "string",
        label: "Board Name Filter",
        required: false,
        description: "Filter boards by name (e.g., 'cedric' to match boards containing 'cedric')",
      },
      {
        name: "boardId",
        type: "string",
        label: "Board ID",
        required: false,
        description: "Optional - specific board ID to watch",
      },
      {
        name: "assetNameMatchType",
        type: "select",
        label: "Asset Name Match Type",
        required: false,
        options: [
          { value: "all", label: "All Names" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match asset names. Default: All Names",
      },
      {
        name: "assetNameFilter",
        type: "string",
        label: "Asset Name Filter",
        required: false,
        description: "Filter assets by name (e.g., 'promo' to match assets containing 'promo')",
      },
      {
        name: "groupingEnabled",
        type: "boolean",
        label: "Grouping Enabled",
        required: false,
        description: "When enabled, buffer uploads and execute only after the threshold is reached",
      },
      {
        name: "groupThreshold",
        type: "number",
        label: "Group Threshold",
        required: false,
        description: "Number of assets to accumulate before executing (min 2)",
      },
    ],
    outputs: [
      { name: "assetId", type: "string", description: "The uploaded asset's ID" },
      { name: "assetName", type: "string", description: "Name of the uploaded file" },
      { name: "mediaUrl", type: "string", description: "URL to the media file" },
      { name: "boardId", type: "string", description: "ID of the board" },
      { name: "boardName", type: "string", description: "Name of the board" },
    ],
    examples: [
      "Launch ads when media is uploaded to boards containing 'creative'",
      "Trigger when files are added to the 'cedric' board",
    ],
  },
  {
    service: NOTION_AUTOMATION_TRIGGER.service,
    event: NOTION_AUTOMATION_TRIGGER.event,
    label: "Notion",
    description: "Triggers when a Notion database automation sends a matching status update",
    config: [
      {
        name: "notionDatabaseId",
        type: "string",
        label: "Database ID",
        required: false,
        placeholder: "Optional Notion database ID",
        description: "Only run for pages in this Notion database. Hyphens are optional.",
      },
      {
        name: "notionStatusProperty",
        type: "string",
        label: "Status Property",
        required: false,
        placeholder: NOTION_AUTOMATION_TRIGGER.defaultStatusProperty,
        description: "Name of the status property included in the Notion webhook content.",
      },
      {
        name: "notionStatusValue",
        type: "string",
        label: "Status Value",
        required: false,
        placeholder: "Launch",
        description: "Only run when the selected status matches. Leave blank to trust the Notion automation condition.",
      },
      {
        name: "notionTemplateProperty",
        type: "string",
        label: "Template Property",
        required: false,
        placeholder: NOTION_AUTOMATION_TRIGGER.defaultTemplateProperty,
        description:
          "Notion property whose value is the AdManage template name or a source ad ID. Exposed as templateName.",
      },
    ],
    outputs: [
      { name: "pageId", type: "string", description: "Notion page ID" },
      { name: "pageTitle", type: "string", description: "Notion page title" },
      { name: "pageUrl", type: "string", description: "Notion page URL" },
      { name: "databaseId", type: "string", description: "Notion database ID" },
      { name: "status", type: "string", description: "Current Notion status" },
      { name: "templateName", type: "string", description: "Template name from the configured Notion property" },
      { name: "headline", type: "string", description: "Headline property when present" },
      { name: "description", type: "string", description: "Body / primary text property when present" },
      { name: "linkUrl", type: "string", description: "Destination URL property when present" },
      { name: "adName", type: "string", description: "Ad name property when present" },
      { name: "adSetName", type: "string", description: "Ad set name property when present" },
      { name: "sourceAdId", type: "string", description: "Source ad ID property when present" },
      { name: "mediaUrl", type: "string", description: "First attached creative URL" },
      { name: "mediaType", type: "string", description: "Attached creative media type" },
      { name: "assets", type: "array", description: "All attached Notion creatives" },
      { name: "mapped", type: "object", description: "Flattened Notion property values by column name" },
      { name: "notionProperties", type: "object", description: "Properties selected for the webhook content" },
    ],
    examples: [
      "When a Notion creative status changes to Launch, launch it as a Meta ad",
      "Use the Template column to pick an AdManage template, then launch when Status is Launch",
    ],
  },

  {
    service: MONDAY_AUTOMATION_TRIGGER.service,
    event: MONDAY_AUTOMATION_TRIGGER.event,
    label: "Monday.com",
    description: "Triggers when a Monday board webhook reports a matching status change",
    config: [
      {
        name: "mondayBoardId",
        type: "string",
        label: "Board ID",
        required: false,
        placeholder: "Optional Monday board ID",
        description: "Only run for items on this Monday board.",
      },
      {
        name: "mondayStatusColumn",
        type: "string",
        label: "Status Column",
        required: false,
        placeholder: MONDAY_AUTOMATION_TRIGGER.defaultStatusColumn,
        description: "Status column title or ID used when reading the item.",
      },
      {
        name: "mondayStatusValue",
        type: "string",
        label: "Status Value",
        required: false,
        placeholder: "Ready to Launch",
        description: "Only run when the status matches. Leave blank to accept any status change webhook.",
      },
    ],
    outputs: [
      { name: "boardId", type: "string", description: "Monday board ID" },
      { name: "itemId", type: "string", description: "Monday item ID" },
      { name: "itemName", type: "string", description: "Monday item name" },
      { name: "status", type: "string", description: "Current Monday status label" },
      { name: "statusColumn", type: "string", description: "Status column title/id" },
      { name: "mondayItem", type: "object", description: "Fetched Monday item payload" },
    ],
    examples: [
      "When a Monday item status changes to Ready to Launch, launch Meta ads",
      "Notify Slack when a Monday creative item becomes Approved",
    ],
  },
  {
    service: "dropbox",
    event: "New File in Folder",
    label: "Dropbox",
    description: "Triggers when a new file is added to a Dropbox folder",
    config: [
      {
        name: "folderPath",
        type: "string",
        label: "Folder Path",
        required: true,
        description: "Dropbox folder path (e.g., /Marketing/Creatives)",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new files. Default: Daily",
      },
    ],
    outputs: [
      { name: "fileId", type: "string", description: "The new file's Dropbox ID" },
      { name: "fileName", type: "string", description: "Name of the file" },
      { name: "fileUrl", type: "string", description: "Temporary download URL" },
      { name: "folderName", type: "string", description: "Name of the folder" },
      { name: "fileSize", type: "number", description: "Size in bytes" },
      { name: "mimeType", type: "string", description: "File MIME type" },
    ],
    examples: ["When video is added to Dropbox, launch as ad", "Create ads from files in my Dropbox folder"],
  },
  {
    service: "air",
    event: "New Asset in Board",
    label: "AIR",
    description:
      "Triggers when a new clip is added to a publicly shared AIR board. Requires the board to have 'Anyone with the link can view' sharing enabled.",
    config: [
      {
        name: "boardUrl",
        type: "string",
        label: "AIR Board URL",
        required: true,
        placeholder: "https://app.air.inc/a/bchOiIxFd",
        description:
          "Paste the share URL of a public AIR board. Short URLs and full /a/{shortId}/b/{boardId} URLs both work.",
      },
      {
        name: "boardName",
        type: "string",
        label: "Board Name (optional)",
        required: false,
        description: "Display name used in trigger outputs and templates. Defaults to the board's short ID.",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new clips. Default: Daily",
      },
    ],
    outputs: [
      { name: "assetId", type: "string", description: "The new clip's AIR ID" },
      { name: "assetName", type: "string", description: "Clip name" },
      { name: "fileUrl", type: "string", description: "Direct URL to the clip's original file" },
      { name: "mediaUrl", type: "string", description: "Alias for fileUrl" },
      { name: "mimeType", type: "string", description: "File MIME type" },
      { name: "mediaType", type: "string", description: "'video' or 'image'" },
      { name: "boardName", type: "string", description: "Board name" },
      { name: "shortId", type: "string", description: "AIR short URL ID" },
    ],
    examples: [
      "When creative team approves a clip in AIR, launch it as an ad",
      "Post new AIR board clips as ads in Meta",
    ],
  },
  {
    service: "frameio",
    event: "New File in Project",
    label: "Frame.io",
    description:
      "Triggers when new files appear in a Frame.io project folder. Optionally filter by review label (Approved, In Progress, Needs Review).",
    config: [
      {
        name: "frameioAccountId",
        type: "string",
        label: "Frame.io Account",
        required: true,
        description: "Frame.io account ID (selected via the account picker)",
      },
      {
        name: "folderId",
        type: "string",
        label: "Folder",
        required: true,
        description: "Frame.io folder to watch for new files (selected via the folder picker)",
      },
      {
        name: "projectName",
        type: "string",
        label: "Project Name",
        required: false,
        description: "Display name for the project (shown in trigger outputs)",
      },
      {
        name: "labelFilter",
        type: "select",
        label: "Label Filter",
        required: false,
        options: [
          { value: "all", label: "All Labels" },
          { value: "approved", label: "Approved" },
          { value: "in_progress", label: "In Progress" },
          { value: "needs_review", label: "Needs Review" },
          { value: "none", label: "No Label" },
        ],
        description: "Only trigger on files with this review label. Default: All Labels",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new files. Default: Daily",
      },
    ],
    outputs: [
      { name: "fileId", type: "string", description: "The new file's Frame.io ID" },
      { name: "fileName", type: "string", description: "Name of the file" },
      { name: "fileUrl", type: "string", description: "Direct URL to the file's original media" },
      { name: "mediaUrl", type: "string", description: "Alias for fileUrl" },
      { name: "mimeType", type: "string", description: "File MIME type" },
      { name: "mediaType", type: "string", description: "'video' or 'image'" },
      { name: "fileSize", type: "number", description: "Size in bytes" },
      {
        name: "label",
        type: "string",
        description: "Frame.io review label (approved, in_progress, needs_review, none)",
      },
      { name: "projectName", type: "string", description: "Project display name" },
      { name: "thumbnail", type: "string", description: "Thumbnail URL" },
    ],
    examples: [
      "When approved files land in Frame.io, launch them as ads",
      "Auto-upload Frame.io media to the Media Library when approved",
      "Notify Slack when new files appear in a Frame.io folder",
    ],
  },
  {
    service: "adscan",
    event: "New Competitor Ad",
    label: "Adscan",
    description:
      "Triggers when new ads from configured advertisers in Adscan match your filters (platform, format, language, CTA, views threshold).",
    config: [
      {
        name: "adscanAdvertisers",
        type: "string",
        label: "Advertisers",
        required: true,
        description: "Advertiser names to monitor (Adscan matches by company name).",
      },
      {
        name: "adscanPlatforms",
        type: "string",
        label: "Platforms",
        required: false,
        description: "Optional platform filter — facebook, instagram, audience_network, messenger.",
      },
      {
        name: "adscanFormats",
        type: "string",
        label: "Formats",
        required: false,
        description: "Optional format filter — video, image, carousel, dco, dpa, other.",
      },
      {
        name: "adscanLanguages",
        type: "string",
        label: "Languages",
        required: false,
        description: "Optional language codes (e.g., en, es).",
      },
      {
        name: "adscanCtaTypes",
        type: "string",
        label: "CTA Types",
        required: false,
        description: "Optional CTA button types (e.g., SHOP_NOW, LEARN_MORE).",
      },
      {
        name: "adscanViewsMin",
        type: "number",
        label: "Min views",
        required: false,
        description: "Minimum view count. US ads with no view data are excluded when this is set.",
      },
      {
        name: "adscanViewsMax",
        type: "number",
        label: "Max views",
        required: false,
        description: "Maximum view count. US ads with no view data are excluded when this is set.",
      },
      {
        name: "adscanSpendMin",
        type: "number",
        label: "Min spend",
        required: false,
        description: "Minimum spend (approximated from views). US ads with no view data are excluded when this is set.",
      },
      {
        name: "adscanSpendMax",
        type: "number",
        label: "Max spend",
        required: false,
        description: "Maximum spend (approximated from views). US ads with no view data are excluded when this is set.",
      },
      {
        name: "adscanSearchQuery",
        type: "string",
        label: "Search query",
        required: false,
        description: "Free-text search across headline / body.",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check Adscan for new matching ads. Default: Daily",
      },
    ],
    outputs: [
      { name: "adId", type: "string", description: "Adscan ad ID" },
      { name: "company", type: "string", description: "Advertiser company name" },
      { name: "views", type: "number", description: "View count (null for US ads)" },
      { name: "thumbnailUrl", type: "string", description: "Thumbnail URL" },
      { name: "previewUrl", type: "string", description: "Preview URL" },
      { name: "ads", type: "array", description: "Full list of matching ads in this batch" },
    ],
    examples: [
      "Slack me when Glossier launches a Reels ad with over 10K views",
      "Notify when a competitor releases a new video CTA in Spanish",
    ],
  },
  {
    service: "adscan",
    event: "Advertiser Launch Volume",
    label: "Adscan",
    description:
      "Triggers when a tracked advertiser publishes more than X ads in a rolling window (default 30 days). Surfaces sudden bursts of activity.",
    config: [
      {
        name: "adscanLaunchVolumeAdvertisers",
        type: "string",
        label: "Advertisers",
        required: true,
        description: "Advertiser names to monitor (Adscan matches by company name).",
      },
      {
        name: "adscanLaunchVolumeMinCount",
        type: "number",
        label: "Min ads in window",
        required: true,
        description: "Fire when an advertiser has at least this many ads in the window.",
      },
      {
        name: "adscanLaunchVolumeWindowDays",
        type: "number",
        label: "Window (days)",
        required: false,
        description: "Lookback window in days. Default: 30.",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check Adscan for advertiser launch counts. Default: Daily",
      },
    ],
    outputs: [
      { name: "summary", type: "string", description: "Headline e.g. 'Glossier launched 23 ads in the past 30 days'" },
      { name: "advertiserCount", type: "number", description: "Advertisers that crossed the threshold" },
      { name: "adCount", type: "number", description: "Total ads contributed by qualifying advertisers" },
      { name: "adsList", type: "string", description: "Markdown-formatted list of contributing ads" },
      { name: "windowDays", type: "number", description: "Window length in days" },
      { name: "minCount", type: "number", description: "Threshold used for this poll" },
    ],
    examples: [
      "Slack me when any tracked competitor launches more than 20 ads in 30 days",
      "Email when Brand X spins up 10+ creatives in a week",
    ],
  },
  {
    service: "sharepoint",
    event: "New File in Folder",
    label: "SharePoint",
    description: "Triggers when a new file is added to a SharePoint or OneDrive folder",
    config: [
      {
        name: "folderId",
        type: "string",
        label: "Folder",
        required: true,
        description: "SharePoint folder to watch (selected via folder picker)",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new files. Default: Daily",
      },
    ],
    outputs: [
      { name: "fileId", type: "string", description: "The new file's SharePoint ID" },
      { name: "fileName", type: "string", description: "Name of the file" },
      { name: "fileUrl", type: "string", description: "Download URL" },
      { name: "folderName", type: "string", description: "Name of the folder" },
      { name: "fileSize", type: "number", description: "Size in bytes" },
      { name: "mimeType", type: "string", description: "File MIME type" },
    ],
    examples: ["When video is added to SharePoint, launch as ad", "Create ads from files in my SharePoint folder"],
  },
  {
    service: "google-drive",
    event: "New File in Folder",
    label: "Google Drive",
    description: "Triggers when a new file is added to a Google Drive folder",
    config: [
      { name: "folderId", type: "string", label: "Folder ID", required: true, description: "Google Drive folder ID" },
      {
        name: "batchStrategy",
        type: "select",
        label: "Batch Strategy",
        required: false,
        options: [
          { value: "all_in_one", label: "All files as one ad batch" },
          { value: "one_per_file", label: "One ad per file" },
          { value: "group_by_type", label: "Group by file type" },
        ],
        description: "How to organize files detected in the same poll cycle. Default: All files as one ad batch",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new files. Default: Daily",
      },
    ],
    outputs: [
      { name: "fileId", type: "string", description: "The new file's Google Drive ID" },
      { name: "fileName", type: "string", description: "Name of the file" },
      { name: "folderName", type: "string", description: "Name of the folder" },
      { name: "fileSize", type: "number", description: "Size in bytes" },
      { name: "mimeType", type: "string", description: "File MIME type" },
    ],
    examples: ["When video is added to Drive, launch as ad", "Create ads from files in my Drive folder"],
  },
  {
    service: "google-drive",
    event: "New Folder in Folder",
    label: "Google Drive (Folder Batch)",
    description:
      "Triggers when a new folder is added to a watched folder. All files inside the new folder are treated as a single batch.",
    config: [
      {
        name: "parentFolderId",
        type: "string",
        label: "Parent Folder ID",
        required: true,
        description: "Google Drive folder ID to watch for new subfolders",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: false,
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
        description: "How often to check for new subfolders. Default: Daily",
      },
      {
        name: "batchStrategy",
        type: "select",
        label: "Batch Strategy",
        required: false,
        options: [
          { value: "all_in_one", label: "All files as one ad batch" },
          { value: "one_per_file", label: "One ad per file" },
          { value: "group_by_type", label: "Group by file type" },
        ],
        description: "How to handle multiple files in the folder. Default: All files as one ad batch",
      },
      {
        name: "folderNameFilterType",
        type: "select",
        label: "Folder Name Filter",
        required: false,
        options: [
          { value: "all", label: "All Folders" },
          { value: "contains", label: "Name Contains" },
          { value: "not_contains", label: "Name Does Not Contain" },
          { value: "starts_with", label: "Name Starts With" },
          { value: "ends_with", label: "Name Ends With" },
          { value: "equals", label: "Name Equals" },
        ],
        description: "Filter which folder names trigger the automation",
      },
      {
        name: "folderNameFilter",
        type: "string",
        label: "Folder Name",
        required: false,
        placeholder: "e.g., Campaign_, Launch_",
        description: "The text to match against folder names",
      },
      {
        name: "minFiles",
        type: "number",
        label: "Min Files Required",
        required: false,
        description: "Minimum number of files required in folder to trigger",
      },
      {
        name: "recursiveSearch",
        type: "boolean",
        label: "Recursive Search",
        required: false,
        description: "Search for new folders within all subfolders, not just the top level",
      },
      {
        name: "fileScanDepth",
        type: "number",
        label: "Include Files In Subfolders",
        required: false,
        description:
          "How many folder levels to read files from inside a matched folder. 1 (default) = only files sitting directly in it, 2 = also its subfolders. Maximum 5",
      },
      {
        name: "watchExistingFolders",
        type: "boolean",
        label: "Also Trigger On New Files In Existing Folders",
        required: false,
        description:
          "Also fire when files are added to a folder that already exists, not only when a new folder appears. Only the newly added files are launched, as a batch attributed to the folder they landed in, using the same depth as Include Files In Subfolders. Files count however they arrive — uploaded, moved in from elsewhere in Drive, or copied. Turning this on records whatever is already in the folders as the starting point without launching it",
      },
    ],
    outputs: [
      { name: "folderId", type: "string", description: "ID of the new folder" },
      { name: "folderName", type: "string", description: "Name of the new folder" },
      { name: "fileIds", type: "array", description: "Array of file IDs in the folder" },
      { name: "fileNames", type: "array", description: "Array of file names" },
      { name: "fileCount", type: "number", description: "Number of files in the folder" },
      { name: "files", type: "array", description: "Array of file objects with id, name, mimeType, size" },
    ],
    examples: [
      "Launch a campaign batch when folder is added to Drive",
      "Process all videos in a folder as a single ad set",
      "Create ads from a folder of creative assets",
    ],
  },
  {
    service: "google-sheets",
    event: "Cell Value Changed",
    label: "Google Sheets",
    description: "Triggers when a specific cell value changes in a spreadsheet",
    config: [
      { name: "spreadsheetId", type: "string", label: "Spreadsheet ID", required: true },
      { name: "sheetName", type: "string", label: "Sheet Name", required: true, placeholder: "Sheet1" },
      { name: "triggerCell", type: "string", label: "Trigger Cell", required: false, placeholder: "A1" },
    ],
    outputs: [
      { name: "rowNumber", type: "number", description: "Row that changed" },
      { name: "triggerValue", type: "string", description: "The new cell value" },
    ],
    examples: ["When spreadsheet is updated, duplicate ad set", "Create ads from spreadsheet data"],
  },
  {
    service: "google-sheets",
    event: "New Row Added",
    label: "Google Sheets",
    description:
      "Polls a sheet and runs the flow's actions once per row, for every row that is new or whose watched columns changed. Every column is available to actions as a data pill, so the sheet works as a control surface: type an ad set ID and an instruction into a row and the actions run against it.",
    config: [
      { name: "spreadsheetId", type: "string", label: "Spreadsheet ID or URL", required: true },
      { name: "sheetName", type: "string", label: "Sheet Name", required: false, placeholder: "Sheet1" },
      {
        name: "headerRow",
        type: "number",
        label: "Header Row",
        required: false,
        description: "Row containing column headers. Column names become data pills. Default: 1",
      },
      {
        name: "dataStartRow",
        type: "number",
        label: "Data Start Row",
        required: false,
        description: "First row of data. Default: 2",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: true,
        options: [
          { value: "every-5-min", label: "Every 5 minutes" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "custom", label: "Custom interval" },
        ],
        description: "How often to check for new or edited rows",
      },
      ...CUSTOM_INTERVAL_CONFIG_FIELDS,
      {
        name: "watchedColumns",
        type: "string",
        label: "Watched Columns",
        required: false,
        description:
          "Comma-separated column names whose edits re-run the row. Leave empty to watch exactly the columns your actions reference, so edits to notes columns don't re-fire.",
      },
      {
        name: "processExistingRows",
        type: "boolean",
        label: "Process Existing Rows On First Run",
        required: false,
        description:
          "Off by default: the first run records the rows already in the sheet without acting on them, so connecting a full sheet doesn't fire every row at once.",
      },
    ],
    outputs: [
      { name: "rowNumber", type: "number", description: "The sheet row that fired" },
      { name: "headers", type: "array", description: "Column names found in the header row" },
      { name: "watchedColumns", type: "array", description: "Columns whose changes re-run a row" },
      { name: "processedRowCount", type: "number", description: "Rows whose actions succeeded" },
      { name: "skippedRowCount", type: "number", description: "Rows unchanged since the last run" },
      { name: "deferredRowCount", type: "number", description: "Eligible rows held back by the per-run cap" },
    ],
    examples: [
      "Apply a Value Rule Set to the ad set named in each new row",
      "Pause the ad sets listed in a sheet when the team marks them",
      "Duplicate an ad set when a row is filled in",
    ],
  },
  {
    service: "google-sheets",
    event: "New Rows to Launch",
    label: "Google Sheets (Launch)",
    description:
      "Polls a Google Sheet for new rows, applies column mappings and transforms, then passes the batch data to action nodes for launching or saving as draft.",
    config: [
      { name: "spreadsheetId", type: "string", label: "Spreadsheet ID or URL", required: true },
      { name: "sheetName", type: "string", label: "Sheet Name", required: false, placeholder: "Sheet1" },
      {
        name: "headerRow",
        type: "number",
        label: "Header Row",
        required: false,
        description: "Row containing column headers. Default: 1",
      },
      {
        name: "dataStartRow",
        type: "number",
        label: "Data Start Row",
        required: false,
        description: "First row of data. Default: 2",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: true,
        options: [
          { value: "every-5-min", label: "Every 5 minutes" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "custom", label: "Custom interval" },
        ],
        description: "How often to check for new rows",
      },
      ...CUSTOM_INTERVAL_CONFIG_FIELDS,
    ],
    outputs: [
      { name: "newRowCount", type: "number", description: "Number of new rows found" },
      { name: "processedRowCount", type: "number", description: "Number of rows processed after transform" },
      { name: "skippedRowCount", type: "number", description: "Number of previously processed rows skipped" },
      { name: "transformedRows", type: "array", description: "Transformed batch data for action nodes" },
      { name: "contributingRowNumbers", type: "array", description: "Row numbers that contributed to the batch" },
    ],
    examples: [
      "Poll a sheet for new rows and launch ads automatically",
      "Detect new rows in Google Sheets and save as launch drafts",
    ],
  },
  {
    service: "google-sheets",
    event: "New Rows to Catalog",
    label: "Google Sheets (Catalog Products)",
    description:
      "Polls a Google Sheet for new rows and adds them as products to a Facebook Product Catalog. Supports single catalog mode (all products to one catalog) or per-row catalog ID mode.",
    config: [
      { name: "spreadsheetId", type: "string", label: "Spreadsheet ID or URL", required: true },
      { name: "sheetName", type: "string", label: "Sheet Name", required: false, placeholder: "Sheet1" },
      {
        name: "headerRow",
        type: "number",
        label: "Header Row",
        required: false,
        description: "Row containing column headers. Default: 1",
      },
      {
        name: "dataStartRow",
        type: "number",
        label: "Data Start Row",
        required: false,
        description: "First row of data. Default: 2",
      },
      {
        name: "catalogMode",
        type: "select",
        label: "Catalog Selection Mode",
        required: true,
        options: [
          { value: "single", label: "Single Catalog" },
          { value: "per-row", label: "Per-Row Catalog ID" },
        ],
        description: "Single: all products go to one catalog. Per-Row: each row specifies its catalog ID.",
      },
      {
        name: "catalogId",
        type: "string",
        label: "Catalog ID",
        required: false,
        description: "Facebook Catalog ID (required in single mode)",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: true,
        options: [
          { value: "every-5-min", label: "Every 5 minutes" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "custom", label: "Custom interval" },
        ],
        description: "How often to check for new rows",
      },
      ...CUSTOM_INTERVAL_CONFIG_FIELDS,
    ],
    outputs: [
      { name: "newRowCount", type: "number", description: "Number of new rows found" },
      { name: "productsCreated", type: "number", description: "Number of products created in catalog(s)" },
      { name: "catalogCount", type: "number", description: "Number of catalogs products were added to" },
      { name: "errors", type: "array", description: "Any validation or creation errors" },
    ],
    examples: [
      "Poll a sheet for new products and add them to a Facebook catalog",
      "Import product data from Google Sheets into multiple catalogs",
    ],
  },
  {
    service: "meta-ads",
    event: "Ad Approved",
    label: "Meta Ads",
    description:
      "Triggers when ads are recently approved (transitioned from review to active). Checks for ads with effective_status ACTIVE whose updated_time is within the lookback window.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
        ],
        description: "How to match campaign names. Default: All Campaigns",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter by campaign name",
      },
      {
        name: "adSetFilterType",
        type: "select",
        label: "Ad Set Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Ad Sets" },
          { value: "contains", label: "Contains" },
        ],
        description: "How to match ad set names",
      },
      {
        name: "adSetNameFilter",
        type: "string",
        label: "Ad Set Name Filter",
        required: false,
        description: "Filter by ad set name",
      },
      {
        name: "lookbackHours",
        type: "select",
        label: "Lookback Window",
        required: true,
        options: [
          { value: "1", label: "1 hour" },
          { value: "6", label: "6 hours" },
          { value: "12", label: "12 hours" },
          { value: "24", label: "24 hours" },
          { value: "48", label: "48 hours" },
        ],
        description: "How far back to look for recently approved ads",
      },
    ],
    outputs: [
      { name: "approvedAdIds", type: "array", description: "Array of approved ad IDs" },
      { name: "approvedAdsCount", type: "number", description: "Number of approved ads found" },
      {
        name: "approvedAds",
        type: "array",
        description: "Array with full ad details (adName, adsetName, campaignName, etc.)",
      },
      { name: "qualifyingAdIds", type: "array", description: "Alias for approvedAdIds for compatibility with actions" },
    ],
    examples: [
      "When my ads get approved, duplicate them",
      "After ad approval, apply my scaling rule",
      "When ads are approved, notify me",
    ],
  },
  {
    service: "meta-ads",
    event: "Campaign Status Change",
    label: "Meta Ads",
    description: "Triggers when campaigns match a specific effective status (ACTIVE, PAUSED, WITH_ISSUES, etc.)",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
        ],
        description: "How to match campaign names. Default: All Campaigns",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter by campaign name",
      },
      {
        name: "targetStatus",
        type: "select",
        label: "Target Status",
        required: true,
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "PAUSED", label: "Paused" },
          { value: "WITH_ISSUES", label: "With Issues" },
          { value: "PENDING_REVIEW", label: "Pending Review" },
          { value: "ARCHIVED", label: "Archived" },
        ],
        description: "Which campaign status to detect",
      },
    ],
    outputs: [
      { name: "matchingCampaignIds", type: "array", description: "Array of campaign IDs matching the target status" },
      { name: "matchingCount", type: "number", description: "Number of matching campaigns" },
      {
        name: "matchingCampaigns",
        type: "array",
        description: "Array with full campaign details (campaignName, status, effectiveStatus)",
      },
    ],
    examples: [
      "When a campaign is paused, notify me",
      "When campaign goes active, apply budget rule",
      "Detect campaigns with issues",
    ],
  },
  {
    service: "meta-ads",
    event: "Performance Monitoring",
    label: "Meta Ads",
    description:
      "Monitors relative metric changes (percentage-based) between consecutive time periods and triggers when thresholds are exceeded.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: false },
      { name: "accountIds", type: "array", label: "Ad Accounts", required: true },
      {
        name: "monitoringLevel",
        type: "select",
        label: "Monitoring Level",
        required: true,
        defaultValue: "account",
        options: [
          { value: "account", label: "Account Level" },
          { value: "campaign", label: "Campaign Level" },
          { value: "adset", label: "Ad Set Level" },
          { value: "ad", label: "Ad Level" },
        ],
        description: "Whether to compare metrics at the account, campaign, ad set, or ad level",
      },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
        ],
        description: "How to match campaign names. Only used when monitoring at campaign level.",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter by campaign name",
      },
      {
        name: "monitoringMetric",
        type: "select",
        label: "Metric",
        required: true,
        options: [
          { value: "spend", label: "Spend" },
          // Stored value stays "cpa" for backward-compat; resolves to Meta's cost_per_result.
          { value: "cpa", label: "Cost per Result" },
          { value: "roas", label: "Purchase ROAS" },
          { value: "cpm", label: "CPM" },
          { value: "cpc", label: "CPC" },
          { value: "ctr", label: "CTR" },
          { value: "impressions", label: "Impressions" },
          { value: "conversions", label: "Conversions" },
          { value: "cost_per_subscriber", label: "Cost per Subscriber" },
        ],
        description: "Which metric to monitor for changes",
      },
      {
        name: "monitoringDirection",
        type: "select",
        label: "Direction",
        required: true,
        options: [
          { value: "increases", label: "Increases by" },
          { value: "decreases", label: "Decreases by" },
          { value: "changes", label: "Changes by" },
        ],
        description: "Which direction of change to detect",
      },
      {
        name: "monitoringPercentage",
        type: "number",
        label: "Percentage Threshold",
        required: true,
        description: "Minimum percentage change to trigger (e.g., 20 means 20%)",
      },
      {
        name: "monitoringConditions",
        type: "array",
        label: "Metric Conditions",
        required: false,
        description:
          "Array of {metric, direction, percentage} objects for multi-metric monitoring. When present, overrides single monitoringMetric/Direction/Percentage fields.",
      },
      {
        name: "monitoringLogic",
        type: "select",
        label: "Condition Logic",
        required: false,
        options: [
          { value: "AND", label: "All conditions must match" },
          { value: "OR", label: "Any condition can match" },
        ],
        description:
          "How to combine multiple metric conditions (AND = all must match, OR = any can match). Defaults to AND.",
      },
      {
        name: "monitoringComparisonWindow",
        type: "select",
        label: "Comparison Window",
        required: true,
        defaultValue: "day",
        options: [
          { value: "day", label: "Day over Day" },
          { value: "week", label: "Week over Week" },
          { value: "custom", label: "Custom Date Range" },
        ],
        description:
          "Time period comparison (yesterday vs day before, last 7d vs prior 7d, or matching weekday ranges)",
      },
      {
        name: "monitoringCustomRangeStartDay",
        type: "select",
        label: "Custom Range Start Day",
        required: false,
        options: PERFORMANCE_MONITORING_WEEKDAYS.map(({ value, label }) => ({ value, label })),
        description: "First weekday in a custom recurring reporting range",
      },
      {
        name: "monitoringCustomRangeEndDay",
        type: "select",
        label: "Custom Range End Day",
        required: false,
        options: PERFORMANCE_MONITORING_WEEKDAYS.map(({ value, label }) => ({ value, label })),
        description: "Final weekday in a custom recurring reporting range",
      },
      {
        name: "monitoringAdNameFilter",
        type: "string",
        label: "Ad Name Filter",
        required: false,
        description: "Filter by ad name (contains). Only used when monitoring at ad level.",
      },
      {
        name: "monitoringAdNameFilterType",
        type: "select",
        label: "Ad Name Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Ads" },
          { value: "contains", label: "Contains" },
        ],
        description: "How to match ad names. Only used when monitoring at ad level.",
      },
      ...buildPollingScheduleFields({
        cadences: SCHEDULED_SCAN_CADENCES,
        checksFor: "metrics that crossed the configured change threshold",
        required: true,
      }),
    ],
    outputs: [
      { name: "qualifyingEntityIds", type: "array", description: "Entity IDs exceeding the threshold" },
      { name: "qualifyingCount", type: "number", description: "Number of entities exceeding the threshold" },
      {
        name: "qualifyingEntities",
        type: "array",
        description: "Array with entity details including currentValue, previousValue, percentageChange",
      },
      { name: "qualifyingAdIds", type: "array", description: "Ad IDs exceeding the threshold (ad level only)" },
    ],
    examples: [
      "If spend increases by 20% day over day, notify Slack",
      "If CPA declines by 15%, notify the Growth Strategist",
      "Monitor ROAS changes week over week",
      "If spend increases by 20% AND CPA increases by 15%, pause the campaign",
      "If ROAS decreases by 10% OR CPC increases by 25%, send a Slack alert",
      "If an ad's spend increases by 5% day over day, send a Slack alert",
      "Compare the last completed Monday–Sunday range with the Monday–Sunday range before it",
    ],
  },
  {
    service: "meta-ads",
    event: "Best Performing Organic Post",
    label: "Meta Ads",
    description:
      "Picks the best-performing organic post from a Facebook page (and optionally Instagram) in a recent window and surfaces it as the trigger output. Pairs with a Launch Ad action to auto-promote the winner via the post-id (object_story_id) flow, preserving the original post's social proof.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "pageId",
        type: "string",
        label: "Facebook Page",
        required: true,
        description: "Facebook page to scan for organic posts (used for promotion of IG posts too).",
      },
      {
        name: "instaId",
        type: "string",
        label: "Instagram Account",
        required: false,
        description: "Optional. When set, IG media is ranked alongside FB posts in the same pool.",
      },
      {
        name: "metric",
        type: "select",
        label: "Ranking Metric",
        required: true,
        options: [
          { value: "engagement", label: "Engagement (reactions + comments + shares)" },
          { value: "reactions", label: "Reactions" },
          { value: "comments", label: "Comments" },
          { value: "shares", label: "Shares" },
          { value: "reach", label: "Reach (FB insights)" },
          { value: "impressions", label: "Impressions (FB insights)" },
          { value: "video_views", label: "Video Views (FB videos only)" },
        ],
        description: "Which metric decides the winner. Reach / impressions / video views are FB-only.",
      },
      {
        name: "lookbackDays",
        type: "number",
        label: "Lookback Window (days)",
        required: false,
        placeholder: "7",
        description: "Only consider posts created within this window. Default: 7.",
      },
      {
        name: "minMetricValue",
        type: "number",
        label: "Minimum Metric Value",
        required: false,
        placeholder: "0",
        description: "Skip promotion if the top post's metric falls below this threshold. 0 disables.",
      },
      {
        name: "topN",
        type: "number",
        label: "Number of Top Posts to Promote",
        required: false,
        placeholder: "1",
        description: "Each run, promote up to N highest-ranking posts. Default: 1, max: 10.",
      },
      ...buildPollingScheduleFields({
        cadences: SCHEDULED_SCAN_CADENCES,
        checksFor: "new top-performing organic posts",
        required: true,
      }),
    ],
    outputs: [
      { name: "postId", type: "string", description: "The winning post id (FB) or IG media id" },
      {
        name: "effectiveStoryId",
        type: "string",
        description: "FB: same as postId. IG: '{pageId}_{igMediaId}'. Used as object_story_id.",
      },
      { name: "pageId", type: "string", description: "Facebook page that owns / promotes the post" },
      { name: "message", type: "string", description: "Post caption / message text" },
      { name: "permalinkUrl", type: "string", description: "Public URL of the original post" },
      { name: "mediaUrl", type: "string", description: "Primary media URL (image or video)" },
      { name: "mediaType", type: "string", description: "'image' or 'video'" },
      { name: "metric", type: "string", description: "Metric used for ranking" },
      { name: "metricValue", type: "number", description: "Metric value of the winning post" },
      { name: "createdTime", type: "string", description: "ISO timestamp of post creation" },
    ],
    examples: [
      "Every day, promote the most-engaged post (FB or IG) from the last 7 days",
      "Hourly: promote the top FB reach post from the last 24 hours, skip if reach < 1000",
    ],
  },
  {
    service: "meta-ads",
    event: "Performance Threshold",
    label: "Meta Ads",
    description: "Triggers when ads meet specific performance criteria",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: false },
      { name: "accountIds", type: "array", label: "Ad Accounts", required: true },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match campaign names. Default: All Campaigns",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        placeholder: "e.g., Scaling, Prospecting",
        description: "Filter ads from campaigns matching this criteria",
      },
      {
        name: "adSetNameFilter",
        type: "string",
        label: "Ad Set Name Contains",
        required: false,
        placeholder: "e.g., Testing",
        description: "Filter ads from ad sets whose name contains this text. Use '*' for all ad sets.",
      },
      {
        name: "adNameFilterType",
        type: "select",
        label: "Ad Name Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Ads" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match ad names. Default: All Ads",
      },
      {
        name: "adNameFilter",
        type: "string",
        label: "Ad Name Filter",
        required: false,
        placeholder: "e.g., Winner, UGC",
        description: "Filter ads by their ad-level name",
      },
      {
        name: "allAdSets",
        type: "boolean",
        label: "All Ad Sets",
        required: false,
        description: "Set to true to include all ad sets (ignores adSetNameFilter)",
      },
      {
        name: "metricType",
        type: "select",
        label: "Metric",
        required: true,
        options: [
          { value: "roas", label: "Purchase ROAS" },
          { value: "cpa", label: "CPA" },
          { value: "spend", label: "Spend" },
          { value: "conversions", label: "Conversions" },
          { value: "ctr", label: "CTR" },
          { value: "cpc", label: "CPC" },
        ],
      },
      {
        name: "operator",
        type: "select",
        label: "Operator",
        required: true,
        options: [
          { value: ">", label: ">" },
          { value: ">=", label: ">=" },
          { value: "<", label: "<" },
          { value: "<=", label: "<=" },
          { value: "=", label: "=" },
        ],
      },
      { name: "threshold", type: "number", label: "Threshold", required: true },
      {
        name: "lookbackDays",
        type: "select",
        label: "Lookback Period",
        required: true,
        options: [
          { value: "1", label: "1 day" },
          { value: "3", label: "3 days" },
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
        ],
      },
      {
        name: "adStatusFilter",
        type: "select",
        label: "Ad Status",
        required: false,
        options: [
          { value: "all", label: "All (with spend)" },
          { value: "ACTIVE", label: "Active only" },
          { value: "PAUSED", label: "Paused only" },
        ],
        description: "Filter by ad status",
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "ads that meet the criteria",
      }),
    ],
    outputs: [
      { name: "qualifyingAdIds", type: "array", description: "Array of ad IDs that matched criteria" },
      { name: "qualifyingAdSetIds", type: "array", description: "Array of ad set IDs that contain matching ads" },
      { name: "qualifyingCampaignIds", type: "array", description: "Array of campaign IDs that contain matching ads" },
      { name: "qualifyingAdsCount", type: "number", description: "Number of ads that matched" },
      {
        name: "qualifyingAds",
        type: "array",
        description: "Array with full ad details (includes adName, adSetName, etc.)",
      },
      {
        name: "adName",
        type: "string",
        description: "Original ad name - use {{node-trigger-1.adName}} for naming duplicates",
      },
      { name: "adSetName", type: "string", description: "Ad set name the ad belongs to" },
      { name: "campaignName", type: "string", description: "Campaign name the ad belongs to" },
      {
        name: "qualifyingAdSetAverages",
        type: "array",
        description:
          "Per-ad-set average metrics (Ad Set Avg mode only). Each element has adsetId, adsetName, adCount, plus all metric fields.",
      },
    ],
    examples: [
      "Duplicate ads with ROAS > 3 from ad sets containing 'test'",
      "Pause ads spending more than $10",
      "Scale ads with spend over $10 from test ad sets to scale ad sets",
    ],
  },
  {
    service: "tiktok-ads",
    event: "Performance Threshold",
    label: "TikTok Ads",
    description: "Triggers when TikTok ads meet specific performance criteria (spend, CTR, CPC, etc.)",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match campaign names. Default: All Campaigns",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        placeholder: "e.g., Scaling, Prospecting",
        description: "Filter ads from campaigns matching this criteria",
      },
      {
        name: "adGroupNameFilter",
        type: "string",
        label: "Ad Group Name Contains",
        required: false,
        placeholder: "e.g., Testing",
        description: "Filter ads from ad groups whose name contains this text",
      },
      {
        name: "metricType",
        type: "select",
        label: "Metric",
        required: true,
        options: [
          { value: "spend", label: "Spend" },
          { value: "cpa", label: "CPA (estimated)" },
          { value: "ctr", label: "CTR" },
          { value: "cpc", label: "CPC" },
          { value: "cpm", label: "CPM" },
          { value: "impressions", label: "Impressions" },
          { value: "clicks", label: "Clicks" },
          { value: "reach", label: "Reach" },
          { value: "appInstalls", label: "App Installs" },
          { value: "conversion_rate", label: "Conversion Rate" },
        ],
      },
      {
        name: "operator",
        type: "select",
        label: "Operator",
        required: true,
        options: [
          { value: ">", label: ">" },
          { value: ">=", label: ">=" },
          { value: "<", label: "<" },
          { value: "<=", label: "<=" },
          { value: "=", label: "=" },
        ],
      },
      { name: "threshold", type: "number", label: "Threshold", required: true },
      {
        name: "lookbackDays",
        type: "select",
        label: "Lookback Period",
        required: true,
        options: [
          { value: "1", label: "1 day" },
          { value: "3", label: "3 days" },
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
        ],
      },
      {
        name: "adStatusFilter",
        type: "select",
        label: "Ad Status",
        required: false,
        options: [
          { value: "all", label: "All (with spend)" },
          { value: "ENABLE", label: "Active only" },
          { value: "DISABLE", label: "Disabled only" },
        ],
        description: "Filter by ad operation status",
      },
      {
        name: "includeZeroDeliveryAds",
        type: "boolean",
        label: "Include ads with no delivery",
        required: false,
        description: "When true, evaluate ads with $0 spend and 0 impressions in the lookback window. Default false.",
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "TikTok ads that meet the criteria",
      }),
    ],
    outputs: [
      { name: "qualifyingAdIds", type: "array", description: "Array of TikTok ad IDs that matched criteria" },
      { name: "qualifyingAdsCount", type: "number", description: "Number of ads that matched" },
      {
        name: "qualifyingAds",
        type: "array",
        description: "Array with full ad details including media URLs (videoUrl, thumbnailUrl, videoId, tiktokItemId)",
      },
      {
        name: "adName",
        type: "string",
        description: "Ad name - use {{node-trigger-1.adName}} for referencing",
      },
      { name: "adGroupName", type: "string", description: "Ad group name the ad belongs to" },
      { name: "campaignName", type: "string", description: "Campaign name the ad belongs to" },
      { name: "videoUrl", type: "string", description: "TikTok video preview URL" },
      { name: "thumbnailUrl", type: "string", description: "Video thumbnail/cover URL" },
    ],
    examples: [
      "Pause TikTok ads spending more than $50 with CTR below 1%",
      "Find TikTok ads with CPC above $2 from campaigns containing 'test'",
      "Relaunch top-performing TikTok ads on other platforms",
    ],
  },
  {
    service: "tiktok-ads",
    event: "New Authorized Post",
    label: "TikTok Ads",
    description:
      "Fires when a creator authorizes a new TikTok post (Spark Ads authorization) on the selected ad account — optionally scoped to specific creators. Pairs with the Meta Ads Launch Ad action to automatically launch newly authorized creator posts as Meta ads. The first check records the existing back catalog without firing.",
    config: [
      { name: "advertiserId", type: "string", label: "TikTok Advertiser Account", required: true },
      {
        name: "identityIds",
        type: "array",
        label: "Watch Creators",
        required: false,
        description: "Creator identity ids to watch. Empty = every creator who authorizes posts on this ad account.",
      },
      {
        name: "maxPostsPerRun",
        type: "number",
        label: "Max Posts Per Check",
        required: false,
        placeholder: "5",
        description: "Cap of newly authorized posts processed per check (max 10). Extras carry over to the next check.",
      },
      {
        name: "processExistingPosts",
        type: "boolean",
        label: "Process Existing Posts on First Check",
        required: false,
        description:
          "Default false: the first check seeds the ledger with already-authorized posts without firing. Set true to also process the current back catalog once.",
      },
      {
        name: "checkFrequency",
        type: "select",
        label: "Check Frequency",
        required: true,
        options: [
          { value: "every-5-min", label: "Every 5 minutes" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "custom", label: "Custom interval" },
        ],
        description: "How often to check for newly authorized posts",
      },
      ...CUSTOM_INTERVAL_CONFIG_FIELDS,
    ],
    outputs: [
      {
        name: "qualifyingPosts",
        type: "array",
        description: "Newly authorized posts with videoUrl/thumbnailUrl/caption",
      },
      { name: "qualifyingPostsCount", type: "number", description: "Number of newly authorized posts" },
      { name: "tiktokItemId", type: "string", description: "TikTok item id of the first new post" },
      { name: "authCode", type: "string", description: "Spark Ads authorization code of the first new post" },
      { name: "creatorName", type: "string", description: "TikTok handle of the authorizing creator" },
      { name: "videoUrl", type: "string", description: "Downloadable video URL — feeds Launch Ad's media" },
      { name: "mediaUrl", type: "string", description: "Alias of videoUrl consumed by the Launch Ad action" },
      { name: "thumbnailUrl", type: "string", description: "Video cover/thumbnail URL" },
      { name: "message", type: "string", description: "Post caption text" },
      { name: "authorizedAt", type: "string", description: "ISO timestamp of the Spark authorization" },
      { name: "assets", type: "array", description: "Per-post assets for grouped multi-post launches" },
    ],
    examples: [
      "When @creator authorizes a new TikTok post, launch it as a Meta ad in my Creators ad set",
      "Watch all creators on this TikTok account and push new authorized posts to Meta paused for review",
    ],
  },
  {
    service: "snapchat-ads",
    event: "Performance Threshold",
    label: "Snapchat Ads",
    description:
      "Triggers when Snapchat ads meet specific performance criteria (spend, ROAS, CPA, etc.). Conversion-based metrics (ROAS, CPA, Conversions) are evaluated on purchase conversions.",
    config: [
      { name: "adAccountId", type: "string", label: "Snapchat Ad Account", required: true },
      {
        name: "metricType",
        type: "select",
        label: "Metric",
        required: true,
        options: [
          { value: "spend", label: "Spend" },
          { value: "roas", label: "ROAS" },
          { value: "cpa", label: "CPA" },
          { value: "conversions", label: "Conversions" },
          { value: "ctr", label: "CTR" },
          { value: "cpm", label: "CPM" },
          { value: "frequency", label: "Frequency" },
        ],
      },
      {
        name: "operator",
        type: "select",
        label: "Operator",
        required: true,
        options: [
          { value: ">", label: ">" },
          { value: ">=", label: ">=" },
          { value: "<", label: "<" },
          { value: "<=", label: "<=" },
          { value: "=", label: "=" },
        ],
      },
      { name: "threshold", type: "number", label: "Threshold", required: true },
      {
        name: "lookbackDays",
        type: "select",
        label: "Lookback Period",
        required: true,
        options: [
          { value: "1", label: "1 day" },
          { value: "3", label: "3 days" },
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
        ],
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "Snapchat ads that meet the criteria",
      }),
    ],
    outputs: [
      { name: "qualifyingAdIds", type: "array", description: "Array of Snapchat ad IDs that matched criteria" },
      { name: "qualifyingAdsCount", type: "number", description: "Number of ads that matched" },
      {
        name: "qualifyingAds",
        type: "array",
        description: "Array with full ad details (includes adName, adSquadName, campaignName, etc.)",
      },
      {
        name: "adName",
        type: "string",
        description: "Ad name - use {{node-trigger-1.adName}} for referencing",
      },
      { name: "adSquadName", type: "string", description: "Ad squad name the ad belongs to" },
      { name: "campaignName", type: "string", description: "Campaign name the ad belongs to" },
    ],
    examples: ["Pause Snapchat ads spending over $50 with ROAS below 1", "Find Snapchat ads with CPA above $20"],
  },
  {
    service: "pinterest-ads",
    event: "Performance Threshold",
    label: "Pinterest Ads",
    description:
      "Triggers when Pinterest ads match name or age conditions, e.g. ad name contains a campaign code. Only Ad Name and Ad Age conditions are supported; spend and other performance metrics are not.",
    config: [
      { name: "adAccountId", type: "string", label: "Pinterest Ad Account", required: true },
      {
        name: "metricType",
        type: "select",
        label: "Condition",
        required: true,
        options: [
          { value: "adName", label: "Ad Name" },
          { value: "adAge", label: "Ad Age (days)" },
        ],
      },
      {
        name: "operator",
        type: "select",
        label: "Operator",
        required: true,
        options: [
          { value: "contains", label: "contains" },
          { value: "not_contains", label: "does not contain" },
          { value: "equals", label: "equals" },
          { value: "starts_with", label: "starts with" },
          { value: "ends_with", label: "ends with" },
          { value: ">", label: ">" },
          { value: ">=", label: ">=" },
          { value: "<", label: "<" },
          { value: "<=", label: "<=" },
        ],
      },
      {
        name: "threshold",
        type: "string",
        label: "Value",
        required: true,
        description: "Text to match for Ad Name, or a number of days for Ad Age",
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "Pinterest ads that match the conditions",
      }),
    ],
    outputs: [
      { name: "qualifyingAdIds", type: "array", description: "Array of Pinterest ad IDs that matched the conditions" },
      { name: "qualifyingAdsCount", type: "number", description: "Number of ads that matched" },
      {
        name: "qualifyingAds",
        type: "array",
        description: "Array with ad details (adId, adName, status, adAge)",
      },
      {
        name: "adName",
        type: "string",
        description: "Ad name - use {{node-trigger-1.adName}} for referencing",
      },
    ],
    examples: [
      "Every Sunday, pause Pinterest ads whose name contains 'LES BONNES AFFAIRES'",
      "Pause Pinterest ads older than 30 days",
    ],
  },
  {
    service: "x-ads",
    event: "Performance Threshold",
    label: "X (Twitter) Ads",
    description:
      "Triggers when X promoted posts, ad groups or campaigns meet specific performance criteria (spend, impressions, engagements, clicks, link clicks, video views, CTR, CPC, CPM). X reports no conversion / ROAS / reach data, so those metrics are unavailable.",
    config: [
      { name: "accountId", type: "string", label: "X Ad Account", required: true },
      {
        name: "entityLevel",
        type: "select",
        label: "Level",
        required: false,
        options: [
          { value: "campaign", label: "Campaign" },
          { value: "ad_group", label: "Ad Group" },
          { value: "ad", label: "Ad (promoted post)" },
        ],
        defaultValue: "ad",
        description:
          "Which tier to evaluate. Campaign / Ad Group sum every promoted post underneath and act on the parent.",
      },
      {
        name: "metricType",
        type: "select",
        label: "Metric",
        required: true,
        options: [
          { value: "spend", label: "Spend" },
          { value: "impressions", label: "Impressions" },
          { value: "engagements", label: "Engagements" },
          { value: "clicks", label: "Clicks" },
          { value: "linkClicks", label: "Link Clicks" },
          { value: "videoViews", label: "Video Views" },
          { value: "ctr", label: "CTR (%)" },
          { value: "cpc", label: "CPC" },
          { value: "cpm", label: "CPM" },
        ],
      },
      {
        name: "operator",
        type: "select",
        label: "Operator",
        required: true,
        options: [
          { value: ">", label: ">" },
          { value: ">=", label: ">=" },
          { value: "<", label: "<" },
          { value: "<=", label: "<=" },
          { value: "=", label: "=" },
        ],
      },
      { name: "threshold", type: "number", label: "Threshold", required: true },
      {
        name: "lookbackDays",
        type: "select",
        label: "Lookback Period",
        required: true,
        options: [
          { value: "1", label: "1 day" },
          { value: "3", label: "3 days" },
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
          { value: "90", label: "90 days" },
        ],
      },
      {
        name: "minSpendFilter",
        type: "number",
        label: "Minimum Spend",
        required: false,
        description: "Skip entities that spent less than this in the window.",
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "X entities that meet the criteria",
      }),
    ],
    outputs: [
      {
        name: "qualifyingAdIds",
        type: "array",
        description: "Ids of the evaluated tier that matched (promoted-post, ad-group or campaign ids per Level)",
      },
      { name: "qualifyingAdSetIds", type: "array", description: "X ad group (line item) ids of the matches" },
      { name: "qualifyingCampaignIds", type: "array", description: "X campaign ids of the matches" },
      { name: "qualifyingTweetIds", type: "array", description: "Tweet ids behind the matching promoted posts" },
      { name: "qualifyingAdsCount", type: "number", description: "Number of entities that matched" },
      {
        name: "qualifyingAds",
        type: "array",
        description:
          "Array with full entity details (adName, adGroupName, campaignName, tweetId, tweetUrl, thumbnailUrl, text, spend, impressions, engagements, clicks, linkClicks, videoViews, ctr, cpc, cpm)",
      },
      { name: "adName", type: "string", description: "Entity name - use {{node-trigger-1.adName}} for referencing" },
      { name: "adGroupName", type: "string", description: "Ad group name the promoted post belongs to" },
      { name: "campaignName", type: "string", description: "Campaign name the entity belongs to" },
      { name: "tweetUrl", type: "string", description: "Link to the first matching promoted post on X" },
      { name: "entityLevel", type: "string", description: "The evaluated tier: campaign, ad_group or ad" },
      { name: "accountId", type: "string", description: "X ad account id" },
    ],
    examples: [
      "Notify me when an X promoted post spends over $50 with CTR below 0.5%",
      "Re-promote X ad groups with CPC under $0.20 into a new campaign",
    ],
  },
  {
    service: "google-ads",
    event: "Auto-Applied Keyword Detected",
    label: "Google Ads",
    description:
      "Finds keywords Google's auto-apply recommendations added to Search campaigns and matches them against " +
      "a list of blocked terms. Pair with Add Negative Keywords to block the ones you do not want.",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: true },
      {
        name: "campaignIds",
        type: "array",
        label: "Campaigns",
        required: false,
        description: "Limit the scan to specific Search campaigns. Default: all Search campaigns",
      },
      {
        name: "blockedTerms",
        type: "array",
        label: "Blocked Terms",
        required: true,
        description:
          "Terms that disqualify a keyword. Matched as whole words, case-insensitively: 'free' matches " +
          "'free trial' but not 'freedom'. An empty list matches nothing.",
      },
      {
        name: "keywordSource",
        type: "select",
        label: "Keyword Source",
        required: false,
        // PROVISIONAL: defaults to "any" until the auto-applied filter is validated on a
        // real account. `change_event` attribution is unproven — an empty result is
        // indistinguishable from "the filter never matches", so defaulting to
        // auto_applied would ship a trigger that silently finds nothing. Flip back to
        // "auto_applied" once a run confirms client_type 14 rows come back.
        defaultValue: "any",
        options: [
          { value: "auto_applied", label: "Only keywords Google auto-applied" },
          { value: "any", label: "Any keyword in the campaign" },
        ],
        description: "Auto-applied uses Google's change history, which retains 30 days. Default: only auto-applied",
      },
      {
        name: "maxPerRun",
        type: "number",
        label: "Max Keywords Per Run",
        required: false,
        defaultValue: 200,
        description: "Safety cap. Runs that match more than this are truncated and flagged. Default: 200",
      },
      ...buildPollingScheduleFields({
        cadences: SCHEDULED_SCAN_CADENCES,
        checksFor: "keywords Google auto-added that match the blocked terms",
      }),
    ],
    outputs: [
      {
        name: "qualifyingKeywords",
        type: "array",
        description: "Matched keywords with ad group, campaign and matchedTerm",
      },
      { name: "qualifyingCount", type: "number", description: "Number of keywords that matched" },
      { name: "qualifyingCampaignIds", type: "array", description: "Campaign IDs the matched keywords belong to" },
      { name: "qualifyingAdGroupIds", type: "array", description: "Ad group IDs the matched keywords belong to" },
      { name: "accountId", type: "string", description: "Google Ads account the trigger ran against" },
      { name: "keywordText", type: "string", description: "Text of the first matched keyword" },
      { name: "matchedTerm", type: "string", description: "Blocked term the first keyword matched" },
    ],
    examples: [
      "Block auto-added keywords containing competitor names",
      "Negate any keyword Google adds that contains 'free' or 'cheap'",
    ],
  },
  // ============================================================================
  // APPLOVIN (AXON) TRIGGER
  //
  // AppLovin exposes NO per-ad entity: campaigns and creative sets are the only two
  // tiers in its Reporting and Manage APIs. There is therefore no "Pause Ad" here,
  // and none may be invented — every AppLovin action targets one of those two tiers.
  // ============================================================================
  {
    service: "axon-ads",
    event: "Performance Threshold",
    label: "AppLovin Ads",
    description:
      "Triggers when AppLovin (Axon) campaigns or creative sets meet performance criteria (spend, ROAS, CPA, CTR, etc.). " +
      "Campaign and Creative Set are the only levels AppLovin exposes - it has no per-ad entity. " +
      "Needs a Reporting API Key on the AppLovin integration.",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: true },
      {
        name: "entityLevel",
        type: "select",
        label: "Level",
        required: true,
        options: [
          { value: "campaign", label: "Campaign" },
          { value: "creative_set", label: "Creative Set" },
        ],
        description:
          "What to evaluate. Creative Set level also reports each set's parent campaign, so campaign-level " +
          "actions still work downstream. Default: Campaign",
      },
      {
        name: "criteria",
        type: "array",
        label: "Criteria",
        required: true,
        description:
          "Conditions to evaluate. AppLovin supports spend, impressions, clicks, conversions, ctr, cpa, cpc, cpm, " +
          "roas and adName. Every other metric is rejected because AppLovin reports no column for it. " +
          `The criteria lookbackDays is capped at AppLovin's ${AXON_MAX_WINDOW_DAYS}-day maximum.`,
      },
      {
        name: "minSpendFilter",
        type: "number",
        label: "Minimum Spend",
        required: false,
        description: "Only evaluate entities that spent at least this much in the lookback window.",
      },
      ...buildPollingScheduleFields({
        cadences: PERFORMANCE_THRESHOLD_CADENCES,
        checksFor: "AppLovin campaigns or creative sets that meet the criteria",
      }),
    ],
    outputs: [
      {
        name: "qualifyingAdIds",
        type: "array",
        description: "IDs of the matched entities: campaign IDs at Campaign level, creative set IDs at Creative Set",
      },
      {
        name: "qualifyingCampaignIds",
        type: "array",
        description: "Campaign IDs the matched entities belong to - feeds Pause/Enable Campaign and Change Budget",
      },
      {
        name: "qualifyingCreativeSetIds",
        type: "array",
        description: "Creative set IDs that matched (empty at Campaign level, so campaign runs cannot mis-target)",
      },
      {
        name: "qualifyingAds",
        type: "array",
        description: "Matched entities with full detail (name, parent campaign, every metric field)",
      },
      { name: "qualifyingAdsCount", type: "number", description: "Number of entities that matched" },
      { name: "qualifyingAdNames", type: "string", description: "Names of every matched entity, one per line" },
      {
        name: "totalEntitiesChecked",
        type: "number",
        description: "Number of entities evaluated against the criteria",
      },
      { name: "entityLevel", type: "string", description: "The level evaluated: campaign or creative_set" },
      { name: "accountId", type: "string", description: "AppLovin account the trigger ran against" },
      {
        name: "adName",
        type: "string",
        description: "Matched entity name - use {{node-trigger-1.adName}} for referencing",
      },
      { name: "campaignId", type: "string", description: "Campaign ID of the first matched entity" },
      { name: "campaignName", type: "string", description: "Campaign name of the first matched entity" },
      {
        name: "creativeSetId",
        type: "string",
        description: "Creative set ID of the first matched entity (Creative Set level only)",
      },
      {
        name: "creativeSetName",
        type: "string",
        description: "Creative set name of the first matched entity (Creative Set level only)",
      },
    ],
    examples: [
      "Pause AppLovin creative sets spending over $500 with CPA above $40",
      "Cut AppLovin campaign budgets 25% when ROAS drops below 1",
    ],
  },
  {
    service: "facebook-rules",
    event: "Rule Condition Check",
    label: "Facebook Ad Rules",
    description:
      "Triggers instantly when a Facebook Ad Rule fires. Uses the rule's history to detect when entities are paused, budgets changed, etc.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "ruleId",
        type: "string",
        label: "Rule",
        required: true,
        description: "Select an existing rule to use its conditions",
      },
      {
        name: "ruleName",
        type: "string",
        label: "Rule Name",
        required: false,
        description: "Display name of selected rule",
      },
    ],
    outputs: [
      { name: "matchingAdIds", type: "array", description: "Ad IDs that match the rule conditions" },
      { name: "matchingAdSetIds", type: "array", description: "Ad Set IDs that match the rule conditions" },
      { name: "matchingCount", type: "number", description: "Number of matching entities" },
      { name: "qualifyingAdIds", type: "array", description: "Alias for matchingAdIds for compatibility" },
    ],
    examples: [
      "When ads match my scaling rule conditions, duplicate them",
      "If my pause rule would trigger, send notification first",
      "Use existing rule conditions to trigger automation",
    ],
  },
  {
    service: "admanage",
    event: "Ad Launched via AdManage",
    label: "AdManage",
    description:
      "Triggers when ads are launched via AdManage. Allows logging launches to Google Sheets and tracking ad performance post-launch.",
    config: [
      {
        name: "accountId",
        type: "string",
        label: "Ad Account",
        required: false,
        description: "Filter to specific ad account (optional)",
      },
      {
        name: "campaignNameFilterType",
        type: "select",
        label: "Campaign Filter Type",
        required: false,
        options: [
          { value: "all", label: "All Campaigns" },
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
        ],
        description: "How to match campaign names. Default: All Campaigns",
      },
      {
        name: "campaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter by campaign name",
      },
      {
        name: "lookbackHours",
        type: "select",
        label: "Lookback Window",
        required: true,
        options: [
          { value: "1", label: "1 hour" },
          { value: "6", label: "6 hours" },
          { value: "12", label: "12 hours" },
          { value: "24", label: "24 hours" },
          { value: "48", label: "48 hours" },
        ],
        description: "How far back to look for recently launched ads",
      },
      {
        name: "includePostPermalinks",
        type: "boolean",
        label: "Include post permalinks",
        required: false,
        description:
          "Fetch Facebook and Instagram post URLs for each launched ad. Adds a few Graph API calls per trigger run — leave disabled unless you're mapping these fields to a downstream action (e.g. Google Sheets).",
      },
    ],
    outputs: [
      { name: "launchedAdIds", type: "array", description: "Array of launched ad IDs" },
      { name: "launchedAdsCount", type: "number", description: "Number of launched ads found" },
      {
        name: "launchedAds",
        type: "array",
        description: "Array with full ad details (adId, name, videoName, videoUrl, adGroupValue, adGroupName, etc.)",
      },
      { name: "adId", type: "string", description: "Ad ID (from first launched ad)" },
      { name: "name", type: "string", description: "Ad name" },
      { name: "videoName", type: "string", description: "Video/creative name" },
      { name: "videoUrl", type: "string", description: "Video/creative URL" },
      { name: "adGroupValue", type: "string", description: "Ad Set ID" },
      { name: "adGroupName", type: "string", description: "Ad Set name" },
      {
        name: "creationType",
        type: "string",
        description: "How the creative was created (new_creative, existing_creative, postId)",
      },
      { name: "timestamp", type: "string", description: "When the ad was launched (ISO timestamp)" },
      { name: "platform", type: "string", description: "Platform (facebook, tiktok)" },
      { name: "batchId", type: "number", description: "AdBatch ID" },
      { name: "batchTitle", type: "string", description: "AdBatch title" },
      {
        name: "facebookPermalink",
        type: "string",
        description:
          'Facebook "Post with Comments" URL for the launched ad. Requires the trigger\'s "Include post permalinks" option to be enabled.',
      },
      {
        name: "instagramPermalink",
        type: "string",
        description:
          "Instagram post URL for the launched ad. Empty when the ad has no Instagram placement, when the user's token lacks access to the page's IG business account, or when \"Include post permalinks\" is disabled.",
      },
    ],
    examples: [
      "Log all ad launches to a Google Sheet",
      "Track newly launched ads for performance monitoring",
      "When ads are launched, add them to my tracking spreadsheet",
    ],
  },
  {
    service: "scheduled",
    event: "Scheduled Run",
    label: "Scheduled",
    description:
      "Runs the automation once at a set date/time or on a recurring schedule (daily, weekly, monthly). Times are in UK time (Europe/London).",
    config: [
      {
        name: "frequency",
        type: "select",
        label: "Frequency",
        required: true,
        options: [
          { value: "one-time", label: "One-time" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ],
        description: "How often to run the automation",
      },
      {
        name: "scheduledDate",
        type: "string",
        label: "Scheduled Date",
        required: false,
        placeholder: "2026-08-10",
        description: "The date to run on (YYYY-MM-DD, for one-time frequency)",
      },
      {
        name: "time",
        type: "string",
        label: "Time of Day",
        required: false,
        placeholder: "09:00",
        description: "What time to run (24-hour format UK time, e.g., 09:00)",
      },
      {
        name: "dayOfWeek",
        type: "select",
        label: "Day of Week",
        required: false,
        options: [
          { value: "monday", label: "Monday" },
          { value: "tuesday", label: "Tuesday" },
          { value: "wednesday", label: "Wednesday" },
          { value: "thursday", label: "Thursday" },
          { value: "friday", label: "Friday" },
          { value: "saturday", label: "Saturday" },
          { value: "sunday", label: "Sunday" },
        ],
        description: "Day of week (for weekly frequency)",
      },
      {
        name: "dayOfMonth",
        type: "number",
        label: "Day of Month",
        required: false,
        placeholder: "1",
        description: "Day of month (1-28, for monthly frequency)",
      },
    ],
    outputs: [
      { name: "scheduledTime", type: "string", description: "The scheduled execution time" },
      { name: "frequency", type: "string", description: "The schedule frequency" },
    ],
    examples: [
      "Run once on a specific date at 9pm",
      "Run every day at 9am",
      "Run weekly on Mondays",
      "Run monthly on the 1st",
    ],
  },
  {
    service: "manual",
    event: "Manual Trigger",
    label: "Manual / Run Now",
    description: "Run this automation manually on demand. No automatic trigger - you control when it runs.",
    config: [
      {
        name: "description",
        type: "string",
        label: "Description (optional)",
        required: false,
        placeholder: "e.g., Scale winning ad sets by 20%",
        description: "A note to remind yourself what this automation does",
      },
    ],
    outputs: [
      { name: "executedAt", type: "string", description: "When the automation was manually triggered" },
      { name: "executedBy", type: "string", description: "User who triggered the automation" },
    ],
    examples: [
      "Change budgets for specific ad sets on demand",
      "Pause ads manually when needed",
      "One-time automation tasks",
    ],
  },
  {
    service: "comments",
    event: "New Comment",
    label: "New Comment",
    description: "Triggers when a new Facebook or Instagram comment matches your conditions.",
    config: [
      // Derived from the selected pages (see resolveAdAccountForPages), not
      // picked by the user — comment automations are page-level. Marking it
      // required would raise a blocker with no field anywhere to fill it.
      { name: "adAccountId", type: "string", label: "Ad Account", required: false },
      { name: "pageIds", type: "array", label: "Pages", required: true },
      // Optional on purpose: sentiment "anything" with no keywords is a valid
      // automation (act on every comment on the selected pages), and it
      // serialises to `{}`. The save path allows it, so requiring it here only
      // produced a "Fill in Conditions" blocker with nothing left to fill.
      { name: "conditions", type: "string", label: "Conditions", required: false },
      {
        name: "processExisting",
        type: "boolean",
        label: "Also Run On Existing Comments",
        required: false,
        description:
          "Off by default. When on, saving the automation also runs it once over the comments already collected for the selected pages, not only new ones.",
      },
    ],
    outputs: [
      { name: "commentId", type: "string", description: "Matched comment id" },
      { name: "message", type: "string", description: "Comment text" },
    ],
    examples: ["When a spam comment arrives", "When a negative comment is posted"],
  },
  {
    service: "comments",
    event: "Scheduled scan",
    label: "Scheduled scan",
    description: "Runs on a schedule and processes matching comments.",
    config: [
      // Derived from the selected pages (see resolveAdAccountForPages), not
      // picked by the user — comment automations are page-level. Marking it
      // required would raise a blocker with no field anywhere to fill it.
      { name: "adAccountId", type: "string", label: "Ad Account", required: false },
      { name: "pageIds", type: "array", label: "Pages", required: true },
      { name: "frequency", type: "string", label: "Scan Frequency", required: false },
      { name: "scheduledTime", type: "string", label: "Run Time", required: false },
      // Optional on purpose: sentiment "anything" with no keywords is a valid
      // automation (act on every comment on the selected pages), and it
      // serialises to `{}`. The save path allows it, so requiring it here only
      // produced a "Fill in Conditions" blocker with nothing left to fill.
      { name: "conditions", type: "string", label: "Conditions", required: false },
      {
        name: "processExisting",
        type: "boolean",
        label: "Also Run On Existing Comments",
        required: false,
        description:
          "Off by default. When on, saving the automation also runs it once over the comments already collected for the selected pages, before the first scheduled scan.",
      },
    ],
    outputs: [{ name: "processedCount", type: "number", description: "Comments processed in the run" }],
    examples: ["Hourly hide negative comments"],
  },
  {
    service: "comments",
    event: "Manual Run",
    label: "Manual Comment Run",
    description: "Run comment matching on demand.",
    config: [
      // Derived from the selected pages (see resolveAdAccountForPages), not
      // picked by the user — comment automations are page-level. Marking it
      // required would raise a blocker with no field anywhere to fill it.
      { name: "adAccountId", type: "string", label: "Ad Account", required: false },
      { name: "pageIds", type: "array", label: "Pages", required: true },
      // Optional on purpose: sentiment "anything" with no keywords is a valid
      // automation (act on every comment on the selected pages), and it
      // serialises to `{}`. The save path allows it, so requiring it here only
      // produced a "Fill in Conditions" blocker with nothing left to fill.
      { name: "conditions", type: "string", label: "Conditions", required: false },
      {
        name: "processExisting",
        type: "boolean",
        label: "Also Run On Existing Comments",
        required: false,
        description:
          "Off by default. When on, saving the automation also runs it once over the comments already collected for the selected pages, not only new ones.",
      },
    ],
    outputs: [{ name: "processedCount", type: "number", description: "Comments processed in the run" }],
    examples: ["Manually clean spam comments"],
  },
];

// ============================================================================
// ACTIONS
// ============================================================================

export const ACTIONS: ActionDefinition[] = [
  {
    service: "chatgpt-ads",
    event: "Launch on ChatGPT",
    label: "Launch on ChatGPT",
    description:
      "Launch qualifying Meta image ads into an existing ChatGPT ad group using the normal ChatGPT launcher. Each source is submitted once per automation step and destination; videos are unsupported. Paused by default.",
    config: [
      { name: "accountId", type: "string", label: "ChatGPT ad account", required: true },
      { name: "campaignId", type: "string", label: "ChatGPT campaign", required: true },
      { name: "adGroupId", type: "string", label: "ChatGPT ad group", required: true },
      { name: "title", type: "string", label: "Title override (50 characters)", required: false },
      { name: "description", type: "string", label: "Description override (100 characters)", required: false },
      { name: "linkUrl", type: "string", label: "Destination URL override", required: false },
      {
        name: "shortenCopy",
        type: "boolean",
        label: "Shorten copy to ChatGPT limits",
        required: false,
        defaultValue: true,
      },
      {
        name: "adStatus",
        type: "select",
        label: "Launch status",
        required: false,
        defaultValue: "PAUSED",
        options: [
          { value: "PAUSED", label: "Paused" },
          { value: "ACTIVE", label: "Active" },
        ],
      },
    ],
    examples: ["Scale top Meta image ads to ChatGPT", "Launch Meta winners on ChatGPT paused for review"],
  },
  {
    service: "meta-ads",
    event: "Launch Ad",
    label: "Launch Ad",
    description: "Creates and launches ads to one or more ad sets",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "targetCampaignMatchType",
        type: "select",
        label: "Campaign Filter Match Type",
        required: false,
        options: [
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description:
          "Optional: narrow target ad sets to specific campaigns. Useful when ad set names are identical across campaigns.",
      },
      {
        name: "targetCampaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter campaigns by name (e.g., 'Scaling'). Leave empty to search all campaigns.",
      },
      {
        name: "targetCampaignId",
        type: "string",
        label: "Specific Campaign",
        required: false,
        description: "Select a specific campaign. Only used if targetCampaignNameFilter is empty.",
      },
      {
        name: "targetAdSetMatchType",
        type: "select",
        label: "Target Ad Set Match Type",
        required: false,
        options: [
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match target ad set names. Defaults to 'contains'.",
      },
      {
        name: "targetAdSetNameFilter",
        type: "string",
        label: "Target Ad Set Name Filter",
        required: false,
        description: "Filter target ad sets by name (e.g., 'scale'). Leave empty to select a specific ad set.",
      },
      {
        name: "targetAdSetId",
        type: "string",
        label: "Specific Target Ad Set",
        required: false,
        description: "Select a specific ad set. Only used if targetAdSetNameFilter is empty.",
      },
      { name: "newName", type: "string", label: "Ad Name", required: false, placeholder: "{{assetName}} - {{date}}" },
      { name: "templateName", type: "string", label: "Ad Template", required: false },
    ],
    examples: ["Launch uploaded media as ads to ad sets containing 'scale'"],
  },
  {
    service: "meta-ads",
    event: "Swap Creative from Shortlist",
    label: "Swap Creative from Shortlist",
    description:
      "Selects a shortlisted library creative, launches it into the matched ad set, and pauses the original ad.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "sourceTagName",
        type: "string",
        label: "Shortlist Tag",
        required: true,
        description: "Library uploader tag used as the creative shortlist.",
      },
      {
        name: "selectionStrategy",
        type: "select",
        label: "Selection Strategy",
        required: true,
        options: [
          { value: "round_robin", label: "Round robin" },
          { value: "random", label: "Random" },
          { value: "historical_engagement", label: "Historical engagement" },
        ],
        description: "How to pick the next creative from the shortlist.",
      },
      {
        name: "targetAdSetIds",
        type: "string",
        label: "Target Ad Set IDs",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdSetIds}} to refresh ads in their original ad sets.",
      },
      {
        name: "oldAdIds",
        type: "string",
        label: "Old Ad IDs",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to pause ads that breached the threshold.",
      },
      {
        name: "pauseOriginalAds",
        type: "boolean",
        label: "Pause Original Ads",
        required: false,
        description: "Pause the old ads after replacement creatives are launched.",
      },
    ],
    examples: ["Refresh page-like ads from a tagged shortlist when CPR rises above target"],
  },
  {
    service: "meta-ads",
    event: "Duplicate Ad Set from Sheet Row",
    label: "Duplicate Ad Set",
    description: "Prepares sheet row targeting, campaign, and source ad set settings for a Hunch-style dynamic launch",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "campaignId", type: "string", label: "Campaign", required: true },
      { name: "sourceAdSetId", type: "string", label: "Source Ad Set", required: true },
    ],
    examples: ["Use the row city to replace copied geo targeting before launch"],
  },
  {
    service: "meta-ads",
    event: "Create Media from Templates",
    label: "Create Media from Templates",
    description: "Prepares selected /create templates and dynamic text fields for a Hunch-style dynamic launch",
    config: [{ name: "templateIds", type: "array", label: "Template IDs", required: true }],
    examples: ["Render ten localized ads from template IDs using sheet row values"],
  },
  {
    service: "meta-ads",
    event: "Launch Template Ads",
    label: "Launch Template Ads",
    description: "Launches the generated template ads into the dynamic ad set and creates a /launch batch",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "campaignId", type: "string", label: "Campaign", required: true },
      { name: "sourceAdSetId", type: "string", label: "Source Ad Set", required: true },
      { name: "templateIds", type: "array", label: "Template IDs", required: true },
      {
        name: "locationTargetingMode",
        type: "select",
        label: "Location Targeting",
        required: false,
        options: [
          { value: "replace", label: "Replace source locations" },
          { value: "merge", label: "Merge with source locations" },
        ],
        description: "Use replace for Hunch rows so copied ad sets do not keep old geo targeting.",
      },
      { name: "leadFormId", type: "string", label: "Lead Form ID", required: false },
      { name: "pageId", type: "string", label: "Facebook Page ID", required: false },
      { name: "instagramId", type: "string", label: "Instagram ID", required: false },
      {
        name: "launchStatus",
        type: "select",
        label: "Initial Status",
        required: false,
        options: [
          { value: "PAUSED", label: "Paused" },
          { value: "ACTIVE", label: "Active" },
        ],
      },
      { name: "adSetNameTemplate", type: "string", label: "Ad Set Name", required: false },
      { name: "adNameTemplate", type: "string", label: "Ad Name", required: false },
      { name: "headlineTemplate", type: "string", label: "Headline", required: false },
      { name: "descriptionTemplate", type: "string", label: "Primary Text", required: false },
      { name: "linkUrlTemplate", type: "string", label: "Link URL", required: false },
      { name: "callToActionTemplate", type: "string", label: "CTA", required: false },
      { name: "defaultDailyBudget", type: "number", label: "Default Daily Budget", required: false },
    ],
    examples: [
      "Create 10 local ads for each new Google Sheet row",
      "Duplicate a source ad set per city and launch generated template ads",
    ],
  },
  {
    service: "meta-ads",
    event: "Duplicate Ad Set",
    label: "Duplicate Ad Set",
    description: "Creates a copy of an existing ad set",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetId", type: "string", label: "Source Ad Set", required: true },
      { name: "newName", type: "string", label: "New Name", required: true },
      {
        name: "campaignId",
        type: "string",
        label: "Target Campaign",
        required: false,
        description: "Campaign to place the duplicated ad set into. Leave empty to keep in same campaign.",
      },
      {
        name: "scaleQualifyingStructure",
        type: "boolean",
        label: "Scale qualifying structure",
        required: false,
      },
      {
        name: "launchLive",
        type: "boolean",
        label: "Launch live",
        required: false,
      },
    ],
    examples: ["Duplicate winning ad sets"],
  },
  {
    service: "meta-ads",
    event: "Duplicate Campaign",
    label: "Duplicate Campaign",
    description: "Creates a copy of an entire campaign",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetId", type: "string", label: "Source Campaign", required: true },
      { name: "newName", type: "string", label: "New Name", required: true },
      {
        name: "scaleQualifyingStructure",
        type: "boolean",
        label: "Scale qualifying structure",
        required: false,
      },
      {
        name: "launchLive",
        type: "boolean",
        label: "Launch live",
        required: false,
      },
    ],
    examples: ["Duplicate successful campaigns"],
  },
  {
    service: "meta-ads",
    event: "Duplicate Ad",
    label: "Duplicate Ad",
    description: "Creates copies of existing ads to one or more target ad sets",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "sourceAdIds",
        type: "string",
        label: "Source Ad IDs",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to reference ads from Performance Threshold trigger",
      },
      {
        name: "targetCampaignMatchType",
        type: "select",
        label: "Campaign Filter Match Type",
        required: false,
        options: [
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description:
          "Optional: narrow target ad sets to specific campaigns. Useful when ad set names are identical across campaigns.",
      },
      {
        name: "targetCampaignNameFilter",
        type: "string",
        label: "Campaign Name Filter",
        required: false,
        description: "Filter campaigns by name (e.g., 'Scaling'). Leave empty to search all campaigns.",
      },
      {
        name: "targetCampaignId",
        type: "string",
        label: "Specific Campaign",
        required: false,
        description: "Select a specific campaign. Only used if targetCampaignNameFilter is empty.",
      },
      {
        name: "targetAdSetMatchType",
        type: "select",
        label: "Target Ad Set Match Type",
        required: false,
        options: [
          { value: "contains", label: "Contains" },
          { value: "equals", label: "Equals" },
          { value: "not_contains", label: "Does not contain" },
          { value: "starts_with", label: "Starts with" },
          { value: "ends_with", label: "Ends with" },
        ],
        description: "How to match target ad set names. Defaults to 'contains'.",
      },
      {
        name: "targetAdSetNameFilter",
        type: "string",
        label: "Target Ad Set Name Filter",
        required: false,
        description: "Filter target ad sets by name (e.g., 'scale'). Leave empty to select a specific ad set.",
      },
      {
        name: "targetAdSetId",
        type: "string",
        label: "Specific Target Ad Set",
        required: false,
        description: "Select a specific ad set. Only used if targetAdSetNameFilter is empty.",
      },
      { name: "newName", type: "string", label: "New Name", required: false },
      {
        name: "duplicatedAdStatus",
        type: "select",
        label: "Duplicated Ad Status",
        required: false,
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "PAUSED", label: "Paused" },
        ],
      },
      {
        name: "useExistingPost",
        type: "boolean",
        label: "Use Existing Post ID",
        required: false,
        description: "Reuse the original Meta post so the duplicate keeps social proof.",
      },
      {
        name: "pauseOriginalAds",
        type: "boolean",
        label: "Pause Original Ads",
        required: false,
      },
      {
        name: "pauseSourceAdSets",
        type: "boolean",
        label: "Pause Source Ad Sets",
        required: false,
        description: "Pause the source ad set after at least one qualifying ad is duplicated successfully.",
      },
    ],
    examples: ["Duplicate top performing ads to ad sets containing 'scale'", "Copy ads to scaling ad sets"],
  },
  {
    service: "meta-ads",
    event: "Pause Ad",
    label: "Pause Ad",
    description: "Pauses one or more ads",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "adIdsToPause",
        type: "string",
        label: "Ad IDs to Pause",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to pause ads from Performance Threshold trigger",
      },
    ],
    examples: ["Pause underperforming ads", "Stop ads with low ROAS"],
  },
  {
    service: "meta-ads",
    event: "Pause Campaign",
    label: "Pause Campaign",
    description: "Pauses one or more campaigns",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "targetCampaignIds",
        type: "string",
        label: "Campaigns to Pause",
        required: true,
        description:
          "Use {{node-trigger-1.qualifyingCampaignIds}} to pause campaigns from a Performance Threshold trigger",
      },
    ],
    examples: ["Pause campaigns over budget"],
  },
  {
    service: "meta-ads",
    event: "Launch Campaign",
    label: "Launch Campaign",
    description: "Activates a paused campaign",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetId", type: "string", label: "Campaign ID", required: true },
    ],
    examples: ["Activate scheduled campaigns"],
  },
  {
    service: "meta-ads",
    event: "Pause Ad Set",
    label: "Pause Ad Set",
    description: "Pauses one or more ad sets",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "targetAdSetIds",
        type: "string",
        label: "Ad Sets to Pause",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdSetIds}} to pause ad sets from a Performance Threshold trigger",
      },
    ],
    examples: ["Pause underperforming ad sets"],
  },
  {
    service: "meta-ads",
    event: "Enable Ad",
    label: "Enable Ad",
    description: "Enables (unpauses) one or more ads. Only affects currently paused ads.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "adIdsToEnable",
        type: "string",
        label: "Ad IDs to Enable",
        required: true,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to enable ads from Performance Threshold trigger",
      },
    ],
    examples: ["Re-enable paused ads when performance recovers", "Unpause ads above ROAS threshold"],
  },
  {
    service: "meta-ads",
    event: "Enable Campaign",
    label: "Enable Campaign",
    description: "Enables (unpauses) a campaign. Only affects currently paused campaigns.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetCampaignIds", type: "string", label: "Campaign IDs", required: true },
    ],
    examples: ["Re-enable campaigns when budget resets"],
  },
  {
    service: "meta-ads",
    event: "Enable Ad Set",
    label: "Enable Ad Set",
    description: "Enables (unpauses) an ad set. Only affects currently paused ad sets.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetAdSetIds", type: "string", label: "Ad Set IDs", required: true },
    ],
    examples: ["Re-enable ad sets when performance recovers"],
  },
  {
    service: "meta-ads",
    event: "Update Value Rules",
    label: "Update Value Rules",
    description: "Applies an existing Meta Value Rule Set to one or more ad sets, or disables Value Rules",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "targetAdSetIds",
        type: "string",
        label: "Target Ad Set IDs",
        required: false,
        description:
          "Use a data pill from Google Sheets or another trigger, or enter comma-separated ad set IDs. Takes priority over selectedAdSetIds when both are set.",
      },
      {
        name: "selectedAdSetIds",
        type: "string",
        label: "Selected Ad Sets",
        required: false,
        description: "Ad sets picked from the account via the ad set selector. Used when Target Ad Set IDs is empty.",
      },
      {
        name: "valueRulesOperation",
        type: "select",
        label: "Action",
        required: true,
        options: [
          { value: "APPLY", label: "Apply Value Rule Set" },
          { value: "DISABLE", label: "Disable Value Rules" },
        ],
      },
      {
        name: "valueRuleSetId",
        type: "string",
        label: "Value Rule Set ID",
        required: false,
        description:
          "Pick an existing rule set from the account, use a Google Sheets data pill, or enter a Meta Value Rule Set ID. Required for APPLY.",
      },
    ],
    examples: [
      "Apply a Value Rule Set to specific ad sets every day at 21:00 (UK time) with a Scheduled trigger",
      "Apply a Value Rule Set when a Google Sheet condition is met",
      "Disable Value Rules on ad sets selected by an external data source",
    ],
  },
  {
    service: "meta-ads",
    event: "Launch Ad Set",
    label: "Launch Ad Set",
    description: "Activates a paused ad set",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "targetId", type: "string", label: "Ad Set ID", required: true },
    ],
    examples: ["Activate scheduled ad sets"],
  },
  // ============================================================================
  // RULE MANAGEMENT ACTIONS
  // ============================================================================
  {
    service: "meta-ads",
    event: "Create Rule",
    label: "Create Rule",
    description: "Creates a new Facebook Ad Rule in the account",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "ruleName",
        type: "string",
        label: "Rule Name",
        required: true,
        placeholder: "Auto-pause low performers",
      },
      {
        name: "entityType",
        type: "select",
        label: "Apply To",
        required: true,
        options: [
          { value: "AD", label: "Ads" },
          { value: "ADSET", label: "Ad Sets" },
          { value: "CAMPAIGN", label: "Campaigns" },
        ],
      },
      {
        name: "ruleActionType",
        type: "select",
        label: "Rule Action",
        required: true,
        options: [
          { value: "TURN_OFF", label: "Turn Off" },
          { value: "TURN_ON", label: "Turn On" },
          { value: "NOTIFICATION", label: "Send Notification Only" },
          { value: "INCREASE_DAILY_BUDGET", label: "Increase Daily Budget" },
          { value: "DECREASE_DAILY_BUDGET", label: "Decrease Daily Budget" },
        ],
      },
      {
        name: "budgetValue",
        type: "number",
        label: "Budget Change Amount",
        required: false,
        description: "Only for budget actions",
      },
      {
        name: "budgetValueType",
        type: "select",
        label: "Value Type",
        required: false,
        options: [
          { value: "PERCENT", label: "Percentage" },
          { value: "ABSOLUTE", label: "Fixed Amount" },
        ],
      },
      {
        name: "scheduleType",
        type: "select",
        label: "Schedule",
        required: true,
        options: [
          { value: "DAILY", label: "Daily" },
          { value: "SEMI_HOURLY", label: "Every 30 minutes" },
          { value: "HOURLY", label: "Hourly" },
        ],
      },
      {
        name: "conditions",
        type: "array",
        label: "Conditions",
        required: false,
        description: "Performance conditions (e.g., ROAS > 3)",
      },
      {
        name: "timeRange",
        type: "select",
        label: "Time Range",
        required: false,
        options: [
          { value: "last_7d", label: "Last 7 days" },
          { value: "last_14d", label: "Last 14 days" },
          { value: "last_30d", label: "Last 30 days" },
        ],
      },
    ],
    examples: ["Create rule to pause low ROAS ads", "Create rule to increase budget for high performers"],
  },
  {
    service: "meta-ads",
    event: "Toggle Rule",
    label: "Toggle Rule",
    description: "Enables or disables an existing Facebook Ad Rule",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "ruleId", type: "string", label: "Rule", required: true, description: "Select the rule to toggle" },
      {
        name: "ruleStatus",
        type: "select",
        label: "Set Status",
        required: true,
        options: [
          { value: "ENABLED", label: "Enable" },
          { value: "DISABLED", label: "Disable" },
        ],
      },
    ],
    examples: ["Enable scaling rule when campaign is live", "Disable rules during testing"],
  },
  {
    service: "meta-ads",
    event: "Update Rule",
    label: "Update Rule",
    description: "Modifies an existing Facebook Ad Rule",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      { name: "ruleId", type: "string", label: "Rule to Update", required: true },
      { name: "ruleName", type: "string", label: "New Name", required: false },
      {
        name: "ruleActionType",
        type: "select",
        label: "Rule Action",
        required: false,
        options: [
          { value: "TURN_OFF", label: "Turn Off" },
          { value: "TURN_ON", label: "Turn On" },
          { value: "NOTIFICATION", label: "Send Notification Only" },
          { value: "INCREASE_DAILY_BUDGET", label: "Increase Daily Budget" },
          { value: "DECREASE_DAILY_BUDGET", label: "Decrease Daily Budget" },
        ],
      },
      { name: "budgetValue", type: "number", label: "Budget Amount", required: false },
      { name: "conditions", type: "array", label: "Conditions", required: false },
    ],
    examples: ["Update rule threshold to 2.5 ROAS", "Change rule from pause to notification"],
  },
  {
    service: "meta-ads",
    event: "Change Budget",
    label: "Change Budget",
    description:
      "Changes the budget of ad sets or campaigns immediately. Automatic mode detects per ad set whether the budget lives on the ad set or its CBO campaign (and whether it is daily or lifetime) and updates the right one.",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "budgetEntityLevel",
        type: "select",
        label: "Budget Level",
        required: false,
        options: [
          { value: "automatic", label: "Automatic (detect ad set vs campaign)" },
          { value: "adset", label: "Ad Sets" },
          { value: "campaign", label: "Campaigns" },
        ],
      },
      {
        name: "targetIds",
        type: "string",
        label: "Target IDs",
        required: true,
        description:
          "Use {{trigger.qualifyingAdSetIds}} or {{trigger.qualifyingCampaignIds}} depending on entity level, or comma-separated IDs",
      },
      {
        name: "budgetOperation",
        type: "select",
        label: "Operation",
        required: true,
        options: [
          { value: "INCREASE", label: "Increase" },
          { value: "DECREASE", label: "Decrease" },
          { value: "SET", label: "Set to specific amount" },
        ],
      },
      {
        name: "budgetAmount",
        type: "number",
        label: "Amount",
        required: true,
        description: "Amount in dollars (or percentage if type is PERCENT)",
      },
      {
        name: "budgetAmountType",
        type: "select",
        label: "Amount Type",
        required: true,
        options: [
          { value: "PERCENT", label: "Percentage (%)" },
          { value: "ABSOLUTE", label: "Fixed Amount ($)" },
        ],
      },
      {
        name: "budgetType",
        type: "select",
        label: "Budget Type",
        required: false,
        options: [
          { value: "AUTOMATIC", label: "Automatic (detect daily vs lifetime)" },
          { value: "DAILY", label: "Daily Budget" },
          { value: "LIFETIME", label: "Lifetime Budget" },
        ],
      },
    ],
    examples: [
      "Increase budget by 20% for winning ad sets",
      "Set daily budget to $100 for test ad sets",
      "Set campaign daily budget to $500 for scaling campaigns",
      "Increase budget by 10% (Automatic handles both ABO ad sets and CBO campaigns)",
    ],
  },
  {
    service: "meta-ads",
    event: "Set Minimum Spend",
    label: "Set or Reset Minimum Spend (CBO)",
    description:
      "Sets or resets the minimum spend target for ad sets within a CBO (Campaign Budget Optimization) campaign",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "targetAdSetIds",
        type: "string",
        label: "Target Ad Set IDs",
        required: false,
        description:
          "Ad set IDs to update (comma-separated, use {{trigger.qualifyingAdSetIds}}, or leave blank to use qualifying ad sets from the trigger)",
      },
      {
        name: "minimumSpendAction",
        type: "select",
        label: "Action",
        required: true,
        options: [
          { value: "SET", label: "Set minimum spend" },
          { value: "RESET", label: "Reset minimum spend to 0" },
        ],
        description: "Whether to set a new minimum spend or remove the existing minimum spend",
      },
      {
        name: "minimumSpendType",
        type: "select",
        label: "Minimum Spend Type",
        required: false,
        options: [
          { value: "ABSOLUTE", label: "Fixed Amount ($)" },
          { value: "PERCENT", label: "Percentage of Campaign Budget (%)" },
        ],
        description: "How to specify the minimum spend",
      },
      {
        name: "minimumSpendAmount",
        type: "number",
        label: "Minimum Spend Amount",
        required: false,
        description: "Amount in dollars (or percentage if type is PERCENT). Not used when resetting.",
      },
    ],
    examples: [
      "Reset minimum spend to 0 after an ad set spends $200",
      "Set 30% minimum spend on winning ad sets",
      "Ensure ad sets spend at least $50/day",
      "Allocate minimum budget to top performers in CBO campaigns",
    ],
  },
  {
    service: "meta-ads",
    event: "Apply Existing Rule",
    label: "Apply Existing Rule",
    description: "Applies an existing Facebook Ad Rule to ads or ad sets created in this automation",
    config: [
      { name: "accountId", type: "string", label: "Ad Account", required: true },
      {
        name: "ruleId",
        type: "string",
        label: "Rule",
        required: true,
        description: "Select an existing rule to apply",
      },
      {
        name: "ruleName",
        type: "string",
        label: "Rule Name",
        required: false,
        description: "Display name of selected rule",
      },
      {
        name: "applyTo",
        type: "select",
        label: "Apply Rule To",
        required: true,
        options: [
          { value: "new_ads", label: "New Ads Created in This Flow" },
          { value: "new_adsets", label: "New Ad Sets Created in This Flow" },
          { value: "specific", label: "Specific IDs (manual entry)" },
        ],
        description: "What entities should this rule be applied to",
      },
      {
        name: "targetIds",
        type: "string",
        label: "Target IDs",
        required: false,
        description: "Use {{node-action-1.adIds}} or comma-separated IDs. Only used when 'Apply To' is 'Specific IDs'",
      },
      {
        name: "enableImmediately",
        type: "boolean",
        label: "Enable Rule Immediately",
        required: false,
        description: "Enable the rule right after applying",
      },
    ],
    examples: [
      "After launching ad, apply my 'Pause Low ROAS' rule",
      "Apply scaling rule to new ads",
      "Launch ad then activate my budget rule",
    ],
  },
  // ============================================================================
  // TIKTOK ADS ACTIONS
  // ============================================================================
  {
    service: "tiktok-ads",
    event: "Pause Ad",
    label: "Pause Ad",
    description: "Pauses one or more TikTok ads (sets operation_status to DISABLE)",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Ad IDs to Pause",
        required: false,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to pause ads from Performance Threshold trigger",
      },
    ],
    examples: ["Pause underperforming TikTok ads", "Disable TikTok ads with high CPA"],
  },
  {
    service: "tiktok-ads",
    event: "Enable Ad",
    label: "Enable Ad",
    description: "Enables one or more TikTok ads (sets operation_status to ENABLE)",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Ad IDs to Enable",
        required: false,
        description: "Use {{node-trigger-1.qualifyingAdIds}} or comma-separated IDs",
      },
    ],
    examples: ["Re-enable paused TikTok ads", "Activate winning TikTok ads"],
  },
  {
    service: "tiktok-ads",
    event: "Pause Ad Group",
    label: "Pause Ad Group",
    description: "Pauses one or more TikTok ad groups",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      { name: "targetIds", type: "string", label: "Ad Group IDs", required: false },
    ],
    examples: ["Pause TikTok ad groups with low performance"],
  },
  {
    service: "tiktok-ads",
    event: "Enable Ad Group",
    label: "Enable Ad Group",
    description: "Enables one or more TikTok ad groups",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      { name: "targetIds", type: "string", label: "Ad Group IDs", required: false },
    ],
    examples: ["Re-enable paused TikTok ad groups"],
  },
  {
    service: "tiktok-ads",
    event: "Pause Campaign",
    label: "Pause Campaign",
    description: "Pauses one or more TikTok campaigns",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      { name: "targetIds", type: "string", label: "Campaign IDs", required: false },
    ],
    examples: ["Pause TikTok campaigns over budget"],
  },
  {
    service: "tiktok-ads",
    event: "Enable Campaign",
    label: "Enable Campaign",
    description: "Enables one or more TikTok campaigns",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      { name: "targetIds", type: "string", label: "Campaign IDs", required: false },
    ],
    examples: ["Activate scheduled TikTok campaigns"],
  },
  {
    service: "tiktok-ads",
    event: "Change Budget",
    label: "Change Budget",
    description: "Changes the budget of TikTok ad groups or campaigns",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Target IDs",
        required: false,
        description: "Ad group or campaign IDs. Use data pills or comma-separated IDs.",
      },
      {
        name: "budgetEntityLevel",
        type: "select",
        label: "Entity Level",
        required: true,
        options: [
          { value: "adgroup", label: "Ad Groups" },
          { value: "campaign", label: "Campaigns" },
        ],
      },
      {
        name: "budgetOperation",
        type: "select",
        label: "Operation",
        required: true,
        options: [
          { value: "INCREASE", label: "Increase" },
          { value: "DECREASE", label: "Decrease" },
          { value: "SET", label: "Set to specific amount" },
        ],
      },
      {
        name: "budgetAmount",
        type: "number",
        label: "Amount",
        required: true,
        description: "Amount in dollars (or percentage if type is PERCENT)",
      },
      {
        name: "budgetAmountType",
        type: "select",
        label: "Amount Type",
        required: true,
        options: [
          { value: "PERCENT", label: "Percentage (%)" },
          { value: "ABSOLUTE", label: "Fixed Amount ($)" },
        ],
      },
    ],
    examples: ["Increase TikTok ad group budget by 20%", "Set campaign budget to $500"],
  },
  {
    service: "tiktok-ads",
    event: "Push Creatives to Ad Group",
    label: "Push Creatives to Ad Group",
    description:
      "Copies all creatives from a source ad group into a target ad group, skipping creatives that already exist in the target",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "sourceAdGroupId",
        type: "string",
        label: "Source Ad Group ID",
        required: true,
        description: "Ad group to pull creatives from. Use {{node-trigger-1.qualifyingAdGroupIds}} or enter an ID.",
      },
      {
        name: "targetAdGroupId",
        type: "string",
        label: "Target Ad Group ID",
        required: true,
        description: "Ad group to push creatives into.",
      },
      {
        name: "duplicatedAdStatus",
        type: "select",
        label: "New Ad Status",
        required: false,
        options: [
          { value: "PAUSED", label: "Paused (default)" },
          { value: "ACTIVE", label: "Active" },
        ],
        description: "Status for newly created ads in the target ad group.",
      },
      {
        name: "skipExisting",
        type: "boolean",
        label: "Skip Existing Creatives",
        required: false,
        description: "If enabled, creatives already in the target ad group are skipped. Default: true.",
      },
    ],
    examples: [
      "Push winning creatives to a scaling ad group",
      "Copy creatives from test ad group to production",
      "Sync creatives between TikTok ad groups without duplicates",
    ],
  },
  {
    service: "tiktok-ads",
    event: "Duplicate Campaign",
    label: "Duplicate Campaign",
    description: "Creates a copy of a TikTok campaign, including its child ad groups and (optionally) their ads",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "targetId",
        type: "string",
        label: "Source Campaign",
        required: true,
        description:
          "TikTok campaign to duplicate (enter an ID or use a data pill). In Scale qualifying structure mode, this single TikTok campaign is cloned once per qualifying campaign from the trigger.",
      },
      { name: "newName", type: "string", label: "New Name", required: false },
      {
        name: "campaignBudget",
        type: "number",
        label: "Campaign Budget Override",
        required: false,
        description: "Optional new campaign budget. Leave empty to inherit from the source campaign.",
      },
      {
        name: "campaignBudgetType",
        type: "select",
        label: "Budget Type",
        required: false,
        options: [
          { value: "daily", label: "Daily" },
          { value: "lifetime", label: "Lifetime" },
        ],
      },
      {
        name: "budgetLevel",
        type: "select",
        label: "Budget Level",
        required: false,
        options: [
          { value: "campaign", label: "Campaign (CBO)" },
          { value: "adset", label: "Ad Group" },
        ],
        description: "Smart+ accounts may fall back to CBO if ad-set-level is not allowlisted.",
      },
      {
        name: "duplicateAds",
        type: "boolean",
        label: "Duplicate Ads",
        required: false,
        description: "When enabled, copies the ads inside each child ad group. Default: true.",
      },
      {
        name: "duplicatedAdsStatus",
        type: "select",
        label: "New Ad Status",
        required: false,
        options: [
          { value: "PAUSED", label: "Paused (default)" },
          { value: "ACTIVE", label: "Active" },
        ],
        description: "Status applied to duplicated ads inside the new ad groups.",
      },
      {
        name: "campaignShellOnly",
        type: "boolean",
        label: "Campaign Shell Only",
        required: false,
        description: "When enabled, only the campaign is created. Child ad groups are not duplicated.",
      },
      {
        name: "isCampaignLive",
        type: "boolean",
        label: "Activate New Campaign Immediately",
        required: false,
        description: "Default: false. The duplicated campaign is created paused so you can review before launching.",
      },
      {
        name: "scaleQualifyingStructure",
        type: "boolean",
        label: "Scale qualifying structure",
        required: false,
        description:
          "Cross-platform scale-out. When on, the picked TikTok campaign (`targetId`) is the template, cloned once per qualifying campaign from the trigger — e.g. a Meta Performance Threshold that qualifies 3 campaigns creates 3 new TikTok campaigns. Pair with 'Campaign shell only' plus a following Duplicate Ad Group + Launch on TikTok step to reproduce the qualifying structure on TikTok.",
      },
      {
        name: "launchLive",
        type: "boolean",
        label: "Launch live",
        required: false,
        description: "Create the duplicated campaigns/ad groups/ads active instead of paused. Default: false.",
      },
    ],
    examples: ["Duplicate a winning TikTok campaign at 2× budget", "Clone a campaign into a new launch slot"],
  },
  {
    service: "tiktok-ads",
    event: "Duplicate Ad Group",
    label: "Duplicate Ad Group",
    description: "Creates a copy of an existing TikTok ad group",
    config: [
      { name: "advertiserId", type: "string", label: "Advertiser Account", required: true },
      {
        name: "targetId",
        type: "string",
        label: "Source Ad Group",
        required: true,
        description:
          "TikTok ad group to duplicate (enter an ID or use a data pill). In Scale qualifying structure mode, this single TikTok ad group is cloned once per qualifying ad set from the trigger.",
      },
      { name: "newName", type: "string", label: "New Name", required: false },
      {
        name: "targetCampaignId",
        type: "string",
        label: "Target Campaign",
        required: false,
        description:
          "Campaign to place the duplicated ad group into. Use {{node-action-1.campaignId}} to chain after Duplicate Campaign. Leave empty to keep in the same campaign.",
      },
      {
        name: "newBudget",
        type: "number",
        label: "Budget Override",
        required: false,
        description: "Optional new ad-group budget.",
      },
      {
        name: "budgetType",
        type: "select",
        label: "Budget Type",
        required: false,
        options: [
          { value: "daily", label: "Daily" },
          { value: "lifetime", label: "Lifetime" },
        ],
      },
      { name: "clickAttributionWindow", type: "string", label: "Click Attribution Window", required: false },
      { name: "viewAttributionWindow", type: "string", label: "View Attribution Window", required: false },
      {
        name: "stripInterests",
        type: "boolean",
        label: "Strip Unavailable Interests",
        required: false,
        description:
          "Enable to skip interest targeting from the source if TikTok reports them as unavailable. Use only if duplicates are failing with an interests error.",
      },
      {
        name: "scaleQualifyingStructure",
        type: "boolean",
        label: "Scale qualifying structure",
        required: false,
        description:
          "Cross-platform scale-out. When on, the picked TikTok ad group (`targetId`) is the template, cloned once per qualifying ad set into the matching new campaign shell (strict per-campaign ratio) created by a preceding Duplicate Campaign scale step. Created empty — the Launch on TikTok step adds the qualifying ads' creatives.",
      },
      {
        name: "launchLive",
        type: "boolean",
        label: "Launch live",
        required: false,
        description: "Create the duplicated ad groups/ads active instead of paused. Default: false.",
      },
    ],
    examples: ["Duplicate a winning TikTok ad group", "Clone an ad group into a new campaign for scaling"],
  },
  // ============================================================================
  // SNAPCHAT ADS ACTIONS
  // ============================================================================
  {
    service: "snapchat-ads",
    event: "Pause Ad",
    label: "Pause Ad",
    description: "Pauses one or more Snapchat ads (sets status to PAUSED)",
    config: [
      { name: "adAccountId", type: "string", label: "Snapchat Ad Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Ad IDs to Pause",
        required: false,
        description: "Use {{node-trigger-1.qualifyingAdIds}} to pause ads from Performance Threshold trigger",
      },
    ],
    examples: ["Pause underperforming Snapchat ads", "Disable Snapchat ads with high CPA"],
  },
  // ============================================================================
  // PINTEREST ADS ACTIONS (ADM-12075)
  // ============================================================================
  {
    service: "pinterest-ads",
    event: "Pause Ad",
    label: "Pause Ad",
    description: "Pauses one or more Pinterest ads (sets status to PAUSED). Ads that are already paused are skipped.",
    config: [
      { name: "adAccountId", type: "string", label: "Pinterest Ad Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Ad IDs to Pause",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingAdIds}} to pause ads from the Pinterest Performance Threshold trigger. Leave empty to use the trigger's matched ads.",
      },
    ],
    examples: ["Pause Pinterest ads whose name contains a campaign code", "Pause old Pinterest ads every Sunday"],
  },
  {
    service: "pinterest-ads",
    event: "Enable Ad",
    label: "Enable Ad",
    description:
      "Enables one or more paused Pinterest ads (sets status to ACTIVE). Ads that are already active are skipped.",
    config: [
      { name: "adAccountId", type: "string", label: "Pinterest Ad Account", required: true },
      {
        name: "targetIds",
        type: "string",
        label: "Ad IDs to Enable",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingAdIds}} to enable ads from the Pinterest Performance Threshold trigger. Leave empty to use the trigger's matched ads.",
      },
    ],
    examples: ["Re-enable Pinterest ads whose name contains a campaign code every Monday"],
  },
  // ============================================================================
  // X (TWITTER) ADS ACTIONS
  // ============================================================================
  {
    service: "x-ads",
    event: "Launch on X",
    label: "Launch on X",
    description:
      "Promotes the trigger's qualifying creatives (e.g. Meta winners from a Performance Threshold) as X promoted posts, " +
      "either into existing X ad groups or into a new campaign + ad group. Posts are created paused by default.",
    config: [
      { name: "accountId", type: "string", label: "X Ad Account", required: true },
      {
        name: "mode",
        type: "select",
        label: "Destination",
        required: false,
        options: [
          { value: "existing", label: "Existing ad groups" },
          { value: "new", label: "New campaign + ad group" },
        ],
        defaultValue: "existing",
      },
      {
        name: "lineItemIds",
        type: "array",
        label: "X Ad Groups",
        required: false,
        description: "Existing X ad group (line item) ids to promote into. Required when mode is 'existing'.",
      },
      { name: "campaignName", type: "string", label: "Campaign Name", required: false, description: "New mode only." },
      { name: "adGroupName", type: "string", label: "Ad Group Name", required: false, description: "New mode only." },
      {
        name: "objective",
        type: "select",
        label: "Objective",
        required: false,
        options: [
          { value: "ENGAGEMENTS", label: "Engagements" },
          { value: "WEBSITE_CLICKS", label: "Website clicks" },
          { value: "VIDEO_VIEWS", label: "Video views" },
          { value: "REACH", label: "Reach" },
        ],
        defaultValue: "ENGAGEMENTS",
      },
      {
        name: "placements",
        type: "array",
        label: "Placements",
        required: false,
        description: "ALL_ON_TWITTER (default) and/or PUBLISHER_NETWORK.",
      },
      {
        name: "dailyBudget",
        type: "number",
        label: "Daily Budget",
        required: false,
        description: "New mode only. Account currency; converted to micro units on launch.",
      },
      { name: "bid", type: "number", label: "Bid", required: false, description: "New mode only. Account currency." },
      {
        name: "postText",
        type: "string",
        label: "Post Text",
        required: false,
        description: "Max 280 chars, data pills allowed. Defaults to the source ad's primary text.",
      },
      {
        name: "websiteUrl",
        type: "string",
        label: "Website URL",
        required: false,
        description: "Defaults to the source ad's link.",
      },
      { name: "launchPaused", type: "boolean", label: "Launch Paused", required: false, defaultValue: true },
      { name: "cooldownEnabled", type: "boolean", label: "Enable Cooldown", required: false },
      { name: "cooldownDuration", type: "number", label: "Cooldown Duration", required: false },
      {
        name: "cooldownUnit",
        type: "select",
        label: "Cooldown Unit",
        required: false,
        options: [
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
          { value: "weeks", label: "Weeks" },
          { value: "never", label: "Never launch again" },
        ],
      },
    ],
    examples: [
      "Launch winning Facebook creatives on X",
      "Promote Meta ads with ROAS above 2 as paused X posts",
      "Push media library uploads to an X ad group",
    ],
  },
  // ============================================================================
  // GOOGLE ADS ACTIONS
  // ============================================================================
  {
    service: "google-ads",
    event: "Launch on Google Ads",
    label: "Launch on Google Ads",
    description:
      "Add image and video assets to Google Ads Performance Max asset groups, Demand Gen ads, or App campaign ads.",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: true },
      { name: "campaignId", type: "string", label: "Campaign", required: true },
      {
        name: "googleAdsCampaignType",
        type: "string",
        label: "Campaign Type",
        required: false,
        description: "PERFORMANCE_MAX, DEMAND_GEN, or APP",
      },
      {
        name: "googleAdsAssetGroupIds",
        type: "array",
        label: "Asset Groups",
        required: false,
        description: "Target asset groups (PMax only). If empty, targets the campaign directly.",
      },
      {
        name: "googleAdsImageFieldType",
        type: "select",
        label: "Image Field Type",
        required: false,
        options: [
          { value: "5", label: "Marketing Image (landscape)" },
          { value: "19", label: "Square Marketing Image" },
          { value: "20", label: "Portrait Marketing Image" },
        ],
        description: "How to classify uploaded images in PMax asset groups. Default: Marketing Image.",
      },
    ],
    examples: [
      "Upload winning Facebook creatives to Google Ads Performance Max",
      "Add media library images to Google Ads asset groups",
      "Launch trigger media as Google Ads assets",
    ],
  },
  {
    service: "google-ads",
    event: "Pause Campaign",
    label: "Pause Campaign",
    description: "Pauses one or more Google Ads campaigns (sets status to PAUSED)",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs to Pause",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingCampaignIds}} to pause campaigns from a Performance Threshold trigger. " +
          "Falls back to that output when left empty.",
      },
    ],
    examples: ["Pause Google campaigns with ROAS below 1", "Kill Google campaigns overspending on CPA"],
  },
  {
    service: "google-ads",
    event: "Enable Campaign",
    label: "Enable Campaign",
    description: "Enables one or more Google Ads campaigns (sets status to ENABLED)",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs to Enable",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCampaignIds}} to enable campaigns from a trigger.",
      },
    ],
    examples: ["Re-enable Google campaigns once CPA recovers"],
  },
  {
    service: "google-ads",
    event: "Pause Ad Group",
    label: "Pause Ad Group",
    description:
      "Pauses one or more Google Ads ad groups. Performance Max campaigns use asset groups and are not affected.",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Ad Group IDs to Pause",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingAdGroupIds}} to pause ad groups from an Ad Group level trigger. " +
          "Falls back to that output when left empty.",
      },
    ],
    examples: [
      "Pause Google ad groups whose CPA is above target",
      "Turn off losing ad groups inside a winning campaign",
    ],
  },
  {
    service: "google-ads",
    event: "Enable Ad Group",
    label: "Enable Ad Group",
    description: "Enables one or more Google Ads ad groups (sets status to ENABLED)",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Ad Group IDs to Enable",
        required: false,
        description: "Use {{node-trigger-1.qualifyingAdGroupIds}} to enable ad groups from a trigger.",
      },
    ],
    examples: ["Re-enable Google ad groups when ROAS recovers"],
  },
  {
    service: "google-ads",
    event: "Change Budget",
    label: "Change Budget",
    description:
      "Sets, increases or decreases the daily budget of one or more Google Ads campaigns. " +
      "Campaigns on a shared budget are skipped unless explicitly allowed, since changing one moves budget for every campaign sharing it.",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCampaignIds}}. Falls back to that output when left empty.",
      },
      {
        name: "budgetChangeType",
        type: "select",
        label: "Change Type",
        required: true,
        options: [
          { value: "set", label: "Set to" },
          { value: "increase", label: "Increase by" },
          { value: "decrease", label: "Decrease by" },
        ],
        description: "Default: Set to",
      },
      {
        name: "budgetValueType",
        type: "select",
        label: "Value Type",
        required: false,
        options: [
          { value: "amount", label: "Amount (account currency)" },
          { value: "percentage", label: "Percentage" },
        ],
        description: "Ignored for 'Set to', which is always an amount. Default: Amount",
      },
      { name: "budgetValue", type: "number", label: "Value", required: true },
      {
        name: "allowSharedBudget",
        type: "boolean",
        label: "Allow shared budgets",
        required: false,
        description:
          "Off by default. When on, campaigns using a shared budget are changed too, which affects every other campaign on that budget.",
      },
    ],
    examples: [
      "Increase Google campaign budgets 20% when ROAS is above 3",
      "Cut Google campaign budgets 30% when CPA exceeds target",
    ],
  },
  {
    service: "google-ads",
    event: "Update Target CPA/ROAS",
    label: "Update Target CPA/ROAS",
    description:
      "Updates the target CPA or target ROAS on a campaign's bidding strategy. Handles both standard and portfolio strategies.",
    config: [
      { name: "accountId", type: "string", label: "Google Ads Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCampaignIds}}. Falls back to that output when left empty.",
      },
      {
        name: "biddingTarget",
        type: "select",
        label: "Target",
        required: true,
        options: [
          { value: "target_cpa", label: "Target CPA" },
          { value: "target_roas", label: "Target ROAS" },
        ],
        description:
          "Must match the campaign's strategy family: Target CPA / Maximize Conversions accept tCPA, " +
          "Target ROAS / Maximize Conversion Value accept tROAS.",
      },
      {
        name: "biddingValue",
        type: "number",
        label: "Value",
        required: true,
        description: "Account currency for Target CPA, or a ratio for Target ROAS (e.g. 3 for 300%).",
      },
    ],
    examples: [
      "Loosen target CPA on Google campaigns that stopped spending",
      "Raise target ROAS when a Google campaign beats its goal",
    ],
  },
  {
    service: "google-ads",
    event: "Add Negative Keywords",
    label: "Google Ads",
    description:
      "Adds the matched keywords as negative keywords at ad group or campaign level, and optionally removes " +
      "or pauses the original keyword.",
    config: [
      {
        name: "negativeLevel",
        type: "select",
        label: "Negative Keyword Level",
        required: true,
        defaultValue: "ad_group",
        options: [
          { value: "ad_group", label: "Ad Group" },
          { value: "campaign", label: "Campaign" },
        ],
        description: "Where to write the negative. Default: Ad Group",
      },
      {
        name: "negativeMatchType",
        type: "select",
        label: "Negative Match Type",
        required: true,
        defaultValue: "EXACT",
        options: [
          { value: "EXACT", label: "Exact" },
          { value: "PHRASE", label: "Phrase" },
          { value: "BROAD", label: "Broad" },
        ],
        description: "Match type for the negative keyword. Default: Exact",
      },
      {
        name: "originalKeywordHandling",
        type: "select",
        label: "Original Keyword",
        required: true,
        defaultValue: "remove",
        options: [
          { value: "remove", label: "Remove it" },
          { value: "pause", label: "Pause it" },
          { value: "leave", label: "Leave it (negative only)" },
        ],
        description:
          "A negative alone does not remove the keyword Google added - it blocks it and Google flags a " +
          "conflict. Default: Remove it",
      },
    ],
    examples: ["Add matched keywords as exact negatives and remove the originals"],
  },
  // ============================================================================
  // APPLOVIN (AXON) ACTIONS
  //
  // Campaign and creative set are the ONLY two tiers AppLovin's Manage API can
  // mutate - there is no per-ad entity, so never offer a "Pause Ad" here.
  // ============================================================================
  {
    service: "axon-ads",
    event: "Pause Campaign",
    label: "Pause Campaign",
    description: "Pauses one or more AppLovin campaigns (sets status to PAUSED)",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs to Pause",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingCampaignIds}} to pause campaigns from a Performance Threshold trigger. " +
          "Falls back to that output when left empty.",
      },
    ],
    examples: ["Pause AppLovin campaigns with ROAS below 1", "Kill AppLovin campaigns overspending on CPA"],
  },
  {
    service: "axon-ads",
    event: "Enable Campaign",
    label: "Enable Campaign",
    description: "Enables one or more AppLovin campaigns (sets status to LIVE)",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs to Enable",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCampaignIds}} to enable campaigns from a trigger.",
      },
    ],
    examples: ["Re-enable AppLovin campaigns once CPA recovers"],
  },
  {
    service: "axon-ads",
    event: "Pause Creative Set",
    label: "Pause Creative Set",
    description:
      "Pauses one or more AppLovin creative sets (sets status to PAUSED). The parent campaign is resolved from the " +
      "trigger's matched entities; pin one on the action only when the IDs are typed by hand.",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Creative Set IDs to Pause",
        required: false,
        description:
          "Use {{node-trigger-1.qualifyingCreativeSetIds}} to pause creative sets from a Creative Set level trigger. " +
          "Falls back to that output when left empty, which is empty on a Campaign level run.",
      },
      {
        name: "campaignId",
        type: "string",
        label: "Parent Campaign",
        required: false,
        description:
          "Only needed for hand-typed creative set IDs. AppLovin can only read a creative set through its campaign, " +
          "so an ID with no known parent is skipped rather than guessed.",
      },
    ],
    examples: ["Pause AppLovin creative sets whose CPA is above target", "Turn off losing creative sets in a winner"],
  },
  {
    service: "axon-ads",
    event: "Enable Creative Set",
    label: "Enable Creative Set",
    description:
      "Enables one or more AppLovin creative sets (sets status to LIVE). The parent campaign is resolved from the " +
      "trigger's matched entities; pin one on the action only when the IDs are typed by hand.",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Creative Set IDs to Enable",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCreativeSetIds}} to enable creative sets from a trigger.",
      },
      {
        name: "campaignId",
        type: "string",
        label: "Parent Campaign",
        required: false,
        description: "Only needed for hand-typed creative set IDs; otherwise taken from the trigger's matches.",
      },
    ],
    examples: ["Re-enable AppLovin creative sets when ROAS recovers"],
  },
  {
    service: "axon-ads",
    event: "Change Budget",
    label: "Change Budget",
    description:
      "Sets, increases or decreases the daily budget of one or more AppLovin campaigns. Campaign level only - " +
      "AppLovin holds no budget on a creative set. Skipped while a global budget freeze is active.",
    config: [
      { name: "accountId", type: "string", label: "AppLovin Account", required: false },
      {
        name: "targetIds",
        type: "string",
        label: "Campaign IDs",
        required: false,
        description: "Use {{node-trigger-1.qualifyingCampaignIds}}. Falls back to that output when left empty.",
      },
      {
        name: "budgetChangeType",
        type: "select",
        label: "Change Type",
        required: true,
        options: [
          { value: "set", label: "Set to" },
          { value: "increase", label: "Increase by" },
          { value: "decrease", label: "Decrease by" },
        ],
        description: "Default: Set to",
      },
      {
        name: "budgetValueType",
        type: "select",
        label: "Value Type",
        required: false,
        options: [
          { value: "amount", label: "Amount (account currency)" },
          { value: "percentage", label: "Percentage" },
        ],
        description: "Ignored for 'Set to', which is always an amount. Default: Amount",
      },
      {
        name: "budgetValue",
        type: "number",
        label: "Value",
        required: true,
        description:
          "Account currency for Amount, or a percentage (e.g. 20 for 20%). App campaigns have a $500 daily minimum; " +
          "a change that lands below it is skipped, not forced.",
      },
    ],
    examples: [
      "Increase AppLovin campaign budgets 20% when ROAS is above 3",
      "Cut AppLovin campaign budgets 30% when CPA exceeds target",
    ],
  },
  {
    service: "comments",
    event: "Hide Comment",
    label: "Hide Comment",
    description: "Hide matching Facebook or Instagram comments.",
    config: [],
    examples: ["Hide spam comments", "Hide negative comments"],
  },
  {
    service: "comments",
    event: "Delete Comment",
    label: "Delete Comment",
    description: "Delete matching Facebook or Instagram comments.",
    config: [],
    examples: ["Delete scam comments"],
  },
  {
    service: "comments",
    event: "Like Comment",
    label: "Like Comment",
    description: "Like matching Facebook or Instagram comments as your page.",
    config: [],
    examples: ["Like positive comments", "Like comments that mention your brand"],
  },
  {
    service: "comments",
    event: "Reply to Comment",
    label: "Reply to Comment",
    description: "Reply to matching comments with AI or a fixed template.",
    config: [
      {
        name: "actionConfig",
        type: "string",
        label: "Reply settings",
        required: true,
        description: "AI prompt or fixed reply template",
      },
    ],
    examples: ["Auto-reply to product questions", "Draft empathetic replies for negative comments"],
  },

  {
    service: "monday",
    event: "Create Item",
    label: "Create Monday Item",
    description: "Create a new item on a Monday board. Supports {{trigger.*}} templates.",
    config: [
      {
        name: "mondayBoardId",
        type: "string",
        label: "Board ID",
        required: true,
        placeholder: "{{trigger.boardId}}",
      },
      {
        name: "mondayItemName",
        type: "string",
        label: "Item name",
        required: true,
        placeholder: "{{trigger.itemName}}",
      },
      {
        name: "mondayColumnValues",
        type: "string",
        label: "Column values JSON",
        required: false,
        placeholder: '{"status":{"label":"Working on it"}}',
      },
    ],
    examples: ["Create a Monday follow-up item when an ad launches"],
  },
  {
    service: "monday",
    event: "Update Item",
    label: "Update Monday Item",
    description: "Update a Monday item column value (status, text, etc).",
    config: [
      {
        name: "mondayBoardId",
        type: "string",
        label: "Board ID",
        required: true,
        placeholder: "{{trigger.boardId}}",
      },
      {
        name: "mondayItemId",
        type: "string",
        label: "Item ID",
        required: true,
        placeholder: "{{trigger.itemId}}",
      },
      {
        name: "mondayColumnId",
        type: "string",
        label: "Column ID",
        required: true,
        placeholder: "status",
      },
      {
        name: "mondayColumnValue",
        type: "string",
        label: "Column value",
        required: true,
        placeholder: '{"label":"Done"}',
      },
    ],
    examples: ["Mark a Monday item Done after a successful launch"],
  },
  {
    service: "webhook",
    event: "Send Webhook",
    label: "Send Webhook",
    description: "Sends an HTTP request to any URL. Use for Slack incoming webhooks, Zapier, custom backends, etc.",
    config: [
      {
        name: "url",
        type: "string",
        label: "URL",
        required: true,
        placeholder: "https://hooks.slack.com/services/...",
      },
      {
        name: "method",
        type: "select",
        label: "Method",
        required: true,
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "PATCH", label: "PATCH" },
          { value: "DELETE", label: "DELETE" },
        ],
        description: "HTTP method. Default: POST",
      },
      {
        name: "headers",
        type: "array",
        label: "Headers",
        required: false,
        description: "Custom headers as key/value pairs",
      },
      {
        name: "body",
        type: "string",
        label: "Body",
        required: false,
        placeholder: '{"text": "Ad {{trigger.adName}} was approved"}',
        description: "JSON body. Supports {{variable}} template syntax.",
      },
    ],
    examples: [
      "Send a Slack notification when an ad is approved",
      "POST to Zapier when a new ad launches",
      "Notify my backend when automation completes",
    ],
  },
  {
    service: "notification",
    event: "Send Notification",
    label: "Send Notification",
    description:
      "Send a Slack message or email when this step runs. No approval required — the automation continues immediately.",
    config: [
      {
        name: "notificationMethod",
        type: "select",
        label: "Method",
        required: true,
        options: [
          { value: "email", label: "Email Only" },
          { value: "slack", label: "Slack Only" },
          { value: "both", label: "Both" },
        ],
      },
      {
        name: "slackChannelOverride",
        type: "string",
        label: "Slack Channel",
        required: false,
        description: "Override the org default Slack channel",
      },
      {
        name: "slackUsername",
        type: "string",
        label: "Slack Display Name",
        required: false,
        placeholder: "Automated Alert",
        description: 'Slack message source name. Defaults to "Automated Alert".',
      },
      {
        name: "emailRecipients",
        type: "array",
        label: "Email Recipients",
        required: false,
        description: "Email addresses to notify",
      },
      {
        name: "customMessage",
        type: "string",
        label: "Message",
        required: false,
        placeholder: "Ad {{trigger.adName}} was approved and launched successfully.",
        description: "Supports {{trigger.fieldName}}, {{date}}, {{datetime}}, {{step.N.field}} template variables.",
      },
    ],
    examples: [
      "Send a Slack notification when ad is approved",
      "Email the team when automation completes",
      "Notify via Slack and email when budget changes",
    ],
  },
  {
    service: "report",
    event: "Generate Report Link",
    label: "Generate Report Link",
    description:
      "Generate a shareable link for a statistics report (Top Creatives, Creative Audit). Chain with a Send Notification action to deliver the link via Slack or email.",
    config: [
      {
        name: "reportType",
        type: "select",
        label: "Report Type",
        required: true,
        options: [
          { value: "stats", label: "Top Creatives" },
          { value: "creative_audit", label: "Creative Audit" },
        ],
      },
      {
        name: "reportDateRange",
        type: "select",
        label: "Date Range",
        required: true,
        options: [
          { value: "last_7_days", label: "Last 7 Days" },
          { value: "last_14_days", label: "Last 14 Days" },
          { value: "last_30_days", label: "Last 30 Days" },
          { value: "last_90_days", label: "Last 90 Days" },
          { value: "this_month", label: "This Month" },
          { value: "last_month", label: "Last Month" },
        ],
      },
      {
        name: "templateReportId",
        type: "select",
        label: "Report Template",
        required: false,
        description: "Use a saved report as template to inherit its metrics, filters, and grouping.",
      },
      {
        name: "reportAccountIds",
        type: "array",
        label: "Ad Accounts",
        required: false,
        description: "Select specific ad accounts or leave empty to use the automation's default account.",
      },
      {
        name: "auditLinkMode",
        type: "select",
        label: "Link Type (Creative Audit only)",
        required: false,
        options: [
          { value: "public", label: "Public Link (no login required)" },
          { value: "authenticated", label: "Authenticated Link (login required)" },
        ],
        description: "Choose whether the Creative Audit link requires login or is publicly accessible.",
      },
    ],
    examples: [
      "Generate a Top Creatives share link every Monday and send to Slack",
      "Share Creative Audit results weekly via notification",
      "Send a shareable stats link to the team channel after automation completes",
    ],
  },
  {
    service: "media-library",
    event: "Upload to Media Library",
    label: "Upload to Media Library",
    description:
      "Uploads media from the trigger (e.g. Google Drive file, Google Sheets row) to the Admanage media library, optionally into a specific board.",
    config: [
      {
        name: "targetBoardId",
        type: "string",
        label: "Target Board",
        required: false,
        description: "Board to upload the media into. Leave empty to upload to the library root.",
      },
      {
        name: "namingTemplate",
        type: "string",
        label: "Naming Template",
        required: false,
        description:
          "Optional template for the asset name. Supports {originalName}, {date}, {folderName}, {boardName}, {counter}, {aiName}, {ratio}. {ratio} resolves to the aspect-ratio token detected in the source filename (e.g. 1x1, 9x16) — useful for keeping multi-placement variants distinct. Including {aiName} adds 2-3s per file because the AI namer runs synchronously.",
      },
    ],
    examples: [
      "Upload Google Drive files to my media library",
      "Upload new creatives to the 'Winning Ads' board",
      "Upload Drive folder files and rename them as {date}_{folderName}_{counter}",
    ],
  },
  {
    service: "google-ads",
    event: "Upload to YouTube",
    label: "Upload to YouTube",
    description:
      "Uploads video from the trigger (Google Drive file, media library asset) to a YouTube channel or Google Ads video storage. Videos are queued and uploaded in the background, paced against a daily per-company automation budget, so the automation itself finishes immediately.",
    config: [
      {
        name: "destination",
        type: "select",
        label: "Destination",
        required: false,
        options: [
          { value: "youtube_channel", label: "YouTube channel" },
          { value: "ad_storage", label: "Google Ads video storage" },
        ],
        defaultValue: "youtube_channel",
        description:
          "youtube_channel uploads to the connected channel. ad_storage uses Google Ads managed video storage, which never appears on the channel and costs no YouTube upload quota.",
      },
      {
        name: "mediaSource",
        type: "string",
        label: "Video Source",
        required: false,
        description:
          "Data pill naming the step whose video should be uploaded, e.g. {{node-trigger-1.fileUrl}}. Leave blank to upload whatever media the trigger provides; set it when more than one step produces media so only the chosen step's videos are uploaded.",
      },
      {
        name: "titleTemplate",
        type: "string",
        label: "Title Template",
        required: false,
        description:
          "Title for the uploaded video. Supports {filename}. Defaults to the workspace's YouTube settings. Truncated to YouTube's 100-character limit.",
      },
      {
        name: "privacy",
        type: "select",
        label: "Privacy",
        required: false,
        options: [
          { value: "private", label: "Private" },
          { value: "unlisted", label: "Unlisted" },
          { value: "public", label: "Public" },
        ],
        description: "Channel uploads only. Defaults to the workspace's YouTube settings.",
      },
    ],
    examples: [
      "Upload new Drive videos to YouTube",
      "Upload videos added to the 'Winning Ads' board to YouTube as unlisted",
      "Upload Drive folder videos to Google Ads video storage",
    ],
  },
];

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

export function generateSystemPrompt(): string {
  const triggerDocs = TRIGGERS.map((t) => {
    const configDoc =
      t.config.length > 0
        ? `Config: { ${t.config.map((c) => `${c.name}${c.required ? "" : "?"}: ${c.type}`).join(", ")} }`
        : "Config: {}";

    const outputDoc = t.outputs.length > 0 ? `Outputs: ${t.outputs.map((o) => o.name).join(", ")}` : "";

    return `### ${t.label} (service: "${t.service}")
**Event: "${t.event}"**
${t.description}

${configDoc}
${outputDoc}

Examples: ${t.examples?.join(", ") || "N/A"}`;
  }).join("\n\n");

  const actionDocs = ACTIONS.map((a) => {
    const configDoc = a.config.map((c) => `- ${c.name}${c.required ? " (required)" : ""}: ${c.label}`).join("\n");

    return `**${a.event}**
${a.description}

Config:
${configDoc || "(none)"}`;
  }).join("\n\n");

  return `You are an automation assistant for AdManage, a Meta Ads management platform.
Your job is to help users create automations by understanding their intent and generating valid automation flows.

## Available Triggers

${triggerDocs}

## Available Actions (service: "meta-ads")

${actionDocs}

## CRITICAL: Performance Threshold Criteria Format

When using "Performance Threshold" trigger, you MUST use the \`criteria\` object format AND the \`adSetFilterType\` field:

\`\`\`json
"config": {
  "accountId": "{{selectedAccountId}}",
  "adSetFilterType": "contains",
  "adSetNameFilter": "test",
  "criteria": {
    "conditions": [
      { "metric": "spend", "operator": ">", "value": 10 }
    ],
    "logic": "AND",
    "lookbackDays": 7
  }
}
\`\`\`

**Ad Set Filter Types:**
- \`"all"\` - All ad sets (default, no filter needed)
- \`"contains"\` - Ad sets whose name CONTAINS the text in \`adSetNameFilter\`
- \`"not_contains"\` - Ad sets whose name DOES NOT CONTAIN any comma-separated term in \`adSetNameFilter\`
- \`"specific"\` - A specific ad set (use \`specificAdSetId\` instead)

IMPORTANT: When user mentions filtering by ad set name (e.g., "in 'test' ad sets"), you MUST set BOTH:
- \`adSetFilterType: "contains"\`
- \`adSetNameFilter: "test"\`

**Available metrics (grouped):**
- Performance: spend, roas, cpa, cpm, cpc, ctr, frequency, impressions, reach, clicks
- Conversion: conversions, appInstalls, costPerResult, purchases, purchaseValue, costPerPurchase, leads, costPerLead, addToCart, costPerAddToCart, registrations, costPerRegistration
- Video: hookRate, holdRate, thruPlayRate, videoViews, thruPlays, costPerThruPlay, videoP25, videoP50, videoP75, videoP100
- Engagement: linkClicks, costPerLinkClick, landingPageViews, costPerLandingPageView
- Text filter: adName

**Available operators:** ">", ">=", "<", "<=", "=" (for numeric metrics), "contains", "not_contains", "equals", "starts_with", "ends_with" (for adName)
**Logic:** "AND" or "OR" (for multiple conditions)
**lookbackDays:** 1, 3, 7, 14, or 30

IMPORTANT: When the user mentions filtering by ad NAME (e.g., "ads containing X", "ads with X in the name", "ads named X"), use the dedicated ad-name scope filter:
\`\`\`json
{ "adNameFilterType": "contains", "adNameFilter": "X" }
\`\`\`
When the user asks for ads whose name does not contain text:
\`\`\`json
{ "adNameFilterType": "not_contains", "adNameFilter": "X" }
\`\`\`

The \`adName\` metric remains available when ad-name matching must participate in criteria OR logic; use the dedicated scope filter for normal ad-name filtering.

**Campaign Filter (optional):**
- \`campaignNameFilterType\`: "all" (default), "contains", "equals", "not_contains", "starts_with", "ends_with"
- \`campaignNameFilter\`: the filter text (required when campaignNameFilterType is not "all")

**Ad Status Filter (optional):**
- \`adStatusFilter\`: "all" (default, shows ads with spend), "ACTIVE" (active only), "PAUSED" (paused only)

**Minimum Spend Filter (optional):**
- \`minSpendFilter\`: number - only show ads with at least this much spend in the lookback period

Example with multiple conditions:
\`\`\`json
"config": {
  "accountId": "{{selectedAccountId}}",
  "adSetFilterType": "all",
  "adStatusFilter": "all",
  "campaignNameFilterType": "contains",
  "campaignNameFilter": "Scale",
  "criteria": {
    "conditions": [
      { "metric": "spend", "operator": ">", "value": 10 },
      { "metric": "roas", "operator": ">", "value": 2 }
    ],
    "logic": "AND",
    "lookbackDays": 7
  }
}
\`\`\`

## CRITICAL: Rule Condition Check Format

When using "Rule Condition Check" trigger, the user wants to reuse conditions from an existing Facebook Ad Rule as a trigger. The copilot CANNOT know the user's rule IDs, so leave \`ruleId\` empty and \`ruleName\` empty — the user will select the rule from a dropdown in the config panel.

\`\`\`json
"config": {
  "accountId": "{{selectedAccountId}}",
  "ruleId": "",
  "ruleName": "",
}
\`\`\`

**When to use Rule Condition Check vs Performance Threshold:**
- Use **Rule Condition Check** when user says "use my existing rule", "when my rule conditions match", "based on my rule", "apply my rule's conditions"
- Use **Performance Threshold** when user specifies explicit metrics (e.g., "when ROAS > 2", "when spend > $10")

**Outputs available from Rule Condition Check:**
- \`matchingAdIds\` / \`qualifyingAdIds\` — use in subsequent actions like Duplicate Ad, Pause Ad
- \`matchingAdSetIds\` — use for ad set level actions
- \`matchingCount\` — number of matching entities

Example flow: "When ads match my rule conditions, duplicate them"
\`\`\`json
{
  "nodes": [
    {
      "id": "node-trigger-1",
      "type": "trigger",
      "service": "facebook-rules",
      "event": "Rule Condition Check",
      "position": 0,
      "config": {
        "accountId": "{{selectedAccountId}}",
        "ruleId": "",
        "ruleName": "",
            }
    },
    {
      "id": "node-action-1",
      "type": "action",
      "service": "meta-ads",
      "event": "Duplicate Ad",
      "position": 1,
      "config": {
        "accountId": "{{selectedAccountId}}",
        "sourceAdIds": "{{node-trigger-1.matchingAdIds}}",
        "newName": ""
      }
    }
  ]
}
\`\`\`

In the \`thinking\` field, tell the user: "You'll need to select which rule to use from the Rule Condition Check trigger configuration."

## CRITICAL: Ad Approved Trigger Format

When using "Ad Approved" trigger, the user wants to detect ads that were recently approved (transitioned from review to active).

\`\`\`json
"config": {
  "accountId": "{{selectedAccountId}}",
  "campaignNameFilterType": "all",
  "campaignNameFilter": "",
  "adSetFilterType": "all",
  "adSetNameFilter": "",
  "lookbackHours": "24",
}
\`\`\`

**When to use Ad Approved:**
- Use when user says "when my ads get approved", "after ad approval", "when ads pass review"
- Outputs: \`approvedAdIds\` / \`qualifyingAdIds\` — use in subsequent actions like Duplicate Ad, Pause Ad

Example flow: "When my ads get approved, duplicate them"
\`\`\`json
{
  "nodes": [
    {
      "id": "node-trigger-1",
      "type": "trigger",
      "service": "meta-ads",
      "event": "Ad Approved",
      "position": 0,
      "config": {
        "accountId": "{{selectedAccountId}}",
        "lookbackHours": "24",
            }
    },
    {
      "id": "node-action-1",
      "type": "action",
      "service": "meta-ads",
      "event": "Duplicate Ad",
      "position": 1,
      "config": {
        "accountId": "{{selectedAccountId}}",
        "sourceAdIds": "{{node-trigger-1.approvedAdIds}}",
        "newName": ""
      }
    }
  ]
}
\`\`\`

## CRITICAL: Campaign Status Change Trigger Format

When using "Campaign Status Change" trigger, the user wants to detect campaigns that have a specific status.

\`\`\`json
"config": {
  "accountId": "{{selectedAccountId}}",
  "campaignNameFilterType": "all",
  "campaignNameFilter": "",
  "targetStatus": "PAUSED",
}
\`\`\`

**When to use Campaign Status Change:**
- Use when user says "when campaign is paused", "when campaign goes active", "detect campaigns with issues"
- Available targetStatus values: "ACTIVE", "PAUSED", "WITH_ISSUES", "PENDING_REVIEW", "ARCHIVED"
- Outputs: \`matchingCampaignIds\`, \`matchingCount\`, \`matchingCampaigns\`

## CRITICAL: Ad Launched via AdManage Trigger Format

When using "Ad Launched via AdManage" trigger, the user wants to detect ads that were recently launched via AdManage (from the AdBatch table).

\`\`\`json
"config": {
  "accountId": "",
  "campaignNameFilterType": "all",
  "campaignNameFilter": "",
  "lookbackHours": "24",
}
\`\`\`

**When to use Ad Launched via AdManage:**
- Use when user says "when I launch ads", "after launching ads", "when ads are launched via AdManage", "log my ad launches"
- Outputs: \`launchedAdIds\`, \`launchedAdsCount\`, \`launchedAds\`, \`batchId\`, \`batchTitle\`
- Each ad entry includes: \`adId\`, \`name\`, \`videoName\`, \`videoUrl\`, \`adGroupValue\`, \`adGroupName\`, \`timestamp\`, \`platform\`

Example flow: "When ads are launched, add them to Google Sheets"
\`\`\`json
{
  "nodes": [
    {
      "id": "node-trigger-1",
      "type": "trigger",
      "service": "admanage",
      "event": "Ad Launched via AdManage",
      "position": 0,
      "config": {
        "lookbackHours": "24",
            }
    },
    {
      "id": "node-action-1",
      "type": "action",
      "service": "google-sheets",
      "event": "Add Row",
      "position": 1,
      "config": {
        "spreadsheetId": "",
        "sheetName": "Sheet1",
        "columnMappings": [
          { "column": "A", "sourceType": "template", "value": "{{date}}" },
          { "column": "B", "sourceType": "trigger", "value": "adId" },
          { "column": "C", "sourceType": "trigger", "value": "name" },
          { "column": "D", "sourceType": "trigger", "value": "adGroupName" },
          { "column": "E", "sourceType": "trigger", "value": "timestamp" }
        ]
      }
    }
  ]
}
\`\`\`

In the \`thinking\` field, tell the user: "You'll need to specify your Google Sheets spreadsheet ID."

## Template Variables

Use these patterns in config fields like \`newName\`:

- \`{{date}}\` - Current date
- \`{{nodeId.fieldName}}\` - Reference outputs from previous steps
- \`{{assetName}}\` - Asset name from Media Library trigger
- \`{{node-trigger-1.qualifyingAdIds}}\` - Ad IDs from Performance Threshold

## Output Format

ALWAYS respond with valid JSON:

\`\`\`json
{
  "thinking": "I created an automation that [description]. You'll need to [what user must configure].",
  "flow": {
    "name": "Automation name",
    "nodes": [
      {
        "id": "node-trigger-1",
        "type": "trigger",
        "service": "service-name",
        "event": "Event Name",
        "position": 0,
        "config": { ... }
      },
      {
        "id": "node-action-1",
        "type": "action",
        "service": "meta-ads",
        "event": "Action Name",
        "position": 1,
        "config": { ... }
      }
    ]
  },
  "suggestions": ["Related automation ideas"]
}
\`\`\`

## Rules

1. Always start with exactly ONE trigger at position 0
2. Actions follow at positions 1, 2, 3... - IMPORTANT: Follow the EXACT order the user specifies (e.g., "pause then duplicate" means Pause at position 1, Duplicate at position 2)
3. Use unique IDs: node-trigger-1, node-action-1, node-action-2
4. Use \`"{{selectedAccountId}}"\` for accountId fields
5. When user mentions an ad set by NAME (e.g., "scale", "testing"), use \`targetAdSetNameFilter\` with that name so it matches all ad sets containing that text
6. Only use \`targetAdSetId: "{{selectAdSet}}"\` when user doesn't specify a target ad set name
7. When user mentions source ad sets by name in Performance Threshold (e.g., "from test ad sets"), set BOTH \`adSetFilterType: "contains"\` AND \`adSetNameFilter: "test"\`
8. NEVER ask follow-up questions. Be declarative: "I created X. You'll need to configure Y."
9. Use operator symbols: ">", ">=", "<", "<=", "=" (not "greater_than")
10. Return valid JSON only - no markdown code blocks
11. For Performance Threshold, ALWAYS use the \`criteria\` object with conditions array. Extract the exact values the user mentions (e.g., "over $10" → spend > 10)
12. For Duplicate Ad newName, leave empty to keep original name, OR use \`{{node-trigger-1.adName}}\` to include the original ad name in a custom format like "Scaled - {{node-trigger-1.adName}}"`;
}

// Export generated prompt
export const COPILOT_SYSTEM_PROMPT = generateSystemPrompt();

// ============================================================================
// SUGGESTED PROMPTS
// ============================================================================

export interface SuggestedPrompt {
  readonly text: string;
  readonly description: string;
  /** "suggest" routes the chip into the account-scanning recommend flow instead of building directly. */
  readonly mode?: "suggest";
}

export const SUGGESTED_PROMPTS: readonly SuggestedPrompt[] = [
  {
    text: "Suggest me an automation",
    description: "AI scans your account and recommends automations",
    mode: "suggest",
  },
  {
    text: "Launch ads when I upload new videos",
    description: "Auto-create ads from media library uploads",
  },
  {
    text: "Duplicate my best performing ads",
    description: "Scale ads with high ROAS automatically",
  },
  {
    text: "Pause ads that are losing money",
    description: "Stop ads with poor performance",
  },
  {
    text: "Create ads from Google Drive files",
    description: "Launch ads when files are added to Drive",
  },
  {
    text: "Duplicate ad sets from a spreadsheet",
    description: "Bulk create ad sets from Google Sheets",
  },
  {
    text: "Launch ads and apply my existing rule",
    description: "Create ads and automatically apply a rule to them",
  },
  {
    text: "When rule conditions match, scale the ads",
    description: "Use existing rule conditions as a trigger",
  },
  {
    text: "When my ads get approved, duplicate them",
    description: "Auto-duplicate ads after they pass review",
  },
  {
    text: "When a campaign is paused, notify me",
    description: "Detect campaigns that change to paused status",
  },
  {
    text: "Log my ad launches to Google Sheets",
    description: "Track all ads launched via AdManage",
  },
];

/**
 * Shown instead of {@link SUGGESTED_PROMPTS} when the assistant panel opens on a flow
 * that already has steps — "build me an automation" reads oddly once one already exists,
 * so these are phrased as edits to what's already on the canvas.
 *
 * Deliberately short. Verified live, one at a time, against a real two-step flow:
 * - Editing a field on a step already on the canvas (check frequency, a filter) reliably
 *   routes the agent into a clarifying-question tool call this surface can't answer —
 *   the turn wedges with a failed "ask user" tool call, even with a concrete value already
 *   spelled out in the prompt.
 * - Appending a step that names an external target (an approval gate, a Google Sheets
 *   destination) hits the same "ask user" wall, or a separate bug where the agent's own
 *   "load flow reference" tool call truncates and it retries it in a loop that never
 *   resolves.
 * - Only two shapes came back clean on repeat tries: appending a step with no external
 *   target to pick ("notify me on Slack") and a pure explain with no canvas write.
 * Every entry here has to be one of those two shapes. Don't add an "edit an existing
 * field" or "add a step naming a destination" chip back without re-verifying it live —
 * the failure isn't obvious from the prompt text alone, it only shows up mid-turn.
 */
export const EDIT_SUGGESTED_PROMPTS: readonly SuggestedPrompt[] = [
  {
    text: "Add a step to notify me on Slack when this runs",
    description: "Append a notification action to the end of this flow",
  },
  {
    text: "Explain what this automation does",
    description: "Walk through each step and what it changes",
  },
];

// ============================================================================
// COPILOT RESPONSE TYPE
// ============================================================================

export type CopilotResponse = {
  thinking: string;
  flow?: {
    name: string;
    nodes: Array<{
      id: string;
      type: "trigger" | "action";
      service: string;
      event: string;
      position: number;
      config: Record<string, unknown>;
    }>;
  };
  followUp?: string;
  suggestions?: string[];
  error?: string;
};
