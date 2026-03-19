/**
 * permissionService — centralized permission resolution.
 *
 * CRITICAL: All access checks must use this service.
 * Never duplicate permission logic in route handlers or UI.
 *
 * All checks are server-side. Never trust client-supplied role claims.
 */

import { prisma } from '@/lib/prisma';
import type { HouseholdRole, PermissionLevel, EffectivePermissions } from './types';
import { ROLE_DEFAULT_PERMISSIONS } from './types';

// Suppress unused import warning — ROLE_DEFAULT_PERMISSIONS used in other services
void ROLE_DEFAULT_PERMISSIONS;

/**
 * Resolve effective permissions for a user on a given household.
 * Returns null if the user has no access to the household.
 */
export async function resolveEffectivePermissions(
  userId: string,
  householdId: string,
): Promise<EffectivePermissions | null> {
  // Check if user is the household owner (primary user)
  const household = await prisma.household.findFirst({
    where: { id: householdId, primaryUserId: userId },
  });

  if (household) {
    // Original owner — full MANAGE access
    return buildEffectivePermissions('OWNER', 'MANAGE');
  }

  // Check HouseholdMembership table for collaborators/advisors
  const membership = await prisma.householdMembership.findFirst({
    where: { householdId, userId, status: 'ACTIVE' },
  });

  if (!membership) return null;

  const role = membership.role as HouseholdRole;
  const permissionLevel = membership.permissionLevel as PermissionLevel;

  return buildEffectivePermissions(role, permissionLevel);
}

/**
 * Build EffectivePermissions from role + permission level.
 */
export function buildEffectivePermissions(
  role: HouseholdRole,
  permissionLevel: PermissionLevel,
): EffectivePermissions {
  const canManage = permissionLevel === 'MANAGE';
  const canEdit = canManage || permissionLevel === 'EDIT';

  return {
    canViewHousehold: true,
    canEditHousehold: canEdit && role !== 'ADVISOR',
    canRunSimulation: canEdit,
    canEditScenario: canEdit && role !== 'VIEWER',
    canViewReports: true,
    canGenerateReports: canEdit,
    canViewInsights: true,
    canViewConversations: true,
    canManageAccess: canManage,
    canDeleteHousehold: role === 'OWNER',
    isOwner: role === 'OWNER',
    isAdvisor: role === 'ADVISOR',
    role,
    permissionLevel,
  };
}

/**
 * Quick check: does this user have any access to this household?
 */
export async function hasHouseholdAccess(userId: string, householdId: string): Promise<boolean> {
  const perms = await resolveEffectivePermissions(userId, householdId);
  return perms !== null;
}

/**
 * Quick check: can this user edit this household?
 */
export async function canEditHousehold(userId: string, householdId: string): Promise<boolean> {
  const perms = await resolveEffectivePermissions(userId, householdId);
  return perms?.canEditHousehold ?? false;
}

/**
 * Quick check: can this user manage access (invite/revoke)?
 */
export async function canManageAccess(userId: string, householdId: string): Promise<boolean> {
  const perms = await resolveEffectivePermissions(userId, householdId);
  return perms?.canManageAccess ?? false;
}

/**
 * Require access or throw.
 * Usage: `const perms = await requireAccess(userId, householdId);`
 */
export async function requireAccess(
  userId: string,
  householdId: string,
): Promise<EffectivePermissions> {
  const perms = await resolveEffectivePermissions(userId, householdId);
  if (!perms) throw new Error('ACCESS_DENIED');
  return perms;
}

/**
 * Require edit access or throw.
 */
export async function requireEditAccess(userId: string, householdId: string): Promise<EffectivePermissions> {
  const perms = await requireAccess(userId, householdId);
  if (!perms.canEditHousehold) throw new Error('EDIT_ACCESS_DENIED');
  return perms;
}

/**
 * Require manage access (owner/manager) or throw.
 */
export async function requireManageAccess(userId: string, householdId: string): Promise<EffectivePermissions> {
  const perms = await requireAccess(userId, householdId);
  if (!perms.canManageAccess) throw new Error('MANAGE_ACCESS_DENIED');
  return perms;
}
