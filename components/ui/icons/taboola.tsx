"use client";

import type { CSSProperties, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface TaboolaIconProps extends SVGProps<SVGSVGElement> {
  style?: CSSProperties;
}

const TABOOLA_VIEW_MIN_X = 141;
/** Crop empty space above the mark so the glyph centers in square icon slots. */
const TABOOLA_VIEW_MIN_Y = 78;
const TABOOLA_VIEW_WIDTH = 392.6;
const TABOOLA_VIEW_HEIGHT = 132;
const TABOOLA_ICON_CENTER_X = TABOOLA_VIEW_MIN_X + TABOOLA_VIEW_WIDTH / 2;
const TABOOLA_ICON_CENTER_Y = TABOOLA_VIEW_MIN_Y + TABOOLA_VIEW_HEIGHT / 2;

/** Simplified paths omit the Y-flip baked into `public/taboola.svg`; rotate to match brand orientation. */
export default function Taboola({ className, style, ...props }: TaboolaIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${TABOOLA_VIEW_MIN_X} ${TABOOLA_VIEW_MIN_Y} ${TABOOLA_VIEW_WIDTH} ${TABOOLA_VIEW_HEIGHT}`}
      className={cn("block shrink-0", className)}
      style={style}
      aria-hidden="true"
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <g transform={`rotate(180 ${TABOOLA_ICON_CENTER_X} ${TABOOLA_ICON_CENTER_Y})`}>
        <path d="M233.323 104.4c-54.3.31-78.6 36.38-78.36 76.48.23 40.1 24.94 75.59 79.24 75.27 54.3-.3 78.6-36.08 78.36-76.19-.24-40.09-24.94-75.88-79.24-75.56Zm.65 111.65c-20.89.13-23.8-20.19-23.89-35.5-.08-15.31 2.58-35.94 23.46-36.07 20.88-.11 23.79 20.47 23.89 35.8.09 15.32-2.58 35.67-23.46 35.77Z" />
        <path d="M370.143 104.39c-54.29.33-78.59 36.4-78.35 76.49.22 40.09 24.94 75.59 79.23 75.27 54.3-.31 78.6-36.09 78.37-76.19-.23-40.1-24.95-75.87-79.25-75.57Zm.66 111.67c-20.88.13-23.78-20.19-23.87-35.51-.1-15.31 2.56-35.93 23.46-36.06 20.86-.13 23.79 20.47 23.87 35.78.08 15.33-2.59 35.68-23.46 35.79Z" />
        <path d="M175.643 104.39c39.15-17.49 79.77-25.25 124.03-25.51 46.5-.27 81.76 8.51 126.4 25.51l-.26-48.17c-39.95-19.81-83.28-30.5-126.45-30.25-47.05.28-80.96 9.94-124.01 30.25l.29 48.17Z" />
      </g>
    </svg>
  );
}
