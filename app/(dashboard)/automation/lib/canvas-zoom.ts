/**
 * Zoom model for the builder canvas.
 *
 * A long flow does not fit on one screen at full size, so the redesign puts a
 * zoom cluster in the bottom-left corner of the canvas. Steps are kept coarse
 * (10%) so keyboard-free clicking reaches either end quickly, and floating-point
 * drift is rounded away so the readout never shows "99%".
 */

export const CANVAS_ZOOM_MIN = 0.5;
export const CANVAS_ZOOM_MAX = 1.5;
export const CANVAS_ZOOM_STEP = 0.1;
export const CANVAS_ZOOM_DEFAULT = 1;

const ZOOM_PRECISION = 100;

function roundZoom(value: number): number {
  return Math.round(value * ZOOM_PRECISION) / ZOOM_PRECISION;
}

export function clampCanvasZoom(value: number): number {
  if (!Number.isFinite(value)) return CANVAS_ZOOM_DEFAULT;
  return roundZoom(Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, value)));
}

export function zoomCanvasIn(value: number): number {
  return clampCanvasZoom(clampCanvasZoom(value) + CANVAS_ZOOM_STEP);
}

export function zoomCanvasOut(value: number): number {
  return clampCanvasZoom(clampCanvasZoom(value) - CANVAS_ZOOM_STEP);
}

export function canZoomCanvasIn(value: number): boolean {
  return clampCanvasZoom(value) < CANVAS_ZOOM_MAX;
}

export function canZoomCanvasOut(value: number): boolean {
  return clampCanvasZoom(value) > CANVAS_ZOOM_MIN;
}

export function formatCanvasZoom(value: number): string {
  return `${Math.round(clampCanvasZoom(value) * ZOOM_PRECISION)}%`;
}
