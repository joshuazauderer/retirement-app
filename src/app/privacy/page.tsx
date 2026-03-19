export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: March 2026</p>
      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Information We Collect</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            We collect information you provide directly to us, including account registration details,
            household financial information you enter into the platform, and usage data. We use this
            information to provide and improve our services.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">How We Use Your Information</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Your financial data is used exclusively to power your retirement planning simulations and
            analyses. We do not sell your personal or financial data to third parties.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Data Security</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            All data is encrypted in transit using TLS and encrypted at rest. Access to your data is
            controlled by role-based permissions.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Contact</h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            For privacy-related questions, contact us at privacy@retireplan.app.
          </p>
        </section>
      </div>
    </div>
  );
}
