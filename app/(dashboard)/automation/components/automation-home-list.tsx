"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_HOME_FILTERS,
  filterAutomationHomeRows,
  nextAutomationHomeSort,
  sortAutomationHomeRowsBy,
  type AutomationHomeSort,
  type AutomationHomeSortKey,
  type AutomationHomeFilter,
  type AutomationHomeRow,
  type AutomationHomeStateCounts,
} from "@/lib/automation/home-summary";
import { HOME_COLUMNS, homeColumnWidthVars, type HomeColumn, type HomeColumnId } from "../lib/automation-home-columns";
import { HOME_LIST_CARD_CLASS, HOME_LIST_SCROLLER_CLASS } from "../lib/home-shell-layout";
import { AUTOMATION_HOME_FILTER_LABELS } from "../lib/home-labels";
import {
  describeRowsPerPage,
  getHomePageState,
  HOME_ROWS_PER_PAGE,
  HOME_ROWS_PER_PAGE_OPTIONS,
  HOME_ROWS_PER_PAGE_STORAGE_KEY,
  parseStoredRowsPerPage,
  serializeRowsPerPage,
} from "../lib/home-pagination";
import { useHomeColumnWidths } from "../hooks/use-home-column-widths";
import { doesAutomationMatchSearch } from "./automations-table-filter";
import { usePages } from "@/app/(dashboard)/comments/_features/account-management/hooks/usePages";
import { useUser } from "@/lib/providers/user-provider";
import {
  buildAutomationAccountNameLookup,
  collectWorkspaceAccountNameSources,
  resolveOverlayAccountName,
} from "@/lib/automation/automation-table-account-display";
import { AutomationHomeListRow, HOME_ROW_GRID, type PageProfile } from "./automation-home-row";
import type { AutomationHomeRowMenuHandlers } from "./automation-home-row-actions";
import { ColumnResizeHandle } from "./column-resize-handle";

/** How often the relative "Modified" column re-renders. */
const MODIFIED_REFRESH_MS = 60_000;

function countForFilter(counts: AutomationHomeStateCounts, filter: AutomationHomeFilter): number {
  return filter === "all" ? counts.total : counts[filter];
}

function overlayHumanAccountName(row: AutomationHomeRow, lookup: ReadonlyMap<string, string>): AutomationHomeRow {
  const humanName = resolveOverlayAccountName(row.accountId, row.accountName, lookup);
  return humanName && humanName !== row.accountName ? { ...row, accountName: humanName } : row;
}

interface FilterPillsProps {
  readonly counts: AutomationHomeStateCounts;
  readonly active: AutomationHomeFilter;
  readonly onChange: (filter: AutomationHomeFilter) => void;
}

function FilterPills({ counts, active, onChange }: FilterPillsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {AUTOMATION_HOME_FILTERS.map((filter) => {
        const isActive = filter === active;
        const isAttention = filter === "needs-you" && counts["needs-you"] > 0;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "border-transparent bg-foreground font-semibold text-background"
                : isAttention
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                  : "border-border text-foreground hover:bg-muted",
            )}
          >
            {AUTOMATION_HOME_FILTER_LABELS[filter]} {countForFilter(counts, filter)}
          </button>
        );
      })}
    </div>
  );
}

interface ColumnHeaderProps {
  readonly sort: AutomationHomeSort | null;
  readonly onSort: (key: AutomationHomeSortKey) => void;
  readonly onResizeStart: (columnId: HomeColumnId, clientX: number) => void;
}

function SortIndicator({ state }: { readonly state: "asc" | "desc" | null }): React.ReactElement {
  if (state === "asc") return <ArrowUp className="h-3 w-3" aria-hidden />;
  if (state === "desc") return <ArrowDown className="h-3 w-3" aria-hidden />;
  return <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />;
}

function HeaderLabel({
  column,
  sort,
  onSort,
}: {
  readonly column: HomeColumn;
  readonly sort: AutomationHomeSort | null;
  readonly onSort: (key: AutomationHomeSortKey) => void;
}): React.ReactElement {
  if (!column.sortKey) return <>{column.label}</>;

  const sortKey = column.sortKey;
  const active = sort?.key === sortKey ? sort.direction : null;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={cn(
        "group inline-flex items-center gap-1 pr-1 transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {column.label}
      <SortIndicator state={active} />
    </button>
  );
}

function HeaderCell({
  column,
  sort,
  onSort,
  onResizeStart,
}: {
  readonly column: HomeColumn;
  readonly sort: AutomationHomeSort | null;
  readonly onSort: (key: AutomationHomeSortKey) => void;
  readonly onResizeStart: (columnId: HomeColumnId, clientX: number) => void;
}): React.ReactElement {
  return (
    <div className={cn("relative min-w-0 overflow-hidden", column.className)}>
      <HeaderLabel column={column} sort={sort} onSort={onSort} />
      <ColumnResizeHandle
        ariaLabel={`Resize ${column.label || column.id} column`}
        onResizeStart={(clientX) => onResizeStart(column.id, clientX)}
      />
    </div>
  );
}

function ColumnHeader({ sort, onSort, onResizeStart }: ColumnHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        HOME_ROW_GRID,
        "sticky top-0 z-10 hidden bg-muted md:grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
      )}
    >
      {HOME_COLUMNS.map((column) => (
        <HeaderCell key={column.id} column={column} sort={sort} onSort={onSort} onResizeStart={onResizeStart} />
      ))}
    </div>
  );
}

