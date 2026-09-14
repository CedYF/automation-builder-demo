import type { AutomationFlow } from "../contexts/automation-context";
import { COMMENT_AUTOMATION_TEMPLATES, COMMENT_TEMPLATE_CATEGORY } from "./comment-automation-templates";

export const NOTION_STATUS_LAUNCH_TEMPLATE_ID = "template-notion-status-launch-ad";
export const NOTION_STATUS_LAUNCH_DEFAULT_STATUS = "Launch";

export type TemplateCategory = "scaling" | "optimization" | "reporting" | typeof COMMENT_TEMPLATE_CATEGORY;

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "scaling", label: "Scaling" },
  { value: "optimization", label: "Optimization" },
  { value: "reporting", label: "Reporting" },
  { value: COMMENT_TEMPLATE_CATEGORY, label: "Comments" },
];

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  emoji: string;
  iconService?: string;
  services: string[];
  displaySteps?: Array<{ service: string; label: string }>;
  featured?: boolean;
  flow: AutomationFlow;
}

export const SHEET_TEMPLATE_ADS_DEFAULT_SPREADSHEET_ID = "1pGC7rKyaJ1DYu7VWyAMZT6-jcw3TXmgAfZYNCDreaog";
export const SHEET_TEMPLATE_ADS_LOCATION_PILL = "{{trigger-1.targeting_location}}";
export const ORGANIC_POST_LIKES_THRESHOLD = 1;
export const AD_SET_WINNER_MIN_SPEND = 0;
export const AD_SET_WINNER_MIN_ROAS = 0;
/** Default spend (USD, over the 7-day lookback) a Meta ad must exceed before it scales to AppLovin. */
export const SCALE_META_WINNERS_AXON_MIN_SPEND = 50;
/**
 * Minimum age (whole days) a paused ad must reach before Zombie Campaign revives it.
 *
 * `adAge` is the only condition on that trigger on purpose: it is spend-independent,
 * so ads with no delivery in the lookback window still evaluate. A spend-based
 * condition would silently exclude every long-paused ad.
 *
 * Paired with `>=`, since ad age is floored to whole days — 1 keeps ads created
 * earlier the same day out of the first run.
 */
export const ZOMBIE_CAMPAIGN_MIN_AD_AGE_DAYS = 1;
/**
 * Overflow ad sets Zombie Campaign may create in one run.
 *
 * Meta caps an ad set at 50 ads, so this bounds a single run at roughly 500
 * revived ads. The first run on a mature account sweeps the whole paused back
 * catalogue, which is the run most likely to overflow.
 */
export const ZOMBIE_CAMPAIGN_MAX_AD_SET_SPLITS = 10;
/**
 * Marker written into every revived ad's name, and excluded by the trigger.
 *
 * Revived copies are created PAUSED, and the repeat-safety ledger is keyed on
 * the SOURCE ad id, so a copy carries no cooldown entry of its own. Without this
 * exclusion the next monthly run would see last month's copies as fresh paused
 * ads and revive those too, compounding every month.
 *
 * The trigger's `adName not_contains` check and the action's `newName` must keep
 * using this same constant or the loop reopens. Matching is case-insensitive.
 */
export const ZOMBIE_CAMPAIGN_REVIVED_MARKER = "Zombie";
/**
 * Default run time (24h, Europe/London) for the scheduled Value Rules templates.
 * Evening default because the common use case is switching bid value rules for
 * off-peak hours; the builder lets users change it before saving.
 */
export const SCHEDULED_VALUE_RULES_DEFAULT_TIME = "21:00";

/**
 * Lookback (days) shared by every AppLovin template.
 *
 * AppLovin caps a report window at `AXON_MAX_WINDOW_DAYS` (45) and resolves the
 * "Lifetime" sentinel (0) back to 7, so 7 is both the platform default and the
 * shortest window that still smooths a single bad day.
 */
export const AXON_TEMPLATE_LOOKBACK_DAYS = 7;

/**
 * Spend floor (account currency, over {@link AXON_TEMPLATE_LOOKBACK_DAYS}) before an
 * AppLovin campaign may be paused, and the ROAS it must fall under.
 *
 * The spend condition is listed first and is not decorative: it keeps campaigns that
 * barely delivered out of the population. Campaigns AppLovin cannot score at all are
 * already safe without it — CPP and CPE campaigns report `roas7d` as `null`, and
 * `evaluateAxonCondition` fails every operator on a null metric, so they never match
 * `roas < 1` instead of being read as ROAS 0 and paused.
 */
export const AXON_PAUSE_UNDERPERFORMER_MIN_SPEND = 50;
export const AXON_PAUSE_UNDERPERFORMER_MAX_ROAS = 1;

/**
 * Proof-of-performance floors an AppLovin campaign must clear before its budget is
 * raised, and the percentage raise applied.
 *
 * Deliberately a percentage rather than a flat amount so one template scales across
 * a $500/day campaign and a $50,000/day one: +20% is meaningful on both, where a flat
 * +$50 is a rounding error on the second and a near-doubling on the first.
 *
 * Note it is NOT a safety mechanism against AppLovin's $500/day APP-campaign minimum,
 * which `assertBudgetInRange` applies to the RESULTING budget. An increase computes
 * `current + delta`, so it can never newly drop under the floor. If anything a
 * percentage is likelier to be skipped on an APP campaign already below $500 (+20%
 * on $100 stays under it; a flat +$450 clears it).
 */
export const AXON_SCALE_WINNER_MIN_SPEND = 100;
export const AXON_SCALE_WINNER_MIN_ROAS = 2;
export const AXON_SCALE_WINNER_BUDGET_INCREASE_PERCENT = 20;

