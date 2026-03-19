/**
 * sharedContextService — resolve the active household context for the current user.
 *
 * For users with access to multiple households (owner + advisor memberships),
 * determines which household is currently active.
 *
 * In v1: uses the user's own household by default, with explicit switching for advisors.
 */

import { prisma } from '@/lib/prisma';
import { resolveEffectivePermissions } from './permissionService';
import { listAccessibleHouseholds } from './collaborationService';
import type { HouseholdRole, EffectivePermissions } from './types';

export interface ActiveHouseholdContext {
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  permissions: EffectivePermissions;
  isOwner: boolean;
  canSwitch: boolean;        // User has access to multiple households
  accessibleCount: number;
}

/**
 * Get the active household context for a user.
 * Prefers the user's own household; falls back to first membership if no owned household.
 */
export async function getActiveHouseholdContext(
  userId: string,
  requestedHouseholdId?: string,
): Promise<ActiveHouseholdContext | null> {
  // If specific household requested, validate access
  if (requestedHouseholdId) {
    const perms = await resolveEffectivePermissions(userId, requestedHouseholdId);
    if (!perms) return null;

    const household = await prisma.household.findUnique({
      where: { id: requestedHouseholdId },
      select: { name: true },
    });

    const accessible = await listAccessibleHouseholds(userId);

    return {
      householdId: requestedHouseholdId,
      householdName: household?.name ?? 'Household',
      role: perms.role,
      permissions: perms,
      isOwner: perms.isOwner,
      canSwitch: accessible.length > 1,
      accessibleCount: accessible.length,
    };
  }

  // Default: user's own household
  const ownedHousehold = await prisma.household.findFirst({
    where: { primaryUserId: userId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (ownedHousehold) {
    const perms = await resolveEffectivePermissions(userId, ownedHousehold.id);
    if (!perms) return null;

    const accessible = await listAccessibleHouseholds(userId);

    return {
      householdId: ownedHousehold.id,
      householdName: ownedHousehold.name ?? 'My Household',
      role: 'OWNER',
      permissions: perms,
      isOwner: true,
      canSwitch: accessible.length > 1,
      accessibleCount: accessible.length,
    };
  }

  // No owned household — try first membership (advisor or collaborator)
  const accessible = await listAccessibleHouseholds(userId);
  if (accessible.length === 0) return null;

  const first = accessible[0];
  const perms = await resolveEffectivePermissions(userId, first.householdId);
  if (!perms) return null;

  const household = await prisma.household.findUnique({
    where: { id: first.householdId },
    select: { name: true },
  });

  return {
    householdId: first.householdId,
    householdName: household?.name ?? first.name,
    role: first.role,
    permissions: perms,
    isOwner: first.isOwner,
    canSwitch: accessible.length > 1,
    accessibleCount: accessible.length,
  };
}
