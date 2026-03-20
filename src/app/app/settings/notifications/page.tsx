'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NotificationPreferenceRecord } from '@/server/notifications/types';

interface DigestSection {
  heading: string;
  items: string[];
}

interface DigestPreview {
  householdName:    string;
  userFirstName:    string;
  periodLabel:      string;
  sections:         DigestSection[];
  planHealthSummary: string;
}

interface PreferencesPayload {
  preferences: NotificationPreferenceRecord;
}

interface DigestPreviewPayload {
  preview:  DigestPreview | null;
  message?: string;
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked:     boolean;
  onChange:    (v: boolean) => void;
  label:       string;
  description: string;
  disabled?:   boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [prefs,          setPrefs]          = useState<NotificationPreferenceRecord | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saveSuccess,    setSaveSuccess]    = useState(false);
  const [digest,         setDigest]         = useState<DigestPreview | null>(null);
  const [digestLoading,  setDigestLoading]  = useState(false);
  const [digestMessage,  setDigestMessage]  = useState<string>('');

  // ── Load preferences ────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/notifications/preferences');
        if (!res.ok) return;
        const data = await res.json() as PreferencesPayload;
        setPrefs(data.preferences);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Save preferences ────────────────────────────────────────────────────────

  const savePrefs = useCallback(async (updated: Partial<NotificationPreferenceRecord>) => {
    if (!prefs) return;
    setSaving(true);
    setSaveSuccess(false);

    const next = { ...prefs, ...updated };
    setPrefs(next);

    try {
      const res = await fetch('/api/notifications/preferences', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json() as PreferencesPayload;
        setPrefs(data.preferences);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      }
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  // ── Load digest preview ─────────────────────────────────────────────────────

  const loadDigestPreview = useCallback(async () => {
    setDigestLoading(true);
    setDigest(null);
    setDigestMessage('');

    try {
      const freq = prefs?.digestFrequency === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';
      const res  = await fetch(`/api/notifications/digest/preview?frequency=${freq}`);
      if (!res.ok) return;
      const data = await res.json() as DigestPreviewPayload;
      if (data.preview) {
        setDigest(data.preview);
      } else {
        setDigestMessage(data.message ?? 'No digest preview available.');
      }
    } finally {
      setDigestLoading(false);
    }
  }, [prefs?.digestFrequency]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="text-center py-24 text-slate-500">
        Unable to load notification preferences.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notification Preferences</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Control how and when RetirePlan notifies you about your retirement plan.
        </p>
      </div>

      {/* Save feedback */}
      {(saving || saveSuccess) && (
        <div className={`flex items-center gap-2 text-sm ${saveSuccess ? 'text-green-700' : 'text-slate-500'}`}>
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" />
              Saving…
            </>
          ) : (
            <>✓ Preferences saved</>
          )}
        </div>
      )}

      {/* Email Digest section */}
      <section className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Email Digest</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive a summary of your retirement plan by email.
          </p>
        </div>

        <div className="px-6">
          <Toggle
            checked={prefs.emailDigest}
            onChange={(v) => void savePrefs({ emailDigest: v })}
            label="Enable email digest"
            description="Receive a periodic summary of your plan, simulations, and risk indicators."
          />
        </div>

        {prefs.emailDigest && (
          <div className="px-6 py-4">
            <p className="text-sm font-medium text-slate-900 mb-2">Digest frequency</p>
            <div className="flex gap-3">
              {(['WEEKLY', 'MONTHLY', 'NEVER'] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => void savePrefs({ digestFrequency: freq })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    prefs.digestFrequency === freq
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {freq.charAt(0) + freq.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Alert types section */}
      <section className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Alert Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Get notified when important events occur in your plan.
          </p>
        </div>

        <div className="px-6 divide-y divide-slate-50">
          <Toggle
            checked={prefs.planRiskAlerts}
            onChange={(v) => void savePrefs({ planRiskAlerts: v })}
            label="Plan risk alerts"
            description="Notified when Monte Carlo success rate drops below safety thresholds or portfolio depletion is detected."
          />
          <Toggle
            checked={prefs.collaborationAlerts}
            onChange={(v) => void savePrefs({ collaborationAlerts: v })}
            label="Collaboration alerts"
            description="Notified when someone invites you to a household plan or accepts your invitation."
          />
          <Toggle
            checked={prefs.billingAlerts}
            onChange={(v) => void savePrefs({ billingAlerts: v })}
            label="Billing alerts"
            description="Notified about payment failures, subscription changes, and trial expiration."
          />
          <Toggle
            checked={prefs.simulationAlerts}
            onChange={(v) => void savePrefs({ simulationAlerts: v })}
            label="Simulation completion"
            description="Notified when a simulation or Monte Carlo run finishes."
          />
        </div>
      </section>

      {/* Digest preview section */}
      <section className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Digest Preview</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              See what your next digest email will look like.
            </p>
          </div>
          <button
            onClick={() => void loadDigestPreview()}
            disabled={digestLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {digestLoading ? 'Loading…' : 'Preview Digest'}
          </button>
        </div>

        {digestMessage && !digest && (
          <div className="px-6 py-6 text-sm text-slate-500 text-center">
            {digestMessage}
          </div>
        )}

        {digest && (
          <div className="px-6 py-4 space-y-4">
            {/* Plan health */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm text-green-800">📊 {digest.planHealthSummary}</p>
            </div>

            {/* Sections */}
            {digest.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-slate-900 mb-1 pb-1 border-b border-blue-200">
                  {section.heading}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="text-xs text-slate-600 flex gap-2">
                      <span className="text-slate-400 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {digest.sections.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No updates this period. Keep building your plan!
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
