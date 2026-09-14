"use client";

import { Clock3, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Meta from "@/components/ui/icons/meta";
import {
  formatAutomationTimestamp,
  formatModifiedAgo,
  formatSavedDuration,
  type AutomationHomeRow,
  type AutomationHomeState,
  type AutomationRightNow,
} from "@/lib/automation/home-summary";
import { resolveHomeAccountCell } from "@/lib/automation/home-account-display";
import { AUTOMATION_HOME_STATE_LABELS } from "../lib/home-labels";
import { getServiceInfo } from "../lib/service-icons";
import { AutomationHomeRowActions, type AutomationHomeRowMenuHandlers } from "./automation-home-row-actions";
import { TruncatedText } from "./truncated-text";

/** Step chips before the row collapses to "+N", matching the table's cap. */
const MAX_STEP_ICONS = 4;

/** Shared tracks keep status and activity separate from the workflow beneath the name. */
export const HOME_ROW_GRID = cn(
  "grid w-full min-w-0 items-center gap-x-3 gap-y-3 md:w-max md:min-w-full md:gap-x-5 md:gap-y-0",
  "grid-cols-[minmax(0,1fr)_var(--home-col-on)_var(--home-col-actions)]",
  "md:grid-cols-[var(--home-col-name)_var(--home-col-state)_var(--home-col-right-now)_var(--home-col-on)_var(--home-col-actions)]",
  "xl:grid-cols-[var(--home-col-name)_var(--home-col-state)_var(--home-col-right-now)_var(--home-col-on)_var(--home-col-actions)]",
  "2xl:grid-cols-[var(--home-col-name)_var(--home-col-state)_var(--home-col-right-now)_var(--home-col-account)_var(--home-col-last-run)_var(--home-col-runs)_var(--home-col-modified)_var(--home-col-saved)_var(--home-col-user)_var(--home-col-on)_var(--home-col-actions)]",
);

/** Chip for one configured step's app, matching the table's Steps column. */
function StepIcons({ services }: { readonly services: readonly string[] }): React.ReactElement {
  if (services.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  const shown = services.slice(0, MAX_STEP_ICONS);
  const overflow = services.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((service, index) => {
        const info = getServiceInfo(service);
        return (
          <Tooltip key={`${service}-${index}`}>
            <TooltipTrigger asChild>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-card">
                <ServiceMark service={service} label={info.label} icon={info.icon} iconType={info.iconType} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{info.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 && <span className="text-[11px] font-medium text-muted-foreground">+{overflow}</span>}
    </span>
  );
}

interface ServiceMarkProps {
  readonly service: string;
  readonly label: string;
  readonly icon: string;
  readonly iconType?: string;
}

function ServiceMark({ service, label, icon, iconType }: ServiceMarkProps): React.ReactElement {
  if (service === "meta-ads") return <Meta className="h-3.5 w-3.5" grayscale={false} />;
  if (iconType === "image" || icon.startsWith("/") || icon.startsWith("http")) {
    return <img src={icon} alt={label} className="h-3.5 w-3.5 object-contain" />;
  }
  return <span className="text-[11px] leading-none">{icon}</span>;
}

/** Resolved page profile, keyed by page id, for the account column. */
export interface PageProfile {
  readonly name: string;
  readonly picture: string | null;
}

export type PageProfileLookup = ReadonlyMap<string, PageProfile>;

interface AccountCellProps {
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly pageIds: readonly string[];
  readonly pageProfiles: PageProfileLookup;
  readonly accountLookup: ReadonlyMap<string, string>;
}

/**
 * What this automation runs on.
 *
 * Comment automations run on pages, so they show the page's profile picture and
 * name when we have it. Flow automations (and comment rows whose pages have not
 * loaded yet) show the human ad-account name, not a raw `act_` id.
 */
function AccountCell({
  accountId,
  accountName,
  pageIds,
  pageProfiles,
  accountLookup,
}: AccountCellProps): React.ReactElement {
  const cell = resolveHomeAccountCell({
    accountId,
    accountName,
    pageIds,
    pageProfiles,
    accountLookup,
  });

  if (!cell.isPage) {
    return <TruncatedText className="text-[11.5px] text-muted-foreground">{cell.label}</TruncatedText>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {cell.pictureUrl ? (
        <img src={cell.pictureUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground">
          {cell.label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <TruncatedText
        className="text-[11.5px] text-foreground/80"
        tooltip={cell.title}
        alwaysShow={cell.overflowCount > 0}
      >
        {cell.label}
      </TruncatedText>
      {cell.overflowCount > 0 && (
        <span className="shrink-0 text-[11px] text-muted-foreground">+{cell.overflowCount}</span>
      )}
    </span>
  );
}

/** Owner avatar, matching the table's User column. */
function OwnerAvatar({ initials, email }: { readonly initials: string; readonly email: string | null }) {
  const avatar = (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-[10px] font-semibold text-white">
      {initials}
    </span>
  );
  if (!email) return avatar;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent>
        <p>{email}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Why a row is in its state, for anyone unsure what the badge is claiming. */
const STATE_HINTS: Readonly<Record<AutomationHomeState, string>> = {
  running: "An execution is in flight right now.",
  // Covers both kinds: a flow run pauses, while a comment automation keeps
  // drafting and queues the replies for review.
  "needs-you": "A run is paused, or drafted replies are waiting, until you approve or reject.",
  active: "On and running on its schedule. It will fire again without you.",
  manual: "On, but it has no schedule — it only runs when you press Run.",
  paused: "Switched off. It will not run until you turn it back on.",
};

const STATE_BADGE_CLASSES: Readonly<Record<AutomationHomeState, string>> = {
  running: "bg-primary/10 text-primary font-semibold",
  "needs-you": "bg-amber-100 text-amber-800 font-semibold dark:bg-amber-500/15 dark:text-amber-300",
  active: "bg-muted text-muted-foreground font-medium",
  manual: "bg-muted text-muted-foreground font-medium",
  paused: "bg-muted text-muted-foreground/80",
};

/** States that get a dot: something is happening, or is scheduled to. */
const DOTTED_STATES: Readonly<Record<AutomationHomeState, string | null>> = {
  running: "bg-primary animate-pulse",
  "needs-you": null,
  active: null,
  manual: null,
  paused: null,
};

function StateBadge({ row }: { readonly row: AutomationHomeRow }): React.ReactElement {
  const { state, rightNow } = row;
  const needsReview =
    (state === "active" || state === "manual") &&
    (rightNow.kind === "failure" || (rightNow.kind === "note" && rightNow.attention === "approval-expired"));
  const label = needsReview
    ? "Needs review"
    : state === "active" && row.nextRunLabel
      ? "Scheduled"
      : state === "needs-you"
        ? "Awaiting approval"
        : AUTOMATION_HOME_STATE_LABELS[state];
  const dotClass = needsReview ? null : DOTTED_STATES[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px]",
            needsReview ? STATE_BADGE_CLASSES["needs-you"] : STATE_BADGE_CLASSES[state],
          )}
        >
          {dotClass && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />}
          {needsReview ? (
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
          ) : label === "Scheduled" ? (
            <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
          ) : null}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <p>{needsReview ? "The latest run needs review. Open its history for details." : STATE_HINTS[state]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function RunProgress({ label, percent }: { readonly label: string; readonly percent: number }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <TruncatedText className="text-xs text-foreground/80">{label}</TruncatedText>
      <span
        className="block h-1 overflow-hidden rounded-full bg-primary/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

interface ApprovalActionsProps {
  readonly label: string;
  readonly busy: boolean;
  readonly onApprove: () => void;
  readonly onReview: () => void;
}

function ApprovalActions({ label, busy, onApprove, onReview }: ApprovalActionsProps): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" className="h-7 px-3 text-xs" disabled={busy} onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={onReview}>
          Review
        </Button>
      </div>
      <TruncatedText className="text-[11px] text-muted-foreground">{label}</TruncatedText>
    </div>
  );
}

interface RightNowCellProps {
  readonly rightNow: AutomationRightNow;
  readonly busy: boolean;
  readonly onApprove: () => void;
  readonly onReview: () => void;
  readonly onViewRun: () => void;
}

/**
 * Drafted comment replies are reviewed one by one in the drafted-replies sheet,
 * so this offers Review and no inline Approve. Approving posts a public reply
 * and a single row can stand for hundreds of drafts, which is not something to
 * one-click from a list (ADM-11260).
 */
function ReviewRepliesAction({
  label,
  busy,
  onReview,
}: {
  readonly label: string;
  readonly busy: boolean;
  readonly onReview: () => void;
}): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={busy} onClick={onReview}>
        Review
      </Button>
      <TruncatedText className="text-[11px] text-muted-foreground">{label}</TruncatedText>
    </div>
  );
}

function FailureAction({
  label,
  reason,
  onViewRun,
}: {
  readonly label: string;
  readonly reason: string;
  readonly onViewRun: () => void;
}): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <button
        type="button"
        className="max-w-full text-left text-xs font-medium text-destructive hover:underline"
        aria-label="View failed run"
        onClick={onViewRun}
      >
        {label}
      </button>
      <TruncatedText className="max-w-full text-[11px] text-destructive/80">{reason}</TruncatedText>
    </div>
  );
}

/**
 * Exhaustive on purpose. The previous if-chain fell through to the note
 * renderer, so a new `AutomationRightNow` variant would silently render as a
 * bare label with no call to action and no type error.
 */
function RightNowCell({ rightNow, busy, onApprove, onReview, onViewRun }: RightNowCellProps): React.ReactElement {
  switch (rightNow.kind) {
    case "progress":
      return <RunProgress label={rightNow.label} percent={rightNow.percent} />;
    case "approval":
      return <ApprovalActions label={rightNow.label} busy={busy} onApprove={onApprove} onReview={onReview} />;
    case "review":
      return <ReviewRepliesAction label={rightNow.label} busy={busy} onReview={onReview} />;
    case "failure":
      return <FailureAction label={rightNow.label} reason={rightNow.reason} onViewRun={onViewRun} />;
    case "note":
      if (rightNow.attention === "approval-expired") {
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <TruncatedText className="max-w-full text-xs text-foreground/80">{rightNow.label}</TruncatedText>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onViewRun}>
              Review run →
            </button>
          </div>
        );
      }
      return (
        <TruncatedText className={cn("text-xs", rightNow.muted ? "text-muted-foreground" : "text-foreground/80")}>
          {rightNow.label}
        </TruncatedText>
      );
  }
}

function RowSwitch({
  row,
  onToggle,
}: {
  readonly row: AutomationHomeRow;
  readonly onToggle: (enabled: boolean) => void;
}): React.ReactElement {
  const control = (
    <Switch
      checked={row.enabled}
      disabled={row.toggleLocked}
      aria-label={`Turn ${row.name} ${row.enabled ? "off" : "on"}`}
      onCheckedChange={onToggle}
    />
  );

  if (!row.toggleLockReason) return control;

  return (
    <Tooltip>
      {/* A disabled switch swallows pointer events, so the trigger wraps it. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{control}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[260px]">
        <p>{row.toggleLockReason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const LIFETIME_SAVED_HINT =
  "Lifetime estimate. The comments service reports a total processed count, not per-day history, so this covers the whole life of the automation rather than the window above.";

/**
 * Hours saved, with the period made explicit where it differs.
 *
 * Flow automations report the stats strip's window; comment automations report
 * lifetime, because that is all their service exposes. Showing both as one bare
 * number without saying so would quietly compare two different measures.
 */
function SavedCell({ row }: { readonly row: AutomationHomeRow }): React.ReactElement {
  const formatted = formatSavedDuration(row.savedHours);
  if (!formatted) return <span className="text-muted-foreground">—</span>;

  const value = <span className="text-foreground">{formatted}</span>;
  if (row.source !== "comment") return value;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dotted border-muted-foreground/50">{value}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <p>{LIFETIME_SAVED_HINT}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export interface AutomationHomeRowProps {
  readonly row: AutomationHomeRow;
  readonly busy: boolean;
  /**
   * Clock for the relative "Modified" column, owned by the list so it is read
   * on the client only — formatting a relative time during render would make
   * the server and first client paint disagree.
   */
  readonly now: Date | null;
  /** Page id → profile, resolved once by the list rather than per row. */
  readonly pageProfiles: PageProfileLookup;
  /** Workspace account names, resolved once by the list rather than per row. */
  readonly accountLookup: ReadonlyMap<string, string>;
  readonly onOpen: (row: AutomationHomeRow) => void;
  readonly onToggle: (row: AutomationHomeRow, enabled: boolean) => void;
  readonly onApprove: (row: AutomationHomeRow) => void;
  readonly onReview: (row: AutomationHomeRow) => void;
  readonly canManage: boolean;
  readonly menuHandlers: AutomationHomeRowMenuHandlers;
}

/**
 * One automation in the home list: what it is, what state it is in, what it is
 * doing right now, what it has saved, and whether it is on.
 */
export function AutomationHomeListRow({
  row,
  busy,
  now,
  pageProfiles,
  accountLookup,
  onOpen,
  onToggle,
  onApprove,
  onReview,
  canManage,
  menuHandlers,
}: AutomationHomeRowProps): React.ReactElement {
  const lastRunLabel = formatAutomationTimestamp(row.lastRunAt);
  // The cell shows "12m ago"; the tooltip carries the exact time behind it.
  const modifiedTitle = row.updatedAt ? formatAutomationTimestamp(row.updatedAt) : undefined;

  return (
    <div
      className={cn(
        HOME_ROW_GRID,
        "border-t border-border/60 px-4 py-4 transition-colors",
        // Zebra striping so the eye can track a row across ten columns without
        // losing its line. `even:` counts siblings in the DOM, so the banding
        // stays correct as filters and search change which rows are rendered.
        "even:bg-muted/30",
        // Hover has to out-rank the stripe, or hovering a banded row looks dead.
        "hover:bg-muted/60 even:hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="order-1 flex min-w-0 items-center gap-2.5 text-left md:order-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 flex-col items-start gap-px">
          <TruncatedText
            className={cn(
              "max-w-full text-[13px] font-medium leading-tight",
              row.state === "paused" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {row.name}
          </TruncatedText>
          <TruncatedText className="max-w-full text-[11.5px] leading-tight text-muted-foreground">
            {row.subtitle ? `${row.displayId} · ${row.subtitle}` : row.displayId}
          </TruncatedText>
          <span className="mt-2 max-w-full">
            <StepIcons services={row.stepServices} />
          </span>
        </span>
      </button>

      <div className="order-4 col-span-3 min-w-0 md:order-none md:col-span-1">
        <StateBadge row={row} />
      </div>

      <div className="order-5 col-span-3 flex min-w-0 flex-col gap-1.5 md:order-none md:col-span-1">
        <RightNowCell
          rightNow={row.rightNow}
          busy={busy}
          onApprove={() => onApprove(row)}
          onReview={() => onReview(row)}
          onViewRun={() => menuHandlers.onViewHistory(row)}
        />
        {row.nextRunLabel && (
          <TruncatedText
            className={cn(
              "max-w-full text-[11.5px] leading-tight",
              row.nextRunWarning ? "font-medium text-amber-600" : "text-muted-foreground",
            )}
          >
            {row.nextRunWarning
              ? `Next run ${row.nextRunLabel} — ${row.nextRunWarning}`
              : `Next run ${row.nextRunLabel}`}
          </TruncatedText>
        )}
      </div>

      <div className="hidden min-w-0 2xl:block">
        <AccountCell
          accountId={row.accountId}
          accountName={row.accountName}
          pageIds={row.pageIds}
          pageProfiles={pageProfiles}
          accountLookup={accountLookup}
        />
      </div>

      <div className="hidden min-w-0 2xl:block">
        <TruncatedText className="text-[11.5px] text-muted-foreground">{lastRunLabel}</TruncatedText>
      </div>

      <div className="hidden text-right text-[11.5px] tabular-nums text-muted-foreground 2xl:block">
        {row.runCount > 0 ? row.runCount.toLocaleString("en-US") : "—"}
      </div>

      <div className="hidden min-w-0 2xl:block">
        <TruncatedText
          className="text-[11.5px] text-muted-foreground"
          tooltip={modifiedTitle}
          alwaysShow={Boolean(modifiedTitle)}
        >
          {now ? formatModifiedAgo(row.updatedAt, now) : "—"}
        </TruncatedText>
      </div>

      <div className="hidden text-[13px] font-semibold tabular-nums 2xl:block">
        <SavedCell row={row} />
      </div>

      <div className="hidden justify-center 2xl:flex">
        <OwnerAvatar initials={row.ownerInitials} email={row.ownerEmail} />
      </div>

      <div className="order-2 md:order-none">
        <RowSwitch row={row} onToggle={(enabled) => onToggle(row, enabled)} />
      </div>

      <div className="order-3 flex justify-end md:order-none">
        <AutomationHomeRowActions row={row} canManage={canManage} isBusy={busy} handlers={menuHandlers} />
      </div>
    </div>
  );
}
