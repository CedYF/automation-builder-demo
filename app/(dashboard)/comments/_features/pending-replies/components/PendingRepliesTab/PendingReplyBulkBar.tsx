"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingReplyBulkBarProps {
  /** Ids of the drafts that can be selected on the current page. */
  readonly pendingIds: readonly number[];
  readonly selectedIds: ReadonlySet<number>;
  readonly isBulkApproving: boolean;
  readonly isBulkRejecting: boolean;
  readonly onToggleSelectAll: () => void;
  readonly onBulkApprove: () => void;
  readonly onBulkReject: () => void;
}

/**
 * Select-all plus bulk Approve / Reject for a drafted-replies queue. Always
 * visible while there is something to select, with the actions disabled until
 * a selection exists, so the bulk options are discoverable at a glance.
 */
export function PendingReplyBulkBar({
  pendingIds,
  selectedIds,
  isBulkApproving,
  isBulkRejecting,
  onToggleSelectAll,
  onBulkApprove,
  onBulkReject,
}: PendingReplyBulkBarProps): React.ReactElement | null {
  if (pendingIds.length === 0) return null;

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === pendingIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSelectAll}
          aria-label={allSelected ? "Deselect all" : "Select all"}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors cursor-pointer",
            selectedCount === 0 && "border-muted-foreground/40 bg-background",
            selectedCount > 0 && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {allSelected && <Check className="h-3 w-3" />}
          {someSelected && <span className="h-0.5 w-2 rounded bg-primary-foreground" />}
        </button>
        <Badge variant={selectedCount > 0 ? "secondary" : "outline"}>
          {selectedCount > 0
            ? `${selectedCount} of ${pendingIds.length} selected`
            : `Select all (${pendingIds.length})`}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkReject}
          disabled={isBulkRejecting || selectedCount === 0}
          className="h-7 text-xs"
        >
          {isBulkRejecting ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
          Reject {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
        <Button
          size="sm"
          onClick={onBulkApprove}
          disabled={isBulkApproving || selectedCount === 0}
          className="h-7 text-xs"
        >
          {isBulkApproving ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Approve {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
      </div>
    </div>
  );
}
