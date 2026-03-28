/*
  Warnings:

  - Added the required column `videoUrl` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "videoUrl" TEXT NOT NULL,
ALTER COLUMN "videoStatus" DROP DEFAULT;
