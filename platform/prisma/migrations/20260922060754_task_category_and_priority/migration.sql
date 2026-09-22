-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Operations',
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'medium';
