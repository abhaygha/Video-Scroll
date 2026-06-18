-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hook" TEXT,
ADD COLUMN     "lastRenderError" TEXT,
ADD COLUMN     "renderProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renderStep" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "error" TEXT,
ADD COLUMN     "isHook" BOOLEAN NOT NULL DEFAULT false;
