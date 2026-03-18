'use client';
import { useRouter } from 'next/navigation';

const calculators = [
  { href: '/app/calculators/readiness', title: 'Retirement Readiness', description: 'See whether your current plan is on track for retirement under your assumptions.', icon: '✓', color: 'green' },
  { href: '/app/calculators/savings-gap', title: 'Savings Gap', description: 'Find out how much more you may need to save or how spending needs to change.', icon: '↑', color: 'blue' },
  { href: '/app/calculators/income-projection', title: 'Retirement Income Projection', description: 'See how your retirement income is projected to be funded year by year.', icon: '~', color: 'purple' },
  { href: '/app/calculators/withdrawal', title: 'Withdrawal Calculator', description: 'Understand whether your planned withdrawals are sustainable through your planning horizon.', icon: '$', color: 'orange' },
  { href: '/app/calculators/years-until-retirement', title: 'Years Until Retirement', description: 'See your path to retirement with projected assets, income, and gaps at your target date.', icon: '→', color: 'teal' },
];

const colors: Record<string, string> = {
  green: 'bg-green-50 border-green-200 text-green-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
};

export default function CalculatorsPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planning Calculators</h1>
        <p className="text-slate-500 mt-1">All calculators use your household data and the same projection engine.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {calculators.map(c => (
          <button key={c.href} onClick={() => router.push(c.href)}
            className="text-left p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-lg font-bold mb-3 ${colors[c.color]}`}>{c.icon}</div>
            <h2 className="font-semibold text-slate-900 mb-1">{c.title}</h2>
            <p className="text-sm text-slate-500">{c.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
