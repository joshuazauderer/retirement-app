CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messagesJson" JSONB NOT NULL DEFAULT '[]',
    "contextJson" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_sessions_householdId_idx" ON "conversation_sessions"("householdId");
CREATE INDEX "conversation_sessions_userId_idx" ON "conversation_sessions"("userId");