/**
 * Spend floor and CPA ceiling for the AppLovin cost alert.
 *
 * Alert-only by design: it notifies instead of pausing, so it can flag a campaign
 * the pause rule would leave running (a campaign can clear ROAS 1 and still be
 * buying conversions at an unacceptable CPA) without ever risking delivery.
 */
export const AXON_CPA_ALERT_MIN_SPEND = 100;
export const AXON_CPA_ALERT_MAX_CPA = 50;

/**
 * Trigger services whose ad account `cloneTemplateNodes` cannot fill in.
 *
 * That helper only knows how to inject the workspace's default *Meta* account, so a
 * template triggered on any other platform persists with `accountId: ""`. Nothing
 * downstream stops that: `POST /api/automation-rules` validates only `name` and defers
 * the rest to runtime, and the automations table's on/off toggle sends only
 * `{ id, status }`, so a user can switch the rule on without ever opening the builder.
 *
 * The resulting failure is SILENT, not loud. The execute route gates the axon branch on
 * `axonPerfNode.config?.accountId` being truthy, so an empty one falls through every
 * trigger handler: no execution row, no error, the rule just reads as on and never does
 * anything.
 *
 * Templates matching this set therefore open in the builder instead of persisting
 * immediately — the same treatment comment templates get for their missing page. Note
 * this guard is client-side; an MCP or public-API caller can still persist one.
 *
 * NOTE: the Google Ads templates have the identical gap and are deliberately left
 * alone here; changing their long-shipped behaviour is out of scope for ADM-10377.
 */
const TRIGGER_SERVICES_NEEDING_MANUAL_ACCOUNT: ReadonlySet<string> = new Set(["axon-ads"]);

/**
 * True when a template must be opened in the builder and have its account picked
 * before it can be saved as a runnable rule.
 *
 * @param template - The gallery template the user clicked "Use" on.
 * @returns Whether persisting it immediately would create a rule that cannot run.
 */
