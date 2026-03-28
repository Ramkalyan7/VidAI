/*
  Warnings:

  - You are about to drop the `Video` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_projectId_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "videoStatus" TEXT NOT NULL DEFAULT 'pending';

-- DropTable
DROP TABLE "Video";
