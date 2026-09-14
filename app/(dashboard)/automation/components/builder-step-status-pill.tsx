"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { BuilderStepStatus } from "../lib/builder-readiness";

interface BuilderStepStatusStyle {
  readonly pill: string;
  readonly dot: string;
}

/**
 * One palette for every surface that reports step readiness — the canvas card,
 * the header context bar and the collapsed inspector rail — so a step never
 * looks amber in one place and green in another.
 */
export const BUILDER_STEP_STATUS_STYLES: Readonly<Record<BuilderStepStatus, BuilderStepStatusStyle>> = {
  ready: { pill: "bg-green-100 text-green-700", dot: "bg-green-500" },
  "needs-setup": { pill: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  error: { pill: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

interface BuilderStepStatusPillProps {
  readonly status: BuilderStepStatus;
  readonly label: string;
  readonly title?: string;
  readonly className?: string;
}

export function BuilderStepStatusPill({ status, label, title, className }: BuilderStepStatusPillProps): ReactElement {
  const style = BUILDER_STEP_STATUS_STYLES[status];
  return (
    <span
      data-testid={`builder-step-status-${status}`}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        style.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );
}
