/**
 * advisorAccessService — advisor-specific access management.
 *
 * Advisors are non-owner users invited with the ADVISOR role.
 * They can view (and optionally edit) a household's planning data
 * without becoming an owner.
 *
 * In v1, advisors use the same HouseholdMembership system as collaborators,
 * but with ADVISOR role which restricts household editing.
 * The advisor experience can be differentiated in UI/UX via the role check.
 */

import { prisma } from '@/lib/prisma';
import { resolveEffectivePermissions } from './permissionService';
import { createInvitation } from './invitationService';
import { recordActivity } from './accessAuditService';
import type { EffectivePermissions, PermissionLevel } from './types';

/**
 * Invite an advisor to a household.
 * Advisors get VIEW by default; pass 'EDIT' for read/write advisor.
 */
export async function inviteAdvisor(
  householdId: string,
  invitedByUserId: string,
  advisorEmail: string,
  permissionLevel: PermissionLevel = 'VIEW',
): Promise<{ inviteToken?: string; error?: string }> {
  const result = await createInvitation(
    householdId,
    invitedByUserId,
    advisorEmail,
    'ADVISOR',
    permissionLevel,
  );

  if (result.error) return { error: result.error };

  await recordActivity(householdId, invitedByUserId, 'ADVISOR_ACCESS_GRANTED', {
    targetEmail: advisorEmail,
    details: `Advisor invited with ${permissionLevel} access`,
  });

  return { inviteToken: result.invitation.token };
}

/**
 * Revoke advisor access (uses standard member removal).
 */
export async function revokeAdvisorAccess(
  householdId: string,
  advisorUserId: string,
  revokedByUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const membership = await prisma.householdMembership.findFirst({
    where: { householdId, userId: advisorUserId, role: 'ADVISOR', status: 'ACTIVE' },
    include: { user: { select: { email: true } } },
  });

  if (!membership) return { success: false, error: 'Advisor membership not found' };

  await prisma.householdMembership.update({
    where: { id: membership.id },
    data: { status: 'REMOVED' },
  });

  await recordActivity(householdId, revokedByUserId, 'ADVISOR_ACCESS_REVOKED', {
    targetUserId: advisorUserId,
    targetEmail: membership.user?.email,
    details: 'Advisor access revoked',
  });

  return { success: true };
}

/**
 * Get advisor-scoped effective permissions.
 * Advisors never get MANAGE level, and canEditHousehold depends on their permissionLevel.
 */
export async function getAdvisorPermissions(
  advisorUserId: string,
  householdId: string,
): Promise<EffectivePermissions | null> {
  const perms = await resolveEffectivePermissions(advisorUserId, householdId);
  if (!perms || !perms.isAdvisor) return null;
  return perms;
}

/**
 * List all households an advisor has access to.
 */
export async function listAdvisorHouseholds(
  advisorUserId: string,
): Promise<Array<{ householdId: string; householdName: string; permissionLevel: PermissionLevel }>> {
  const memberships = await prisma.householdMembership.findMany({
    where: { userId: advisorUserId, role: 'ADVISOR', status: 'ACTIVE' },
    include: { household: { select: { id: true, name: true } } },
  });

  return memberships.map((m) => ({
    householdId: m.household.id,
    householdName: m.household.name ?? 'Unnamed Household',
    permissionLevel: m.permissionLevel as PermissionLevel,
  }));
}
