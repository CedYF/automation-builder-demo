"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Files, MessageSquareText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The second sidebar panel, showing the active category's pages.
 *
 * In the app this is resizable, remembers its width in a cookie, and renders a
 * different nav list per category plus credits, notifications and an org
 * switcher. Here it is fixed-width and shows the Automate category only, which
 * is the one category this repo ships.
 *
 * The nav entries are the real ones from `hooks/use-nav-items.ts` minus `/rules`,
 * which is a separate page that did not come across.
 */

const DETAIL_SIDEBAR_WIDTH_PX = 192;

interface DetailNavItem {
  readonly title: string;
  readonly url: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  /** Query string that must be present for this entry to read as active. */
  readonly activeTab?: string;
}

const AUTOMATE_NAV_ITEMS: readonly DetailNavItem[] = [
  { title: "Chat", url: "/automation", icon: MessageSquareText, activeTab: "chat" },
  { title: "Automations", url: "/automation?tab=automations&view=table", icon: Zap, activeTab: "automations" },
  { title: "Templates", url: "/automation?tab=templates&view=table", icon: Files, activeTab: "templates" },
  { title: "Admin analytics", url: "/automation/admin", icon: BarChart3 },
];

/** True when the item matches the current path and tab. */
function useIsActive(item: DetailNavItem): boolean {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");

  if (item.url === "/automation/admin") return pathname === "/automation/admin";
  if (pathname !== "/automation") return false;
  return item.activeTab === "chat" ? tab === null || tab === "chat" : tab === item.activeTab;
}

function DetailNavLink({ item }: { item: DetailNavItem }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;

  return (
    <Link
      href={item.url}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.title}
    </Link>
  );
}

export function DetailSidebar() {
  const style = { "--detail-sidebar-width": `${DETAIL_SIDEBAR_WIDTH_PX}px` } as React.CSSProperties;

  return (
    <>
      {/* Spacer that pushes page content clear of the fixed panel. */}
      <div className="hidden w-[var(--detail-sidebar-width)] shrink-0 md:block" style={style} />

      <div
        style={style}
        className="fixed inset-y-0 left-16 z-30 hidden w-[var(--detail-sidebar-width)] flex-col overflow-hidden border-r border-white/5 bg-sidebar md:flex"
      >
        <div className="flex h-16 shrink-0 items-center px-4">
          <h2 className="text-sm font-semibold text-sidebar-foreground">Automate</h2>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {AUTOMATE_NAV_ITEMS.map((item) => (
            <DetailNavLink key={item.title} item={item} />
          ))}
        </nav>

      </div>
    </>
  );
}
