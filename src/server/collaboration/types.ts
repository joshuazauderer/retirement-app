/**
 * Phase 15 — Multi-User Collaboration + Advisor Mode + Permissions Layer
 *
 * DESIGN PRINCIPLES:
 * - Collaboration must not compromise household data security
 * - All access is enforced server-side
 * - Household data belongs to the household, not individual users
 * - Actions are attributable (actor tracking for audit)
 *
 * LIMITATIONS (v1):
 * - No fine-grained per-object ACL (household-level permissions only)
 * - No real-time collaboration (no websockets)
 * - No email sending yet (invite link generation only)
 * - Advisor can access only explicitly authorized households
 * - No billing tier differentiation yet
 */

export type HouseholdRole = 'OWNER' | 'COLLABORATOR' | 'ADVISOR' | 'VIEWER';

export type PermissionLevel = 'VIEW' | 'EDIT' | 'MANAGE';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

// Roles with their default permission levels
export const ROLE_DEFAULT_PERMISSIONS: Record<HouseholdRole, PermissionLevel> = {
  OWNER: 'MANAGE',
  COLLABORATOR: 'EDIT',
  ADVISOR: 'VIEW',
  VIEWER: 'VIEW',
};

// What each permission level can do
export interface EffectivePermissions {
  canViewHousehold: boolean;
  canEditHousehold: boolean;
  canRunSimulation: boolean;
  canEditScenario: boolean;
  canViewReports: boolean;
  canGenerateReports: boolean;
  canViewInsights: boolean;
  canViewConversations: boolean;
  canManageAccess: boolean;       // Invite/revoke/change roles
  canDeleteHousehold: boolean;
  isOwner: boolean;
  isAdvisor: boolean;
  role: HouseholdRole;
  permissionLevel: PermissionLevel;
}

export interface HouseholdMembership {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  permissionLevel: PermissionLevel;
  status: MembershipStatus;
  invitedByUserId?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  userEmail?: string;
  userName?: string;
}

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  email: string;
  role: HouseholdRole;
  permissionLevel: PermissionLevel;
  token: string;
  invitedByUserId: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  householdName?: string;
  invitedByEmail?: string;
}

export interface CollaborationActivityEntry {
  id: string;
  householdId: string;
  actorUserId: string;
  actorEmail?: string;
  action: CollaborationAction;
  targetUserId?: string;
  targetEmail?: string;
  details?: string;
  createdAt: string;
}

export type CollaborationAction =
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'INVITE_REVOKED'
  | 'INVITE_EXPIRED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'PERMISSION_CHANGED'
  | 'SCENARIO_CREATED'
  | 'SIMULATION_RUN'
  | 'REPORT_EXPORTED'
  | 'ADVISOR_ACCESS_GRANTED'
  | 'ADVISOR_ACCESS_REVOKED';

export interface AccessPolicy {
  householdId: string;
  allowAdvisorAccess: boolean;
  advisorCanEdit: boolean;
  requireOwnerApprovalForAdvisors: boolean;
}

export interface CollaborationValidation {
  valid: boolean;
  errors: string[];
}

// Constants
export const INVITATION_TOKEN_LENGTH = 32;
export const INVITATION_EXPIRY_DAYS = 7;
export const MAX_HOUSEHOLD_MEMBERS = 10; // Reasonable limit for v1
