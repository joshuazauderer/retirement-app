export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Support</h1>
      <p className="text-slate-600 leading-relaxed mb-6">
        Our support team is here to help. Browse common topics below or contact us directly.
      </p>
      <div className="space-y-3">
        {[
          "Getting started with RetirePlan",
          "Managing your household financial data",
          "Understanding simulation results",
          "Billing and subscription questions",
          "Account and access management",
        ].map((topic) => (
          <div key={topic} className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-sm text-slate-700">{topic}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500">
        Can&apos;t find what you need?{" "}
        <a href="/contact" className="text-blue-600 hover:underline">Contact us directly</a>.
      </p>
    </div>
  );
}