function EmptyFilterState({
  filter,
  searchTerm,
}: {
  readonly filter: AutomationHomeFilter;
  readonly searchTerm: string;
}): React.ReactElement {
  if (searchTerm.trim()) {
    return (
      <div className="border-t border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        No automations match “{searchTerm.trim()}”.
      </div>
    );
  }

  const message =
    filter === "needs-you"
      ? "Nothing is waiting for approval right now."
      : filter === "running"
        ? "Nothing is running at the moment."
        : filter === "active"
          ? "No automations are on a schedule right now."
          : filter === "paused"
            ? "No paused automations."
            : "No automations yet.";
  return (
    <div className="border-t border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

interface ListSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** Narrows the list by name, ad account or rule id, at any list length. */
function ListSearch({ value, onChange }: ListSearchProps): React.ReactElement {
  return (
    <div className="relative w-full sm:w-56">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search automations"
        aria-label="Search automations"
        className="h-8 pl-8 pr-8 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className={cn(HOME_ROW_GRID, "border-t border-border/60 px-4 py-2.5")}>
          <Skeleton className="h-8 w-full max-w-[240px]" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="hidden h-5 w-full md:block" />
          <Skeleton className="hidden h-4 w-full 2xl:block" />
          <Skeleton className="hidden h-4 w-full 2xl:block" />
          <Skeleton className="hidden h-4 w-8 2xl:block" />
          <Skeleton className="hidden h-4 w-12 2xl:block" />
          <Skeleton className="hidden h-5 w-12 2xl:block" />
          <Skeleton className="hidden h-6 w-6 rounded-full 2xl:block" />
          <Skeleton className="h-5 w-9" />
          <Skeleton className="ml-auto h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

export interface AutomationHomeListProps {
  readonly rows: readonly AutomationHomeRow[];
  readonly counts: AutomationHomeStateCounts;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly busyRowKey: string | null;
  readonly onRefresh: () => void;
  readonly onOpen: (row: AutomationHomeRow) => void;
  readonly onToggle: (row: AutomationHomeRow, enabled: boolean) => void;
  readonly onApprove: (row: AutomationHomeRow) => void;
  readonly onReview: (row: AutomationHomeRow) => void;
  readonly canManage: boolean;
  readonly menuHandlers: AutomationHomeRowMenuHandlers;
}

/**
 * The one list of automations.
 *
 * Running, waiting on you, idle and paused are states in a column rather than
 * separate tabs, and the filter pills narrow to whichever the user cares about.
 * Every row the API returned is rendered here — search and the pills are the
 * only ways a row drops out of view.
 */
export function AutomationHomeList({
  rows,
  counts,
  loading,
  refreshing,
  busyRowKey,
  onRefresh,
  onOpen,
  onToggle,
  onApprove,
  onReview,
  canManage,
  menuHandlers,
}: AutomationHomeListProps): React.ReactElement {
  const [filter, setFilter] = useState<AutomationHomeFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<AutomationHomeSort | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | null>(HOME_ROWS_PER_PAGE);
  // Read after mount rather than in the initial state: localStorage is not
  // available during the server render, and seeding from it there would
  // hydrate a different row count than the server produced.
  useEffect(() => {
    try {
      const stored = parseStoredRowsPerPage(window.localStorage.getItem(HOME_ROWS_PER_PAGE_STORAGE_KEY));
      if (stored !== undefined) setRowsPerPage(stored);
    } catch {
      // Private mode and blocked site data both throw here; the default stands.
    }
  }, []);

  const handleRowsPerPageChange = useCallback((next: number | null) => {
    setRowsPerPage(next);
    setPage(1);
    try {
      window.localStorage.setItem(HOME_ROWS_PER_PAGE_STORAGE_KEY, serializeRowsPerPage(next));
    } catch {
      // Not being able to remember the choice must not break changing it.
    }
  }, []);
  const { widths, startResize } = useHomeColumnWidths();
  // Client-only clock for the relative "Modified" column. Reading it during
  // render would make the server and first client paint disagree.
  const [now, setNow] = useState<Date | null>(null);
  const { extendedUser } = useUser();
  const accountLookup = useMemo(
    () => buildAutomationAccountNameLookup(collectWorkspaceAccountNameSources(extendedUser)),
    [extendedUser],
  );
  // Resolved once for the whole list: a comment automation's account column
  // shows the page it moderates, and only the pages API knows its name and
  // picture. Failure is non-fatal — the cell falls back to the ad account name.
  const { data: pages } = usePages();
  const pageProfiles = useMemo(() => {
    const profiles = new Map<string, PageProfile>();
    for (const page of pages ?? []) {
      if (!page.pageId) continue;
      profiles.set(page.pageId, { name: page.pageName ?? page.pageId, picture: page.pagePicture ?? null });
    }
    return profiles;
  }, [pages]);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), MODIFIED_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
  const namedRows = useMemo(
    () => rows.map((row) => overlayHumanAccountName(row, accountLookup)),
    [rows, accountLookup],
  );
  const filteredRows = useMemo(() => {
    const byState = filterAutomationHomeRows(namedRows, filter);
    if (!searchTerm.trim()) return byState;
    // Reuses the automations table's predicate so a term that finds a rule there
    // finds the same rule here.
    return byState.filter((row) => doesAutomationMatchSearch(row, searchTerm));
  }, [namedRows, filter, searchTerm]);
  // Sorting is applied after filtering so a chosen column orders exactly what
  // is on screen, and clearing the sort restores the default most-recent-first order.
  const orderedRows = useMemo(() => sortAutomationHomeRowsBy(filteredRows, sort), [filteredRows, sort]);
  const handleSort = useCallback(
    (key: AutomationHomeSortKey) => setSort((current) => nextAutomationHomeSort(current, key)),
    [],
  );

  const pageState = getHomePageState({ totalRows: orderedRows.length, page, rowsPerPage });
  const visibleRows = useMemo(
    () => orderedRows.slice(pageState.startIndex, pageState.endIndex),
    [orderedRows, pageState.startIndex, pageState.endIndex],
  );
  // Any change to what is being listed sends the user back to the top of it —
  // staying on page 6 of a freshly filtered list shows a stranded middle.
  useEffect(() => {
    setPage(1);
  }, [filter, searchTerm, sort]);

  return (
    <TooltipProvider delayDuration={200}>
      <section className={HOME_LIST_CARD_CLASS} style={homeColumnWidthVars(widths)}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-foreground">Your automations</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh automations"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </Button>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <ListSearch value={searchTerm} onChange={setSearchTerm} />
            <FilterPills counts={counts} active={filter} onChange={setFilter} />
          </div>
        </div>

        {/* Header lives inside the scroller so a horizontal resize drag and
            vertical row scroll keep columns lined up. Sticky pins the labels. */}
        <div className={HOME_LIST_SCROLLER_CLASS}>
          <ColumnHeader sort={sort} onSort={handleSort} onResizeStart={startResize} />
          {loading && rows.length === 0 ? (
            <ListSkeleton />
          ) : orderedRows.length === 0 ? (
            <EmptyFilterState filter={filter} searchTerm={searchTerm} />
          ) : (
            visibleRows.map((row) => (
              <AutomationHomeListRow
                key={row.rowKey}
                row={row}
                busy={busyRowKey === row.rowKey}
                now={now}
                pageProfiles={pageProfiles}
                accountLookup={accountLookup}
                onOpen={onOpen}
                onToggle={onToggle}
                onApprove={onApprove}
                onReview={onReview}
                canManage={canManage}
                menuHandlers={menuHandlers}
              />
            ))
          )}
        </div>

        {filteredRows.length > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{pageState.label}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="sr-only">Rows per page</span>
                <select
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
                  value={serializeRowsPerPage(rowsPerPage)}
                  onChange={(event) => {
                    const next = parseStoredRowsPerPage(event.target.value);
                    if (next !== undefined) handleRowsPerPageChange(next);
                  }}
                  aria-label="Rows per page"
                  data-testid="home-rows-per-page"
                >
                  {HOME_ROWS_PER_PAGE_OPTIONS.map((option) => (
                    <option key={serializeRowsPerPage(option)} value={serializeRowsPerPage(option)}>
                      {describeRowsPerPage(option)}
                    </option>
                  ))}
                </select>
                per page
              </label>
            </div>
            {pageState.pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={!pageState.hasPrevious}
                  onClick={() => setPage(pageState.page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground" data-testid="home-page-indicator">
                  Page {pageState.page} of {pageState.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={!pageState.hasNext}
                  onClick={() => setPage(pageState.page + 1)}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
