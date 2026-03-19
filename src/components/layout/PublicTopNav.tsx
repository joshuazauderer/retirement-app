import Link from "next/link";

export function PublicTopNav() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
        <Link
          href="/"
          className="text-base font-bold text-slate-900 tracking-tight"
        >
          RetirePlan
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
