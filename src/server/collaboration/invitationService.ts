/**
 * invitationService — secure invitation token management.
 *
 * Flow:
 * 1. Owner creates invitation → generates secure token → stores in DB
 * 2. Invitation link sent (or copied) with token
 * 3. Invitee visits link → validates token → signs in/up → accepts → membership created
 * 4. Token invalidated after acceptance or expiry
 *
 * Security:
 * - Tokens are random 32-byte hex strings (64 chars)
 * - Tokens expire after INVITATION_EXPIRY_DAYS days
 * - Tokens are single-use
 * - No open join links; always token-based
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireManageAccess } from './permissionService';
import { recordActivity } from './accessAuditService';
import type {
  HouseholdInvitation,
  HouseholdRole,
  PermissionLevel,
  InvitationStatus,
  CollaborationValidation,
} from './types';
import {
  INVITATION_TOKEN_LENGTH,
  INVITATION_EXPIRY_DAYS,
  ROLE_DEFAULT_PERMISSIONS,
  MAX_HOUSEHOLD_MEMBERS,
} from './types';

export function generateToken(): string {
  return randomBytes(INVITATION_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a new invitation.
 */
export async function createInvitation(
  householdId: string,
  invitedByUserId: string,
  email: string,
  role: HouseholdRole,
  permissionLevel?: PermissionLevel,
): Promise<{ invitation: HouseholdInvitation; error?: string }> {
  // Validate
  const validation = await validateInvitation(householdId, invitedByUserId, email, role);
  if (!validation.valid) {
    return { invitation: {} as HouseholdInvitation, error: validation.errors.join('; ') };
  }

  const effectivePermission = permissionLevel ?? ROLE_DEFAULT_PERMISSIONS[role];
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Revoke any existing pending invite to this email for this household
  await prisma.householdInvitation.updateMany({
    where: { householdId, email, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });

  const inv = await prisma.householdInvitation.create({
    data: {
      householdId,
      email: email.toLowerCase().trim(),
      role,
      permissionLevel: effectivePermission,
      token,
      invitedByUserId,
      status: 'PENDING',
      expiresAt,
    },
    include: {
      household: { select: { name: true } },
      invitedBy: { select: { email: true } },
    },
  });

  await recordActivity(householdId, invitedByUserId, 'INVITE_SENT', {
    targetEmail: email,
    details: `Invited as ${role}`,
  });

  return {
    invitation: {
      id: inv.id,
      householdId: inv.householdId,
      email: inv.email,
      role: inv.role as HouseholdRole,
      permissionLevel: inv.permissionLevel as PermissionLevel,
      token: inv.token,
      invitedByUserId: inv.invitedByUserId,
      status: inv.status as InvitationStatus,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      householdName: inv.household?.name ?? undefined,
      invitedByEmail: inv.invitedBy?.email ?? undefined,
    },
  };
}

/**
 * Validate an invitation before creating it.
 */
async function validateInvitation(
  householdId: string,
  invitedByUserId: string,
  email: string,
  role: HouseholdRole,
): Promise<CollaborationValidation> {
  const errors: string[] = [];

  // Verify requester has manage access
  try {
    await requireManageAccess(invitedByUserId, householdId);
  } catch {
    errors.push('You do not have permission to invite members to this household');
    return { valid: false, errors };
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email address');
  }

  // Cannot invite self
  const inviter = await prisma.user.findUnique({ where: { id: invitedByUserId }, select: { email: true } });
  if (inviter?.email?.toLowerCase() === email.toLowerCase()) {
    errors.push('You cannot invite yourself');
  }

  // Check if user is already an active member
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (existingUser) {
    const existingMembership = await prisma.householdMembership.findFirst({
      where: { householdId, userId: existingUser.id, status: 'ACTIVE' },
    });
    if (existingMembership) {
      errors.push('This user is already a member of this household');
    }

    // Check if they are the owner
    const isOwner = await prisma.household.findFirst({ where: { id: householdId, primaryUserId: existingUser.id } });
    if (isOwner) errors.push('This user is the household owner');
  }

  // Check membership limit
  const memberCount = await prisma.householdMembership.count({
    where: { householdId, status: 'ACTIVE' },
  });
  if (memberCount >= MAX_HOUSEHOLD_MEMBERS) {
    errors.push(`Household member limit (${MAX_HOUSEHOLD_MEMBERS}) reached`);
  }

  // Cannot invite as OWNER
  if (role === 'OWNER') {
    errors.push('Cannot invite a user as household owner. Ownership transfer is not supported in this version.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Look up an invitation by token. Returns null if not found/expired/used.
 */
export async function getInvitationByToken(token: string): Promise<HouseholdInvitation | null> {
  const inv = await prisma.householdInvitation.findUnique({
    where: { token },
    include: {
      household: { select: { name: true } },
      invitedBy: { select: { email: true } },
    },
  });

  if (!inv) return null;

  // Check expiry
  if (inv.status === 'PENDING' && inv.expiresAt < new Date()) {
    await prisma.householdInvitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } });
    return null;
  }

  if (inv.status !== 'PENDING') return null;

  return {
    id: inv.id,
    householdId: inv.householdId,
    email: inv.email,
    role: inv.role as HouseholdRole,
    permissionLevel: inv.permissionLevel as PermissionLevel,
    token: inv.token,
    invitedByUserId: inv.invitedByUserId,
    status: inv.status as InvitationStatus,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    householdName: inv.household?.name ?? undefined,
    invitedByEmail: inv.invitedBy?.email ?? undefined,
  };
}

/**
 * Accept an invitation — creates membership, marks invite used.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<{ success: boolean; householdId?: string; error?: string }> {
  const inv = await getInvitationByToken(token);
  if (!inv) return { success: false, error: 'Invitation is invalid, expired, or already used.' };

  // Verify the accepting user's email matches the invite
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email?.toLowerCase() !== inv.email.toLowerCase()) {
    return { success: false, error: 'This invitation was sent to a different email address. Please sign in with the invited email.' };
  }

  // Create membership
  await prisma.householdMembership.upsert({
    where: { householdId_userId: { householdId: inv.householdId, userId } },
    create: {
      householdId: inv.householdId,
      userId,
      role: inv.role,
      permissionLevel: inv.permissionLevel,
      status: 'ACTIVE',
      invitedByUserId: inv.invitedByUserId,
      invitedAt: new Date(inv.createdAt),
      acceptedAt: new Date(),
    },
    update: {
      role: inv.role,
      permissionLevel: inv.permissionLevel,
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
  });

  // Mark invitation as accepted
  await prisma.householdInvitation.update({
    where: { id: inv.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  await recordActivity(inv.householdId, userId, 'INVITE_ACCEPTED', {
    details: `Accepted invitation as ${inv.role}`,
  });

  return { success: true, householdId: inv.householdId };
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(
  invitationId: string,
  revokedByUserId: string,
  householdId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireManageAccess(revokedByUserId, householdId);
  } catch {
    return { success: false, error: 'Access denied' };
  }

  const inv = await prisma.householdInvitation.findFirst({
    where: { id: invitationId, householdId, status: 'PENDING' },
  });
  if (!inv) return { success: false, error: 'Invitation not found or already processed' };

  await prisma.householdInvitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } });

  await recordActivity(householdId, revokedByUserId, 'INVITE_REVOKED', {
    targetEmail: inv.email,
    details: `Invitation to ${inv.email} revoked`,
  });

  return { success: true };
}

/**
 * List active invitations for a household.
 */
export async function listPendingInvitations(householdId: string): Promise<HouseholdInvitation[]> {
  const invites = await prisma.householdInvitation.findMany({
    where: { householdId, status: 'PENDING', expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return invites.map((inv) => ({
    id: inv.id,
    householdId: inv.householdId,
    email: inv.email,
    role: inv.role as HouseholdRole,
    permissionLevel: inv.permissionLevel as PermissionLevel,
    token: inv.token,
    invitedByUserId: inv.invitedByUserId,
    status: inv.status as InvitationStatus,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    invitedByEmail: inv.invitedBy?.email ?? undefined,
  }));
}
