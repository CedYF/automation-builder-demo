"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildDefaultHomeColumnWidths,
  clampHomeColumnWidth,
  homeColumnById,
  type HomeColumnId,
  type HomeColumnWidths,
} from "../lib/automation-home-columns";

export interface UseHomeColumnWidthsResult {
  readonly widths: HomeColumnWidths;
  /** Begin a mouse-drag resize of `columnId` from the given starting clientX. */
  readonly startResize: (columnId: HomeColumnId, startClientX: number) => void;
}

/**
 * Session-scoped column widths for the automation home list. Widths reset when
 * the list unmounts; they are not written to storage.
 */
export function useHomeColumnWidths(): UseHomeColumnWidthsResult {
  const [widths, setWidths] = useState<HomeColumnWidths>(buildDefaultHomeColumnWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const endDragRef = useRef<(() => void) | null>(null);

  const startResize = useCallback((columnId: HomeColumnId, startClientX: number): void => {
    const column = homeColumnById(columnId);
    endDragRef.current?.();
    const startWidth = widthsRef.current[columnId];

    const handleMove = (event: MouseEvent): void => {
      const nextWidth = clampHomeColumnWidth(startWidth + (event.clientX - startClientX), column);
      setWidths((prev) => (prev[columnId] === nextWidth ? prev : { ...prev, [columnId]: nextWidth }));
    };
    const endDrag = (): void => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", endDrag);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      endDragRef.current = null;
    };
    endDragRef.current = endDrag;

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", endDrag);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => () => endDragRef.current?.(), []);

  return { widths, startResize };
}
