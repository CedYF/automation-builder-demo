"use client";

import type { CSSProperties, SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Official Mintegral mint (from mintegral.com / favicon assets). */
const MINTEGRAL_MINT = "#00D1AE";
/** Official Mintegral yellow (from mintegral.com / favicon assets). */
const MINTEGRAL_YELLOW = "#FFCE00";

interface MintegralProps extends SVGProps<SVGSVGElement> {
  grayscale?: boolean;
}

/**
 * Official Mintegral brand mark — the mint + yellow dual bar (2:1) from the
 * 2022 Mobvista-aligned identity. Kept in brand colors so the mark reads at
 * small sizes; pass `grayscale` to mute it.
 */
export function Mintegral({ className, grayscale = false, style, ...props }: MintegralProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("block shrink-0", className)}
      style={
        {
          ...style,
          filter: grayscale ? "grayscale(100%)" : style?.filter,
        } as CSSProperties
      }
      aria-hidden="true"
      {...props}
    >
      <rect x="0" y="8" width="16" height="8" fill={MINTEGRAL_MINT} />
      <rect x="16" y="8" width="8" height="8" fill={MINTEGRAL_YELLOW} />
    </svg>
  );
}

export default Mintegral;
