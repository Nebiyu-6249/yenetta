---
name: yenetta-local-validate
description: Stand up the Yenetta monorepo locally on Windows (Docker Desktop Postgres+pgvector and Redis, pnpm, Prisma migrate/seed, NestJS API + Next.js web) and validate it live end to end, then report what works, what 404s, and what errors. Use this whenever the task involves setting up, starting, restarting, smoke-testing, or verifying Yenetta on this machine - "stand it up", "is it working", "run the checks", "validate the core", "reality-check the milestones", after pulling or merging changes, before or after a milestone commit, after changing .env (especially adding or changing OPENAI_API_KEY or EMBEDDING_MODEL, which needs a re-embed), or when a fresh session needs to know the real state of the app instead of trusting PROGRESS.md.
---

# Yenetta: local stand-up and live validation

The point of this workflow is to find out what is actually true about the app
on real, persistent infrastructure, not to restate what `PROGRESS.md` claims.
Unit tests here mock the database, so they cannot tell you whether a route is
wired, a migration applies, or grounding works. The live check script can.
Report results, not assumptions.

Project rule: **no emojis anywhere** (code, docs, commits, output you write into
the repo). `pnpm lint` enforces it.

All helper scripts live in `.claude/skills/yenetta-local-validate/scripts/`
(referred to below as `$S`). They are plain Node, so they run the same from
PowerShell and Git Bash.

## 0. Check current state first

Skip work that is already done. Quick probes:

```bash
docker ps --format '{{.Names}} {{.Status}}'      # yenetta-postgres, yenetta-redis healthy?
curl -s http://localhost:3001/api/health          # API up?
git log --oneline -3 && git status -sb            # what code is this?
```

If the API is already up and the user only wants verification, jump to step 8.

## 1. Prerequisites (Windows)

- **Node 20+** (`node -v`).
- **pnpm via corepack.** `corepack enable` needs admin on Windows (it writes to
  `C:\Program Files\nodejs`). Install the shims per-user instead:
  `corepack enable --install-directory "$env:APPDATA\npm" pnpm` (create the
  directory first if it does not exist; it is normally on PATH).
- **Docker Desktop**, running. The user installs it (admin prompt + license).
  Installing is not starting: if the engine pipe is missing, launch
  `C:\Program Files\Docker\Docker\Docker Desktop.exe` and wait for
  `docker info` to succeed. Shells opened before the install do not have
  `docker` on PATH: prepend `C:\Program Files\Docker\Docker\resources\bin`.

## 2. Install

```bash
pnpm install
```

"Ignored build scripts" for Prisma/msgpackr is harmless: `prisma generate`
fetches the query and schema engines itself.

**Stop running dev servers before any install or `prisma generate`.** On
Windows the running API holds Prisma's engine DLL and Next holds its SWC
binary, so installs fail with EPERM.

## 3. Infra

```bash
pnpm docker:up
docker compose ps        # both healthy
docker exec yenetta-postgres psql -U yenetta -d yenetta -tAc "select extversion from pg_extension where extname='vector'"
```

## 4. Environment

```bash
node $S/init-env.mjs .            # creates .env with generated secrets; refuses to overwrite
```

It sets a test `ADMIN_PHONE` (`+251900000001`), a `CHAPA_WEBHOOK_SECRET` so
webhooks can be signed locally, and a blank `OPENAI_API_KEY`. Why blank
matters: the LLM factory treats **any** non-empty value as a real key, so the
`sk-...` placeholder style would route chat to OpenAI and fail. Never print or
commit `.env`.

If `.env` already exists, read which features it enables (without echoing
secret values): `OPENAI_API_KEY` set means real OpenAI calls (they cost money,
tiny amounts) and needs step 9.

## 5. Database

```bash
pnpm --filter @yenetta/api prisma:generate
pnpm --filter @yenetta/api prisma:migrate     # migrate deploy, all migrations
pnpm --filter @yenetta/api db:seed            # idempotent; promotes ADMIN_PHONE to admin
```

