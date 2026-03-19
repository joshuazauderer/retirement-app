'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (msg: string) => void;
  disabled?: boolean;
  placeholder?: string;
  starterSuggestions?: string[];
}

export function ChatInput({ onSend, disabled, placeholder, starterSuggestions }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {starterSuggestions && starterSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {starterSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setValue(s); textareaRef.current?.focus(); }}
              disabled={disabled}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? 'Ask about your retirement plan...'}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-h-[40px] max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">
        Press Enter to send, Shift+Enter for a new line.
      </p>
    </div>
  );
}
