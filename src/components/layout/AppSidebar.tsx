"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_SECTIONS,
  SETTINGS_SUB_ITEMS,
  getActiveSection,
  getActiveSubItemHref,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const activeSection = getActiveSection(pathname);
  const activeSubHref = getActiveSubItemHref(pathname);

  // Determine which sub-items to show
  const isSettingsPath = pathname.startsWith("/app/settings");
  const subItems = isSettingsPath
    ? SETTINGS_SUB_ITEMS
    : (activeSection?.subItems ?? null);
  const sectionLabel = isSettingsPath
    ? "Settings"
    : (activeSection?.label ?? null);

  // No sidebar for unknown sections
  if (!subItems || subItems.length <= 1) return null;

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-3.5rem)]">
      <div className="px-3 py-5 flex-1">
        {sectionLabel && (
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">
            {sectionLabel}
          </p>
        )}
        <nav className="space-y-0.5">
          {subItems.map((item) => {
            const isActive = activeSubHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-2.5 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
