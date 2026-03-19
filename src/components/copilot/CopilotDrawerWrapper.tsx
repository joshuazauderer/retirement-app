'use client';

import { useState, useEffect } from 'react';
import { CopilotDrawer } from './CopilotDrawer';

/**
 * CopilotDrawerWrapper — thin client wrapper that fetches the householdId
 * from the API and renders CopilotDrawer.
 *
 * Used in the layout as a dynamic import (ssr: false) so it never
 * runs on the server.
 */
export default function CopilotDrawerWrapper() {
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/household')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const id = data?.household?.id ?? null;
        if (id) setHouseholdId(id);
      })
      .catch(() => {});
  }, []);

  if (!householdId) return null;

  return <CopilotDrawer householdId={householdId} />;
}
