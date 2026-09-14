export const serviceDefinitions = {
  "chatgpt-ads": {
    label: "ChatGPT Ads",
    icon: "/brand-icons/chatgpt/logo.svg",
    iconType: "image" as const,
    color: "#111111",
    description: "Launch winning Meta image ads into your connected ChatGPT ad account.",
  },
  "media-library": {
    label: "Media Library",
    icon: "🖼️",
    iconType: "emoji" as const,
    color: "#7C3AED",
    description: "Upload media to your library or trigger automations when media is uploaded to specific boards.",
  },
  "google-drive": {
    label: "Google Drive",
    icon: "/google-drive-logo.svg",
    iconType: "image" as const,
    color: "#4285F4",
    description:
      "Google Drive is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  dropbox: {
    label: "Dropbox",
    icon: "/dropbox.png",
    iconType: "image" as const,
    color: "#0061FE",
    description:
      "Dropbox is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  sharepoint: {
    label: "SharePoint",
    icon: "/sharepoint.png",
    iconType: "image" as const,
    color: "#038387",
    description:
      "SharePoint is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  air: {
    label: "AIR",
    icon: "/air-inc-logo.jpg",
    iconType: "image" as const,
    color: "#0B0B0B",
    description:
      "Trigger automations from a publicly shared AIR board. Anyone with the board link can view — no AIR credentials are stored.",
  },
  adscan: {
    label: "Adscan",
    icon: "/logos/adscan-logo.png",
    iconType: "image" as const,
    color: "#0EA5E9",
    description: "Trigger automations when competitor ads matching your filters appear in Adscan's Ad Library index.",
  },
  frameio: {
    label: "Frame.io",
    icon: "/frameio.png",
    iconType: "image" as const,
    color: "#7B2FBE",
    description:
      "Trigger automations when new files appear in a Frame.io project folder. Filter by review status (Approved, In Progress, etc.).",
  },
  "google-sheets": {
    label: "Google Sheets",
    icon: "/images/googlesheets.png",
    iconType: "image" as const,
    color: "#0F9D58",
    description: "Share your Google Sheet with our service account to enable automation. No sign-in required.",
  },
  notion: {
    label: "Notion",
    icon: "/notion.svg",
    iconType: "image" as const,
    color: "#111111",
    description: "Trigger automations from status changes sent by a Notion database automation webhook.",
  },
  monday: {
    label: "Monday.com",
    icon: "/logos/logo-monday.svg",
    iconType: "image" as const,
    color: "#6161FF",
    description: "Trigger workflows from board status changes and create or update Monday.com items.",
  },
  "meta-ads": {
    label: "Meta",
    icon: "/icons8-meta.svg",
    iconType: "image" as const,
    color: "#0081FB",
    description:
      "Meta Ads is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  "facebook-rules": {
    label: "Facebook Ad Rules",
    icon: "/icons8-meta.svg",
    iconType: "image" as const,
    color: "#0081FB",
    description: "Trigger automations instantly when a Facebook Ad Rule fires (pauses, budget changes, etc.).",
  },
  box: {
    label: "Box",
    icon: "📦",
    iconType: "emoji" as const,
    color: "#0061D5",
    description:
      "Box is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  hubspot: {
    label: "HubSpot",
    icon: "🎯",
    iconType: "emoji" as const,
    color: "#FF7A59",
    description:
      "HubSpot is a secure partner with Admanage. Your credentials are encrypted and can be removed at any time.",
  },
  scheduled: {
    label: "Scheduled",
    icon: "📅",
    iconType: "emoji" as const,
    color: "#6366F1",
    description: "Run your automation on a recurring schedule (daily, weekly, monthly).",
  },
  condition: {
    label: "Condition / Filter",
    icon: "🔀",
    iconType: "emoji" as const,
    color: "#8B5CF6",
    description: "Add conditional logic to control your automation flow.",
  },
  timer: {
    label: "Timer / Schedule",
    icon: "⏰",
    iconType: "emoji" as const,
    color: "#F59E0B",
    description: "Schedule actions to run at a specific date and time.",
  },
  delay: {
    label: "Delay",
    icon: "⏳",
    iconType: "emoji" as const,
    color: "#8B5CF6",
    description: "Wait for a specified duration before continuing to the next step.",
  },
  approval: {
    label: "Approval",
    icon: "🛡️",
    iconType: "emoji" as const,
    color: "#F97316",
    description: "Pause the automation and require manual approval before continuing.",
  },
  admanage: {
    label: "AdManage",
    icon: "🚀",
    iconType: "emoji" as const,
    color: "#3B82F6",
    description: "Trigger automations when ads are launched via AdManage.",
  },
  comments: {
    label: "Comments",
    icon: "💬",
    iconType: "emoji" as const,
    color: "#0EA5E9",
    description: "Automate Facebook and Instagram comment replies, likes, hides, and deletes.",
  },
  manual: {
    label: "Manual Trigger",
    icon: "▶️",
    iconType: "emoji" as const,
    color: "#10B981",
    description: "Run this automation manually on demand. No automatic trigger - you control when it runs.",
  },
  "tiktok-ads": {
    label: "TikTok Ads",
    icon: "/tiktok-logo.webp",
    iconType: "image" as const,
    color: "#000000",
    description: "Monitor TikTok ad performance and launch cross-channel creatives.",
  },
  "snapchat-ads": {
    label: "Snapchat Ads",
    icon: "/snapchat-logo.svg",
    iconType: "image" as const,
    color: "#FFFC00",
    description: "Launch ads on Snapchat from your winning Facebook creatives.",
  },
  "pinterest-ads": {
    label: "Pinterest Ads",
    icon: "/pinterest-logo.svg",
    iconType: "image" as const,
    color: "#E60023",
    description: "Pause or enable Pinterest ads by name, or launch your winning Facebook creatives on Pinterest.",
  },
  "x-ads": {
    label: "X (Twitter) Ads",
    icon: "𝕏",
    iconType: "emoji" as const,
    color: "#000000",
    description:
      "Monitor X promoted-post performance and promote your winning creatives as X posts through an existing or new X campaign.",
  },
  "axon-ads": {
    label: "AppLovin Ads",
    icon: "🎯",
    iconType: "emoji" as const,
    color: "#6366F1",
    description: "Launch ads on AppLovin from your winning Facebook creatives.",
  },
  "triplewhale-ads": {
    label: "Triple Whale",
    icon: "🐋",
    iconType: "emoji" as const,
    color: "#00C2CB",
    description: "Trigger on Triple Whale's pixel-attributed ROAS instead of Meta's own ad-reported attribution.",
  },
  "triplewhale-account": {
    label: "Triple Whale (Account)",
    icon: "🐋",
    iconType: "emoji" as const,
    color: "#00C2CB",
    description: "Trigger on Triple Whale's shop-wide summary metrics (blended ROAS, attributed revenue, AOV, ...).",
  },
  "google-ads": {
    label: "Google Ads",
    icon: "/google.png",
    iconType: "image" as const,
    color: "#4285F4",
    description: "Add image and video assets to Google Ads Performance Max, Demand Gen, and App campaigns.",
  },
  webhook: {
    label: "Webhook",
    icon: "🔗",
    iconType: "emoji" as const,
    color: "#6366F1",
    description: "Send an HTTP request to any URL when this automation runs.",
  },
  notification: {
    label: "Notification",
    icon: "🔔",
    iconType: "emoji" as const,
    color: "#F59E0B",
    description: "Send a Slack message or email notification when this step runs.",
  },
  slack: {
    label: "Slack",
    icon: "/slack-logo.svg",
    iconType: "image" as const,
    color: "#4A154B",
    description: "Send a Slack notification when this step runs.",
  },
  email: {
    label: "Email",
    icon: "✉️",
    iconType: "emoji" as const,
    color: "#EA4335",
    description: "Send an email notification when this step runs.",
  },
  report: {
    label: "Report",
    icon: "📊",
    iconType: "emoji" as const,
    color: "#8B5CF6",
    description: "Generate a shareable link for a statistics report and pass it to the next step.",
  },
};

export type ServiceKey = keyof typeof serviceDefinitions;

export function getServiceInfo(serviceKey: string) {
  const normalizedKey = serviceKey?.toLowerCase().replace(/\s+/g, "-") || "";

  return (
    serviceDefinitions[normalizedKey as ServiceKey] || {
      label: "Unknown Service",
      icon: "⚙️",
      iconType: "emoji" as const,
      color: "#6B7280",
      description: "Service information not available.",
    }
  );
}

interface ServiceIconProps {
  service: string;
  size?: number;
  className?: string;
}

export function ServiceIcon({ service, size = 24, className = "" }: ServiceIconProps) {
  const normalizedService = service?.toLowerCase().replace(/\s+/g, "-") || "";
  const info = getServiceInfo(normalizedService);

  // Handle image icons
  if (info.iconType === "image") {
    return (
      <img
        src={info.icon}
        alt={info.label}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  // Handle emoji/text icons
  return (
    <span className={className} style={{ fontSize: size }}>
      {info.icon}
    </span>
  );
}
