export function annualizeAmount(amount: number, frequency: string): number {
  const multipliers: Record<string, number> = {
    WEEKLY: 52,
    BIWEEKLY: 26,
    SEMIMONTHLY: 24,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUALLY: 1,
  };
  return amount * (multipliers[frequency] ?? 1);
}

export function getMemberAgeAtYear(dateOfBirth: string, year: number): number {
  // Parse birth year directly from the ISO date string to avoid timezone issues.
  // "1980-01-01" and "1980-01-01T00:00:00.000Z" both start with the 4-digit year.
  const birthYear = parseInt(dateOfBirth.slice(0, 4), 10);
  return year - birthYear;
}

export function isMemberAlive(
  dateOfBirth: string,
  year: number,
  lifeExpectancy: number
): boolean {
  return getMemberAgeAtYear(dateOfBirth, year) <= lifeExpectancy;
}

export function isMemberRetired(
  dateOfBirth: string,
  year: number,
  retirementAge: number
): boolean {
  return getMemberAgeAtYear(dateOfBirth, year) >= retirementAge;
}

/**
 * Parse a growth rate stored as a decimal fraction (e.g. 0.0300 = 3%).
 * Prisma Decimal fields for rates in this schema use scale=4 and store
 * the value directly as a fraction (0.03, 0.07, etc.), NOT as a percentage.
 */
export function parseDecimalRate(
  rateVal: { toString(): string } | null | undefined
): number {
  if (rateVal == null) return 0;
  const n = parseFloat(rateVal.toString());
  return isNaN(n) ? 0 : n;
}
