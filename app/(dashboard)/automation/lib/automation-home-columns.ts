import type { CSSProperties } from "react";
import type { AutomationHomeSortKey } from "@/lib/automation/home-summary";

export type HomeColumnId =
  | "name"
  | "on"
  | "state"
  | "rightNow"
  | "account"
  | "lastRun"
  | "runs"
  | "modified"
  | "saved"
  | "user"
  | "actions";

export interface HomeColumn {
  readonly id: HomeColumnId;
  readonly label: string;
  /** Custom property the shared grid template reads for this track. */
  readonly cssVar: `--home-col-${string}`;
  /** Responsive visibility and alignment. MUST match the row cell's own classes. */
  readonly className: string;
  /** Omitted for columns with nothing meaningful to order by. */
  readonly sortKey?: AutomationHomeSortKey;
  readonly defaultWidth: number;
  readonly minWidth: number;
  readonly maxWidth: number;
}

export type HomeColumnWidths = Record<HomeColumnId, number>;

/**
 * The list's columns, in the exact order `AutomationHomeListRow` renders its
 * cells.
 *
 * Header and row share one grid template, so a header declared in a different
 * order silently puts every label over the wrong column. Declaring the order
 * once, here, keeps the two from drifting apart. Each entry's `className`
 * must mirror the matching row cell's breakpoints, or the columns shear apart at
 * one width while looking fine at another.
 */
export const HOME_COLUMNS: readonly HomeColumn[] = [
  {
    id: "name",
    label: "Automation",
    cssVar: "--home-col-name",
    className: "",
    sortKey: "name",
    defaultWidth: 280,
    minWidth: 160,
    maxWidth: 560,
  },
  {
    id: "state",
    label: "Status",
    cssVar: "--home-col-state",
    className: "",
    sortKey: "state",
    defaultWidth: 150,
    minWidth: 150,
    maxWidth: 180,
  },
  {
    id: "rightNow",
    label: "Latest activity",
    cssVar: "--home-col-right-now",
    className: "hidden md:block",
    defaultWidth: 200,
    minWidth: 120,
    maxWidth: 420,
  },
  {
    id: "account",
    label: "Ad account",
    cssVar: "--home-col-account",
    className: "hidden min-w-0 2xl:block",
    sortKey: "account",
    defaultWidth: 140,
    minWidth: 88,
    maxWidth: 320,
  },
  {
    id: "lastRun",
    label: "Last run",
    cssVar: "--home-col-last-run",
    className: "hidden min-w-0 2xl:block",
    sortKey: "lastRun",
    defaultWidth: 96,
    minWidth: 80,
    maxWidth: 200,
  },
  {
    id: "runs",
    label: "Runs",
    cssVar: "--home-col-runs",
    className: "hidden text-right 2xl:block",
    sortKey: "runs",
    defaultWidth: 52,
    minWidth: 44,
    maxWidth: 120,
  },
  {
    id: "modified",
    label: "Modified",
    cssVar: "--home-col-modified",
    className: "hidden min-w-0 2xl:block",
    sortKey: "modified",
    defaultWidth: 72,
    minWidth: 64,
    maxWidth: 160,
  },
  {
    id: "saved",
    label: "Saved",
    cssVar: "--home-col-saved",
    className: "hidden 2xl:block",
    sortKey: "saved",
    defaultWidth: 64,
    minWidth: 52,
    maxWidth: 140,
  },
  {
    id: "user",
    label: "User",
    cssVar: "--home-col-user",
    className: "hidden justify-center 2xl:flex",
    defaultWidth: 40,
    minWidth: 34,
    maxWidth: 80,
  },
  {
    id: "on",
    label: "On",
    cssVar: "--home-col-on",
    className: "",
    defaultWidth: 44,
    minWidth: 40,
    maxWidth: 80,
  },
  {
    id: "actions",
    // Icon-only column; the kebab's aria-label names the actions.
    label: "",
    cssVar: "--home-col-actions",
    className: "flex justify-end",
    defaultWidth: 40,
    minWidth: 36,
    maxWidth: 56,
  },
];

const COLUMN_BY_ID: ReadonlyMap<HomeColumnId, HomeColumn> = new Map(HOME_COLUMNS.map((column) => [column.id, column]));

export function homeColumnById(id: HomeColumnId): HomeColumn {
  const column = COLUMN_BY_ID.get(id);
  if (!column) throw new Error(`Unknown home column: ${id}`);
  return column;
}

/** Clamp a proposed width to a column's `[minWidth, maxWidth]` bounds. */
export function clampHomeColumnWidth(width: number, column: HomeColumn): number {
  return Math.min(column.maxWidth, Math.max(column.minWidth, width));
}

export function buildDefaultHomeColumnWidths(): HomeColumnWidths {
  const widths: Partial<HomeColumnWidths> = {};
  for (const column of HOME_COLUMNS) widths[column.id] = column.defaultWidth;
  // HOME_COLUMNS enumerates every HomeColumnId, so the partial is complete.
  return widths as HomeColumnWidths;
}

/** CSS variables the shared header/row grid reads for each track. */
export function homeColumnWidthVars(widths: Readonly<HomeColumnWidths>): CSSProperties {
  // Custom properties are valid inline styles; CSSProperties' index signature
  // does not include `--*` keys in this React types version.
  return Object.fromEntries(HOME_COLUMNS.map((column) => [column.cssVar, `${widths[column.id]}px`])) as CSSProperties;
}
