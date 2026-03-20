import { describe, it, expect } from 'vitest';
import { getDashboardUpgradePrompt } from '@/server/dashboard/dashboardUpgradePromptService';

describe('getDashboardUpgradePrompt', () => {
  it('shows upgrade prompt for FREE plan', () => {
    const result = getDashboardUpgradePrompt('FREE');

    expect(result.show).toBe(true);
    expect(result.planType).toBe('FREE');
    expect(result.headline).toBeTruthy();
    expect(result.ctaLabel).toBeTruthy();
    expect(result.ctaHref).toBeTruthy();
  });

  it('does not show upgrade prompt for PRO plan', () => {
    const result = getDashboardUpgradePrompt('PRO');

    expect(result.show).toBe(false);
    expect(result.planType).toBe('PRO');
  });

  it('does not show upgrade prompt for ADVISOR plan', () => {
    const result = getDashboardUpgradePrompt('ADVISOR');

    expect(result.show).toBe(false);
    expect(result.planType).toBe('ADVISOR');
  });

  it('FREE prompt includes expected features list', () => {
    const result = getDashboardUpgradePrompt('FREE');

    expect(result.featuredFeatures.length).toBeGreaterThan(0);
    expect(result.featuredFeatures.some(f => f.toLowerCase().includes('monte carlo'))).toBe(true);
    expect(result.featuredFeatures.some(f => f.toLowerCase().includes('ai'))).toBe(true);
  });

  it('FREE prompt CTA links to billing page', () => {
    const result = getDashboardUpgradePrompt('FREE');

    expect(result.ctaHref).toBe('/app/settings/billing');
  });

  it('PRO plan has empty headline and body', () => {
    const result = getDashboardUpgradePrompt('PRO');

    expect(result.headline).toBe('');
    expect(result.body).toBe('');
    expect(result.featuredFeatures).toHaveLength(0);
  });

  it('ADVISOR plan has empty headline and body', () => {
    const result = getDashboardUpgradePrompt('ADVISOR');

    expect(result.headline).toBe('');
    expect(result.body).toBe('');
    expect(result.featuredFeatures).toHaveLength(0);
  });
});
