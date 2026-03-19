import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

const STARTER_CONCEPTS = [
  { label: 'What is sequence-of-returns risk?', desc: 'Learn how early market downturns affect your plan' },
  { label: 'What is a safe withdrawal rate?', desc: 'Understand the 4% rule and its limitations' },
  { label: 'What is a Roth conversion?', desc: 'How moving money to Roth can reduce future taxes' },
  { label: 'What is depletion risk?', desc: 'The core risk retirement planning addresses' },
  { label: 'What is Medicare?', desc: 'Health coverage starting at age 65' },
  { label: 'What is Monte Carlo simulation?', desc: 'How probability-based projections work' },
];

export default async function CopilotPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-slate-500">No household found. Please complete onboarding first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">AI Planning Copilot</h1>
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <p className="text-slate-500 text-sm">
          Ask questions about your retirement plan in plain language.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <strong>Planning tool, not financial advice.</strong> All insights are grounded in your plan data and use planning-grade estimates.
        Consult a licensed financial professional for personalized guidance.
      </div>

      <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Chat panel */}
        <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <CopilotPanel householdId={householdId} className="h-full" />
        </div>

        {/* Side panel — desktop only */}
        <div className="hidden lg:flex flex-col w-72 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Concepts you can ask about</h2>
            <div className="space-y-2">
              {STARTER_CONCEPTS.map((c) => (
                <div key={c.label} className="p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <p className="text-xs font-medium text-slate-700">{c.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Try asking</h2>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Does my plan work?</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>What are the biggest risks?</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>What if I retire at 62?</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>How can I reduce my tax burden?</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>How much would downsizing help?</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
