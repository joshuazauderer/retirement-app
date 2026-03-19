"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { USER_MENU_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  userName: string | null;
  userEmail: string | null;
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export function UserMenu({ userName, userEmail }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const initials = getInitials(userName, userEmail);
  const displayName = userName || userEmail || "Account";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
          open && "bg-slate-100 text-slate-900"
        )}
      >
        {/* Avatar */}
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
          {initials}
        </span>
        <span className="hidden sm:block max-w-[120px] truncate font-medium">
          {displayName}
        </span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">{userName || "Account"}</p>
            {userEmail && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{userEmail}</p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            {USER_MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-slate-100 py-1">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
