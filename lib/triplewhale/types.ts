/** Inclusive date window, ISO `YYYY-MM-DD`. */
export interface TwPeriod {
  readonly startDate: string;
  readonly endDate: string;
}

/**
 * Why a Triple Whale merge attached nothing.
 *
 * Lives here rather than beside the server-side merge so client components can
 * render an explanation without importing a module that pulls in Prisma.
 */
export type TwSkippedReason =
  | "disabled"
  | "no-workspace"
  | "not-connected"
  | "no-scope"
  | "no-ads"
  | "no-account"
  | "error";

/** A workspace's decrypted Triple Whale connection. */
export interface TwConnection {
  readonly shopDomain: string;
  readonly apiKey: string;
  /** False when the key cannot reach `orcabase/api/sql` (no ad-level data). */
  readonly hasPixelAttribution: boolean;
  readonly validatedAt: string | null;
}

/** Triple Whale attributed performance for one ad. */
export interface TwAdMetrics {
  readonly adId: string;
  readonly adName: string | null;
  readonly accountId: string | null;
  readonly spend: number;
  readonly revenue: number;
  readonly orders: number;
  readonly newCustomerOrders: number;
  readonly newCustomerRevenue: number;
  /** First-time visitors, per Triple Whale's pixel (`new_visitors`). */
  readonly newVisitors: number;
  /** Distinct visitors — what Triple Whale's own UI labels "Users" (`unique_visitors`). */
  readonly uniqueVisitors: number;
  /** Pixel sessions (`visit_sessions`), the column behind the summary page's "Sessions". */
  readonly sessions: number;
  /** Computed as revenue / spend. Zero when spend is zero. */
  readonly roas: number;
}

/** One metric from the account-level summary page. */
export interface TwSummaryMetric {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly current: number | null;
  readonly previous: number | null;
  readonly delta: number | null;
}

/** Which ad accounts a Triple Whale shop actually tracks. */
export interface TwCoverageRow {
  readonly channel: string;
  readonly accountId: string | null;
  readonly spend: number;
}
