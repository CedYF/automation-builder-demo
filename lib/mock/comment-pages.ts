export const DEMO_COMMENT_PAGES = [
  { id: "demo-page-1", displayId: "3922256870133", name: "Northwind Coffee — UK", platform: "facebook", category: "Coffee shop" },
  { id: "demo-ig-1", displayId: "17841409280651312", name: "Northwind Coffee — UK", platform: "instagram", category: "Food and drink" },
  { id: "demo-page-2", displayId: "4451268093321", name: "Northwind Coffee — US", platform: "facebook", category: "Coffee shop" },
] as const;

export type DemoCommentPage = (typeof DEMO_COMMENT_PAGES)[number];
