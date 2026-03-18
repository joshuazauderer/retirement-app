/**
 * Withdrawal Ordering Service — Phase 7
 *
 * Determines how to source a withdrawal target from available accounts,
 * implementing explicit ordering strategies across tax treatments.
 *
 * Supported orderings:
 *   TAXABLE_FIRST       TAXABLE → TAX_DEFERRED → TAX_FREE → MIXED
 *   TAX_DEFERRED_FIRST  TAX_DEFERRED → TAXABLE → TAX_FREE → MIXED
 *   TAX_FREE_FIRST      TAX_FREE → TAXABLE → TAX_DEFERRED → MIXED
 *   PRO_RATA            Proportional across all accounts with positive balances
 *
 * Tax-deferred accounts are grossed up to account for income tax owed on the
 * pre-tax withdrawal. The same epsilon filter (> 0.01) used in the baseline
 * engine prevents floating-point residuals from triggering false shortfalls.
 *
 * v1 limitations:
 * - Pro-rata grosses up each TAX_DEFERRED account individually; the iteration
 *   order within a bucket is alphabetical by account ID, not optimized.
 * - No RMD-forced withdrawal from tax-deferred accounts.
 */

import type { WithdrawalOrderingType } from './types';

export interface OrderedWithdrawalResult {
  /** Total gross withdrawn from all accounts (includes tax-deferred gross-up). */
  actualWithdrawal: number;
  /** Net shortfall after exhausting all accounts. > 0 means portfolio depleted. */
  shortfall: number;
  /** Gross withdrawal per account (accountId → gross amount withdrawn). */
  byAccount: Record<string, number>;
  /** Net withdrawal amounts by tax bucket. */
  byBucket: { taxable: number; taxDeferred: number; taxFree: number };
}

