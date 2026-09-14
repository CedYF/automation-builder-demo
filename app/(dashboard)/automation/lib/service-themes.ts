// Service theme definitions for rich, colorful UI
// Each service has brand colors, gradients, and background styles

export interface ServiceTheme {
  id: string;
  label: string;
  description: string;
  icon: string; // emoji fallback
  color: string; // hex color
  gradient: string; // tailwind gradient classes
  lightBg: string; // light background for icon containers
  iconBg: string; // gradient background for icon
  borderColor: string; // border accent
}

export const serviceThemes: Record<string, ServiceTheme> = {
  monday: {
    id: "monday",
    label: "Monday.com",
    description: "Work management automation",
    icon: "M",
    color: "#6161FF",
    gradient: "from-indigo-500 to-violet-600",
    lightBg: "bg-indigo-50",
    iconBg: "bg-gradient-to-br from-indigo-100 to-violet-200",
    borderColor: "border-indigo-200",
  },
  "meta-ads": {
    id: "meta-ads",
    label: "Meta Ads",
    description: "Facebook & Instagram Ads",
    icon: "📱",
    color: "#0081FB",
    gradient: "from-blue-500 to-indigo-600",
    lightBg: "bg-blue-50",
    iconBg: "bg-gradient-to-br from-blue-100 to-blue-200",
    borderColor: "border-blue-200",
  },
  "google-sheets": {
    id: "google-sheets",
    label: "Google Sheets",
    description: "Spreadsheet automation",
    icon: "📊",
    color: "#0F9D58",
    gradient: "from-green-500 to-green-600",
    lightBg: "bg-green-50",
    iconBg: "bg-gradient-to-br from-green-100 to-green-200",
    borderColor: "border-green-200",
  },
  "google-drive": {
    id: "google-drive",
    label: "Google Drive",
    description: "File storage & sync",
    icon: "📁",
    color: "#4285F4",
    gradient: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    iconBg: "bg-gradient-to-br from-blue-100 to-blue-200",
    borderColor: "border-blue-200",
  },
  slack: {
    id: "slack",
    label: "Slack",
    description: "Team messaging",
    icon: "💬",
    color: "#4A154B",
    gradient: "from-purple-600 to-purple-700",
    lightBg: "bg-purple-50",
    iconBg: "bg-gradient-to-br from-purple-100 to-purple-200",
    borderColor: "border-purple-200",
  },
  box: {
    id: "box",
    label: "Box",
    description: "Cloud content management",
    icon: "📦",
    color: "#0061D5",
    gradient: "from-blue-600 to-blue-700",
    lightBg: "bg-blue-50",
    iconBg: "bg-gradient-to-br from-blue-100 to-blue-200",
    borderColor: "border-blue-200",
  },
  hubspot: {
    id: "hubspot",
    label: "HubSpot",
    description: "CRM & Marketing",
    icon: "🎯",
    color: "#FF7A59",
    gradient: "from-orange-400 to-orange-600",
    lightBg: "bg-orange-50",
    iconBg: "bg-gradient-to-br from-orange-100 to-orange-200",
    borderColor: "border-orange-200",
  },
  scheduled: {
    id: "scheduled",
    label: "Scheduled",
    description: "Run on a recurring schedule",
    icon: "📅",
    color: "#6366F1",
    gradient: "from-indigo-500 to-indigo-600",
    lightBg: "bg-indigo-50",
    iconBg: "bg-gradient-to-br from-indigo-100 to-indigo-200",
    borderColor: "border-indigo-200",
  },
  delay: {
    id: "delay",
    label: "Delay",
    description: "Wait before continuing",
    icon: "⏳",
    color: "#8B5CF6",
    gradient: "from-purple-500 to-purple-600",
    lightBg: "bg-purple-50",
    iconBg: "bg-gradient-to-br from-purple-100 to-purple-200",
    borderColor: "border-purple-200",
  },
  timer: {
    id: "timer",
    label: "Schedule",
    description: "Time-based triggers",
    icon: "⏰",
    color: "#8B5CF6",
    gradient: "from-violet-500 to-violet-600",
    lightBg: "bg-violet-50",
    iconBg: "bg-gradient-to-br from-violet-100 to-violet-200",
    borderColor: "border-violet-200",
  },
  webhook: {
    id: "webhook",
    label: "Webhook",
    description: "HTTP triggers",
    icon: "🔗",
    color: "#EC4899",
    gradient: "from-pink-500 to-pink-600",
    lightBg: "bg-pink-50",
    iconBg: "bg-gradient-to-br from-pink-100 to-pink-200",
    borderColor: "border-pink-200",
  },
  approval: {
    id: "approval",
    label: "Approval",
    description: "Manual approval required",
    icon: "🛡️",
    color: "#F97316",
    gradient: "from-orange-500 to-orange-600",
    lightBg: "bg-orange-50",
    iconBg: "bg-gradient-to-br from-orange-100 to-orange-200",
    borderColor: "border-orange-200",
  },
};

// Default theme for unconfigured/unknown services
export const defaultTheme: ServiceTheme = {
  id: "default",
  label: "Choose an app",
  description: "Select an app to get started",
  icon: "⚡",
  color: "#9CA3AF",
  gradient: "from-gray-300 to-gray-400",
  lightBg: "bg-gray-50",
  iconBg: "bg-gradient-to-br from-gray-100 to-gray-200",
  borderColor: "border-gray-200",
};

// Helper function to get theme for a service
export function getServiceTheme(serviceId: string | undefined): ServiceTheme {
  if (!serviceId) return defaultTheme;
  return serviceThemes[serviceId] || defaultTheme;
}

// Node type badge styling
export const nodeTypeBadgeStyles: Record<string, { bg: string; text: string; border: string }> = {
  trigger: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  action: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  filter: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  delay: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  approval: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
  },
};

// Status indicator colors
export const statusColors = {
  configured: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  unconfigured: "bg-gray-300",
};

// Soft glow ring around the status dot, keyed to the same status palette
export const statusGlowColors = {
  configured: "ring-green-500/20",
  warning: "ring-amber-500/20",
  error: "ring-red-500/20",
  unconfigured: "ring-gray-300/30",
};

// Per node-type accent used for the card's left spine and selection glow.
// Mirrors the node type badge palette so the whole card reads as one colour family.
export const nodeTypeAccents: Record<string, { spine: string; selectedRing: string }> = {
  trigger: { spine: "bg-violet-500", selectedRing: "ring-violet-500/25" },
  action: { spine: "bg-blue-500", selectedRing: "ring-blue-500/25" },
  filter: { spine: "bg-amber-500", selectedRing: "ring-amber-500/25" },
  delay: { spine: "bg-purple-500", selectedRing: "ring-purple-500/25" },
  approval: { spine: "bg-orange-500", selectedRing: "ring-orange-500/25" },
};

export const defaultNodeAccent = { spine: "bg-gray-300", selectedRing: "ring-primary/20" };

export function getNodeTypeAccent(nodeType: string): { spine: string; selectedRing: string } {
  return nodeTypeAccents[nodeType] || defaultNodeAccent;
}
