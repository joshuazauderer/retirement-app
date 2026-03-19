import { describe, it, expect } from "vitest";
import {
  NAV_SECTIONS,
  USER_MENU_ITEMS,
  SETTINGS_SUB_ITEMS,
  FOOTER_COLUMNS,
  getActiveSection,
  getActiveSubItemHref,
} from "@/config/navigation";

describe("NAV_SECTIONS structure", () => {
  it("has exactly 6 top-level sections", () => {
    expect(NAV_SECTIONS).toHaveLength(6);
  });

  it("has the correct section ids in order", () => {
    const ids = NAV_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(["dashboard", "household", "planning", "analysis", "reports", "ai"]);
  });

  it("each section has a non-empty label", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
    }
  });

  it("each section has at least one subItem", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.subItems.length).toBeGreaterThan(0);
    }
  });

  it("all section hrefs start with /app/", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.href).toMatch(/^\/app\//);
    }
  });

  it("all subItem hrefs start with /app/", () => {
    for (const section of NAV_SECTIONS) {
      for (const sub of section.subItems) {
        expect(sub.href).toMatch(/^\/app\//);
      }
    }
  });

  it("has no duplicate subItem hrefs across all sections", () => {
    const allHrefs = NAV_SECTIONS.flatMap((s) => s.subItems.map((i) => i.href));
    const unique = new Set(allHrefs);
    expect(unique.size).toBe(allHrefs.length);
  });

  it("section href matches its first subItem href", () => {
    for (const section of NAV_SECTIONS) {
      expect(section.href).toBe(section.subItems[0].href);
    }
  });
});

describe("getActiveSection", () => {
  it("returns Dashboard for /app/overview", () => {
    expect(getActiveSection("/app/overview")?.id).toBe("dashboard");
  });

  it("returns Dashboard for /app/plan-health", () => {
    expect(getActiveSection("/app/plan-health")?.id).toBe("dashboard");
  });

  it("returns Household for /app/income", () => {
    expect(getActiveSection("/app/income")?.id).toBe("household");
  });

  it("returns Household for /app/assets", () => {
    expect(getActiveSection("/app/assets")?.id).toBe("household");
  });

  it("returns Planning for /app/simulations", () => {
    expect(getActiveSection("/app/simulations")?.id).toBe("planning");
  });

  it("returns Planning for nested route /app/simulations/abc123", () => {
    expect(getActiveSection("/app/simulations/abc123")?.id).toBe("planning");
  });

  it("returns Analysis for /app/monte-carlo", () => {
    expect(getActiveSection("/app/monte-carlo")?.id).toBe("analysis");
  });

  it("returns Analysis for /app/withdrawal-strategies", () => {
    expect(getActiveSection("/app/withdrawal-strategies")?.id).toBe("analysis");
  });

  it("returns Reports for /app/reports", () => {
    expect(getActiveSection("/app/reports")?.id).toBe("reports");
  });

  it("returns AI for /app/ai-insights", () => {
    expect(getActiveSection("/app/ai-insights")?.id).toBe("ai");
  });

  it("returns AI for /app/copilot", () => {
    expect(getActiveSection("/app/copilot")?.id).toBe("ai");
  });

  it("returns null for /app/settings/access (settings are not a nav section)", () => {
    expect(getActiveSection("/app/settings/access")).toBeNull();
  });

  it("returns null for an unknown path", () => {
    expect(getActiveSection("/some/unknown/path")).toBeNull();
  });
});

describe("getActiveSubItemHref", () => {
  it("returns /app/income for /app/income", () => {
    expect(getActiveSubItemHref("/app/income")).toBe("/app/income");
  });

  it("returns /app/monte-carlo for /app/monte-carlo/runId", () => {
    expect(getActiveSubItemHref("/app/monte-carlo/run123")).toBe("/app/monte-carlo");
  });

  it("returns /app/settings/access for /app/settings/access", () => {
    expect(getActiveSubItemHref("/app/settings/access")).toBe("/app/settings/access");
  });

  it("returns null for unknown path", () => {
    expect(getActiveSubItemHref("/unknown")).toBeNull();
  });
});

describe("USER_MENU_ITEMS", () => {
  it("all items have hrefs under /app/settings/", () => {
    for (const item of USER_MENU_ITEMS) {
      expect(item.href).toMatch(/^\/app\/settings\//);
    }
  });

  it("has at least 2 items", () => {
    expect(USER_MENU_ITEMS.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SETTINGS_SUB_ITEMS", () => {
  it("all items are under /app/settings/", () => {
    for (const item of SETTINGS_SUB_ITEMS) {
      expect(item.href).toMatch(/^\/app\/settings\//);
    }
  });
});

describe("FOOTER_COLUMNS", () => {
  it("has exactly 3 columns", () => {
    expect(FOOTER_COLUMNS).toHaveLength(3);
  });

  it("all footer hrefs do NOT start with /app/", () => {
    for (const col of FOOTER_COLUMNS) {
      for (const link of col.links) {
        expect(link.href).not.toMatch(/^\/app\//);
      }
    }
  });

  it("each column has a heading and at least one link", () => {
    for (const col of FOOTER_COLUMNS) {
      expect(col.heading.length).toBeGreaterThan(0);
      expect(col.links.length).toBeGreaterThan(0);
    }
  });
});
