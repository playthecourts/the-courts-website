/*
  Warnings:

  - Added the required column `signed_name` to the `waiver_signatures` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "waiver_signatures" ADD COLUMN     "signed_name" TEXT NOT NULL;
