# Yenetta — Claude Code Build Brief & Prompt

> **How to use this file.** This is the single source of truth for the build.
> The agent follows it milestone by milestone, pauses after each milestone for
> review, writes tests, and keeps `PROGRESS.md` and `README.md` up to date.

---

## 0. Agent operating instructions (read first)

You are building **Yenetta**, a production web + Android application. Work in **milestones M0–M7** (defined in §10). After completing each milestone:

1. Run the milestone's **acceptance checks** and show they pass.
2. Update `PROGRESS.md` (what was done, decisions made, what's next) and `README.md`.
3. Commit with a clear conventional-commit message and **stop for human review** before starting the next milestone.

Rules:

- **Do not invent product scope.** Build what's in this brief. If something is ambiguous, make the smallest reasonable choice, **write it down in `PROGRESS.md` under "Assumptions,"** and continue.
- **Never commit secrets.** All keys come from `.env` (provide `.env.example` only).
- **Write tests** for backend business logic (auth, entitlements, quotas, retrieval, payments webhook) and smoke tests for the apps.
- **TypeScript strict mode everywhere.** Lint + format must pass before each commit.
- The developer is on **Windows**; all setup commands must work in **PowerShell** with **Docker Desktop**. Provide a one-command dev bootstrap.

---

## 1. What Yenetta is

Yenetta ("የነታ" — the traditional Ethiopian scholar/teacher) is an **AI study companion for Ethiopian high-school students (Grades 9–12)**, grounded in the Ethiopian Ministry of Education curriculum and past national exams.

The product is **chat-first** — students talk to it in natural language like they would ChatGPT/Claude ("Explain Chapter 4", "I have a chemistry mid-exam next week", "test me before tomorrow's quiz", "I'm preparing for the university entrance exam") — but every answer is **grounded in the actual curriculum and past papers**, not generic internet knowledge. Around the chat sit structured **Study** and **Exam Practice** tools.

It supports the full school year (homework, classwork, quizzes, mid-exams, finals) and becomes a dedicated **University Entrance Exam (ESSLCE/EUEE) coach** for Grade 12, where every past-exam question is linked to the textbook chapter that teaches it.

### Core product principles (do not violate)

- **Grounding via RAG, NOT fine-tuning.** The model must answer from retrieved curriculum/exam content and **cite its sources**. When the retrieved context does not support an answer, it must say so rather than guess. A wrong "correct answer" is reputationally fatal for an exam product.
- **Offline-first on Android.** Ethiopian mobile data is expensive and intermittent. Past-exam practice, downloaded summaries, flashcards and the spaced-repetition scheduler must work with **no connection**; only live AI generation and sync require data.
- **Cost-controlled AI.** Cheap-model routing, caching of shared generated outputs, prompt caching of stable curriculum context, and per-tier quotas are first-class requirements (§8). Past-exam practice is pure retrieval and must cost **$0 in AI**.
- **Data-residency aware.** Ethiopia's Personal Data Protection Proclamation 1321/2024 requires locally-collected personal data to be storable in-country. Architect a **clean split** between _personal data_ (accounts, payments, performance, chat history) and _non-personal content_ (curriculum, embeddings), so personal data can be hosted on an in-country DB without re-architecting.

---

## 2. Branding & design system

Brand assets are provided as two logo files (drop them into `packages/web/public/brand/` and `apps/mobile/assets/brand/`):

- **Latin wordmark** — "Yenetta AI" in gold; use in web/app headers.
- **Amharic mark** "የነታ" with a flame above; the **flame is the app icon / favicon**.

Use the product name **"Yenetta"** everywhere (repo, package names, app IDs, copy). The header may render the wordmark as "Yenetta AI."

**Color tokens** (sampled from the logos — put these in a shared theme):

| Token             | Hex                          | Use                                       |
| ----------------- | ---------------------------- | ----------------------------------------- |
| `gold` (primary)  | `#B08A45`                    | primary brand, buttons, links, active     |
| `gold-deep`       | `#8A5D21`                    | hovers, gradients                         |
| `bronze`          | `#633D0D`                    | dark accent, gradient end, icon ink       |
| `flame-gradient`  | `#633D0D → #8A5D21 → #B08A45`| logo/icon, hero accents                   |
| `cream` (surface) | `#F4ECDF`                    | warm cards / sections                     |
| `paper` (bg)      | `#F7F7F5`                    | app background                            |
| `ink` (text)      | `#2A2118`                    | primary text (warm near-black)            |
| `muted`           | `#6B6256`                    | secondary text                            |
| `success`/`warn`/`error` | standard              | feedback states                           |

**Typography:** Latin UI — a warm rounded sans (**Poppins** or **Outfit**) for headings, **Inter** for body. Amharic — **Noto Sans Ethiopic**. **Design feel:** clean, warm, premium, calm. Light mode first; dark mode is a nice-to-have.

---

## 3. Tech stack (locked)

**Monorepo:** pnpm workspaces + **Turborepo**. TypeScript throughout, strict mode. Shared types package consumed by web, mobile, and api.

| Layer              | Choice                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Backend API        | **NestJS** (Node 20+), REST (+ optional WebSocket for streaming chat) |
| Database           | **PostgreSQL 16 + pgvector**                                          |
| ORM / migrations   | **Prisma**                                                            |
| Cache / queue      | **Redis** + **BullMQ**                                                |
| Web                | **Next.js (App Router)**, Tailwind CSS                                |
| Mobile             | **React Native (Expo)** — offline-first, local **SQLite**            |
| Auth               | Phone + **OTP**; JWT access + refresh; server-side entitlement checks |
| AI provider        | **OpenAI** (default), behind a **provider abstraction**              |
| Payments           | **Chapa** (sandbox/mock first)                                       |
| SMS (OTP)          | Pluggable: **mock in dev**, adapter for AfroMessage/Twilio          |
| Containerization   | **Docker + Docker Compose**                                          |
| i18n               | English now; Amharic in Phase 2                                       |

**Naming:** repo `yenetta`; packages `@yenetta/shared|api|web|mobile|ingestion`; appId `com.yenetta.app`; domain env-configurable (`SITE_URL` default `https://www.yenetta.com`).

---

## 10. Milestones (build in this order; pause for review after each)

### M0 — Scaffold & tooling

Monorepo (pnpm + Turborepo), `shared` package with design tokens + base types, NestJS api skeleton, Next.js web skeleton, Expo mobile skeleton, **Docker Compose** (Postgres+pgvector, Redis), `.env.example`, ESLint/Prettier, husky + conventional commits, basic CI, push to the GitHub repo.

**Acceptance:** `docker compose up` brings up DB+Redis; `pnpm dev` boots api + web + mobile to hello-world screens that read the brand theme; `pnpm lint && pnpm test` pass; repo pushed.

### M1 — Backend core

DB schema + migrations; phone+OTP auth (mock SMS) with JWT; users/profile; curriculum taxonomy; provider abstractions (LLM, SMS, Payment) stubbed; entitlements skeleton (free tier default).

### M2 — Content pipeline + RAG + grounded chat

`ingestion` worker (OCR → clean → classify → chunk → embed → pgvector); admin upload UI; seed sample dataset; scoped vector retrieval; grounded tutor chat with citations + honest fallback; cost-control middleware.

### M3 — Study & exam features (backend + API)

Chapter summaries, study notes, flashcards (+ spaced repetition), AI quizzes; past-exam practice by year/chapter ($0 AI); timed mock exams; progress + weak-area detection; per-chapter caching.

### M4 — Website (Next.js)

Marketing/landing pages + web app: auth UI, chat-first home, Study, Exam Practice, dashboard/progress, paywall UI.

### M5 — Android app (Expo, offline-first)

Auth, chat-first home, Study, Exam Practice, downloads + local SQLite cache, offline study, background sync, paywall.

### M6 — Payments & entitlements end-to-end

Chapa sandbox checkout, webhook verification, subscription → entitlement enforcement (web + mobile), per-tier quotas, failed/lapsed handling, signed offline entitlement token.

### M7 — Phase 2

Long-term memory; personalized study plans; deep analytics + study guides; streaks/XP/leaderboards; Amharic i18n + "explain in Amharic".

---

> The full, authoritative brief (including §4 RAG architecture, §5 data model,
> §6 feature scope, §7 auth/payments, §8 cost control, §9 security/compliance,
> §11 env vars, §12 conventions) was provided to the build agent. This file
> captures the operating instructions, brand, stack, and milestone plan that
> drive day-to-day work. Keep it in sync if the plan changes.
