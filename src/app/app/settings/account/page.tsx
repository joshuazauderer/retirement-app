"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phraseMatches = confirmationPhrase.trim().toUpperCase() === CONFIRMATION_PHRASE;

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phraseMatches) {
      setError(`Please type "${CONFIRMATION_PHRASE}" exactly to confirm`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/account/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmationPhrase }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to close account. Please try again.");
        return;
      }

      // Sign out and redirect to home
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Something went wrong. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your account settings.</p>
      </div>

      {/* Close Account Section */}
      <div className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Close Account</h2>
        <p className="text-sm text-slate-600 mb-4">
          Permanently close your RetirePlan account. This action cannot be undone.
        </p>

        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-2">
            Closing your account will:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            <li>Immediately revoke your access to RetirePlan</li>
            <li>Cancel any active subscriptions</li>
            <li>Remove you from all shared households</li>
            <li>Revoke any pending collaboration invitations</li>
            <li>Retain your data for compliance purposes</li>
          </ul>
        </div>

        <form onSubmit={handleClose} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="closePassword"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Confirm your password
            </label>
            <input
              id="closePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your current password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPhrase"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Type{" "}
              <span className="font-mono font-bold text-red-700">{CONFIRMATION_PHRASE}</span> to
              confirm
            </label>
            <input
              id="confirmPhrase"
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              required
              placeholder={CONFIRMATION_PHRASE}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {confirmationPhrase.length > 0 && !phraseMatches && (
              <p className="text-xs text-red-600 mt-1">
                Must match exactly: {CONFIRMATION_PHRASE}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !phraseMatches || !password}
              className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Closing account..." : "Close My Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
