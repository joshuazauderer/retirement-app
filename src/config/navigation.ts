// Centralized navigation config — single source of truth

export type NavSubItem = {
  href: string;
  label: string;
};

export type NavSection = {
  id: string;
  label: string;
  href: string; // landing href (first sub-item or dedicated landing page)
  subItems: NavSubItem[];
};

export type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type FooterColumn = {
  heading: string;
  links: FooterLink[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/app/overview",
    subItems: [
      { href: "/app/overview",               label: "Overview" },
      { href: "/app/plan-health",            label: "Plan Health" },
      { href: "/app/settings/notifications", label: "Notifications" },
    ],
  },
  {
    id: "household",
    label: "Household",
    href: "/app/income",
    subItems: [
      { href: "/app/income",      label: "Income" },
      { href: "/app/assets",      label: "Assets" },
      { href: "/app/liabilities", label: "Liabilities" },
      { href: "/app/expenses",    label: "Expenses" },
      { href: "/app/benefits",    label: "Benefits" },
      { href: "/app/housing",     label: "Housing" },
      { href: "/app/insurance",   label: "Insurance" },
      { href: "/app/assumptions", label: "Assumptions" },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    href: "/app/simulations",
    subItems: [
      { href: "/app/simulations", label: "Simulations" },
      { href: "/app/scenarios",   label: "Scenarios" },
      { href: "/app/calculators", label: "Calculators" },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    href: "/app/monte-carlo",
    subItems: [
      { href: "/app/monte-carlo",           label: "Monte Carlo" },
      { href: "/app/withdrawal-strategies", label: "Withdrawal" },
      { href: "/app/sequence-risk",         label: "Sequence Risk" },
      { href: "/app/social-security",       label: "Social Security" },
      { href: "/app/tax-planning",          label: "Tax Planning" },
      { href: "/app/roth-conversions",      label: "Roth" },
      { href: "/app/healthcare-planning",   label: "Healthcare" },
      { href: "/app/longevity-stress",      label: "Longevity" },
      { href: "/app/long-term-care-stress", label: "LTC Stress" },
      { href: "/app/housing-planning",      label: "Housing Plan" },
      { href: "/app/downsizing",            label: "Downsizing" },
      { href: "/app/legacy-planning",       label: "Legacy" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/app/reports",
    subItems: [
      { href: "/app/reports", label: "Reports" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    href: "/app/ai-insights",
    subItems: [
      { href: "/app/ai-insights", label: "AI Insights" },
      { href: "/app/copilot",     label: "Copilot" },
    ],
  },
];

// Settings items — shown in user menu, not top nav
export const USER_MENU_ITEMS: NavSubItem[] = [
  { href: "/app/settings/security", label: "Security" },
  { href: "/app/settings/access",   label: "Access" },
  { href: "/app/settings/billing",  label: "Billing" },
];

// Settings sidebar items (shown when path starts with /app/settings)
export const SETTINGS_SUB_ITEMS: NavSubItem[] = [
  { href: "/app/settings/security",      label: "Security" },
  { href: "/app/settings/account",       label: "Account" },
  { href: "/app/settings/access",        label: "Access" },
  { href: "/app/settings/billing",       label: "Billing" },
  { href: "/app/settings/notifications", label: "Notifications" },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Company",
    links: [
      { href: "/about",   label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/help",         label: "Help Center" },
      { href: "/security",     label: "Security" },
      { href: "/billing-help", label: "Billing Help" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms",   label: "Terms of Service" },
    ],
  },
];

/**
 * Given a pathname, find which top-level NavSection is active.
 * Uses sub-item prefix matching so nested routes (e.g. /app/monte-carlo/runId)
 * correctly activate their parent section.
 */
export function getActiveSection(pathname: string): NavSection | null {
  for (const section of NAV_SECTIONS) {
    for (const sub of section.subItems) {
      if (pathname === sub.href || pathname.startsWith(sub.href + "/")) {
        return section;
      }
    }
  }
  return null;
}

/**
 * Given a pathname, return the active sub-item href within the active section.
 */
export function getActiveSubItemHref(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    for (const sub of section.subItems) {
      if (pathname === sub.href || pathname.startsWith(sub.href + "/")) {
        return sub.href;
      }
    }
  }
  // Check settings sub-items
  for (const sub of SETTINGS_SUB_ITEMS) {
    if (pathname === sub.href || pathname.startsWith(sub.href + "/")) {
      return sub.href;
    }
  }
  return null;
}
