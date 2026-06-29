<div align="center">

# 🔥 Yenetta

**AI study companion for Ethiopian high-school students (Grades 9–12)**

Grounded in the Ethiopian Ministry of Education curriculum and past national exams.

</div>

---

Yenetta ("የነታ" — the traditional Ethiopian scholar/teacher) is a **chat-first**
AI tutor. Students ask questions in natural language and every answer is
**grounded in the actual curriculum and past papers** (RAG, with citations) —
not generic internet knowledge. Around the chat sit structured **Study** and
**Exam Practice** tools, with an **offline-first Android app** for low-connectivity
study.

> **Status:** Milestone **M0 — Scaffold & tooling** complete. See
> [`PROGRESS.md`](./PROGRESS.md) for the milestone log and
> [`docs/BUILD_BRIEF.md`](./docs/BUILD_BRIEF.md) for the full build plan.

## Monorepo layout

```
yenetta/
├─ packages/
│  ├─ shared/        @yenetta/shared    — TS types, zod schemas, design tokens
│  ├─ api/           @yenetta/api       — NestJS backend (REST)
│  ├─ web/           @yenetta/web       — Next.js website + web app (Tailwind)
│  └─ ingestion/     @yenetta/ingestion — content pipeline worker
└─ apps/
   └─ mobile/        @yenetta/mobile    — Expo React Native app (offline-first)
```

## Tech stack

| Layer        | Choice                                             |
| ------------ | -------------------------------------------------- |
| Monorepo     | pnpm workspaces + Turborepo, TypeScript (strict)   |
| Backend      | NestJS (Node 20+), REST                            |
| Database     | PostgreSQL 16 + pgvector                           |
| Cache/queue  | Redis + BullMQ                                     |
| Web          | Next.js (App Router) + Tailwind CSS                |
| Mobile       | React Native (Expo), local SQLite, offline-first   |
| AI           | OpenAI (default) behind a provider abstraction     |
| Payments     | Chapa (sandbox first)                              |
| SMS (OTP)    | Pluggable (mock in dev)                            |

## Prerequisites

- **Node 20+** and **pnpm 10+** (`corepack enable` recommended)
- **Docker Desktop** (for Postgres + Redis)
- Works on **Windows / PowerShell**, macOS, and Linux

## Quick start

```powershell
# 1. Install deps and start Postgres (pgvector) + Redis
pnpm bootstrap          # = pnpm install && docker compose up -d

# 2. Create your env file (never commit the real one)
copy .env.example .env  # PowerShell;  cp .env.example .env on macOS/Linux

# 3. Boot api + web + mobile (hello-world screens)
pnpm dev
```

Then open:

- **Web app:** http://localhost:3000
- **API:** http://localhost:3001/api (try `/api/health`)
- **Mobile:** scan the Expo QR from the `pnpm dev` output (or `pnpm --filter @yenetta/mobile android`)

### Useful scripts (run from the repo root)

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `pnpm dev`         | Run api + web + mobile in dev (Turborepo)         |
| `pnpm build`       | Build all packages                                |
| `pnpm lint`        | ESLint across the monorepo                        |
| `pnpm typecheck`   | `tsc --noEmit` across the monorepo                |
| `pnpm test`        | Run unit/smoke tests (Vitest)                     |
| `pnpm format`      | Prettier write                                    |
| `pnpm docker:up`   | Start Postgres + Redis                            |
| `pnpm docker:down` | Stop them                                         |

## Architecture notes

- **Grounding via RAG, not fine-tuning.** Answers come from retrieved
  curriculum/exam chunks (pgvector) and cite their sources; the tutor says "not
  in the curriculum yet" rather than guessing.
- **Cost-controlled AI.** Cheap-model routing, cached shared outputs, per-tier
  quotas. Past-exam practice is pure retrieval ($0 in AI).
- **Data-residency aware.** `DATABASE_URL` (personal data) and
  `CONTENT_DATABASE_URL` (curriculum + embeddings) are independent so personal
  data can move to an in-country host without re-architecting.
- **Brand layer.** Design tokens live in `@yenetta/shared` and feed both the
  Tailwind theme (web) and the React Native styles (mobile), so the brand never
  drifts.

## Environment variables

Copy `.env.example` → `.env`. Secrets (`OPENAI_API_KEY`, `CHAPA_SECRET_KEY`,
JWT secrets, …) are **never** committed. See `.env.example` for the full list.

## License

Proprietary — © Yenetta. All rights reserved.
