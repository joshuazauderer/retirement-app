import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/app/settings/security"
          className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Security</h2>
          <p className="text-sm text-slate-500">
            Change your password and manage account security settings.
          </p>
        </Link>
        <Link
          href="/app/settings/access"
          className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Access Management</h2>
          <p className="text-sm text-slate-500">
            Invite collaborators, advisors, and viewers to your household. Manage roles and permissions.
          </p>
        </Link>
        <Link
          href="/app/settings/billing"
          className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Billing & Subscription</h2>
          <p className="text-sm text-slate-500">
            Manage your plan, billing details, and feature access.
          </p>
        </Link>
        <Link
          href="/app/settings/account"
          className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-red-300 hover:shadow-sm transition-all"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Account</h2>
          <p className="text-sm text-slate-500">
            Manage account-level settings including account closure.
          </p>
        </Link>
      </div>
    </div>
  );
}
