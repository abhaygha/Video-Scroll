-- CreateEnum
CREATE TYPE "CompositingLayout" AS ENUM ('PIP_CORNER', 'PIP_LARGE', 'SPLIT_BOTTOM');

-- AlterEnum
ALTER TYPE "PublishStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "compositingLayout" "CompositingLayout" NOT NULL DEFAULT 'PIP_LARGE',
ADD COLUMN     "durationSec" DOUBLE PRECISION,
ADD COLUMN     "instagramCaption" TEXT,
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3),
ADD COLUMN     "scrollScoreJson" TEXT,
ADD COLUMN     "thumbnailPath" TEXT,
ADD COLUMN     "youtubeDescription" TEXT,
ADD COLUMN     "youtubeTags" TEXT,
ADD COLUMN     "youtubeTitle" TEXT;

-- AlterTable
ALTER TABLE "PublishJob" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "assetOrder" INTEGER,
ADD COLUMN     "clipReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShortClip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "filePath" TEXT,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ShortClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "displayName" TEXT,
    "voiceId" TEXT NOT NULL DEFAULT 'onyx',
    "layout" "CompositingLayout" NOT NULL DEFAULT 'PIP_LARGE',
    "brandColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfileAsset" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL DEFAULT 'default',
    "type" "AssetType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorProfileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConnection" (
    "id" TEXT NOT NULL,
    "platform" "PublishPlatform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "channelId" TEXT,
    "channelName" TEXT,
    "accountId" TEXT,
    "accountName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortClip_projectId_idx" ON "ShortClip"("projectId");

-- CreateIndex
CREATE INDEX "CreatorProfileAsset_profileId_idx" ON "CreatorProfileAsset"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_platform_key" ON "OAuthConnection"("platform");

-- AddForeignKey
ALTER TABLE "ShortClip" ADD CONSTRAINT "ShortClip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfileAsset" ADD CONSTRAINT "CreatorProfileAsset_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
