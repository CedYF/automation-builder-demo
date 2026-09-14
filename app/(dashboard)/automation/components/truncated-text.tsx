"use client";

import { useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { shouldShowTruncationTooltip } from "../lib/truncation-tooltip";

interface TruncatedTextProps {
  /** What the cell renders. Truncated with an ellipsis when it overflows. */
  readonly children: ReactNode;
  /** What the tooltip reveals. Defaults to the rendered text. */
  readonly tooltip?: ReactNode;
  /**
   * Open even when the text fits, for a tooltip that adds information the cell
   * does not show — the exact timestamp behind "12m ago", say.
   */
  readonly alwaysShow?: boolean;
  readonly className?: string;
  readonly side?: "top" | "right" | "bottom" | "left";
}

/**
 * A truncating line of text that reveals its full value on hover.
 *
 * The open decision is made from the element's measured width at the moment the
 * pointer arrives, so a cell whose text already fits stays silent. That is the
 * part a native `title` cannot do: it fires on every cell regardless, which
 * teaches people that hovering tells them nothing new.
 *
 * Measuring on open rather than on mount keeps it correct through column
 * resizes and font loading without an observer per cell.
 */
export function TruncatedText({
  children,
  tooltip,
  alwaysShow = false,
  className,
  side = "top",
}: TruncatedTextProps): ReactElement {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setIsOpen(false);
        return;
      }
      const element = textRef.current;
      setIsOpen(
        shouldShowTruncationTooltip({
          scrollWidth: element?.scrollWidth ?? 0,
          clientWidth: element?.clientWidth ?? 0,
          alwaysShow,
        }),
      );
    },
    [alwaysShow],
  );

  return (
    <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span ref={textRef} className={cn("block truncate", className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[360px] break-words">
        {tooltip ?? children}
      </TooltipContent>
    </Tooltip>
  );
}
