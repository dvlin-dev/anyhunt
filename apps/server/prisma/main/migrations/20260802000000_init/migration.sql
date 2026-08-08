-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TopicVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'EMPTY', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('INITIAL', 'SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "TopicReportReason" AS ENUM ('SPAM', 'COPYRIGHT', 'INAPPROPRIATE', 'MISLEADING', 'OTHER');

-- CreateEnum
CREATE TYPE "TopicReportStatus" AS ENUM ('PENDING', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRecord" (
    "id" TEXT NOT NULL,
    "userIdHash" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "feedback" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "TopicVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "managedSkillId" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "inboxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "webhookSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillVersion" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "files" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "RunTrigger" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "checkpoint" JSONB,
    "runtimeStats" JSONB,
    "narrative" TEXT,
    "emptyReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "canonicalUrlHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "sourceTitle" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserItemState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canonicalUrlHash" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),
    "notInterestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserItemState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicReport" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" "TopicReportReason" NOT NULL,
    "description" TEXT,
    "status" "TopicReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "routeGroup" TEXT,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "authType" TEXT,
    "userId" TEXT,
    "clientIp" TEXT NOT NULL,
    "forwardedFor" TEXT,
    "origin" TEXT,
    "referer" TEXT,
    "userAgent" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryAfter" TEXT,
    "rateLimitLimit" TEXT,
    "rateLimitRemaining" TEXT,
    "rateLimitReset" TEXT,
    "requestBytes" INTEGER,
    "responseBytes" INTEGER,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "errorCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "upstreamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inputTokenPrice" DOUBLE PRECISION NOT NULL,
    "outputTokenPrice" DOUBLE PRECISION NOT NULL,
    "maxContextTokens" INTEGER NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL,
    "capabilitiesJson" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultAgentModelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AttachedTopicSkills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AttachedTopicSkills_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRecord_userIdHash_key" ON "AccountDeletionRecord"("userIdHash");

-- CreateIndex
CREATE INDEX "AccountDeletionRecord_reason_idx" ON "AccountDeletionRecord"("reason");

-- CreateIndex
CREATE INDEX "AccountDeletionRecord_deletedAt_idx" ON "AccountDeletionRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_ownerId_createdAt_idx" ON "Topic"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Topic_visibility_status_idx" ON "Topic"("visibility", "status");

-- CreateIndex
CREATE INDEX "Topic_enabled_status_nextRunAt_idx" ON "Topic"("enabled", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "Topic_managedSkillId_idx" ON "Topic"("managedSkillId");

-- CreateIndex
CREATE INDEX "Subscription_topicId_enabled_idx" ON "Subscription"("topicId", "enabled");

-- CreateIndex
CREATE INDEX "Subscription_userId_enabled_idx" ON "Subscription"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_topicId_key" ON "Subscription"("userId", "topicId");

-- CreateIndex
CREATE INDEX "Skill_ownerId_enabled_idx" ON "Skill"("ownerId", "enabled");

-- CreateIndex
CREATE INDEX "SkillVersion_skillId_createdAt_idx" ON "SkillVersion"("skillId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillId_version_key" ON "SkillVersion"("skillId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillId_contentHash_key" ON "SkillVersion"("skillId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "Run_runKey_key" ON "Run"("runKey");

-- CreateIndex
CREATE INDEX "Run_topicId_scheduledAt_idx" ON "Run"("topicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Run_status_scheduledAt_idx" ON "Run"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "RunItem_canonicalUrlHash_idx" ON "RunItem"("canonicalUrlHash");

-- CreateIndex
CREATE INDEX "RunItem_runId_rank_idx" ON "RunItem"("runId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "RunItem_runId_canonicalUrlHash_key" ON "RunItem"("runId", "canonicalUrlHash");

-- CreateIndex
CREATE INDEX "UserItemState_userId_savedAt_idx" ON "UserItemState"("userId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserItemState_userId_canonicalUrlHash_key" ON "UserItemState"("userId", "canonicalUrlHash");

-- CreateIndex
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_subscriptionId_createdAt_idx" ON "Delivery"("subscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_runId_subscriptionId_channel_key" ON "Delivery"("runId", "subscriptionId", "channel");

-- CreateIndex
CREATE INDEX "TopicReport_status_createdAt_idx" ON "TopicReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TopicReport_reporterUserId_idx" ON "TopicReport"("reporterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicReport_topicId_reporterUserId_key" ON "TopicReport"("topicId", "reporterUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetUserId_idx" ON "AdminAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_requestId_idx" ON "RequestLog"("requestId");

-- CreateIndex
CREATE INDEX "RequestLog_statusCode_createdAt_idx" ON "RequestLog"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_routeGroup_createdAt_idx" ON "RequestLog"("routeGroup", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_userId_createdAt_idx" ON "RequestLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_clientIp_createdAt_idx" ON "RequestLog"("clientIp", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_createdAt_idx" ON "IdempotencyRecord"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_idempotencyKey_key" ON "IdempotencyRecord"("scope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LlmProvider_enabled_idx" ON "LlmProvider"("enabled");

-- CreateIndex
CREATE INDEX "LlmProvider_providerType_idx" ON "LlmProvider"("providerType");

-- CreateIndex
CREATE INDEX "LlmModel_providerId_idx" ON "LlmModel"("providerId");

-- CreateIndex
CREATE INDEX "LlmModel_enabled_idx" ON "LlmModel"("enabled");

-- CreateIndex
CREATE INDEX "LlmModel_modelId_idx" ON "LlmModel"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "LlmModel_providerId_modelId_key" ON "LlmModel"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "_AttachedTopicSkills_B_index" ON "_AttachedTopicSkills"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_managedSkillId_fkey" FOREIGN KEY ("managedSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunItem" ADD CONSTRAINT "RunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserItemState" ADD CONSTRAINT "UserItemState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicReport" ADD CONSTRAINT "TopicReport_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicReport" ADD CONSTRAINT "TopicReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicReport" ADD CONSTRAINT "TopicReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmModel" ADD CONSTRAINT "LlmModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachedTopicSkills" ADD CONSTRAINT "_AttachedTopicSkills_A_fkey" FOREIGN KEY ("A") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachedTopicSkills" ADD CONSTRAINT "_AttachedTopicSkills_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
