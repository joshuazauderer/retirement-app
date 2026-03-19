export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Help Center</h1>
      <p className="text-slate-600 leading-relaxed mb-8">
        Find answers to common questions about using RetirePlan.
      </p>
      <div className="space-y-6">
        {[
          {
            q: "How does the retirement simulation work?",
            a: "RetirePlan uses both deterministic projections and Monte Carlo simulations to model your retirement trajectory. Deterministic projections apply fixed assumptions year by year, while Monte Carlo runs thousands of scenarios with variable returns to calculate your probability of success.",
          },
          {
            q: "Is my data secure?",
            a: "Yes. All data is encrypted in transit and at rest. We use industry-standard security practices and never sell your personal or financial data.",
          },
          {
            q: "Can I invite a financial advisor to view my plan?",
            a: "Yes. Go to Settings → Access to invite collaborators. You control their access level.",
          },
          {
            q: "What does the Plan Health Score measure?",
            a: "The Plan Health Score is a composite 0–100 score across seven components: portfolio sufficiency, income replacement, debt load, healthcare preparedness, longevity coverage, emergency buffer, and profile completeness.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-slate-100 pb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{q}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
