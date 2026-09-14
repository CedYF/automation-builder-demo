"use client";

/**
 * Which pages a manual Run should act on.
 *
 * A comment automation is one rule per page, and Run has always fanned out over
 * every one of them — fine for a handful of new comments, expensive when a
 * six-page automation rescans 20,000. This picks the subset, so "just re-run
 * Instagram" is one click rather than a reason to avoid the button.
 *
 * Every page starts ticked: the dialog is opt-in from the Run menu, so the
 * default has to match what plain Run does.
 */

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PageAvatar } from "./run-page-filter";
import type { CommentAutomationMember } from "../hooks/use-comment-automation-members";

interface RunPagesDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Every per-page rule of the automation, paired with its page. */
  readonly members: readonly CommentAutomationMember[];
  /** Runs the automation on exactly these rules. */
  readonly onRun: (ruleIds: readonly number[]) => void;
  /** True while a run is starting, so the dialog cannot be double-submitted. */
  readonly isStarting?: boolean;
}

function pageLabelFor(member: CommentAutomationMember): string {
  return member.pageName?.trim() || member.pageId;
}

/**
 * The page's own id, copyable.
 *
 * Every Meta support thread, Graph call and database query is keyed on the page
 * id, not its name — so the picker is the natural place to lift it from rather
 * than digging through the rule rows.
 */
function CopyPageId({ pageId }: { pageId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      // Inside a <label>: without this, clicking to copy also toggles the page.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void navigator.clipboard?.writeText(pageId).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => setCopied(false),
        );
      }}
      title={`Copy page id ${pageId}`}
      aria-label={`Copy page id ${pageId}`}
      className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <span className="truncate">{pageId}</span>
      {copied ? (
        <Check className="h-3 w-3 flex-shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 flex-shrink-0" />
      )}
    </button>
  );
}

export function RunPagesDialog({ open, onOpenChange, members, onRun, isStarting = false }: RunPagesDialogProps) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set(members.map((member) => member.id)));

  // Reopening starts from every page again, and a saved automation can gain or
  // lose pages between opens — a stale selection would silently skip a new one.
  useEffect(() => {
    if (open) setSelected(new Set(members.map((member) => member.id)));
  }, [open, members]);

  const allSelected = selected.size === members.length && members.length > 0;
  const toggle = (ruleId: number, checked: boolean): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(ruleId);
      else next.delete(ruleId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Run on selected pages</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border-b px-5 py-2">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {members.length} pages
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelected(allSelected ? new Set<number>() : new Set(members.map((member) => member.id)))}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {members.map((member) => {
            const name = pageLabelFor(member);
            const checked = selected.has(member.id);
            return (
              <label
                key={member.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60",
                  checked && "bg-muted/40",
                )}
              >
                <Checkbox checked={checked} onCheckedChange={(value) => toggle(member.id, value === true)} />
                <PageAvatar
                  pageId={member.pageId}
                  name={name}
                  picture={null}
                  className="h-6 w-6 flex-shrink-0 text-[9px]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm" title={name}>
                    {name}
                  </span>
                  <CopyPageId pageId={member.pageId} />
                </span>
                <span className="flex-shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {member.platform === "instagram" ? "IG" : "FB"}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isStarting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            disabled={selected.size === 0 || isStarting}
            onClick={() => onRun([...selected])}
          >
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {selected.size === members.length
              ? `Run on all ${members.length} pages`
              : `Run on ${selected.size} ${selected.size === 1 ? "page" : "pages"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
