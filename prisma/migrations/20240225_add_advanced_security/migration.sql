-- Migration: Add Advanced Security Tables
-- Created: 2024-02-25
-- Description: Adds API Key management and MFA backup code tables

-- Create ApiKey table
CREATE TABLE "ApiKey" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "keyPrefix" VARCHAR(50) NOT NULL,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "scopes" TEXT[] NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP,
    "lastUsedAt" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for ApiKey table
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- Create MfaBackupCode table
CREATE TABLE "MfaBackupCode" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "codeHash" VARCHAR(255) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for MfaBackupCode table
CREATE INDEX "MfaBackupCode_userId_idx" ON "MfaBackupCode"("userId");
CREATE INDEX "MfaBackupCode_codeHash_idx" ON "MfaBackupCode"("codeHash");

-- Add relation from User to ApiKey and MfaBackupCode
-- (These should already exist in the User table if schema was updated)

-- Optional: Add unique constraint to prevent duplicate key prefixes
-- ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_keyPrefix_unique" UNIQUE ("keyPrefix");

-- Rollback script (if needed):
-- DROP TABLE IF EXISTS "MfaBackupCode";
-- DROP TABLE IF EXISTS "ApiKey";
