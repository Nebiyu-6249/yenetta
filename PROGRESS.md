# Yenetta — Progress Log

Milestone-by-milestone build log. Updated at the end of every milestone, then
committed before pausing for human review (see `docs/BUILD_BRIEF.md` §0).

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
