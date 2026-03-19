/**
 * collaborationService — household membership management.
 *
 * Manages active memberships: listing members, changing roles, removing members.
 */

import { prisma } from '@/lib/prisma';
import { requireManageAccess } from './permissionService';
import { recordActivity } from './accessAuditService';
import type { HouseholdMembership, HouseholdRole, PermissionLevel, MembershipStatus } from './types';

/**
 * List all active members of a household (including the owner).
 */
export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMembership[]> {
  // Get original owner
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: { primaryUser: { select: { id: true, email: true, name: true } } },
  });

  const members: HouseholdMembership[] = [];

  if (household) {
    members.push({
      id: `owner-${household.primaryUserId}`,
      householdId,
      userId: household.primaryUserId,
      role: 'OWNER',
      permissionLevel: 'MANAGE',
      status: 'ACTIVE',
      createdAt: household.createdAt.toISOString(),
      updatedAt: household.updatedAt.toISOString(),
      userEmail: household.primaryUser?.email ?? undefined,
      userName: household.primaryUser?.name ?? undefined,
    });
  }

  // Get collaborators/advisors
  const memberships = await prisma.householdMembership.findMany({
    where: { householdId, status: 'ACTIVE' },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const m of memberships) {
    members.push({
      id: m.id,
      householdId: m.householdId,
      userId: m.userId,
      role: m.role as HouseholdRole,
      permissionLevel: m.permissionLevel as PermissionLevel,
      status: m.status as MembershipStatus,
      invitedByUserId: m.invitedByUserId ?? undefined,
      invitedAt: m.invitedAt?.toISOString() ?? undefined,
      acceptedAt: m.acceptedAt?.toISOString() ?? undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      userEmail: m.user?.email ?? undefined,
      userName: m.user?.name ?? undefined,
    });
  }

  return members;
}

/**
 * Remove a member from a household.
 */
export async function removeMember(
  householdId: string,
  targetUserId: string,
  removedByUserId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireManageAccess(removedByUserId, householdId);
  } catch {
    return { success: false, error: 'Access denied' };
  }

  // Cannot remove owner
  const isOwner = await prisma.household.findFirst({ where: { id: householdId, primaryUserId: targetUserId } });
  if (isOwner) return { success: false, error: 'Cannot remove the household owner' };

  // Cannot remove self via this route (use leave instead)
  if (targetUserId === removedByUserId) {
    return { success: false, error: 'Use the leave household option to remove yourself' };
  }

  const membership = await prisma.householdMembership.findFirst({
    where: { householdId, userId: targetUserId, status: 'ACTIVE' },
    include: { user: { select: { email: true } } },
  });
  if (!membership) return { success: false, error: 'Member not found' };

  await prisma.householdMembership.update({
    where: { id: membership.id },
    data: { status: 'REMOVED' },
  });

  await recordActivity(householdId, removedByUserId, 'MEMBER_REMOVED', {
    targetUserId,
    targetEmail: membership.user?.email,
    details: `Removed member ${membership.user?.email ?? targetUserId}`,
  });

  return { success: true };
}

/**
 * Change a member's role/permission.
 */
export async function updateMemberRole(
  householdId: string,
  targetUserId: string,
  newRole: HouseholdRole,
  newPermissionLevel: PermissionLevel,
  updatedByUserId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireManageAccess(updatedByUserId, householdId);
  } catch {
    return { success: false, error: 'Access denied' };
  }

  if (newRole === 'OWNER') return { success: false, error: 'Cannot assign OWNER role via this route' };

  const membership = await prisma.householdMembership.findFirst({
    where: { householdId, userId: targetUserId, status: 'ACTIVE' },
    include: { user: { select: { email: true } } },
  });
  if (!membership) return { success: false, error: 'Member not found' };

  await prisma.householdMembership.update({
    where: { id: membership.id },
    data: { role: newRole, permissionLevel: newPermissionLevel },
  });

  await recordActivity(householdId, updatedByUserId, 'ROLE_CHANGED', {
    targetUserId,
    targetEmail: membership.user?.email,
    details: `Role changed to ${newRole} / ${newPermissionLevel}`,
  });

  return { success: true };
}

/**
 * List all households the user has access to (owned + memberships).
 */
export async function listAccessibleHouseholds(
  userId: string,
): Promise<Array<{ householdId: string; name: string; role: HouseholdRole; isOwner: boolean }>> {
  const owned = await prisma.household.findMany({
    where: { primaryUserId: userId },
    select: { id: true, name: true },
  });

  const memberships = await prisma.householdMembership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { household: { select: { id: true, name: true } } },
  });

  return [
    ...owned.map((h) => ({ householdId: h.id, name: h.name ?? 'My Household', role: 'OWNER' as HouseholdRole, isOwner: true })),
    ...memberships.map((m) => ({
      householdId: m.household.id,
      name: m.household.name ?? 'Shared Household',
      role: m.role as HouseholdRole,
      isOwner: false,
    })),
  ];
}
