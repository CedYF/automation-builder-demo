"use client";

import { Archive, Copy, Download, History, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AUTOMATION_DUPLICATE_PERMISSION_BLOCKED,
  canDuplicateAutomationSource,
  describeDuplicateAutomationBlock,
} from "@/lib/automation/duplicate-automation-rule";
import {
  canArchiveHomeAutomation,
  canDeleteHomeAutomation,
  canExportHomeAutomation,
  canRenameHomeAutomation,
  describeArchiveAutomationBlock,
  describeExportAutomationBlock,
} from "@/lib/automation/home-automation-actions";
import type { AutomationHomeRow } from "@/lib/automation/home-summary";

export interface AutomationHomeRowMenuHandlers {
  readonly onRename: (row: AutomationHomeRow) => void;
  readonly onDuplicate: (row: AutomationHomeRow) => void;
  readonly onViewHistory: (row: AutomationHomeRow) => void;
  readonly onExport: (row: AutomationHomeRow) => void;
  readonly onArchive: (row: AutomationHomeRow) => void;
  readonly onDelete: (row: AutomationHomeRow) => void;
}

export interface AutomationHomeRowActionsProps {
  readonly row: AutomationHomeRow;
  readonly canManage: boolean;
  readonly isBusy: boolean;
  readonly handlers: AutomationHomeRowMenuHandlers;
}

/**
 * Always-visible row menu for rename, duplicate, history, export, archive and
 * delete — the actions the older automations table already offered.
 */
export function AutomationHomeRowActions({
  row,
  canManage,
  isBusy,
  handlers,
}: AutomationHomeRowActionsProps): React.ReactElement {
  const canRename = canRenameHomeAutomation(canManage);
  const canDuplicate = canDuplicateAutomationSource(row.source, canManage);
  const canExport = canExportHomeAutomation(row.source);
  const canArchive = canArchiveHomeAutomation(row.source, canManage);
  const canDelete = canDeleteHomeAutomation(canManage);
  const isComment = row.source === "comment";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${row.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem
          disabled={!canRename || isBusy}
          title={canRename ? undefined : AUTOMATION_DUPLICATE_PERMISSION_BLOCKED}
          onClick={() => handlers.onRename(row)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDuplicate || isBusy}
          title={describeDuplicateAutomationBlock(row.source, canManage) ?? undefined}
          onClick={() => handlers.onDuplicate(row)}
        >
          <Copy className="mr-2 h-4 w-4" />
          {isBusy ? "Working..." : "Duplicate"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isBusy} onClick={() => handlers.onViewHistory(row)}>
          <History className="mr-2 h-4 w-4" />
          {isComment ? "Edit in Builder" : "View History"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canExport || isBusy}
          title={describeExportAutomationBlock(row.source) ?? undefined}
          onClick={() => handlers.onExport(row)}
        >
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canArchive || isBusy}
          title={describeArchiveAutomationBlock(row.source, canManage) ?? undefined}
          onClick={() => handlers.onArchive(row)}
        >
          <Archive className="mr-2 h-4 w-4" />
          {row.isArchived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={!canDelete || isBusy}
          title={canDelete ? undefined : AUTOMATION_DUPLICATE_PERMISSION_BLOCKED}
          onClick={() => handlers.onDelete(row)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
