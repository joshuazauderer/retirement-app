import Link from "next/link";
import { FOOTER_COLUMNS } from "@/config/navigation";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">RetirePlan</span>
          <span className="text-xs text-slate-400">
            © {year} RetirePlan. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
