"use client";

import { type ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
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

interface DeleteActivationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * One confirmation, shared by every place an automation can be turned on —
 * the builder header switch and the execution panel's post-run CTA — so
 * turning on a rule that permanently deletes comments always gets the same
 * explicit checkpoint no matter where the click came from.
 */
export function DeleteActivationConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteActivationConfirmDialogProps): ReactElement {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Turn on permanent deletion?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This automation will delete matching comments as they come in. Deleted comments can&apos;t be recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Turn it on
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
