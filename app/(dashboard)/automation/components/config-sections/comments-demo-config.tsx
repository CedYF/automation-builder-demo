"use client";

import { useState } from "react";
import { EyeOff, Eye, Facebook, Instagram, Check, ChevronsUpDown, Search, RefreshCw, X, Sparkles, Clock3, Zap, Hand, Trash2, MessageSquare, ThumbsUp, FileSpreadsheet } from "lucide-react";
import { DEMO_COMMENT_PAGES } from "@/lib/mock/comment-pages";
import { previewDemoComments } from "@/lib/mock/comment-examples";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ConfigSectionProps } from "./types";

function readConditions(config: Record<string, unknown>): Record<string, unknown> {
  return config.conditions && typeof config.conditions === "object" && !Array.isArray(config.conditions)
    ? config.conditions as Record<string, unknown>
    : {};
}

export function DemoCommentPreview({ config, actionEvent = "Hide Comment", showStats = false }: { config: Record<string, unknown>; actionEvent?: string; showStats?: boolean }) {
  const [refreshCount, setRefreshCount] = useState(0);
  const selectedPageIds = Array.isArray(config.pageIds)
    ? config.pageIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const previewConfig = showStats && selectedPageIds.length === 0
    ? { ...config, pageIds: DEMO_COMMENT_PAGES.map((page) => page.id) }
    : config;
  const decisions = previewDemoComments(previewConfig);
  const matched = decisions.filter((decision) => decision.willHide).length;
  const conditions = readConditions(config);
  const actionLabel = actionEvent === "Delete Comment" ? "Would delete"
    : actionEvent === "Reply to Comment" ? "Would reply"
      : actionEvent === "Like Comment" ? "Would like"
        : actionEvent === "Export to Google Sheet" ? "Would export"
          : "Would hide";
  const unmatchedLabel = actionEvent === "Hide Comment" || actionEvent === "Delete Comment" ? "Stay visible" : "Not matched";
  const actionOutcome = actionEvent === "Delete Comment" ? "deleted"
    : actionEvent === "Reply to Comment" ? "replied to"
      : actionEvent === "Like Comment" ? "liked"
        : actionEvent === "Export to Google Sheet" ? "exported" : "hidden";
  const meaningScanEnabled = Array.isArray(conditions.customIntents) && conditions.customIntents.includes("custom-comment-scan");
  const brandStanceEnabled = Array.isArray(conditions.brandStances) && conditions.brandStances.includes("undermining");
  const activeFilters = [
    (brandStanceEnabled || meaningScanEnabled) && conditions.matchMode === "any" ? { label: "Match", value: "Any condition" } : null,
    brandStanceEnabled ? { label: "Stance toward brand", value: "Mocks or undermines the brand or ad" } : null,
    meaningScanEnabled ? { label: "Scan for meaning", value: "Mock scan finds related pile-ons" } : null,
  ].filter((filter): filter is { label: string; value: string } => filter !== null);
  const selectedPages = DEMO_COMMENT_PAGES.filter((page) => selectedPageIds.includes(page.id));
  const ageLabel = (minutes: number) => minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;

  if (showStats) {
    return (
      <section aria-label="Sample comment decisions" className="space-y-3">
        {activeFilters.length > 0 && <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rule checks</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeFilters.map(({ label, value }) => <span key={label} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary ring-1 ring-inset ring-primary/15"><strong>{label}:</strong><span className="truncate">{value}</span></span>)}
          </div>
        </div>}
        <div aria-label="Preview statistics" className="overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Comment preview</h3>
            <button type="button" onClick={() => setRefreshCount((count) => count + 1)} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" aria-label="Refresh matches"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          </div>
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs text-muted-foreground">{selectedPages.length === 0 ? "All connected demo pages · choose pages in Setup to narrow down" : `Previewing ${selectedPages.map((page) => page.name).join(", ")}${selectedPages.length > 1 ? ` · ${selectedPages.length} pages` : ""}`}</p>
            {refreshCount > 0 && <p className="text-[11px] text-muted-foreground" role="status">Refreshed from mock comments</p>}
            <div>
              <p className="text-base font-semibold">{matched > 0 ? `${matched} comment${matched === 1 ? "" : "s"} would be ${actionOutcome}` : decisions.length > 0 ? "No matches" : "No comments yet"}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{decisions.length - matched} would stay visible · {decisions.length} sample comments checked</p>
            </div>
            {decisions.length > 0 && <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {decisions.map(({ comment, reasons, willHide }) => {
                const page = DEMO_COMMENT_PAGES.find((candidate) => candidate.id === comment.pageId);
                const tone = comment.sentimentScore <= 40 ? "Negative" : comment.sentimentScore >= 60 ? "Positive" : "Neutral";
                const toneColor = tone === "Negative" ? "bg-rose-50 text-rose-700 ring-rose-200" : tone === "Positive" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-muted text-muted-foreground ring-border";
                return <li key={comment.id} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{comment.author}</p><p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">{page?.platform === "instagram" ? <Instagram className="h-3 w-3 text-pink-600" /> : <Facebook className="h-3 w-3 text-blue-600" />}{page?.name ?? "Demo page"}</span>
                      <span>· {ageLabel(comment.postedMinutesAgo)}</span><span>· Scored {ageLabel(comment.scoredMinutesAgo)}</span><span>· Sample ad comment</span>
                    </p></div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${toneColor}`}>{tone}</span>
                  </div>
                  <p className="mt-2 text-sm leading-snug">{comment.text}</p>
                  <p className={`mt-2 text-xs font-medium ${willHide ? "text-violet-700" : "text-emerald-700"}`}>
                    {willHide ? actionLabel : unmatchedLabel}{reasons.length ? ` · ${reasons.join(" · ")}` : " · No rule checks matched"}
                  </p>
                </li>;
              })}
            </ul>}
          </div>
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">Tone uses saved mock scores. Previewing does not change comments.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Sample comment decisions" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Example results</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {decisions.length ? `${decisions.length} sample comments · ${matched} match` : "Choose a page to preview its comments."}
        </p>
      </div>
      <div className="space-y-2">
        {decisions.map(({ comment, reasons, willHide }) => {
          const page = DEMO_COMMENT_PAGES.find((candidate) => candidate.id === comment.pageId);
          return (
            <article key={comment.id} className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{comment.author}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${willHide ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {willHide ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {willHide ? actionLabel : unmatchedLabel}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">{comment.text}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {page?.name ?? "Demo page"} · {page?.platform === "instagram" ? "Instagram" : "Facebook"}
                {reasons.length > 0 ? ` · ${reasons.join(" · ")}` : ""}
              </p>
            </article>
          );
        })}
      </div>
      {decisions.length > 0 && <p className="text-[11px] text-muted-foreground">Sample data only. Previewing does not change comments.</p>}
    </section>
  );
}

export function CommentsTriggerConfig({ config, setConfig, event, setEvent }: ConfigSectionProps) {
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [refreshNotice, setRefreshNotice] = useState(false);
  const pageIds = Array.isArray(config.pageIds)
    ? config.pageIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const conditions = readConditions(config);
  const hasNegativeTone = typeof conditions.sentimentMax === "number";
  const meaningScanEnabled = Array.isArray(conditions.customIntents) && conditions.customIntents.includes("custom-comment-scan");
  const brandStanceEnabled = Array.isArray(conditions.brandStances) && conditions.brandStances.includes("undermining");

  const setPageIds = (nextIds: string[]) => {
    const selected = DEMO_COMMENT_PAGES.filter((page) => nextIds.includes(page.id));
    setConfig({
      ...config,
      pageIds: nextIds,
      pagePlatforms: Object.fromEntries(selected.map((page) => [page.id, page.platform])),
      pageNames: Object.fromEntries(selected.map((page) => [page.id, page.name])),
      platform: selected[0]?.platform ?? "facebook",
    });
  };

  const togglePage = (pageId: string) => {
    setPageIds(pageIds.includes(pageId) ? pageIds.filter((id) => id !== pageId) : [...pageIds, pageId]);
  };
  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  const visiblePages = DEMO_COMMENT_PAGES.filter((page) =>
    !normalizedSearch || [page.name, page.id, page.displayId, page.category, page.platform]
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
  );
  const allVisibleSelected = visiblePages.length > 0 && visiblePages.every((page) => pageIds.includes(page.id));
  const toggleAllVisible = () => {
    const visibleIds = new Set<string>(visiblePages.map((page) => page.id));
    setPageIds(allVisibleSelected
      ? pageIds.filter((id) => !visibleIds.has(id))
      : [...new Set([...pageIds, ...visiblePages.map((page) => page.id)])]);
  };

  const updateTone = (negative: boolean) => {
    const next: Record<string, unknown> = { ...conditions, matchMode: "any" };
    if (negative) next.sentimentMax = 40;
    else delete next.sentimentMax;
    setConfig({ ...config, conditions: next, toneValue: { mode: "preset", preset: negative ? "negative" : "anything" } });
  };

  const toggleMeaningScan = () => {
    setConfig({
      ...config,
      conditions: {
        ...conditions,
        matchMode: "any",
        customIntents: meaningScanEnabled ? [] : ["custom-comment-scan"],
      },
    });
  };

  const toggleBrandStance = () => {
    setConfig({
      ...config,
      conditions: { ...conditions, matchMode: "any", brandStances: brandStanceEnabled ? [] : ["undermining"] },
    });
  };

  return (
    <div className="space-y-3 pb-3">
      <section className={`rounded-xl border bg-background p-4 ${pageIds.length === 0 ? "border-amber-400 ring-1 ring-amber-200" : ""}`}>
        <div className="mb-3 flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${pageIds.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {pageIds.length ? <Check className="h-3.5 w-3.5" /> : "1"}
          </span>
          <h3 className="text-sm font-semibold">Choose pages</h3>
          {pageIds.length === 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Start here</span>}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Pick the Facebook or Instagram pages this rule should watch.</p>
        <Popover open={pagePickerOpen} onOpenChange={setPagePickerOpen}>
          <PopoverTrigger asChild>
            <button type="button" role="combobox" aria-expanded={pagePickerOpen} aria-label="Choose pages" className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 text-left text-sm hover:bg-muted/30">
              <span className="flex min-w-0 items-center gap-2 truncate">
                {pageIds.length > 0 && <span className="flex shrink-0 items-center" aria-hidden>
                  {pageIds.slice(0, 3).map((pageId, index) => {
                    const page = DEMO_COMMENT_PAGES.find((item) => item.id === pageId);
                    return <span key={pageId} className={`flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background ${index > 0 ? "-ml-1.5" : ""}`}>
                      {page?.platform === "instagram" ? <Instagram className="h-4 w-4 text-pink-600" /> : <Facebook className="h-4 w-4 text-blue-600" />}
                    </span>;
                  })}
                </span>}
                <span className="truncate">{pageIds.length ? `${pageIds.length} page${pageIds.length === 1 ? "" : "s"}` : "Choose pages…"}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[min(400px,calc(100vw-2rem))] p-0">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="search" aria-label="Search pages by name, ID, or category" placeholder="Search name, ID, category…" value={pageSearchQuery} onChange={(change) => { setPageSearchQuery(change.target.value); setRefreshNotice(false); }} className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <button type="button" aria-label="Refresh demo pages" title="Refresh demo pages" onClick={() => { setPageSearchQuery(""); setRefreshNotice(true); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted/40"><RefreshCw className="h-4 w-4" /></button>
            </div>
            <div className="flex min-h-[38px] items-center justify-between gap-2 border-b bg-muted/20 px-3 py-1.5">
              <span className="truncate text-[11px] text-muted-foreground">{refreshNotice ? "Demo pages up to date" : normalizedSearch ? `${visiblePages.length} of ${DEMO_COMMENT_PAGES.length} pages` : `${DEMO_COMMENT_PAGES.length} pages`}{pageIds.length ? ` · ${pageIds.length} selected` : ""}</span>
              {visiblePages.length > 0 && <button type="button" onClick={toggleAllVisible} className="shrink-0 rounded px-2 py-1 text-xs font-medium hover:bg-muted/60">{allVisibleSelected ? "Deselect all" : "Select all"}</button>}
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {visiblePages.length === 0 ? <p className="px-2 py-5 text-center text-sm text-muted-foreground">No pages match your search.</p> : visiblePages.map((page) => (
                <label key={page.id} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/60">
                  <input type="checkbox" checked={pageIds.includes(page.id)} onChange={() => togglePage(page.id)} className="mt-1 h-4 w-4 accent-blue-600" />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50">{page.platform === "instagram" ? <Instagram className="h-4 w-4 text-pink-600" /> : <Facebook className="h-4 w-4 text-blue-600" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm" title={page.name}>{page.name}</span><span className="block truncate text-xs text-muted-foreground" title={page.displayId}>{page.displayId}</span></span>
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t bg-muted/20 px-3 py-2.5"><button type="button" onClick={() => setPagePickerOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Done</button></div>
          </PopoverContent>
        </Popover>
        {pageIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected pages">
            {DEMO_COMMENT_PAGES.filter((page) => pageIds.includes(page.id)).map((page) => (
              <span key={page.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 py-1 pl-1 pr-1.5 text-[11px]">
                {page.platform === "instagram" ? <Instagram className="h-3.5 w-3.5 text-pink-600" /> : <Facebook className="h-3.5 w-3.5 text-blue-600" />}
                <span className="max-w-[180px] truncate" title={page.name}>{page.name}</span>
                <button type="button" aria-label={`Remove ${page.name} ${page.platform}`} onClick={() => togglePage(page.id)} className="rounded p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>
          <h3 className="text-sm font-semibold">Match by tone</h3>
        </div>
        <select
          aria-label="Comment tone"
          value={hasNegativeTone ? "negative" : "anything"}
          onChange={(change) => updateTone(change.target.value === "negative")}
          className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
        >
          <option value="negative">Negative</option>
          <option value="anything">Any tone</option>
        </select>
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" role="switch" aria-label="Scan comments for meaning" checked={meaningScanEnabled} onChange={toggleMeaningScan} className="h-4 w-4 accent-blue-600" />
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-semibold">Scan for meaning</span>
            <span className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">Optional</span>
          </label>
          <p className="mt-1 pl-6 text-[11px] leading-relaxed text-muted-foreground">
            {meaningScanEnabled ? "Also catches hostile calls to flood your comments, even when the wording sounds neutral." : "Turn on to catch hostile pile-ons that a tone check could miss."}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>
          <h3 className="text-sm font-semibold">When it runs</h3>
        </div>
        <div className="overflow-hidden rounded-lg border">
          {[
            { value: "New Comment", label: "As comments arrive", icon: Zap },
            { value: "Scheduled scan", label: "On a schedule", icon: Clock3 },
            { value: "Manual Run", label: "Only when I run it", icon: Hand },
          ].map((option) => {
            const Icon = option.icon;
            const selected = (event ?? "New Comment") === option.value;
            return (
              <button key={option.value} type="button" onClick={() => setEvent?.(option.value)} className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs last:border-b-0 ${selected ? "bg-blue-50 font-semibold text-blue-700" : "hover:bg-muted/40"}`}>
                <Icon className="h-3.5 w-3.5" />
                <span className="flex-1">{option.label}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        {event === "New Comment" && (
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs">
            Also sweep comments already posted
            <input type="checkbox" role="switch" checked={config.processExisting === true} onChange={() => setConfig({ ...config, processExisting: config.processExisting !== true })} className="h-4 w-4 accent-blue-600" />
          </label>
        )}
      </section>
      <details className="rounded-xl border bg-background p-4">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced · Brand stance</summary>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
          <input type="checkbox" checked={brandStanceEnabled} onChange={toggleBrandStance} className="mt-0.5 h-4 w-4 accent-blue-600" />
          <span><strong className="block">Undermines the brand</strong><span className="mt-0.5 block text-[11px] text-muted-foreground">Hide comments that attack trust in the brand, even when their tone is calm.</span></span>
        </label>
      </details>
      <DemoCommentPreview config={config} />
    </div>
  );
}

const ACTION_OPTIONS = [
  { event: "Hide Comment", title: "Hide the comment", detail: "Only you and the commenter can still see it.", icon: EyeOff },
  { event: "Delete Comment", title: "Delete the comment", detail: "This cannot be undone.", icon: Trash2 },
  { event: "Reply to Comment", title: "Reply to the comment", detail: "Your reply is posted publicly under the comment.", icon: MessageSquare },
  { event: "Like Comment", title: "Like the comment", detail: "Comments already liked are skipped.", icon: ThumbsUp },
  { event: "Export to Google Sheet", title: "Export to Google Sheet", detail: "Each run appends new matching comments. Nothing changes on the page.", icon: FileSpreadsheet },
] as const;

export function CommentsActionConfig({ config, setConfig, event, setEvent }: ConfigSectionProps) {
  const selectAction = (nextEvent: string) => {
    if (nextEvent === event) return;
    setConfig({
      ...config,
      actionConfig: nextEvent === "Reply to Comment"
        ? { useAI: true, aiPrompt: "Write a helpful reply.", autoSend: false }
        : nextEvent === "Export to Google Sheet" ? { sheetName: "Comments" } : {},
    });
    setEvent?.(nextEvent);
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="What happens" className="overflow-hidden rounded-lg border">
        {ACTION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = (event || "Hide Comment") === option.event;
          return (
            <button
              key={option.event}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectAction(option.event)}
              className={`flex w-full items-start gap-3 border-b px-3 py-2.5 text-left last:border-b-0 ${selected ? "bg-blue-50/70" : "hover:bg-muted/40"}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-blue-700" : "text-muted-foreground"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-semibold ${selected ? "text-blue-700" : ""}`}>{option.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{option.detail}</span>
              </span>
              {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />}
            </button>
          );
        })}
      </div>
      {event === "Reply to Comment" && (
        <label className="block text-xs font-medium">AI instructions
          <textarea
            value={typeof config.actionConfig?.aiPrompt === "string" ? config.actionConfig.aiPrompt : ""}
            onChange={(change) => setConfig({ ...config, actionConfig: { ...config.actionConfig, useAI: true, autoSend: false, aiPrompt: change.target.value } })}
            className="mt-2 min-h-20 w-full rounded-lg border bg-background p-2 text-xs"
          />
        </label>
      )}
      {event === "Export to Google Sheet" && (
        <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">Mock export only. No Google Sheet is connected in this demo.</p>
      )}
    </div>
  );
}
