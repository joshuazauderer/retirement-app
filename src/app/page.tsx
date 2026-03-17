import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-white font-bold text-xl">RetirePlan</div>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-blue-500 hover:bg-blue-400">Get Started</Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Your retirement,{" "}
          <span className="text-blue-400">planned right.</span>
        </h1>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Build a comprehensive retirement plan tailored to your household.
          Track your progress, model scenarios, and retire with confidence.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-6 text-lg">
              Start Planning — Free
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8 text-left">
          {[
            {
              title: "Household-aware",
              desc: "Plan for individuals, couples, and dependents with full household modeling.",
            },
            {
              title: "Scenario modeling",
              desc: "Run projections across different retirement ages, savings rates, and market conditions.",
            },
            {
              title: "Always up to date",
              desc: "Tax rules, contribution limits, and planning assumptions are kept current.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
