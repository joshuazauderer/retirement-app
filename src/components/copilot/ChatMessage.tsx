'use client';

import type { ConversationMessage, IntentType } from '@/server/conversation/types';

interface ChatMessageProps {
  message: ConversationMessage;
  suggestions?: string[];
  onSuggestionClick?: (s: string) => void;
}

const INTENT_BADGE_COLORS: Record<IntentType, string> = {
  EXPLAIN: 'bg-blue-100 text-blue-700',
  MODIFY: 'bg-purple-100 text-purple-700',
  COMPARE: 'bg-indigo-100 text-indigo-700',
  RISK: 'bg-red-100 text-red-700',
  RECOMMEND: 'bg-green-100 text-green-700',
  CLARIFY: 'bg-yellow-100 text-yellow-700',
  UNKNOWN: 'bg-slate-100 text-slate-600',
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatMessage({ message, suggestions, onSuggestionClick }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content}
      </div>

      {/* Badges and timestamp for assistant messages */}
      {!isUser && (
        <div className="flex items-center gap-2 mt-1 px-1">
          {message.intentType && message.intentType !== 'UNKNOWN' && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INTENT_BADGE_COLORS[message.intentType]}`}
            >
              {message.intentType}
            </span>
          )}
          {message.fromFallback && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Deterministic
            </span>
          )}
          <span className="text-[10px] text-slate-400">{formatTimestamp(message.timestamp)}</span>
        </div>
      )}

      {/* Timestamp for user messages */}
      {isUser && (
        <span className="text-[10px] text-slate-400 mt-1 px-1">{formatTimestamp(message.timestamp)}</span>
      )}

      {/* Suggestion chips */}
      {!isUser && suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 px-1 max-w-[85%]">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestionClick?.(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
