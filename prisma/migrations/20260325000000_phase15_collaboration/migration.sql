-- Phase 15: Multi-User Collaboration + Advisor Mode + Permissions Layer
-- Creates: household_memberships, household_invitations, collaboration_activities

-- household_memberships
CREATE TABLE "household_memberships" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invitedByUserId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "household_memberships_pkey" PRIMARY KEY ("id")
);

-- household_invitations
CREATE TABLE "household_invitations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id")
);

-- collaboration_activities
CREATE TABLE "collaboration_activities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "householdId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "details" TEXT,

    CONSTRAINT "collaboration_activities_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "household_memberships_householdId_userId_key" ON "household_memberships"("householdId", "userId");
CREATE UNIQUE INDEX "household_invitations_token_key" ON "household_invitations"("token");

-- Indexes
CREATE INDEX "household_memberships_userId_idx" ON "household_memberships"("userId");
CREATE INDEX "household_memberships_householdId_idx" ON "household_memberships"("householdId");
CREATE INDEX "household_invitations_householdId_idx" ON "household_invitations"("householdId");
CREATE INDEX "household_invitations_email_idx" ON "household_invitations"("email");
CREATE INDEX "collaboration_activities_householdId_idx" ON "collaboration_activities"("householdId");
CREATE INDEX "collaboration_activities_actorUserId_idx" ON "collaboration_activities"("actorUserId");

-- Foreign keys: household_memberships
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: household_invitations
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: collaboration_activities
ALTER TABLE "collaboration_activities" ADD CONSTRAINT "collaboration_activities_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
