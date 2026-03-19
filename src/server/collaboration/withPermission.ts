import { NextResponse } from 'next/server';
import { resolveEffectivePermissions } from './permissionService';
import type { EffectivePermissions } from './types';

type PermissionCheck = (perms: EffectivePermissions) => boolean;

/**
 * Helper for API routes to check permissions and return 403 if denied.
 * Returns [perms, null] on success or [null, errorResponse] on failure.
 */
export async function withPermission(
  userId: string,
  householdId: string,
  check: PermissionCheck,
): Promise<[EffectivePermissions, null] | [null, NextResponse]> {
  const perms = await resolveEffectivePermissions(userId, householdId);
  if (!perms) {
    return [null, NextResponse.json({ error: 'Household not found or access denied' }, { status: 403 })];
  }
  if (!check(perms)) {
    return [null, NextResponse.json({ error: 'Insufficient permissions for this action' }, { status: 403 })];
  }
  return [perms, null];
}
