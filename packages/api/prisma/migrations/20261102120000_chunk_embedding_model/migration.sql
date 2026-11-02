-- Record which embedding model produced each chunk's vector, so retrieval only
-- compares vectors from the same model. Every chunk written before this
-- migration came from the deterministic stub embedder (no OpenAI key was ever
-- configured), so existing rows are backfilled as 'stub-embedding'. No column
-- default: every writer must stamp the model explicitly.

-- AlterTable
ALTER TABLE "content_chunks" ADD COLUMN "embeddingModel" TEXT;
UPDATE "content_chunks" SET "embeddingModel" = 'stub-embedding';
ALTER TABLE "content_chunks" ALTER COLUMN "embeddingModel" SET NOT NULL;

-- CreateIndex
CREATE INDEX "content_chunks_embeddingModel_idx" ON "content_chunks"("embeddingModel");