Drift check (should print "No difference detected"; run from `packages/api`,
via Git Bash - PowerShell mangles the arguments):

```bash
../../node_modules/.bin/prisma migrate diff --from-url "postgresql://yenetta:yenetta@localhost:5432/yenetta" --to-schema-datamodel prisma/schema.prisma --exit-code
```

## 6. Gates

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Run these (or `pnpm build`) before `pnpm dev` on a fresh clone: the turbo `dev`
task does not depend on `^build`, and the API imports `@yenetta/shared` and
`@yenetta/ingestion` from their `dist`.

## 7. Run the app

Start api and web separately as background processes. Avoid plain `pnpm dev`:
it also starts the parked Expo app, which can block on interactive prompts.

```bash
pnpm --filter @yenetta/api dev       # background
pnpm --filter @yenetta/web dev       # background
node $S/wait-for.mjs --timeout 240 http://localhost:3001/api/health http://localhost:3000/
```

Then **read the API boot log** for a `RetrievalService` warning like
"Content chunks embedded with another model are excluded from retrieval".
That means the active embedding model changed since the corpus was embedded:
do step 9 before judging any chat result.

## 8. Live checks

```bash
node $S/validate-live.mjs .          # ~1-2 min; add --skip-admin to skip admin/MFA
```

It walks every milestone's API (M0-M7), payments webhooks, admin RBAC,
upload-to-grounding, and the full admin TOTP flow, printing PASS / FAIL / SKIP
per check and exiting 1 on any FAIL. A `NOT WIRED (404)` detail means that
feature is not actually implemented, which is the single most important thing
to report. Read `references/troubleshooting.md` before calling a FAIL a bug:
several failure modes are environmental (rate limits, a stale embedding model,
MFA left on by an aborted run).

Also confirm the web routes serve (`/`, `/pricing`, `/login`, `/chat`,
`/study`, `/practice`, `/dashboard`, `/paywall`, `/admin`, `/robots.txt`,
`/sitemap.xml`; all should be 200). That proves they compile and serve, not
that the UI works; say so unless you actually clicked through.

## 9. After an embedding model change

Every chunk records the model that embedded it, and retrieval only searches
the active model's chunks (cross-model cosine similarity is meaningless). After
adding/changing `OPENAI_API_KEY` or `EMBEDDING_MODEL`:

```bash
pnpm --filter @yenetta/api db:reembed     # idempotent; second run re-embeds 0
node $S/similarity-probe.mjs .            # real models only
```

The probe prints top similarities for in- and out-of-curriculum questions and
the gap between them. The supporting floor defaults to 0.18 for the stub and
0.30 for real models (`RETRIEVAL_MIN_SIMILARITY` overrides). On the seed data
with `text-embedding-3-small` (2026-11-02): in-curriculum 0.31-0.73,
out-of-curriculum 0.08-0.21. Re-tune on the real corpus, and pass real
curriculum questions to the probe as extra arguments.

## 10. Report

Give the user a short report in this shape, then record it in `PROGRESS.md` if
it is a milestone check:

```markdown
## Yenetta validation - <date>, commit <short sha>
**Stack:** Docker <ver>, Postgres <ver> + pgvector <ver>, LLM <stub | OpenAI model>
**Gates:** lint / typecheck / test (<N> tests): pass | fail
**Live checks:** <P> passed, <F> failed, <S> skipped
**Not wired (404):** <routes, or "none">
**Failures:** <each FAIL: what, why (bug vs environment), evidence>
**Not verified:** <e.g. UI click-through, mobile, real Chapa/SMS>
```

Lead with what is actually broken or unverified. Name environment-caused
failures as such instead of letting them read as product bugs.

## Cleaning up

- Leave servers running if the user may want to click around; say so.
- Each validation run adds throwaway users, one payment, and one
  `validate-live-krebs-cycle.md` document (there is no delete route); SQL to
  clear them is in `references/troubleshooting.md`.
- Never reset or edit DB rows beyond the dev test data this workflow created,
  and never on anything but the local Docker database.
