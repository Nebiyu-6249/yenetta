# Yenetta — Progress Log

Milestone-by-milestone build log. Updated at the end of every milestone, then
committed before pausing for human review (see `docs/BUILD_BRIEF.md` §0).

---

## ✅ M1 — Backend core — _complete (2026-06-29)_

### What was done

- **Data model (Prisma):** the full §5 schema — 25 tables across a **personal-data
  domain** (users, auth_otps, refresh_tokens, subscriptions, payments, progress,
  weak_areas, chat, sr_cards, quiz/mock attempts, usage_events, quotas) and a
  **content domain** (subjects, chapters, content_documents, content_chunks with
  a `vector(1536)` pgvector column, exam_papers/questions, flashcards, quizzes,
  mock_exams, generated_content). Cross-domain references are **plain string IDs,
  not FKs**, so the personal-data tables can move to an in-country DB later (§9).
- **Migration:** initial migration generated and applied; pgvector extension +
  `vector(1536)` column verified on a live Postgres 16.
- **Phone + OTP auth:** `POST /auth/otp/request` (rate-limited, mock SMS logs the
  code, dev code returned outside production), `POST /auth/otp/verify`
  (peppered-hash check, attempt lockout, consumes the code), `POST /auth/refresh`
  (rotating refresh tokens, persisted hashed, old token revoked). JWT access +
  refresh via `@nestjs/jwt`.
- **Global auth:** `JwtAuthGuard` as an `APP_GUARD` — every route requires a valid
  access token unless `@Public()`. `@CurrentUser()` injects the user id.
- **Users/profile:** `GET /users/me`, `PATCH /users/me` (name, grade, stream,
  locale), composed with the resolved entitlement.
- **Curriculum taxonomy:** `GET /subjects` (filter by grade/stream),
  `GET /subjects/:id`, `GET /subjects/:id/chapters` — auth-protected, served from
  seeded data.
- **Provider abstractions (wired, stubbed):** `LlmProvider` (OpenAI skeleton +
  deterministic stub, env-selected with key-presence fallback), `SmsProvider`
  (mock + AfroMessage/Twilio adapter stubs), `PaymentProvider` (Chapa skeleton).
- **Entitlements skeleton:** server-side resolver, **free tier default**,
  env-driven per-tier quotas (pure `quotasForTier` + DB-backed `resolve`).
- **Config:** zod-validated env (`validateEnv`) with a typed `ENV` DI token;
  fail-fast on misconfiguration. zod `ZodValidationPipe` for all request bodies.
- **Seed:** idempotent sample dataset (3 subjects, 7 chapters, 4 quota rows).
- **Tests:** 20 new unit tests (OTP gen/hash/rate-limit/verify/lockout, JWT
  issue/verify/rotate/revoke, entitlement resolution, provider factories).

### Acceptance checks

Verified end-to-end against a **live Postgres 16 + pgvector** (migrated + seeded):

| Check | Result |
| --- | --- |
| Register/login via OTP (dev code in response + logs) | ✅ `otp/request` returns `devCode`; `otp/verify` returns user + entitlement + tokens |
| Seeded subjects/chapters queryable via API | ✅ `GET /subjects`, `?grade=12` filter, `/subjects/:id/chapters` all return seeded rows |
| Auth-protected route works | ✅ `/users/me` → 401 without token, 200 with valid token |
| Unit tests for auth + entitlements pass | ✅ 20/20 (26 across the monorepo) |
| Extras demonstrated | ✅ OTP rate-limit (6th req → 429), bad input → 400, profile persists, refresh rotation + old-token revocation (→ 401) |

`pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.

### Decisions

- **Personal/content split via plain-ID references** (no cross-domain FKs) is the
  concrete mechanism for the §9 data-residency requirement. Both `DATABASE_URL`
  and `CONTENT_DATABASE_URL` exist in env; M1 runs on a single datasource and the
  physical split is a deploy-time change (no re-architecting needed).
- **OTP hashing** = HMAC-SHA256 peppered with `JWT_ACCESS_SECRET` (deterministic
  lookup-by-phone, never store plaintext). **OTP rate-limiting is DB-based** for
  M1 (counts recent rows); the Redis-backed global limiter lands with the
  cost-control middleware in M2.
- **Refresh tokens carry a `jti`** so two tokens issued in the same second stay
  unique (found + fixed a unique-constraint bug during live testing).
- **Provider stubs throw `NotImplementedException`** for not-yet-built methods so
  accidental use fails loudly; the LLM stub returns deterministic output so dev
  and tests work without an API key.
- **`tsBuildInfoFile` pinned into `dist`** for the emitting packages so
  `nest build`/`tsc` never skip emit after `dist` is deleted.

### Assumptions

- Curriculum browse requires auth (it's a student feature); this also satisfies
  the "auth-protected route works" acceptance.
- The seed is a small synthetic taxonomy so the API is queryable now; the real
  OCR-ingested corpus + embeddings arrive in M2.

### Next — M2 (Content pipeline + RAG + grounded chat)

- `ingestion` worker: OCR → clean → classify → chunk → embed → pgvector.
- Admin upload UI; seed a small synthetic content dataset with embeddings.
- Scoped vector retrieval; grounded tutor chat with citations + honest fallback.
- Cost-control middleware online (routing, caching, quotas, usage logging).

**Pausing for human review before starting M2.**

---

## ✅ M0 — Scaffold & tooling — _complete (2026-06-29)_

### What was done

- **Monorepo:** pnpm workspaces + Turborepo (`turbo.json`), TypeScript strict
  everywhere via a shared `tsconfig.base.json`. Workspaces:
  `packages/{shared,api,web,ingestion}` and `apps/mobile`.
- **`@yenetta/shared`:** design tokens (the brand color palette, flame gradient,
  typography, spacing, radii), base domain types (`Grade`, `Stream`,
  `SubscriptionTier`, `UserProfile`, `Subject`, `Chapter`, `CitedSource`),
  and shared constants. Built to `dist` (CommonJS) for cross-runtime use.
- **`@yenetta/api`:** NestJS skeleton — `AppModule`, `AppController` (branded
  info), `HealthController` (`/api/health`), global `api` prefix, CORS, config
  module reading the repo-root `.env`.
- **`@yenetta/web`:** Next.js (App Router) + Tailwind. Tailwind theme is wired
  to the shared tokens; hello-world home page renders the wordmark and primary
  gold from `@yenetta/shared`. Poppins (headings) + Inter (body) via `next/font`.
- **`@yenetta/ingestion`:** worker skeleton with the typed pipeline stages
  (`uploaded → ocr → cleaned → classified → embedded`) — real logic lands in M2.
- **`@yenetta/mobile`:** Expo React Native skeleton — hello-world screen reading
  the shared brand tokens, monorepo-aware `metro.config.js`, `app.json` with
  `com.yenetta.app` IDs and brand colors.
- **Infra:** `docker-compose.yml` (pgvector/pg16 + Redis 7 with healthchecks);
  a Postgres init script enabling the `vector` extension; `.env.example` with
  the full variable set from the brief (§11), including the personal-data vs
  content DB split.
- **Quality gates:** ESLint flat config (shared base + per-package), Prettier,
  Husky `pre-commit` (lint) + `commit-msg` (commitlint, conventional commits),
  GitHub Actions CI (`install → build shared → lint → typecheck → test`).
- **Tests:** Vitest unit/smoke tests for shared tokens, api controller,
  ingestion pipeline, and mobile brand wiring.
- **Docs:** `README.md` (setup + architecture), `docs/BUILD_BRIEF.md`,
  brand-asset placeholder READMEs in web/public and mobile/assets.

### Acceptance checks

| Check | Result |
| --- | --- |
| `docker compose config` valid (pgvector + Redis) | ✅ valid (`docker compose up` works on Docker Desktop) |
| `pnpm lint` | ✅ pass (0 errors, 0 warnings) |
| `pnpm typecheck` | ✅ pass (all 5 packages, incl. Next.js + Expo) |
| `pnpm test` | ✅ pass (7 tests across 5 packages) |
| Hello-world screens read the brand theme | ✅ web + mobile render wordmark/colors from `@yenetta/shared` |

> Note: the Docker daemon is not available in the build CI sandbox, so the
> containers were validated via `docker compose config` rather than a live
> `up`. On the developer's Docker Desktop, `pnpm docker:up` brings up DB+Redis.

### Decisions

- **Prisma over Drizzle** for the ORM (per brief default) — added in M1.
- **`@yenetta/shared` compiles to CommonJS** and is consumed from `dist`. This
  is the most compatible target across NestJS (CJS), Next.js, and Expo/Metro,
  and avoids ESM/CJS interop friction. Turbo's `^build` ensures it builds first.
- **pnpm `node-linker=hoisted`** (`.npmrc`) so Expo/Metro and Next bundlers get
  a flat-ish `node_modules` they're known to be happy with in a monorepo.
- **Vitest** for unit/smoke tests (fast, no Jest/Babel config sprawl). Mobile
  RN screens are smoke-tested via Expo on a device/emulator; Vitest covers the
  pure-logic/brand wiring.
- **Web dev port pinned to 3000** in the script (no shell-specific env
  expansion) so `pnpm dev` works in PowerShell as well as POSIX shells.

### Assumptions

- Real logo image files are not in the repo yet; the UI falls back to a 🔥
  emoji + "Yenetta AI" text. Placeholder READMEs document where to drop the
  provided assets (`packages/web/public/brand/`, `apps/mobile/assets/brand/`).
- `docs/BUILD_BRIEF.md` captures the operating instructions, brand, stack, and
  milestone plan. The full §4–§9/§11–§12 detail from the original brief drives
  the later milestones and is summarized there.

### Next — M1 (Backend core)

- Prisma schema + migrations for the core tables (§5).
- Phone + OTP auth (mock SMS, dev code in logs) with JWT access/refresh.
- Users/profile (grade, stream); curriculum taxonomy (subjects/chapters).
- Provider abstractions (LLM, SMS, Payment) wired but stubbed.
- Entitlements skeleton (free tier default). Unit tests for auth + entitlements.

**Pausing for human review before starting M1.**
