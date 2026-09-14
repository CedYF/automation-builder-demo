/**
 * When a truncated cell should reveal its full value.
 *
 * A native `title` fires on every cell whether or not the text was actually
 * clipped, which trains people to ignore it. This decides from the measured
 * element instead, so the tooltip only appears when there is something to
 * reveal — or when the tooltip carries information the cell does not show at
 * all, such as the exact timestamp behind "12m ago".
 */

/**
 * Sub-pixel layout rounding can leave `scrollWidth` a fraction above
 * `clientWidth` on text that is not really clipped, which would pop a tooltip
 * showing the string already on screen.
 */
const TRUNCATION_TOLERANCE_PX = 1;

export interface TruncationTooltipInput {
  /** Full content width of the element. */
  readonly scrollWidth: number;
  /** Visible width of the element. */
  readonly clientWidth: number;
  /**
   * The tooltip adds information the cell never shows, so it is worth opening
   * even when the text fits.
   */
  readonly alwaysShow?: boolean;
}

export function isElementTruncated(scrollWidth: number, clientWidth: number): boolean {
  if (!Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) return false;
  return scrollWidth - clientWidth > TRUNCATION_TOLERANCE_PX;
}

export function shouldShowTruncationTooltip(input: TruncationTooltipInput): boolean {
  if (input.alwaysShow) return true;
  return isElementTruncated(input.scrollWidth, input.clientWidth);
}
