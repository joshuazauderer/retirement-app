export default function BillingHelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Billing Help</h1>
      <p className="text-slate-600 leading-relaxed mb-8">
        Answers to common billing and subscription questions.
      </p>
      <div className="space-y-6">
        {[
          {
            q: "What plans are available?",
            a: "RetirePlan offers three tiers: Free, Pro, and Advisor. Free gives you access to core planning tools. Pro unlocks advanced analyses and AI features. Advisor tier is designed for financial professionals managing multiple client households.",
          },
          {
            q: "How do I upgrade or change my plan?",
            a: "Go to Settings → Billing in the app. You can upgrade, downgrade, or cancel your subscription from there at any time.",
          },
          {
            q: "How do I cancel my subscription?",
            a: "You can cancel at any time from Settings → Billing. Your access will continue until the end of your current billing period.",
          },
          {
            q: "What payment methods do you accept?",
            a: "We accept all major credit and debit cards via Stripe. All payment processing is handled securely by Stripe — we never store your payment details.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-slate-100 pb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{q}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500">
        Still have questions?{" "}
        <a href="/contact" className="text-blue-600 hover:underline">Contact us</a>.
      </p>
    </div>
  );
}
