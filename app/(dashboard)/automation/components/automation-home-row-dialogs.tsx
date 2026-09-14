"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AutomationHomeRow } from "@/lib/automation/home-summary";

export interface HomeRenameDialogProps {
  readonly row: AutomationHomeRow | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (name: string) => void;
}

export function HomeRenameDialog({ row, busy, onClose, onSubmit }: HomeRenameDialogProps): React.ReactElement {
  const [name, setName] = useState(row?.name ?? "");
  useEffect(() => {
    setName(row?.name ?? "");
  }, [row]);

  const trimmed = name.trim();
  const canSave = Boolean(row) && trimmed.length > 0 && trimmed !== row?.name && !busy;

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename automation</DialogTitle>
          <DialogDescription>This updates the name on the list and in the builder.</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Automation name"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) onSubmit(trimmed);
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(trimmed)} disabled={!canSave}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface HomeDeleteDialogProps {
  readonly row: AutomationHomeRow | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function HomeDeleteDialog({ row, busy, onClose, onConfirm }: HomeDeleteDialogProps): React.ReactElement {
  return (
    <AlertDialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{row?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the automation. History for past runs is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
