import { FaTiktok } from "react-icons/fa";

import { cn } from "@/lib/utils";
import ChatGptIcon from "@/components/ui/icons/chatgpt";
import Meta from "@/components/ui/icons/meta";
import { Google } from "@/components/ui/icons/google";
import { Axon } from "@/components/ui/icons/axon";
import Snapchat from "@/components/ui/icons/snapchat";
import Pinterest from "@/components/ui/icons/pinterest";
import Taboola from "@/components/ui/icons/taboola";
import { Reddit } from "@/components/ui/icons/reddit";
import LinkedIn from "@/components/ui/icons/linkedin";
import { Mintegral } from "@/components/ui/icons/mintegral";
import X from "@/components/ui/icons/x";

const AD_ACCOUNT_PLATFORM_ICON_CLASS = "shrink-0 w-4 h-4";

/**
 * Brand icon for an ad account's platform, matching the launch account picker
 * (chooseAdAccount2). Falls back to the Meta mark for unknown/blank types.
 */
export function AdAccountPlatformIcon({ type, className }: { type?: string | null; className?: string }) {
  const platform = String(type || "").toLowerCase();
  const cls = cn(AD_ACCOUNT_PLATFORM_ICON_CLASS, className);

  if (platform === "chatgpt_ads") return <ChatGptIcon className={cls} />;
  if (platform === "tiktok") return <FaTiktok className={cn(cls, "text-muted-foreground")} aria-hidden="true" />;
  if (platform === "google_ads") return <Google className={cls} aria-hidden="true" />;
  if (platform === "axon") return <Axon className={cls} aria-hidden="true" />;
  if (platform === "snapchat") return <Snapchat className={cls} grayscale={false} aria-hidden="true" />;
  if (platform === "pinterest")
    return <Pinterest className={cn(cls, "text-[#E60023]")} grayscale={false} aria-hidden="true" />;
  if (platform === "taboola") return <Taboola className={cn(cls, "text-[#1F78FF]")} aria-hidden="true" />;
  if (platform === "reddit") return <Reddit className={cls} aria-hidden="true" />;
  if (platform === "linkedin") return <LinkedIn className={cls} aria-hidden="true" />;
  if (platform === "mintegral") return <Mintegral className={cls} aria-hidden="true" />;
  if (platform === "x") return <X className={cls} aria-hidden="true" />;

  return <Meta className={cls} grayscale={false} aria-hidden="true" />;
}
