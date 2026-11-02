# Troubleshooting the Yenetta stand-up and live checks

Read this before reporting a live-check FAIL as a product bug. Each entry gives
the symptom, the cause, and the fix. All SQL below is for the **local Docker
dev database only** and touches only test data this workflow creates:

```bash
docker exec yenetta-postgres psql -U yenetta -d yenetta -c "<SQL>"
```

## Chat checks fall back ("I don't have that in the curriculum yet")

- **Embedding model changed.** The API boot log shows a `RetrievalService`
  warning ("excluded from retrieval ... active: <model>"). Cause: `.env` now
  selects a different embedding backend than the one the corpus was embedded
  with (typically an `OPENAI_API_KEY` was added). Fix:
  `pnpm --filter @yenetta/api db:reembed`, then re-run. This is the intended
  safe behavior, not a bug.
- **No seed data.** `subjects seeded` also fails. Run `db:seed`.
- **Stub limitation.** With the offline stub embedder (no key), short questions
  against long multi-topic chunks can score under 0.18 (for example "What is
  photosynthesis?"). The check script uses questions that ground with the stub;
  a fallback on your own question under the stub is not evidence of a bug.

Check which models the corpus uses:

```sql
SELECT "embeddingModel", count(*) FROM content_chunks GROUP BY 1;
```

## OTP request returns 429

Limits: 5 OTP requests per phone per hour (DB-counted, `OTP_RATE_LIMIT_PER_HOUR`)
and 5 per IP per minute (in-memory). The check script uses `ADMIN_PHONE` twice
per run, so two full runs per hour is the ceiling. Fix: wait, or clear the test
admin's consumed codes:

```sql
DELETE FROM auth_otps WHERE phone = '+251900000001';   -- the test ADMIN_PHONE only
```

## Admin checks SKIP with "MFA is still enabled"

A previous run aborted between MFA enroll and disable. Reset the test admin:

```sql
UPDATE users SET "mfaEnabled" = false, "mfaSecret" = NULL, "mfaChallengeJti" = NULL,
  "mfaChallengeAttempts" = 0, "mfaLastUsedStep" = NULL
WHERE phone = '+251900000001';
```

## MFA verify returns 401 with a correct-looking code

Each TOTP time step (30 s) is accepted once, across confirm, login and disable,
and a login challenge is single-use and dropped after 5 wrong codes. Reusing
the code you just confirmed enrollment with is rejected by design: wait for the
next code. The check script does this automatically.

## Webhook checks SKIP

`CHAPA_WEBHOOK_SECRET` is not in `.env`. Add any random hex value (the script
signs test webhooks with it) and restart the API.

## Admin login shows role != admin

`ADMIN_PHONE` was set after seeding, or changed. Re-run `db:seed`; it promotes
that phone to admin.

## Uploaded document stuck at `uploaded`

`INGESTION_MODE=queue` hands work to the BullMQ worker. Start it:
`pnpm --filter @yenetta/ingestion dev`, or use the default `inline` mode.

## EPERM during `pnpm install` or `prisma generate`

A running API (Prisma engine DLL) or web dev server (Next SWC binary) holds the
file. Stop the dev servers, then retry. On flaky networks the Prisma engine
download can also fail: re-run the install.

## `docker` not found / cannot connect to the docker API

- Not on PATH in this shell: prepend `C:\Program Files\Docker\Docker\resources\bin`.
- Engine not running (no `\\.\pipe\dockerDesktopLinuxEngine`): start Docker
  Desktop and wait for `docker info` to succeed. The context should be
  `desktop-linux` (`docker context show`).

## Prettier flags a file you did not change

The working copy has CRLF line endings from Git's `autocrlf` on Windows; the
committed content is LF and passes. Not a real issue; CI on Linux checks out LF.

## CI

CI (`.github/workflows/ci.yml`) has passed on `claude/yenetta-build-brief-qr6v10`
since 2026-11-02. Before that date every run failed at "Setup pnpm" because the
workflow and `package.json` both pinned a pnpm version; do not re-add
`version:` to `pnpm/action-setup`. The security job fails on any CRITICAL
advisory in a production dependency (`pnpm audit --prod --audit-level=critical`);
check locally with the same command before pushing dependency changes.

## Removing validation test data

```sql
-- the uploaded test document and its chunks
DELETE FROM content_chunks WHERE "sourceDocumentId" IN
  (SELECT id FROM content_documents WHERE filename = 'validate-live-krebs-cycle.md');
DELETE FROM content_documents WHERE filename = 'validate-live-krebs-cycle.md';
```

Throwaway student users use phones `+25191...`, `+25192...` with a timestamp
suffix; they are harmless to leave in a dev database.
