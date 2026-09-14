"use client";

/**
 * Page identity for a multi-page comment automation's history: the avatar and
 * name shown on each run, and the dropdown that narrows the list to one page.
 *
 * These live apart from the run list because the history view renders the
 * filter in its page header, next to the automation's name, while the list
 * itself renders the same avatars on every row.
 */

import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildProfileIconUrl, isValidProfileIconId } from "@/lib/utils/r2-link-helper";
import { getCommenterInitials } from "../../../lib/commenter-initials";
import type { RunPageCount } from "@/app/(dashboard)/comments/lib/api/automation";

/** The "no page picked" value; a radio group needs a value for every option. */
const ALL_PAGES_VALUE = "__all_pages__";

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

/** A page with no stored name (disconnected since) falls back to its raw id. */
export function pageLabel(page: { pageId: string; pageName?: string | null }): string {
  return page.pageName?.trim() || page.pageId;
}

/**
 * A page's picture, trying each source in turn: the stored picture, then the
 * page's mirrored profile icon, then its initials. Instagram accounts store a
 * raw Facebook CDN link that expires (403), so the stored picture alone left
 * them as a broken image — the same fallback order the page picker uses.
 */
export function PageAvatar({
  pageId,
  name,
  picture,
  className,
}: {
  pageId: string;
  name: string;
  picture: string | null | undefined;
  className: string;
}) {
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const sources = [picture, isValidProfileIconId(pageId) ? buildProfileIconUrl(pageId) : null].filter(
    (source): source is string => Boolean(source),
  );
  const source = sources.find((candidate) => !failedSources.has(candidate));
  if (source) {
    return (
      <img
        key={source}
        src={source}
        alt=""
        className={cn("flex-shrink-0 rounded-full object-cover", className)}
        loading="lazy"
        onError={() => setFailedSources((failed) => new Set(failed).add(source))}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground",
        className,
      )}
    >
      {getCommenterInitials(name.replace(/^@/, ""))}
    </span>
  );
}

/**
 * Which page's runs the history shows: "All pages" by default, then one option
 * per page with its run count, busiest first. A stacked list of every page cost
 * a screen of height before the first run; the counts span every page either
 * way, so they don't move while a filter is on.
 */
export function RunPageFilter({
  pages,
  selectedPageId,
  onSelect,
}: {
  pages: readonly RunPageCount[];
  selectedPageId: string | null;
  onSelect: (pageId: string | null) => void;
}) {
  const allCount = pages.reduce((sum, page) => sum + page.runCount, 0);
  const selected = pages.find((page) => page.pageId === selectedPageId) ?? null;
  const selectedName = selected ? pageLabel(selected) : "All pages";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[15rem] gap-2" aria-label="Filter runs by page">
          {selected ? (
            <PageAvatar
              pageId={selected.pageId}
              name={selectedName}
              picture={selected.pagePicture}
              className="h-4 w-4 text-[8px]"
            />
          ) : (
            <Layers className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 truncate">{selectedName}</span>
          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatCount(selected ? selected.runCount : allCount)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={selectedPageId ?? ALL_PAGES_VALUE}
          onValueChange={(value) => onSelect(value === ALL_PAGES_VALUE ? null : value)}
        >
          <DropdownMenuRadioItem value={ALL_PAGES_VALUE} className="gap-2">
            <Layers className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">All pages</span>
            <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">{formatCount(allCount)}</span>
          </DropdownMenuRadioItem>
          {pages.map((page) => {
            const name = pageLabel(page);
            return (
              <DropdownMenuRadioItem key={page.pageId} value={page.pageId} className="gap-2">
                <PageAvatar
                  pageId={page.pageId}
                  name={name}
                  picture={page.pagePicture}
                  className="h-4 w-4 text-[8px]"
                />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCount(page.runCount)}
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
