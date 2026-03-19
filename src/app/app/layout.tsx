import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_ITEMS = [
  { href: "/app/overview", label: "Overview" },
  { href: "/app/income", label: "Income" },
  { href: "/app/assets", label: "Assets" },
  { href: "/app/liabilities", label: "Liabilities" },
  { href: "/app/expenses", label: "Expenses" },
  { href: "/app/benefits", label: "Benefits" },
  { href: "/app/housing", label: "Housing" },
  { href: "/app/insurance", label: "Insurance" },
  { href: "/app/assumptions", label: "Assumptions" },
  { href: "/app/simulations", label: "Simulations" },
  { href: "/app/scenarios", label: "Scenarios" },
  { href: "/app/monte-carlo", label: "Monte Carlo" },
  { href: "/app/withdrawal-strategies", label: "Withdrawal" },
  { href: "/app/sequence-risk", label: "Seq. Risk" },
  { href: "/app/social-security", label: "Social Sec." },
  { href: "/app/tax-planning", label: "Tax Planning" },
  { href: "/app/roth-conversions", label: "Roth" },
  { href: "/app/healthcare-planning", label: "Healthcare" },
  { href: "/app/longevity-stress", label: "Longevity" },
  { href: "/app/long-term-care-stress", label: "LTC Stress" },
  { href: "/app/housing-planning", label: "Housing Plan" },
  { href: "/app/downsizing", label: "Downsizing" },
  { href: "/app/legacy-planning", label: "Legacy" },
  { href: "/app/calculators", label: "Calculators" },
  { href: "/app/reports", label: "Reports" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/app/overview"
              className="font-bold text-lg text-slate-900"
            >
              RetirePlan
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {session.user?.name || session.user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
