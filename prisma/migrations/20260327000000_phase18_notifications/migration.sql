-- Phase 18: Notifications + Email Alerts + Scheduled Digest System

-- Notification table: stores in-app notifications per user
CREATE TABLE "notifications" (
    "id"           TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"       TEXT NOT NULL,
    "householdId"  TEXT,
    "type"         TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "isRead"       BOOLEAN NOT NULL DEFAULT false,
    "readAt"       TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- NotificationPreference table: per-user notification settings
CREATE TABLE "notification_preferences" (
    "id"                  TEXT NOT NULL,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    "userId"              TEXT NOT NULL,
    "emailDigest"         BOOLEAN NOT NULL DEFAULT true,
    "digestFrequency"     TEXT NOT NULL DEFAULT 'WEEKLY',
    "planRiskAlerts"      BOOLEAN NOT NULL DEFAULT true,
    "collaborationAlerts" BOOLEAN NOT NULL DEFAULT true,
    "billingAlerts"       BOOLEAN NOT NULL DEFAULT true,
    "simulationAlerts"    BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one preference row per user
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- Indexes for notifications
CREATE INDEX "notifications_userId_isRead_idx"   ON "notifications"("userId", "isRead");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- Foreign keys
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences"
    ADD CONSTRAINT "notification_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