export function requiresAccountBeforeSave(template: AutomationTemplate): boolean {
  return template.flow.nodes.some(
    (node) =>
      node.type === "trigger" &&
      node.service !== undefined &&
      TRIGGER_SERVICES_NEEDING_MANUAL_ACCOUNT.has(node.service),
  );
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // --- Featured ---
  {
    id: "template-performance-monitoring",
    name: "Performance Monitoring",
    description:
      "Track key metric changes across your ad accounts. Get alerted when spend, CPA, or ROAS shifts significantly day-over-day or week-over-week so you can act fast.",
    category: "optimization",
    emoji: "📈",
    services: ["meta-ads", "notification"],
    featured: true,
    flow: {
      id: "template-performance-monitoring",
      name: "Performance Monitoring",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Monitoring",
          position: 0,
          config: {
            monitoringLevel: "campaign",
            monitoringMetric: "spend",
            monitoringDirection: "decreases",
            monitoringPercentage: 20,
            monitoringComparisonWindow: "day",
            campaignNameFilterType: "all",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: {
            notificationMethod: "both",
            customMessage:
              "{{trigger.summary}}\n\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)",
          },
        },
      ],
    },
  },

  // --- Scaling ---
  {
    id: "template-scale-top-performers",
    name: "Scale Top Performers",
    description: "Automatically duplicate ads that exceed a ROAS threshold so you can scale winners quickly.",
    category: "scaling",
    emoji: "🚀",
    services: ["meta-ads"],
    flow: {
      id: "template-scale-top-performers",
      name: "Scale Top Performers",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 3 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-scale-ad-set-winners",
    name: "Scale Ad Set Winners",
    description:
      "Pick the highest-ROAS ad inside each matching ad set, duplicate the winner with its existing Post ID, and pause the original source ad set after scaling.",
    category: "scaling",
    emoji: "🏆",
    services: ["meta-ads"],
    displaySteps: [
      { service: "meta-ads", label: "Find one winner per ad set" },
      { service: "meta-ads", label: "Duplicate by Post ID and pause source ad set" },
    ],
    flow: {
      id: "template-scale-ad-set-winners",
      name: "Scale Ad Set Winners",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: {
              conditions: [
                { metric: "spend", operator: ">", value: AD_SET_WINNER_MIN_SPEND },
                { metric: "roas", operator: ">", value: AD_SET_WINNER_MIN_ROAS },
              ],
              logic: "AND",
              lookbackDays: 7,
              conversionEvent: "purchase",
              aggregation: "top_per_adset",
              rankMetric: "roas",
              rankDirection: "desc",
              topPerAdSetLimit: 1,
            },
            adSetFilterType: "all",
            adSetNameFilter: "*",
            allAdSets: true,
            adStatusFilter: "ACTIVE",
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad",
          position: 1,
          config: {
            sourceAdIds: "{{trigger-1.qualifyingAdIds}}",
            targetAdSetMatchType: "specific",
            targetAdSetId: "",
            duplicatedAdStatus: "ACTIVE",
            useExistingPost: true,
            pauseSourceAdSets: true,
            cooldownEnabled: true,
            cooldownUnit: "never",
            newName: "{{trigger-1.adName}} - Winner",
          },
        },
      ],
    },
  },
  {
    id: "template-budget-boost-winners",
    name: "Budget Boost for Winners",
    description: "Increase budget by 20% for campaigns with ROAS above 2 to capitalize on high-performing spend.",
    category: "scaling",
    emoji: "💰",
    services: ["meta-ads"],
    flow: {
      id: "template-budget-boost-winners",
      name: "Budget Boost for Winners",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 2 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Change Budget",
          position: 1,
          config: {
            budgetOperation: "INCREASE",
            budgetAmount: 20,
            budgetAmountType: "PERCENT",
          },
        },
      ],
    },
  },
  {
    id: "template-post-approval-scaling",
    name: "Post-Approval Scaling",
    description:
      "Once an ad is approved by Meta, automatically duplicate it into additional ad sets for broader reach.",
    category: "scaling",
    emoji: "✅",
    services: ["meta-ads"],
    flow: {
      id: "template-post-approval-scaling",
      name: "Post-Approval Scaling",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Ad Approved",
          position: 0,
          config: {
            lookbackHours: "24",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-promote-liked-organic-posts",
    name: "Promote Liked Organic Posts",
    description:
      "Check recent organic posts for strong reactions, then launch the best post as a Meta ad while preserving likes, comments, and shares.",
    category: "scaling",
    emoji: "👍",
    services: ["meta-ads"],
    displaySteps: [
      { service: "meta-ads", label: "Find organic posts with enough likes" },
      { service: "meta-ads", label: "Launch winner as an ad" },
    ],
    flow: {
      id: "template-promote-liked-organic-posts",
      name: "Promote Liked Organic Posts",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Best Performing Organic Post",
          position: 0,
          config: {
            metric: "reactions",
            minMetricValue: ORGANIC_POST_LIKES_THRESHOLD,
            lookbackDays: 30,
            topN: 1,
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Launch Ad",
          position: 1,
          config: {
            adSource: "post_id",
            adStatus: "PAUSED",
            targetAdSetMatchType: "specific",
            cooldownEnabled: true,
            cooldownUnit: "never",
            adNameTemplate: "Organic Post - {{node-trigger-1.metricValue}} likes",
          },
        },
      ],
    },
  },
  {
    id: "template-tiktok-authorized-posts-to-meta",
    name: "TikTok Creator Posts → Meta Ads",
    description:
      "Watch a TikTok ad account for newly authorized creator posts (Spark Ads) and automatically launch each new post as a Meta ad, paused for review.",
    category: "scaling",
    emoji: "🎵",
    services: ["tiktok-ads", "meta-ads"],
    displaySteps: [
      { service: "tiktok-ads", label: "Detect newly authorized creator posts" },
      { service: "meta-ads", label: "Launch each post as a Meta ad" },
    ],
    flow: {
      id: "template-tiktok-authorized-posts-to-meta",
      name: "TikTok Creator Posts → Meta Ads",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "tiktok-ads",
          event: "New Authorized Post",
          position: 0,
          config: {
            // First check records the creator's existing authorized posts
            // without launching them; only posts authorized afterwards fire.
            processExistingPosts: false,
            maxPostsPerRun: 5,
            checkFrequency: "hourly",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Launch Ad",
          position: 1,
          config: {
            adSource: "new_ad",
            adStatus: "PAUSED",
            targetAdSetMatchType: "specific",
            cooldownEnabled: true,
            cooldownUnit: "never",
            adNameTemplate: "{{node-trigger-1.creatorName}} - {{node-trigger-1.fileName}}",
          },
        },
      ],
    },
  },
  {
    id: "template-auto-test-ads-from-google-drive",
    name: "Auto Test Ads From Google Drive",
    description:
      "Watch a Drive parent folder for each new batch folder, duplicate a source ad set, then launch every media file from that folder into the new ad set.",
    category: "scaling",
    emoji: "🗂️",
    services: ["google-drive", "meta-ads"],
    flow: {
      id: "template-auto-test-ads-from-google-drive",
      name: "Auto Test Ads From Google Drive",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "google-drive",
          event: "New Folder in Folder",
          position: 0,
          config: {
            parentFolderId: "",
            checkFrequency: "hourly",
            batchStrategy: "one_per_file",
            folderNameFilterType: "all",
            minFiles: 1,
            recursiveSearch: false,
            fileScanDepth: 1,
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad Set",
          position: 1,
          config: {
            targetId: "",
            newName: "{{node-trigger-1.folderName}} - Test {{date}}",
          },
        },
        {
          id: "action-2",
          type: "action",
          service: "meta-ads",
          event: "Launch Ad",
          position: 2,
          config: {
            targetId: "{{action-1.resultId}}",
            targetAdSetMatchType: "specific",
            adStatus: "PAUSED",
            adNameTemplate: "{boardName} - {filename}",
          },
        },
      ],
    },
  },
  {
    id: "template-hunch-style-sheet-template-ads",
    name: "Sheet Template Ads",
    description:
      "Watch a Google Sheet for new city rows, create media from /create templates, duplicate a source ad set, and launch the generated ads paused.",
    category: "scaling",
    emoji: "📍",
    services: ["google-sheets", "meta-ads"],
    displaySteps: [
      { service: "google-sheets", label: "Google Sheets new rows" },
      { service: "meta-ads", label: "Duplicate ad set with sheet location" },
      { service: "meta-ads", label: "Create media from /create templates" },
      { service: "meta-ads", label: "Launch ads in duplicated ad set" },
    ],
    flow: {
      id: "template-hunch-style-sheet-template-ads",
      name: "Sheet Template Ads",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "google-sheets",
          event: "New Rows to Launch",
          position: 0,
          config: {
            spreadsheetId: SHEET_TEMPLATE_ADS_DEFAULT_SPREADSHEET_ID,
            sheetName: "Sheet1",
            headerRow: 1,
            dataStartRow: 2,
            processExistingRows: true,
            checkFrequency: "hourly",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad Set",
          position: 1,
          config: {
            hunchGroupId: "hunch-sheet-template-ads",
            useSheetRowLocation: true,
            accountId: "",
            campaignId: "",
            autoSelectFirstCampaign: true,
            autoSelectFirstAdSet: true,
            sourceAdSetId: "",
            targetId: "",
            deferToTemplateLaunch: true,
            templateIds: [],
            locationTargetingMode: "replace",
            locationSource: "sheet",
            locationColumn: SHEET_TEMPLATE_ADS_LOCATION_PILL,
            hiddenGeoColumn: "hidden_targeting_location_geo",
            countryColumn: "country",
            radiusColumn: "radius_m",
            leadFormId: "",
            pageId: "",
            instagramId: "",
            launchStatus: "PAUSED",
            adSetNameTemplate: "{city_naming} - Dynamic",
            adNameTemplate: "{city_naming} - {template_name}",
            headlineTemplate: "{city_naming}",
            descriptionTemplate: "{visual_text}",
            linkUrlTemplate: "{landing_page_url}",
            callToActionTemplate: "LEARN_MORE",
            defaultDailyBudget: "30",
          },
        },
        {
          id: "action-2",
          type: "action",
          service: "meta-ads",
          event: "Create Media from Templates",
          position: 2,
          config: {
            hunchGroupId: "hunch-sheet-template-ads",
            autoSelectTemplateCount: 2,
            accountId: "",
            campaignId: "",
            autoSelectFirstCampaign: true,
            autoSelectFirstAdSet: true,
            sourceAdSetId: "",
            templateIds: [],
            locationTargetingMode: "replace",
            locationSource: "sheet",
            locationColumn: SHEET_TEMPLATE_ADS_LOCATION_PILL,
            hiddenGeoColumn: "hidden_targeting_location_geo",
            countryColumn: "country",
            radiusColumn: "radius_m",
            adSetNameTemplate: "{city_naming} - Dynamic",
            adNameTemplate: "{city_naming} - {template_name}",
            headlineTemplate: "{city_naming}",
            descriptionTemplate: "{visual_text}",
            linkUrlTemplate: "{landing_page_url}",
            callToActionTemplate: "LEARN_MORE",
            leadFormId: "",
            pageId: "",
            instagramId: "",
            launchStatus: "PAUSED",
          },
        },
        {
          id: "action-3",
          type: "action",
          service: "meta-ads",
          event: "Launch Template Ads",
          position: 3,
          config: {
            hunchGroupId: "hunch-sheet-template-ads",
            autoSelectTemplateCount: 2,
            accountId: "",
            campaignId: "",
            autoSelectFirstCampaign: true,
            autoSelectFirstAdSet: true,
            sourceAdSetId: "",
            targetId: "{{action-1.resultId}}",
            templateIds: [],
            locationTargetingMode: "replace",
            locationSource: "sheet",
            locationColumn: SHEET_TEMPLATE_ADS_LOCATION_PILL,
            hiddenGeoColumn: "hidden_targeting_location_geo",
            countryColumn: "country",
            radiusColumn: "radius_m",
            leadFormId: "",
            pageId: "",
            instagramId: "",
            instaId: "",
            adStatus: "PAUSED",
            launchStatus: "PAUSED",
            adNameTemplate: "{city_naming} - {template_name}",
            headlineTemplate: "{city_naming}",
            headline: "{city_naming}",
            descriptionTemplate: "{visual_text}",
            description: "{visual_text}",
            linkUrlTemplate: "{landing_page_url}",
            linkUrl: "{landing_page_url}",
            callToActionTemplate: "LEARN_MORE",
            callToAction: "LEARN_MORE",
          },
        },
      ],
    },
  },

  {
    id: "template-zombie-campaign",
    name: "Zombie Campaign",
    description:
      "Once a month, bring paused ads back to life: clone an ad set as a fresh landing spot and copy every paused ad into it, left paused for review. Each ad is only ever revived once. Pick the ad set to clone before turning it on.",
    category: "scaling",
    emoji: "🧟",
    services: ["meta-ads"],
    displaySteps: [
      { service: "meta-ads", label: "Find paused ads once a month" },
      { service: "meta-ads", label: "Clone the ad set" },
      { service: "meta-ads", label: "Copy paused ads into the new ad set" },
    ],
    flow: {
      id: "template-zombie-campaign",
      name: "Zombie Campaign",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: {
              conditions: [
                { metric: "adAge", operator: ">=", value: ZOMBIE_CAMPAIGN_MIN_AD_AGE_DAYS },
                // Keeps last month's revived copies out of this month's run.
                { metric: "adName", operator: "not_contains", value: ZOMBIE_CAMPAIGN_REVIVED_MARKER },
              ],
              logic: "AND",
              lookbackDays: 7,
            },
            adSetFilterType: "all",
            adSetNameFilter: "*",
            allAdSets: true,
            adStatusFilter: "PAUSED",
            checkFrequency: "monthly",
            checkDayOfMonth: "1",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad Set",
          position: 1,
          config: {
            targetId: "",
            newName: "Zombie Ad Set - {{date}}",
          },
        },
        {
          id: "action-2",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad",
          position: 2,
          config: {
            sourceAdIds: "{{trigger-1.qualifyingAdIds}}",
            targetAdSetMatchType: "specific",
            targetAdSetId: "{{action-1.resultId}}",
            // The marker is what stops next month's run reviving these copies.
            newName: `{{trigger-1.adName}} - ${ZOMBIE_CAMPAIGN_REVIVED_MARKER}`,
            duplicatedAdStatus: "PAUSED",
            cooldownEnabled: true,
            cooldownUnit: "never",
            autoSplitEnabled: true,
            autoSplitMaxDuplications: ZOMBIE_CAMPAIGN_MAX_AD_SET_SPLITS,
          },
        },
      ],
    },
  },

  // --- Cross-Channel Scaling ---
  {
    id: "template-launch-winners-tiktok",
    name: "Launch Winners on TikTok",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on TikTok to expand reach.",
    category: "scaling",
    emoji: "🎵",
    services: ["meta-ads", "tiktok-ads"],
    flow: {
      id: "template-launch-winners-tiktok",
      name: "Launch Winners on TikTok",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 2 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "tiktok-ads",
          event: "Launch on TikTok",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-scale-meta-winners-new-tiktok-adgroup",
    name: "Scale Meta Winners into New TikTok Ad Group",
    description:
      "Every week, pick your highest-ROAS Meta ad per ad set, clone a TikTok ad group as a fresh landing spot, and launch the winners into it — everything created paused for review.",
    category: "scaling",
    emoji: "🚀",
    services: ["meta-ads", "tiktok-ads"],
    flow: {
      id: "template-scale-meta-winners-new-tiktok-adgroup",
      name: "Scale Meta Winners into New TikTok Ad Group",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            checkFrequency: "weekly",
            adSetFilterType: "all",
            adSetNameFilter: "*",
            criteria: {
              aggregation: "top_per_adset",
              rankMetric: "roas",
              rankDirection: "desc",
              topPerAdSetLimit: 1,
              conditions: [
                { metric: "spend", operator: ">", value: AD_SET_WINNER_MIN_SPEND },
                { metric: "roas", operator: ">", value: AD_SET_WINNER_MIN_ROAS },
              ],
              logic: "AND",
              lookbackDays: 7,
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          service: "tiktok-ads",
          event: "Duplicate Ad Group",
          position: 1,
          config: {},
        },
        {
          id: "action-3",
          type: "action",
          service: "tiktok-ads",
          event: "Launch on TikTok",
          position: 2,
          config: {
            adGroupId: "{{action-2.adGroupId}}",
          },
        },
      ],
    },
  },
  {
    id: "template-scale-meta-winners-chatgpt",
    name: "Scale Top Meta Ads to ChatGPT",
    description:
      "Every week, select the highest-ROAS Meta ad per ad set and launch image winners into your ChatGPT ad group, paused for review. Each source is transferred once; video ads are reported as unsupported.",
    category: "scaling",
    emoji: "🚀",
    iconService: "chatgpt-ads",
    services: ["meta-ads", "chatgpt-ads"],
    flow: {
      id: "template-scale-meta-winners-chatgpt",
      name: "Scale Top Meta Ads to ChatGPT",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            checkFrequency: "weekly",
            adSetFilterType: "all",
            adSetNameFilter: "*",
            criteria: {
              aggregation: "top_per_adset",
              rankMetric: "roas",
              rankDirection: "desc",
              topPerAdSetLimit: 1,
              conditions: [
                { metric: "spend", operator: ">", value: 50 },
                { metric: "roas", operator: ">", value: 2 },
              ],
              logic: "AND",
              lookbackDays: 7,
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "chatgpt-ads",
          event: "Launch on ChatGPT",
          position: 1,
          config: { adStatus: "PAUSED", shortenCopy: true, cooldownEnabled: true, cooldownUnit: "never" },
        },
      ],
    },
  },
  {
    id: "template-launch-winners-snapchat",
    name: "Launch Winners on Snapchat",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on Snapchat.",
    category: "scaling",
    emoji: "👻",
    services: ["meta-ads", "snapchat-ads"],
    flow: {
      id: "template-launch-winners-snapchat",
      name: "Launch Winners on Snapchat",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 2 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "snapchat-ads",
          event: "Launch on Snapchat",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-launch-winners-pinterest",
    name: "Launch Winners on Pinterest",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on Pinterest.",
    category: "scaling",
    emoji: "📌",
    services: ["meta-ads", "pinterest-ads"],
    flow: {
      id: "template-launch-winners-pinterest",
      name: "Launch Winners on Pinterest",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 2 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "pinterest-ads",
          event: "Launch on Pinterest",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-launch-winners-x",
    name: "Launch Winners on X",
    description: "Find Facebook ads with ROAS above 2 and automatically promote them as paused X posts.",
    category: "scaling",
    emoji: "𝕏",
    services: ["meta-ads", "x-ads"],
    flow: {
      id: "template-launch-winners-x",
      name: "Launch Winners on X",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: ">", value: 2 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "x-ads",
          event: "Launch on X",
          position: 1,
          config: { mode: "existing", objective: "ENGAGEMENTS", placements: ["ALL_ON_TWITTER"], launchPaused: true },
        },
      ],
    },
  },
  {
    id: "template-launch-winners-axon",
    name: "Scale Meta Winners → AppLovin",
    description:
      "Find Meta ads that cross a spend threshold and automatically launch them on AppLovin (Axon) to expand reach.",
    category: "scaling",
    emoji: "📲",
    services: ["meta-ads", "axon-ads"],
    flow: {
      id: "template-launch-winners-axon",
      name: "Scale Meta Winners → AppLovin",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: {
              conditions: [{ metric: "spend", operator: ">", value: SCALE_META_WINNERS_AXON_MIN_SPEND }],
              logic: "AND",
              lookbackDays: 7,
            },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "axon-ads",
          event: "Launch on Axon",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-scale-applovin-winners",
    name: "Scale Winning AppLovin Campaigns",
    description: `Check AppLovin campaigns weekly and raise the daily budget by ${AXON_SCALE_WINNER_BUDGET_INCREASE_PERCENT}% on campaigns that spent at least $${AXON_SCALE_WINNER_MIN_SPEND} while returning ${AXON_SCALE_WINNER_MIN_ROAS}x or better over the last ${AXON_TEMPLATE_LOOKBACK_DAYS} days. Weekly, not daily, so each raise is backed by a fresh window instead of compounding on the last one.`,
    category: "scaling",
    emoji: "📈",
    services: ["axon-ads"],
    displaySteps: [
      {
        service: "axon-ads",
        label: `Find campaigns with spend at or above $${AXON_SCALE_WINNER_MIN_SPEND} and ROAS at or above ${AXON_SCALE_WINNER_MIN_ROAS}`,
      },
      {
        service: "axon-ads",
        label: `Increase the daily budget of only those campaigns by ${AXON_SCALE_WINNER_BUDGET_INCREASE_PERCENT}%`,
      },
    ],
    flow: {
      id: "template-scale-applovin-winners",
      name: "Scale Winning AppLovin Campaigns",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "axon-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            accountId: "",
            entityLevel: "campaign",
            criteria: {
              conditions: [
                { metric: "spend", operator: ">=", value: AXON_SCALE_WINNER_MIN_SPEND },
                { metric: "roas", operator: ">=", value: AXON_SCALE_WINNER_MIN_ROAS },
              ],
              logic: "AND",
              lookbackDays: AXON_TEMPLATE_LOOKBACK_DAYS,
            },
            // Weekly, NOT daily, and it must stay matched to the lookback window.
            // `Change Budget` keeps no cooldown ledger and re-reads the campaign's LIVE
            // budget each run, so every raise compounds on the last one. A daily rule
            // over a 7-day lookback raises the budget seven times off the same seven
            // days of data (1.2^7 ≈ 3.6x in a week); weekly gives the window time to
            // turn over so each raise is backed by evidence the previous one is working.
            checkFrequency: "weekly",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "axon-ads",
          event: "Change Budget",
          position: 1,
          config: {
            accountId: "",
            targetIds: "{{trigger-1.qualifyingCampaignIds}}",
            budgetChangeType: "increase",
            budgetValueType: "percentage",
            budgetValue: AXON_SCALE_WINNER_BUDGET_INCREASE_PERCENT,
          },
        },
      ],
    },
  },

  // --- Optimization ---
  {
    id: "template-google-sheets-value-rules",
    name: "Google Sheets → Meta Value Rules",
    description:
      "Use a Google Sheets column as the source of truth and apply a Meta Value Rule Set when a row matches your condition.",
    category: "optimization",
    emoji: "📊",
    services: ["google-sheets", "meta-ads"],
    displaySteps: [
      { service: "google-sheets", label: "Check each Sheet row against a condition" },
      { service: "meta-ads", label: "Apply the row's Value Rule Set to its ad set" },
    ],
    flow: {
      id: "template-google-sheets-value-rules",
      name: "Google Sheets → Meta Value Rules",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "google-sheets",
          event: "Cell Value Changed",
          position: 0,
          config: {
            spreadsheetId: "",
            sheetName: "Sheet1",
            triggerMode: "column",
            triggerColumn: "C",
            headerRow: 1,
            startRow: 2,
            triggerOperator: "equals",
            triggerValue: "APPLY",
            checkFrequency: "every-5-min",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Update Value Rules",
          position: 1,
          config: {
            accountId: "",
            targetAdSetIds: "{{trigger-1.mapped.Ad Set ID}}",
            valueRulesOperation: "APPLY",
            valueRuleSetId: "{{trigger-1.mapped.Value Rule Set ID}}",
          },
        },
      ],
    },
  },
  {
    id: "template-scheduled-value-rules-switch",
    name: "Scheduled Value Rules Switch",
    description:
      "Apply a Meta Value Rule Set to specific ad sets at a set time each day — e.g. boost bid values for your best audiences every evening. Times run in UK time (Europe/London).",
    category: "optimization",
    emoji: "⏰",
    iconService: "meta-ads",
    services: ["scheduled", "meta-ads"],
    displaySteps: [
      { service: "scheduled", label: "Run at a scheduled time" },
      { service: "meta-ads", label: "Apply a Value Rule Set to chosen ad sets" },
    ],
    flow: {
      id: "template-scheduled-value-rules-switch",
      name: "Scheduled Value Rules Switch",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled Run",
          position: 0,
          config: {
            frequency: "daily",
            scheduledTime: SCHEDULED_VALUE_RULES_DEFAULT_TIME,
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Update Value Rules",
          position: 1,
          config: {
            accountId: "",
            valueRulesOperation: "APPLY",
            valueRuleSetId: "",
          },
        },
      ],
    },
  },
  {
    id: "template-scheduled-value-rules-disable",
    name: "Disable Value Rules at Night",
    description:
      "Turn off Value Rules on specific ad sets at a set time each day, letting delivery return to default bidding overnight. Times run in UK time (Europe/London).",
    category: "optimization",
    emoji: "🌙",
    iconService: "meta-ads",
    services: ["scheduled", "meta-ads"],
    displaySteps: [
      { service: "scheduled", label: "Run at a scheduled time" },
      { service: "meta-ads", label: "Disable Value Rules on chosen ad sets" },
    ],
    flow: {
      id: "template-scheduled-value-rules-disable",
      name: "Disable Value Rules at Night",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled Run",
          position: 0,
          config: {
            frequency: "daily",
            scheduledTime: SCHEDULED_VALUE_RULES_DEFAULT_TIME,
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Update Value Rules",
          position: 1,
          config: {
            accountId: "",
            valueRulesOperation: "DISABLE",
          },
        },
      ],
    },
  },
  {
    id: "template-pause-underperformers",
    name: "Pause Underperformers",
    description: "Automatically pause ads with ROAS below 1 to stop wasting budget on low-performing creatives.",
    category: "optimization",
    emoji: "⏸️",
    services: ["meta-ads"],
    flow: {
      id: "template-pause-underperformers",
      name: "Pause Underperformers",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "roas", operator: "<", value: 1 }], logic: "AND", lookbackDays: 7 },
            adSetFilterType: "all",
            adSetNameFilter: "*",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Pause Ad",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-pause-underperformers-triplewhale",
    name: "Pause Underperformers (Triple Whale ROAS)",
    description:
      "Automatically pause ads with Triple Whale blended ROAS below 1 — pixel-attributed revenue, not Meta's own ad-reported ROAS.",
    category: "optimization",
    emoji: "🐋",
    services: ["triplewhale-ads", "meta-ads"],
    flow: {
      id: "template-pause-underperformers-triplewhale",
      name: "Pause Underperformers (Triple Whale ROAS)",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "triplewhale-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: { conditions: [{ metric: "twRoas", operator: "<", value: 1 }], logic: "AND", lookbackDays: 7 },
            adStatusFilter: "ACTIVE",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Pause Ad",
          position: 1,
          config: {},
        },
      ],
    },
  },
  {
    id: "template-triplewhale-account-roas-alert",
    name: "Triple Whale Blended ROAS Alert",
    description:
      "Check your Triple Whale shop-wide summary daily and get a Slack alert when blended ROAS drops below 1.5x. Alert only, nothing is paused — this checks the whole shop, not a single Meta ad account. Add email recipients in the builder to get it by email too.",
    category: "optimization",
    emoji: "🐋",
    services: ["triplewhale-account", "notification"],
    displaySteps: [
      { service: "triplewhale-account", label: "Check the workspace's Triple Whale blended ROAS" },
      { service: "notification", label: "Send a Slack alert with the current numbers" },
    ],
    flow: {
      id: "template-triplewhale-account-roas-alert",
      name: "Triple Whale Blended ROAS Alert",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "triplewhale-account",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: {
              conditions: [{ metric: "twAccountRoas", operator: "<", value: 1.5 }],
              logic: "AND",
              lookbackDays: 7,
            },
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: {
            notificationMethod: "both",
            // Pills come off the account snapshot spread into triggerData
            // (buildTriplewhaleAccountTriggerData) — every twAccount* metric key
            // plus shopDomain is available here.
            customMessage:
              "Triple Whale blended ROAS dropped below 1.5x over the last 7 days for {{trigger.shopDomain}}: {{trigger.twAccountRoas}}x blended ROAS on {{trigger.twAccountRevenue}} revenue.",
          },
        },
      ],
    },
  },
  {
    id: "template-pause-underperforming-google-campaigns",
    name: "Pause Underperforming Google Campaigns",
    description:
      "Check Google Ads campaigns daily and pause campaigns that have spent at least $50 while returning less than 1x ROAS over the last 7 days.",
    category: "optimization",
    emoji: "🔎",
    iconService: "google-ads",
    services: ["google-ads"],
    displaySteps: [
      { service: "google-ads", label: "Find campaigns with spend over $50 and ROAS below 1" },
      { service: "google-ads", label: "Pause only the matching campaigns" },
    ],
    flow: {
      id: "template-pause-underperforming-google-campaigns",
      name: "Pause Underperforming Google Campaigns",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "google-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            accountId: "",
            entityLevel: "campaign",
            campaignNameFilterType: "all",
            criteria: {
              conditions: [
                { metric: "spend", operator: ">=", value: 50 },
                { metric: "roas", operator: "<", value: 1 },
              ],
              logic: "AND",
              lookbackDays: 7,
              aggregation: "per_ad",
            },
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "google-ads",
          event: "Pause Campaign",
          position: 1,
          config: {
            accountId: "",
            targetIds: "{{trigger-1.qualifyingCampaignIds}}",
          },
        },
      ],
    },
  },
  {
    id: "template-pause-underperforming-applovin-campaigns",
    name: "Pause Underperforming AppLovin Campaigns",
    description: `Check AppLovin campaigns daily and pause campaigns that have spent at least $${AXON_PAUSE_UNDERPERFORMER_MIN_SPEND} while returning less than ${AXON_PAUSE_UNDERPERFORMER_MAX_ROAS}x ROAS over the last ${AXON_TEMPLATE_LOOKBACK_DAYS} days.`,
    category: "optimization",
    emoji: "🛑",
    services: ["axon-ads"],
    displaySteps: [
      {
        service: "axon-ads",
        label: `Find campaigns with spend at or above $${AXON_PAUSE_UNDERPERFORMER_MIN_SPEND} and ROAS below ${AXON_PAUSE_UNDERPERFORMER_MAX_ROAS}`,
      },
      { service: "axon-ads", label: "Pause only the matching campaigns" },
    ],
    flow: {
      id: "template-pause-underperforming-applovin-campaigns",
      name: "Pause Underperforming AppLovin Campaigns",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "axon-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            accountId: "",
            entityLevel: "campaign",
            criteria: {
              conditions: [
                { metric: "spend", operator: ">=", value: AXON_PAUSE_UNDERPERFORMER_MIN_SPEND },
                { metric: "roas", operator: "<", value: AXON_PAUSE_UNDERPERFORMER_MAX_ROAS },
              ],
              logic: "AND",
              lookbackDays: AXON_TEMPLATE_LOOKBACK_DAYS,
            },
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "axon-ads",
          event: "Pause Campaign",
          position: 1,
          config: {
            accountId: "",
            targetIds: "{{trigger-1.qualifyingCampaignIds}}",
          },
        },
      ],
    },
  },
  {
    id: "template-applovin-cpa-alert",
    // Not "spike": AppLovin reports no prior-window or delta columns, so this is an
    // absolute CPA ceiling over one lookback window, not a rise against a baseline.
    name: "AppLovin CPA Alert",
    description: `Watch AppLovin campaigns daily and get a Slack alert when a campaign that has spent at least $${AXON_CPA_ALERT_MIN_SPEND} pushes its CPA above $${AXON_CPA_ALERT_MAX_CPA}. Alert only, nothing is paused. Add email recipients in the builder to get it by email too.`,
    category: "optimization",
    emoji: "🚨",
    services: ["axon-ads", "notification"],
    displaySteps: [
      {
        service: "axon-ads",
        label: `Find campaigns with spend at or above $${AXON_CPA_ALERT_MIN_SPEND} and CPA above $${AXON_CPA_ALERT_MAX_CPA}`,
      },
      { service: "notification", label: "Send a Slack alert naming those campaigns" },
    ],
    flow: {
      id: "template-applovin-cpa-alert",
      name: "AppLovin CPA Alert",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "axon-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            accountId: "",
            entityLevel: "campaign",
            criteria: {
              conditions: [
                { metric: "spend", operator: ">=", value: AXON_CPA_ALERT_MIN_SPEND },
                { metric: "cpa", operator: ">", value: AXON_CPA_ALERT_MAX_CPA },
              ],
              logic: "AND",
              lookbackDays: AXON_TEMPLATE_LOOKBACK_DAYS,
            },
            checkFrequency: "daily",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: {
            notificationMethod: "both",
            // Both pills come off the axon trigger's `triggerData` (buildAxonTriggerData),
            // which is what `replaceTemplates` interpolates against.
            customMessage: `{{trigger.qualifyingAdsCount}} AppLovin campaign(s) went over a $${AXON_CPA_ALERT_MAX_CPA} CPA on at least $${AXON_CPA_ALERT_MIN_SPEND} of spend in the last ${AXON_TEMPLATE_LOOKBACK_DAYS} days.\n\n{{trigger.qualifyingAdNames}}`,
          },
        },
      ],
    },
  },
  {
    id: "template-page-like-creative-refresh",
    name: "Page-Like Creative Refresh",
    description:
      "Refresh degrading page-like ads by swapping in a shortlisted library creative, pausing the old ad, and notifying the SMM.",
    category: "optimization",
    emoji: "🔄",
    services: ["meta-ads", "notification"],
    flow: {
      id: "template-page-like-creative-refresh",
      name: "Page-Like Creative Refresh",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            criteria: {
              conditions: [{ metric: "costPerResult", operator: ">", value: 0 }],
              logic: "AND",
              lookbackDays: 3,
              conversionEvent: "page_like",
            },
            adSetFilterType: "all",
            adSetNameFilter: "*",
            checkFrequency: "hourly",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Swap Creative from Shortlist",
          position: 1,
          config: {
            sourceTagName: "page-like-promotion",
            selectionStrategy: "round_robin",
            targetAdSetIds: "{{trigger-1.qualifyingAdSetIds}}",
            oldAdIds: "{{trigger-1.qualifyingAdIds}}",
            pauseOriginalAds: true,
            launchMode: "launch",
          },
        },
        {
          id: "action-2",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 2,
          config: {
            notificationMethod: "both",
            customMessage:
              "Creative refresh completed for {{trigger.qualifyingAdsCount}} page-like ad(s).\n\nOld ad(s): {{trigger.qualifyingAdNames}}\nShortlist tag: page-like-promotion\nStrategy: round_robin",
          },
        },
      ],
    },
  },
  {
    id: "template-daily-budget-rule-toggle",
    name: "Daily Budget Rule Toggle",
    description: "Run a scheduled check every day and toggle an existing automation rule on or off based on the day.",
    category: "optimization",
    emoji: "📅",
    services: ["scheduled", "meta-ads"],
    flow: {
      id: "template-daily-budget-rule-toggle",
      name: "Daily Budget Rule Toggle",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled Run",
          position: 0,
          config: {
            frequency: "daily",
            time: "09:00",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Toggle Rule",
          position: 1,
          config: {},
        },
      ],
    },
  },

  // --- Reporting ---
  {
    id: "template-log-launches-to-sheets",
    name: "Log Ad Launches to Sheets",
    description:
      "Every time an ad is launched via AdManage, automatically log the details to a Google Sheet for tracking.",
    category: "reporting",
    emoji: "📊",
    services: ["admanage", "google-sheets"],
    flow: {
      id: "template-log-launches-to-sheets",
      name: "Log Ad Launches to Sheets",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "admanage",
          event: "Ad Launched via AdManage",
          position: 0,
          config: {},
        },
        {
          id: "action-1",
          type: "action",
          service: "google-sheets",
          event: "Add Row",
          position: 1,
          config: {},
        },
      ],
    },
  },

  // --- Comments (from Comments recipe library) ---
  ...COMMENT_AUTOMATION_TEMPLATES,
];

/**
 * Backward-compatible export used by automation-header.tsx "Load Template" dropdown.
 * Returns just the flow objects so the existing `handleLoadTemplate(template)` keeps working.
 */
export const automationTemplates: AutomationFlow[] = AUTOMATION_TEMPLATES.map((t) => t.flow);
