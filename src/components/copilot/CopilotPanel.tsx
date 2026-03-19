'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ConversationMessage, CopilotResponse } from '@/server/conversation/types';

interface CopilotPanelProps {
  householdId: string;
  className?: string;
}

const STARTER_SUGGESTIONS = [
  'Does my plan work?',
  'What are the biggest risks?',
  'How can I improve this plan?',
  'What is sequence-of-returns risk?',
];

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function CopilotPanel({ householdId, className }: CopilotPanelProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function sendMessage(msg: string) {
    if (!msg.trim() || isLoading) return;

    const userMsg: ConversationMessage = {
      id: randomId(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLastSuggestions([]);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          householdId,
          message: msg,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = (await res.json()) as CopilotResponse & { sessionId: string };

      if (data.sessionId) setSessionId(data.sessionId);

      const assistantMsg: ConversationMessage = {
        id: randomId(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        intentType: data.intentType,
        actionType: data.actionType,
        fromFallback: data.fromFallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLastSuggestions(data.suggestions ?? []);
    } catch {
      const errorMsg: ConversationMessage = {
        id: randomId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        fromFallback: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`flex flex-col h-full bg-slate-50 ${className ?? ''}`}>
      {/* Disclaimer */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex-shrink-0">
        AI copilot — planning explanations only, not financial advice.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm font-medium mb-1">AI Planning Copilot</p>
            <p className="text-slate-400 text-xs mb-6">
              Ask questions about your retirement plan in plain language.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              suggestions={msg.role === 'assistant' && isLast ? lastSuggestions : undefined}
              onSuggestionClick={sendMessage}
            />
          );
        })}

        {isLoading && (
          <div className="flex items-start mb-4">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        starterSuggestions={messages.length === 0 ? STARTER_SUGGESTIONS : undefined}
      />
    </div>
  );
}
