import { describe, expect, it } from "vitest";
import {
  CANVAS_ZOOM_DEFAULT,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  canZoomCanvasIn,
  canZoomCanvasOut,
  clampCanvasZoom,
  formatCanvasZoom,
  zoomCanvasIn,
  zoomCanvasOut,
} from "./canvas-zoom";

describe("clampCanvasZoom", () => {
  it("keeps a value inside the range untouched", () => {
    expect(clampCanvasZoom(0.8)).toBe(0.8);
  });

  it("clamps below the minimum", () => {
    expect(clampCanvasZoom(0.1)).toBe(CANVAS_ZOOM_MIN);
  });

  it("clamps above the maximum", () => {
    expect(clampCanvasZoom(4)).toBe(CANVAS_ZOOM_MAX);
  });

  it("falls back to the default for a non-finite value", () => {
    expect(clampCanvasZoom(Number.NaN)).toBe(CANVAS_ZOOM_DEFAULT);
    expect(clampCanvasZoom(Number.POSITIVE_INFINITY)).toBe(CANVAS_ZOOM_DEFAULT);
  });

  it("rounds away floating-point drift", () => {
    expect(clampCanvasZoom(0.1 + 0.2)).toBe(0.5);
    expect(clampCanvasZoom(0.7000000000000001)).toBe(0.7);
  });
});

describe("zoomCanvasIn / zoomCanvasOut", () => {
  it("steps up by one increment", () => {
    expect(zoomCanvasIn(1)).toBe(1.1);
  });

  it("steps down by one increment", () => {
    expect(zoomCanvasOut(1)).toBe(0.9);
  });

  it("never exceeds the maximum", () => {
    expect(zoomCanvasIn(CANVAS_ZOOM_MAX)).toBe(CANVAS_ZOOM_MAX);
  });

  it("never drops below the minimum", () => {
    expect(zoomCanvasOut(CANVAS_ZOOM_MIN)).toBe(CANVAS_ZOOM_MIN);
  });

  it("stays free of accumulated drift across repeated steps", () => {
    let zoom = CANVAS_ZOOM_DEFAULT;
    for (let step = 0; step < 5; step += 1) zoom = zoomCanvasOut(zoom);
    expect(zoom).toBe(CANVAS_ZOOM_MIN);
    for (let step = 0; step < 5; step += 1) zoom = zoomCanvasIn(zoom);
    expect(zoom).toBe(CANVAS_ZOOM_DEFAULT);
  });
});

describe("canZoomCanvasIn / canZoomCanvasOut", () => {
  it("reports headroom in the middle of the range", () => {
    expect(canZoomCanvasIn(1)).toBe(true);
    expect(canZoomCanvasOut(1)).toBe(true);
  });

  it("reports no headroom at the boundaries", () => {
    expect(canZoomCanvasIn(CANVAS_ZOOM_MAX)).toBe(false);
    expect(canZoomCanvasOut(CANVAS_ZOOM_MIN)).toBe(false);
  });
});

describe("formatCanvasZoom", () => {
  it("renders whole percentages", () => {
    expect(formatCanvasZoom(1)).toBe("100%");
    expect(formatCanvasZoom(0.5)).toBe("50%");
    expect(formatCanvasZoom(1.5)).toBe("150%");
  });

  it("clamps out-of-range values before formatting", () => {
    expect(formatCanvasZoom(9)).toBe("150%");
    expect(formatCanvasZoom(0)).toBe("50%");
  });
});
