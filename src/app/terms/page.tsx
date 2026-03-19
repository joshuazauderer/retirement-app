export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: March 2026</p>
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Acceptance of Terms</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            By accessing or using RetirePlan, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, do not use the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Not Financial Advice</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            RetirePlan provides planning tools and projections for informational purposes only.
            Nothing on this platform constitutes financial, investment, tax, or legal advice.
            Please consult qualified professionals before making financial decisions.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Account Responsibilities</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            You are responsible for maintaining the security of your account and for all activity
            that occurs under your account.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Contact</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            For questions about these terms, contact legal@retireplan.app.
          </p>
        </section>
      </div>
    </div>
  );
}
