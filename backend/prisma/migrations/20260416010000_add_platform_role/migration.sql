-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('user', 'superadmin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole" NOT NULL DEFAULT 'user';
