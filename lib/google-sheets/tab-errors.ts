/**
 * Diagnosis helpers for Google Sheets "Unable to parse range" failures.
 *
 * The Sheets API returns a 400 `Unable to parse range: 'Tab'!A:Z` both for genuinely
 * malformed A1 notation AND — far more commonly in practice — when the tab named in the
 * range simply does not exist in the spreadsheet. Because every range this app builds is
 * assembled from a constant template, in practice it is always the second case: the tab
 * was renamed or deleted in the customer's spreadsheet after the automation was configured.
 *
 * The raw Google message names the range but never the tabs that DO exist, so an automation
 * that had been writing happily for months fails with a message nobody can act on. These
 * helpers turn it into an error that names the real tabs and points at the likely rename.
 *
 * Kept free of any API/auth imports so it stays directly unit-testable and so
 * `client.ts` can use it without an import cycle.
 */

/** Substring Google uses for a range whose tab it could not resolve. */
const RANGE_PARSE_ERROR_MARKER = "Unable to parse range";

/** Cap the tab list in an error message so a 200-tab workbook can't produce a wall of text. */
const MAX_TABS_IN_ERROR = 25;

/** True when `message` is the Sheets 400 for a range whose tab could not be resolved. */
export function isRangeParseError(message: string): boolean {
  return message.includes(RANGE_PARSE_ERROR_MARKER);
}

/** Only our metadata-confirmed missing-tab diagnosis is a static config failure. */
export function isMissingTabConfigurationError(message: string): boolean {
  return (
    /^(?:Spreadsheet "[^\r\n]+", sheet "[^\r\n]+": )?Sheet tab "[^\r\n]+" was not found/.test(message) &&
    message.includes("Update the Sheet Name on this step") &&
    /(?:Available|available) tabs:/.test(message)
  );
}

/**
 * Normalise a tab title for forgiving comparison: trims, lowercases, and collapses runs of
 * whitespace. Catches the renames people actually make — "Fb ads results" vs
 * "FB Ads Results" vs "Fb  ads results " — without pulling in a fuzzy-match dependency.
 */
function normaliseTabTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find the tab that differs from `sheetName` only by case or whitespace, if one exists.
 * A hit means the configured name is a near-miss the user can fix by re-selecting the tab.
 */
export function findTabIgnoringCaseAndSpacing(sheetName: string, tabTitles: readonly string[]): string | undefined {
  const target = normaliseTabTitle(sheetName);
  return tabTitles.find((title) => normaliseTabTitle(title) === target);
}

function formatTabList(tabTitles: readonly string[]): string {
  if (tabTitles.length === 0) return "none readable";
  const shown = tabTitles.slice(0, MAX_TABS_IN_ERROR).map((title) => `"${title}"`);
  const overflow = tabTitles.length - shown.length;
  return overflow > 0 ? `${shown.join(", ")} (+${overflow} more)` : shown.join(", ");
}

/**
 * Build the operator-facing replacement for Google's opaque range error.
 *
 * @param sheetName - The tab name the automation is configured to write to.
 * @param tabTitles - The tab titles actually present in the spreadsheet.
 * @returns A message naming the real tabs, and the likely rename when one is detectable.
 */
export function formatMissingTabError(sheetName: string, tabTitles: readonly string[]): string {
  const nearMatch = findTabIgnoringCaseAndSpacing(sheetName, tabTitles);
  if (nearMatch && nearMatch !== sheetName) {
    return (
      `Sheet tab "${sheetName}" was not found, but this spreadsheet has "${nearMatch}" — ` +
      `it looks like the tab was renamed. Update the Sheet Name on this step to "${nearMatch}". ` +
      `Available tabs: ${formatTabList(tabTitles)}.`
    );
  }
  return (
    `Sheet tab "${sheetName}" was not found in this spreadsheet — it was most likely renamed or deleted. ` +
    `Update the Sheet Name on this step to one of the available tabs: ${formatTabList(tabTitles)}.`
  );
}
