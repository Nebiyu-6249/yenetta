-- AlterTable
ALTER TABLE "content_chunks" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

-- AlterTable
ALTER TABLE "content_documents" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

-- CreateIndex
CREATE INDEX "content_chunks_visibility_ownerId_idx" ON "content_chunks"("visibility", "ownerId");
