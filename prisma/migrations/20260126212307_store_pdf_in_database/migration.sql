/*
  Warnings:

  - You are about to drop the column `storagePath` on the `Document` table. All the data in the column will be lost.
  - Added the required column `pdfData` to the `Document` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add pdfData column as nullable first
ALTER TABLE "Document" ADD COLUMN "pdfData" BYTEA;

-- Step 2: Since we can't read files from SQL, we'll set a placeholder and handle in application
-- The application should re-upload or process existing documents
-- For now, we'll set empty bytea for existing rows
UPDATE "Document" SET "pdfData" = ''::bytea WHERE "pdfData" IS NULL;

-- Step 3: Make pdfData required
ALTER TABLE "Document" ALTER COLUMN "pdfData" SET NOT NULL;

-- Step 4: Drop the old storagePath column
ALTER TABLE "Document" DROP COLUMN "storagePath";
