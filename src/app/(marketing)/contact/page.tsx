'use client';

import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactPage() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Message sent!</h1>
          <p className="text-slate-600 mb-8">
            Thanks for reaching out, <strong>{form.name}</strong>. We'll get back to you at{' '}
            <strong>{form.email}</strong> as soon as possible.
          </p>
          <button
            onClick={() => {
              setForm({ name: '', email: '', subject: '', message: '' });
              setState('idle');
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Contact Us</h1>
      <p className="text-slate-600 leading-relaxed mb-8">
        We&apos;d love to hear from you. Whether you have a question, feedback, or need support,
        fill out the form below and we&apos;ll get back to you as quickly as possible.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name + Email side by side on larger screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={255}
              value={form.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1.5">
            Subject <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            maxLength={200}
            value={form.subject}
            onChange={handleChange}
            placeholder="What's this about?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={form.message}
            onChange={handleChange}
            placeholder="Tell us how we can help..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-y"
          />
          <p className="mt-1 text-xs text-slate-400 text-right">
            {form.message.length}/5000
          </p>
        </div>

        {state === 'error' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={state === 'submitting'}
          className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {state === 'submitting' ? 'Sending\u2026' : 'Send message'}
        </button>
      </form>
    </div>
  );
}
