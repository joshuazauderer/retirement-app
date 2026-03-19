"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, getActiveSection } from "@/config/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { cn } from "@/lib/utils";

type AppTopNavProps = {
  userName: string | null;
  userEmail: string | null;
};

export function AppTopNav({ userName, userEmail }: AppTopNavProps) {
  const pathname = usePathname();
  const activeSection = getActiveSection(pathname);

  // Also mark Settings as a pseudo-section
  const isSettings = pathname.startsWith("/app/settings");

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-4 gap-4">
        {/* Left: Logo + primary nav */}
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/app/overview"
            className="shrink-0 text-base font-bold text-slate-900 tracking-tight"
          >
            RetirePlan
          </Link>

          {/* Primary nav — desktop only */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Primary navigation">
            {NAV_SECTIONS.map((section) => {
              const isActive = activeSection?.id === section.id;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={cn(
                    "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "text-blue-700 bg-blue-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {section.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-blue-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Notifications + User menu + Mobile hamburger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <NotificationBell />
          <div className="hidden md:block">
            <UserMenu userName={userName} userEmail={userEmail} />
          </div>
          <MobileNavDrawer userName={userName} userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