interface AccountInfo {
  id: string;
  taxTreatment: 'TAXABLE' | 'TAX_DEFERRED' | 'TAX_FREE' | 'MIXED';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function executeOrderedWithdrawals(
  targetWithdrawal: number,
  accountBalances: Record<string, number>,
  accounts: AccountInfo[],
  taxRate: number,
  ordering: WithdrawalOrderingType
): OrderedWithdrawalResult {
  if (targetWithdrawal <= 0) {
    return {
      actualWithdrawal: 0,
      shortfall: 0,
      byAccount: {},
      byBucket: { taxable: 0, taxDeferred: 0, taxFree: 0 },
    };
  }

  switch (ordering) {
    case 'TAXABLE_FIRST':
      return executeSequential(
        targetWithdrawal,
        accountBalances,
        accounts,
        taxRate,
        ['TAXABLE', 'TAX_DEFERRED', 'TAX_FREE', 'MIXED']
      );
    case 'TAX_DEFERRED_FIRST':
      return executeSequential(
        targetWithdrawal,
        accountBalances,
        accounts,
        taxRate,
        ['TAX_DEFERRED', 'TAXABLE', 'TAX_FREE', 'MIXED']
      );
    case 'TAX_FREE_FIRST':
      return executeSequential(
        targetWithdrawal,
        accountBalances,
        accounts,
        taxRate,
        ['TAX_FREE', 'TAXABLE', 'TAX_DEFERRED', 'MIXED']
      );
    case 'PRO_RATA':
      return executeProRata(targetWithdrawal, accountBalances, accounts, taxRate);
  }
}

// ---------------------------------------------------------------------------
// Sequential ordering
// ---------------------------------------------------------------------------

function executeSequential(
  targetWithdrawal: number,
  accountBalances: Record<string, number>,
  accounts: AccountInfo[],
  taxRate: number,
  order: string[]
): OrderedWithdrawalResult {
  const byAccount: Record<string, number> = {};
  const byBucket = { taxable: 0, taxDeferred: 0, taxFree: 0 };
  let remaining = targetWithdrawal;

  for (const treatment of order) {
    if (remaining <= 0) break;
    const accs = accounts.filter((a) => a.taxTreatment === treatment);
    for (const acc of accs) {
      if (remaining <= 0) break;
      const avail = accountBalances[acc.id] ?? 0;
      if (avail <= 0) continue;

      let grossNeed = remaining;
      if (treatment === 'TAX_DEFERRED' && taxRate > 0 && taxRate < 1) {
        grossNeed = remaining / (1 - taxRate);
      }

      const withdrawn = Math.min(avail, grossNeed);
      byAccount[acc.id] = (byAccount[acc.id] ?? 0) + withdrawn;

      if (treatment === 'TAXABLE') byBucket.taxable += withdrawn;
      else if (treatment === 'TAX_DEFERRED') byBucket.taxDeferred += withdrawn;
      else byBucket.taxFree += withdrawn;

      const netCovered =
        treatment === 'TAX_DEFERRED' ? withdrawn * (1 - taxRate) : withdrawn;
      remaining = Math.max(0, remaining - netCovered);
    }
  }

  const actualWithdrawal = Object.values(byAccount).reduce((s, v) => s + v, 0);
  const shortfall = remaining > 0.01 ? remaining : 0;

  return { actualWithdrawal, shortfall, byAccount, byBucket };
}

// ---------------------------------------------------------------------------
// Pro-rata ordering
// ---------------------------------------------------------------------------

/**
 * Distributes the withdrawal proportionally across all accounts with positive
 * balances. Tax-deferred accounts are grossed up individually.
 *
 * The proportions are computed from NET-equivalent available balances:
 * - Taxable / Tax-Free accounts: net = available balance
 * - Tax-Deferred accounts: net = available × (1 - taxRate)
 *
 * This ensures each account contributes the same net-of-tax fraction.
 */
function executeProRata(
  targetWithdrawal: number,
  accountBalances: Record<string, number>,
  accounts: AccountInfo[],
  taxRate: number
): OrderedWithdrawalResult {
  // Compute net-equivalent balances for eligible accounts
  const eligible = accounts.filter((a) => (accountBalances[a.id] ?? 0) > 0);

  const netBalances: Record<string, number> = {};
  let totalNet = 0;
  for (const acc of eligible) {
    const avail = accountBalances[acc.id] ?? 0;
    const net =
      acc.taxTreatment === 'TAX_DEFERRED' && taxRate > 0 && taxRate < 1
        ? avail * (1 - taxRate)
        : avail;
    netBalances[acc.id] = net;
    totalNet += net;
  }

  if (totalNet <= 0) {
    return {
      actualWithdrawal: 0,
      shortfall: targetWithdrawal > 0.01 ? targetWithdrawal : 0,
      byAccount: {},
      byBucket: { taxable: 0, taxDeferred: 0, taxFree: 0 },
    };
  }

  const byAccount: Record<string, number> = {};
  const byBucket = { taxable: 0, taxDeferred: 0, taxFree: 0 };
  let totalNetCovered = 0;

  for (const acc of eligible) {
    const netShare = (netBalances[acc.id] / totalNet) * targetWithdrawal;
    // Gross up if tax-deferred
    const grossNeed =
      acc.taxTreatment === 'TAX_DEFERRED' && taxRate > 0 && taxRate < 1
        ? netShare / (1 - taxRate)
        : netShare;

    const avail = accountBalances[acc.id] ?? 0;
    const withdrawn = Math.min(avail, grossNeed);
    byAccount[acc.id] = (byAccount[acc.id] ?? 0) + withdrawn;

    if (acc.taxTreatment === 'TAXABLE') byBucket.taxable += withdrawn;
    else if (acc.taxTreatment === 'TAX_DEFERRED') byBucket.taxDeferred += withdrawn;
    else byBucket.taxFree += withdrawn;

    const netCovered =
      acc.taxTreatment === 'TAX_DEFERRED' && taxRate > 0 && taxRate < 1
        ? withdrawn * (1 - taxRate)
        : withdrawn;
    totalNetCovered += netCovered;
  }

  const actualWithdrawal = Object.values(byAccount).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, targetWithdrawal - totalNetCovered);
  const shortfall = remaining > 0.01 ? remaining : 0;

  return { actualWithdrawal, shortfall, byAccount, byBucket };
}

// ---------------------------------------------------------------------------
// Ordering label helpers (for UI)
// ---------------------------------------------------------------------------

export function orderingTypeLabel(type: WithdrawalOrderingType): string {
  switch (type) {
    case 'TAXABLE_FIRST': return 'Taxable First → Tax-Deferred → Tax-Free';
    case 'TAX_DEFERRED_FIRST': return 'Tax-Deferred First → Taxable → Tax-Free';
    case 'TAX_FREE_FIRST': return 'Tax-Free First → Taxable → Tax-Deferred';
    case 'PRO_RATA': return 'Pro-Rata Across All Accounts';
  }
}
