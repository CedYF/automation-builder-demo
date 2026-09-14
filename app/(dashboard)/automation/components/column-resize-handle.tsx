"use client";

import type { ReactElement } from "react";

interface ColumnResizeHandleProps {
  readonly ariaLabel: string;
  /** Starts a width drag from the mouse-down clientX. */
  readonly onResizeStart: (clientX: number) => void;
}

/**
 * Drag affordance pinned to a column header's right edge. It only starts the
 * drag; the resize itself is driven by document-level listeners so this stays a
 * thin presentational control.
 */
export function ColumnResizeHandle({ ariaLabel, onResizeStart }: ColumnResizeHandleProps): ReactElement {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onResizeStart(event.clientX);
      }}
      className="group absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none items-center justify-center"
    >
      <span className="h-4 w-px bg-border transition-colors group-hover:bg-primary group-active:bg-primary" />
    </span>
  );
}
