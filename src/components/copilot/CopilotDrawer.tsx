'use client';

import { useState } from 'react';
import { MessageCircle, X, ChevronDown } from 'lucide-react';
import { CopilotPanel } from './CopilotPanel';

interface CopilotDrawerProps {
  householdId: string;
}

export function CopilotDrawer({ householdId }: CopilotDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center"
          aria-label="Open AI Copilot"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col w-full sm:w-[400px] h-[600px] sm:h-[calc(100vh-2rem)] sm:bottom-4 sm:right-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-semibold text-sm">AI Planning Copilot</span>
              <span className="text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full font-medium">BETA</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                aria-label="Minimize"
              >
                <ChevronDown size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Panel */}
          <div className="flex-1 min-h-0">
            <CopilotPanel householdId={householdId} className="h-full" />
          </div>
        </div>
      )}
    </>
  );
}
