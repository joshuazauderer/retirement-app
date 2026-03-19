"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  NAV_SECTIONS,
  USER_MENU_ITEMS,
  getActiveSection,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

type MobileNavDrawerProps = {
  userName: string | null;
  userEmail: string | null;
};

export function MobileNavDrawer({ userName, userEmail }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const activeSection = getActiveSection(pathname);
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    activeSection?.id ?? null
  );

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col shadow-xl md:hidden",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-modal="true"
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <Link href="/app/overview" className="text-lg font-bold text-slate-900" onClick={() => setOpen(false)}>
            RetirePlan
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable nav items */}
        <div className="flex-1 overflow-y-auto py-3">
          {NAV_SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            const isActive = activeSection?.id === section.id;
            return (
              <div key={section.id}>
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "text-blue-700" : "text-slate-700 hover:text-slate-900"
                  )}
                >
                  {section.label}
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                </button>
                {isExpanded && (
                  <div className="pl-4 pb-1">
                    {section.subItems.map((sub) => {
                      const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center px-4 py-2 text-sm rounded-lg transition-colors",
                            isSubActive
                              ? "text-blue-700 font-medium bg-blue-50"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                          onClick={() => setOpen(false)}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Settings separator */}
          <div className="mx-4 my-3 border-t border-slate-100" />
          <p className="px-4 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            Account
          </p>
          {USER_MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* User footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          {(userName || userEmail) && (
            <p className="text-xs text-slate-500 mb-2 truncate">
              {userName || userEmail}
            </p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
