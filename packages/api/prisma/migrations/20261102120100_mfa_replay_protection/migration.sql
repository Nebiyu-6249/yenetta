-- MFA replay protection: single-use login challenges with an attempt cap, and
-- at-most-once acceptance of each TOTP time step.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaChallengeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mfaChallengeJti" TEXT,
ADD COLUMN     "mfaLastUsedStep" INTEGER;
