/** Rows per page in the home list. */
export const HOME_ROWS_PER_PAGE = 25;

/** Page sizes offered in the footer. `null` shows every row on one page. */
export const HOME_ROWS_PER_PAGE_OPTIONS: readonly (number | null)[] = [25, 50, 100, 200, null];

export const HOME_ROWS_PER_PAGE_STORAGE_KEY = "automation-home-rows-per-page";

/** Label for a page-size option, including the show-everything case. */
export function describeRowsPerPage(rowsPerPage: number | null): string {
  return rowsPerPage === null ? "All" : String(rowsPerPage);
}

/**
 * A stored page size, or null when the value is missing, malformed, or no
 * longer offered — a stale number from an older build must not silently become
 * the page size.
 */
export function parseStoredRowsPerPage(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  if (raw === "all") return null;

  const parsed = Number.parseInt(raw, 10);
  return HOME_ROWS_PER_PAGE_OPTIONS.includes(parsed) ? parsed : undefined;
}

/** Serializes a page size for storage. */
export function serializeRowsPerPage(rowsPerPage: number | null): string {
  return rowsPerPage === null ? "all" : String(rowsPerPage);
}

export interface HomePageInput {
  readonly totalRows: number;
  readonly page: number;
  /** Null shows every row on a single page. */
  readonly rowsPerPage?: number | null;
}

export interface HomePageState {
  /** 1-based, always within range even if the requested page is not. */
  readonly page: number;
  readonly pageCount: number;
  /** Slice bounds for the ordered rows. */
  readonly startIndex: number;
  readonly endIndex: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** e.g. "1–25 of 200". */
  readonly label: string;
}

function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), pageCount);
}

/**
 * Page bounds for the home list.
 *
 * The list rendered all 200 rows at once, so anything below the first screen
 * was only reachable by scrolling past every paused rule.
 *
 * Clamps rather than throws on an out-of-range page: shrinking the result set
 * (a filter, a search) routinely leaves the current page past the end, and
 * landing on an empty list would read as "no automations".
 */
export function getHomePageState(input: HomePageInput): HomePageState {
  // `null` means "show everything": one page as tall as the result set.
  const requested = input.rowsPerPage === undefined ? HOME_ROWS_PER_PAGE : input.rowsPerPage;
  const rowsPerPage = requested === null ? Math.max(1, input.totalRows) : Math.max(1, requested);
  const pageCount = Math.max(1, Math.ceil(input.totalRows / rowsPerPage));
  const page = clampPage(input.page, pageCount);

  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, input.totalRows);

  return {
    page,
    pageCount,
    startIndex,
    endIndex,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
    label: input.totalRows === 0 ? "No automations" : `${startIndex + 1}–${endIndex} of ${input.totalRows}`,
  };
}
