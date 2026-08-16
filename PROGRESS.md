# Yenetta — Progress Log

Milestone-by-milestone build log. Updated at the end of every milestone, then
committed before pausing for human review (see `docs/BUILD_BRIEF.md` §0).

---

## Security & Hardening arc — _complete (2026-08-16)_

Applied the Security & Hardening Build Delta on top of M0-M7. Each batch was
verified (lint + no-emoji + typecheck + tests, and live against Postgres +
pgvector where applicable), then committed and pushed. Tracker: `docs/SECURITY.md`.

### What was done

- **Transport / app hardening:** Helmet (HSTS/CSP/referrer/CORP), CORS allowlist
  (never `*`), request body-size cap, production error sanitization
  (`AllExceptionsFilter`), Next.js security headers.
- **Auth / abuse:** per-IP rate limiting on OTP + auth routes; rotating,
  revocable refresh tokens with `jti`.
- **Uploads / RAG isolation:** magic-byte upload validation; `content_chunks`
  carry `visibility` + `ownerId`; retrieval returns only PUBLIC plus the
  requester's OWN private chunks; private answers never enter the shared cache
  (LLM04/LLM08). `/admin/documents` (admin, public) vs `/me/documents`
  (private notes).
- **Payments:** webhook verifies amount + currency against the recorded payment;
  server-side pricing; audited grants.
- **Audit log:** append-only `audit_events` (actor + IP + safe metadata), admin
  read endpoint behind RBAC.
- **Admin RBAC:** `role` on users + `@Roles` + `RolesGuard` (student -> 403,
  admin -> 200, verified live).
- **DB least-privilege + RLS:** `packages/api/prisma/sql/rls-and-least-privilege.sql`
  provisions a DML-only `yenetta_app` role and FORCEs row-level security on all
  user-scoped tables keyed on `app.user_id`. Verified live: per-user isolation,
  cross-tenant write rejected, DDL denied. (App-role cutover deferred.)
- **Admin TOTP MFA:** RFC 6238 (no new dependency), secret encrypted at rest
  (AES-256-GCM), `/me/mfa` enroll/confirm/disable, and login enforcement (OTP
  yields only a short-lived challenge; `/auth/mfa/verify` completes). Verified
  live end to end.
- **PII redaction:** `redactPii`/`redactPiiDeep` scrub email/phone from LLM
  egress and audit metadata; the student's own message is still stored verbatim.
- **No-emoji rule:** `scripts/check-no-emoji.mjs` fails CI on any emoji codepoint.
- **Supply chain:** `.github/dependabot.yml` + a CI `security-scan` job
  (gitleaks secret gate + `pnpm audit --prod --audit-level=critical` gate +
  non-blocking advisory report).

### Next session — validate the core, start the pilot (features paused)

No new features. Focus:

1. **Validate the core end to end** against real infra (Postgres + pgvector +
   Redis): OTP login, grounded chat with citations + honest fallback, quota
   enforcement, uploads + ingestion, payments (Chapa sandbox), admin MFA login.
   Confirm the full `pnpm test` suite and a manual smoke on web + mobile.
2. **Pilot prerequisites:** load real curriculum content (replace seed
   placeholders), set real secrets/env (`.env` from `.env.example`, incl.
   `ADMIN_PHONE`, Chapa sandbox keys, SMS provider), decide hosting + run the
   RLS/least-privilege SQL and the app-role cutover, and walk the pre-launch
   security gate in `docs/SECURITY.md`.
3. **Open items to weigh before pilot:** high-severity dependency backlog (via
   Dependabot), CAPTCHA on OTP, and container image scanning once deploy
   Dockerfiles exist.

---

## M7 — Phase 2 (memory, plans, analytics, gamification, Amharic) — _complete (2026-06-29)_

### What was done

- **DB migration** adding the Phase-2 tables: `study_plans` + `study_plan_items`,
  `learning_profiles` (long-term memory), `user_stats` (XP/streak/level/opt-in).
- **Shared, pure algorithms (`@yenetta/shared`):** `buildStudySchedule`
  (spreads chapters across days to an exam date within a daily budget),
  gamification (`xpForActivity`, `levelForXp`, `updateStreak`), and an **i18n
  catalog (en + am) with `t()`** — all unit-tested.
- **Long-term memory (`MemoryService`):** builds a learning profile from the
  student's weak chapters and injects it into the tutor prompt, so **sessions
  resume with memory of prior mistakes/mastery**. `GET /memory`.
- **Personalized study plans (`PlansService`, Premium):** generate from an exam
  date + daily minutes (weak chapters first), `adapt` re-prioritizes the
  remaining items by current mastery, mark items complete. `POST /plans`,
  `GET /plans/current`, `POST /plans/:id/adapt`.
- **Deep analytics + study guides:** `GET /analytics` (progress + weak areas +
  stats); premium per-chapter **study guides** (`GET /chapters/:id/study-guide`).
- **Streaks / XP / opt-in leaderboard (`StatsService`):** XP awarded on chat,
  quiz, practice, and mock; daily streaks; levels; `GET /stats`,
  `GET /leaderboard`, opt-in toggle.
- **Amharic i18n + "explain in Amharic":** the grounded prompt takes a
  `language` option (adds an Amharic instruction + the memory context); chat
  accepts `language: 'am'`. The web app has a **locale toggle** (EN/አማ) that
  switches UI strings via the shared catalog and sends Amharic chat requests.
- **Premium gating** applied to plans and study guides (+ M6 mock exams).

### Acceptance checks

Verified end-to-end against the live database:

| Check | Result |
| --- | --- |
| Study plan generated from an exam date | 7 scheduled items across days; weak chapters first |
| Plan adapts to performance | `adapt` re-prioritizes remaining items by current mastery |
| Sessions resume with memory | learning profile (“still working on: Acids, Bases and Salts”) injected into the grounded prompt |
| Toggling Amharic switches UI strings + Amharic explanations | shared `t('am', …)` strings; grounded chat with `language='am'` carries an Amharic instruction (web EN/አማ toggle) |
| Premium gating applied | plans & study guides 402 for free, 200/201 for premium |
| Streaks / XP / leaderboard | XP awarded per activity (practice +15, chat +2), streak, opt-in leaderboard |

`pnpm lint`, `pnpm typecheck`, `pnpm test` (77 tests) all pass; `next build` OK.

### Decisions

- **Memory is derived from progress** (weak chapters) and injected as a short
  prompt context — deterministic and cheap; richer episodic memory can layer on.
- **Amharic explanations** are driven by a prompt instruction (real Amharic text
  comes from OpenAI; the offline stub stays English). UI strings are fully
  switchable now via the shared catalog.
- **Plans prioritize weak chapters first**, then unstudied, then mastered; the
  schedule is a pure function so it's reproducible and testable.
- Mobile consumes the same shared i18n catalog; full mobile screen localization
  is a fast follow (the `t()` plumbing is in place).

### Build complete

All milestones **M0–M7** are implemented, tested, and pushed. The product spans:
a grounded RAG tutor, study + exam tools with spaced repetition, an offline-first
Android app, Chapa payments with entitlement enforcement, and Phase-2 memory /
plans / analytics / gamification / Amharic.

---

## M6 — Payments & entitlements end-to-end — _complete (2026-06-29)_

### What was done

- **Chapa provider (real):** checkout initialization (Chapa `transaction/
  initialize`, with a mock URL fallback when no key), **HMAC-SHA256 webhook
  signature verification** (timing-safe), and webhook parsing. Sandbox by
  default; flip to live by swapping keys — no code change.
- **Payments module:** `POST /payments/checkout` (records a pending payment,
  returns a checkout URL), `POST /payments/webhook` (raw-body, signature-
  verified, **idempotent** — a payment already `success` is a no-op so duplicate
  deliveries can't double-grant), and `POST /payments/voucher` (scratch-code
  redemption stub). Successful payment **creates or extends** a Premium
  subscription by one period.
- **Entitlement enforcement:** `PremiumGuard` gates premium-only endpoints
  (timed mock exams); free vs premium daily AI quotas already enforced in
  chat/study now differ live by subscription. Lapsed/expired subscriptions
  **auto-downgrade at read time** (the resolver only counts active, unexpired
  subscriptions) — progress is never deleted. An `expireLapsed()` sweep tidies
  statuses for reminders/analytics.
- **Signed offline entitlement token:** `GET /entitlements/token` issues a JWT
  (tier + expiry, capped to 7 days) the mobile app caches; offline premium ends
  when the token lapses, forcing a periodic online refresh.
- **Web + mobile wired:** the web paywall starts a real Chapa checkout and
  redeems vouchers; the mobile Profile screen opens checkout, redeems vouchers,
  caches the signed entitlement token, and falls back to it for **offline
  premium gating**.
- **Tests:** payments (checkout, verified-webhook activation, idempotency,
  signature rejection, subscription extension, voucher) + signed-token issuance.

### Acceptance checks

Verified end-to-end against the live database:

| Check | Result |
| --- | --- |
| Buy Premium (sandbox) → unlock | checkout → **signed webhook** → tier `premium`, daily AI limit 20 → 300 |
| Premium features unlock | premium-gated mock exam: 402 (free) → 201 (premium) |
| Simulate expiry → auto-downgrade (progress retained) | expired subscription → tier `free`, mock 402 again; data intact |
| Quota enforcement | free 20 / premium 300 resolved from the live subscription |
| Webhook idempotency | re-delivery returns `idempotent`; exactly one subscription row |
| Invalid signature rejected | HTTP 401 |
| Signed offline entitlement token | JWT issued (tier + 7-day expiry) for mobile caching |

`pnpm lint`, `pnpm typecheck`, `pnpm test` (71 tests) all pass.

### Decisions

- **Read-time downgrade**: the entitlements resolver already excludes
  expired/inactive subscriptions, so expiry downgrades automatically with no
  cron on the critical path; the sweep is for tidy statuses + future reminders.
- **No silent auto-renew** (mobile money is unreliable): checkout is an explicit
  re-purchase; vouchers are an alternative top-up.
- **Webhook needs the raw body** for HMAC, so Nest is bootstrapped with
  `rawBody: true` and the route is `@Public()` (authenticated by signature).
- The offline token is **capped at 7 days** so a cached premium token can't
  outlive a lapsed pass indefinitely.

### Assumptions

- Without `CHAPA_SECRET_KEY`, checkout returns a mock URL and the purchase is
  completed via the (signed) webhook — the live flow is identical once real
  sandbox keys are set. The dev voucher code is `YENETTA-PREMIUM`.

### Next — M7 (Phase 2)

- Long-term memory / learning profile; personalized study plans; deep analytics
  + study guides; streaks/XP/leaderboards; Amharic i18n + "explain in Amharic".

**Pausing for human review before starting M7.**

---

## M5 — Android app (Expo, offline-first) — _complete (2026-06-29)_

### What was done

- **Offline engine (`apps/mobile/src/lib/offline`)** — the heart of M5, written
  framework-free so it's fully unit-tested:
  - `OfflineStore` interface with two implementations: `SqliteOfflineStore`
    (expo-sqlite, on-device) and `InMemoryOfflineStore` (tests/fallback).
  - `DownloadService` — caches a chapter's study pack (summary, notes,
    flashcards) and a year's past-paper questions **with answers** for offline
    grading; seeds SM-2 cards for new flashcards.
  - `OfflineSrs` — spaced repetition that runs entirely on-device (shared SM-2).
  - `OfflinePractice` — grades cached past-papers locally (shared grader) and
    **queues the attempt** for sync.
  - `SyncService` — flushes queued mutations to the server on reconnect; keeps
    the queue intact while offline.
- **Shared grading moved to `@yenetta/shared`** so the device and server grade
  identically; a new `GET /exams/practice/download` returns full questions
  (with answers) for caching.
- **App layer:** AsyncStorage token storage, an API client (also satisfying the
  offline `RemoteApi` contract) with refresh-on-401, NetInfo connectivity hook,
  an `OfflineDataProvider` that inits SQLite and auto-flushes the sync queue when
  back online, and an `AuthProvider`.
- **Screens (Expo/React Native):** phone+OTP login, chat-first **Tutor**,
  **Study** (download chapters, open offline), **Chapter** (summary/notes/
  flashcard review with grade buttons), **Practice** (download → on-device
  grading), and **Profile/Paywall**. Tab navigation, an offline banner, and the
  brand theme sourced from shared tokens. `com.yenetta.app`.

### Acceptance checks

| Check | Result |
| --- | --- |
| Offline study works with no network | unit-tested: cached chapter → flashcard SR review reschedules offline |
| Cached past-paper practice offline | unit-tested: download → grade locally → queue attempt (no network) |
| Reconnect → progress syncs | unit-tested: `SyncService.flush` posts queued attempts; queue preserved while offline |
| Core flows (auth, chat, study, practice, paywall) | implemented as RN screens; typecheck passes |
| Lint / typecheck / tests | `pnpm lint`, `pnpm typecheck`, `pnpm test` (64) all pass |

> The offline engine (download, on-device SR, on-device grading, reconnect sync)
> is verified by unit tests against the in-memory store; `SqliteOfflineStore`
> mirrors it for the device. The airplane-mode click-through on an emulator is
> for the developer to run (`pnpm --filter @yenetta/mobile android`).

### Decisions

- **Spaced repetition is local-only** on the device (per-device SR state is the
  norm and works fully offline); the sync queue carries practice/quiz attempts,
  which is what updates server-side progress.
- **Past-paper answers are downloaded** for offline grading via a dedicated
  download endpoint. (Encrypt-on-device + watermarking per §9 is a follow-up.)
- **State-based tab navigation** (no router dependency) keeps the MVP simple and
  typecheck-clean; swap to expo-router/React Navigation later.
- The offline services depend on interfaces (`OfflineStore`, `RemoteApi`) so the
  whole engine is testable without a device.

### Assumptions

- `EXPO_PUBLIC_API_URL` points the app at the API. The practice screen uses the
  seeded 2015 paper as the demo download; chapter downloads come from `/study`.

### Next — M6 (Payments & entitlements end-to-end)

- Chapa sandbox checkout, webhook verification, subscription → entitlement
  enforcement (web + mobile), per-tier quotas live, failed/lapsed handling,
  signed offline entitlement token.

**Pausing for human review before starting M6.**

---

## M4 — Website (Next.js) — _complete (2026-06-29)_

### What was done

- **Marketing site (SSR/SEO):** a branded landing page (hero, features,
  principles, CTA) and a **pricing** page, both server-rendered. Metadata
  (title template, description, OpenGraph/Twitter), `robots.txt`, and
  `sitemap.xml` are wired; app/admin routes are disallowed from indexing.
- **Auth UI:** phone + OTP login (`/login`) — request code → verify → tokens
  stored client-side; the dev code is surfaced in non-production.
- **App client foundation:** a typed API client (`lib/api.ts`) with bearer auth
  and automatic refresh-on-401, and an `AuthProvider` + `useRequireAuth` guard.
- **Chat-first home (`/chat`):** the hero surface — message the tutor, see
  grounded answers with **source chips** and an honest "not in the curriculum"
  marker; quota-limit (429) prompts an upgrade.
- **Study (`/study`, `/study/[chapterId]`):** browse subjects → chapters, then a
  tabbed chapter view — Summary, Notes, flip **Flashcards**, and an interactive
  **Quiz** that grades against the API.
- **Exam Practice (`/practice`):** past-paper practice (answer → graded with
  explanations) and **timed mock exams** with a live countdown.
- **Dashboard (`/dashboard`):** per-chapter mastery bars and focus (weak) areas.
- **Paywall (`/paywall`) + plan cards:** Free vs Premium, current-plan aware,
  with the Chapa checkout note (wired in M6).
- **Design system:** a small UI kit (Button, Card, Badge, Spinner, Logo) on the
  Yenetta brand tokens — warm, calm, premium; light mode; responsive with a
  mobile nav.

### Acceptance checks

| Check | Result |
| --- | --- |
| Production build of the whole site | `next build` — all 14 routes; marketing pages static |
| Marketing SSR + SEO | `<title>`, meta description, hero copy render server-side; `robots.txt` + `sitemap.xml` 200 |
| Full journey wired | sign up → chat → study a chapter → practice a paper → paywall (client routes build + target the verified API) |
| Lint / typecheck / tests | `pnpm lint`, `pnpm typecheck`, `pnpm test` (58) all pass |

> The marketing SSR/SEO and the production build of every app route were verified
> here; the click-through journey runs against the M1–M3 API that this typed
> client targets (all of which was verified end-to-end in earlier milestones).

### Decisions

- **Whole repo aligned on React 19.** Next 15 requires React 19, so mobile was
  bumped to **Expo SDK 53** (React 19 / RN 0.79) and `react`/`react-dom` pinned
  via pnpm overrides — this removes the React 18/19 split that otherwise paired
  mismatched copies under the hoisted node-linker (which broke `next build`).
- **Auth tokens in `localStorage`** with refresh-on-401 for the MVP; httpOnly
  cookies are a future hardening step.
- **App pages are client components** behind a client-side auth guard; marketing
  pages stay server components for SEO.

### Assumptions

- `NEXT_PUBLIC_API_URL` points the web app at the API (default
  `http://localhost:3001`). The admin page and app pages need the API running.

### Next — M5 (Android app, offline-first)

- Expo app: auth, chat-first home, Study, Exam Practice, **downloads + local
  SQLite cache**, offline study (cached content, flashcards, SR in airplane
  mode), background sync, paywall.

**Pausing for human review before starting M5.**

---

## M3 — Study & exam features — _complete (2026-06-29)_

### What was done

- **Shared, pure algorithms (`@yenetta/shared`):** an **SM-2 spaced-repetition
  scheduler** (`scheduleSm2`, isomorphic so it also runs offline on mobile) and
  **deterministic extractive generators** (`buildSummary/Notes/Flashcards/Quiz`)
  that produce study content from chapter text at $0 AI — swappable for
  abstractive LLM generation behind the same shapes.
- **Study generators + caching (`StudyService`):** per-chapter summary, study
  notes, flashcards, and fill-in-the-blank quizzes. Generated **once and cached**
  in `generated_content` (keyed by chapter+type+version); flashcards and quizzes
  are also persisted as rows so SRS and quiz-taking can reference them. Quota
  checked + usage logged per request (cache hits cost nothing).
- **Spaced repetition (`SrsService`):** seeds SR cards from a chapter's
  flashcards, lists due cards, and reschedules on review via SM-2
  (`GET /srs/due`, `POST /srs/review`).
- **Quizzes:** `GET /chapters/:id/quiz` returns questions without answers;
  `POST /quizzes/:id/attempts` grades, persists the attempt, and updates mastery.
- **Past-exam practice (`ExamsService`, $0 AI):** `GET /exams/papers`,
  `GET /exams/practice` (by year/chapter/subject, answers hidden), and
  `POST /exams/practice/submit` — pure DB grading with stored explanations.
- **Timed mock exams:** `GET /exams/mocks`, `POST /exams/mocks/:id/start`
  (returns questions + duration + an attempt id), and
  `POST /exams/mocks/attempts/:id/submit` (records duration, grades, updates
  mastery).
- **Progress + weak-area detection (`ProgressService`):** mastery as an
  exponential moving average per chapter, updated from quiz/practice/mock
  results; weak areas derived from low mastery. `GET /progress`.
- **Shared grading** helper (`gradeAnswers`) used by quizzes, practice, and mocks.
- **Seed:** a timed mock exam over the sample 2015 Chemistry paper.
- **Tests:** SM-2 scheduling, extractive generators, grading, and progress EMA.

### Acceptance checks

Verified end-to-end against the live database:

| Check | Result |
| --- | --- |
| Generate summary/notes/flashcards/quiz for a chapter | all four generated from chapter text |
| Second call served from cache | summary `cached:false` then `cached:true` |
| Take a past-paper practice | `/exams/practice` → submit → 2/2 with explanations ($0 AI) |
| Take a timed mock exam | start (1800s, attempt id) → submit (duration recorded) → 2/2 |
| Quiz + spaced repetition | quiz 1/1; SR due card → review → next interval scheduled |
| Progress updates and persists | mastery tracked per chapter across activities |

`pnpm lint`, `pnpm typecheck`, `pnpm test` (58 tests) all pass.

### Decisions

- **Generators are deterministic/extractive** (sentence + definition extraction)
  so study material is $0, reproducible, cached once, and works offline/in tests;
  LLM-backed abstractive generation drops in behind the same interfaces later.
- **Weak areas are derived from `user_progress` mastery** (< 0.5) rather than
  written to a separate table in M3; the `weak_areas` table remains for future
  explicit tagging.
- **Mastery is an EMA** (0.6·prev + 0.4·new) so it adapts but keeps history.
- Mock questions are sourced from `exam_questions` matching the mock's
  subject/year; grading is shared across quiz/practice/mock.

### Assumptions

- Quiz generation yields as many fill-in-the-blank items as the chapter has
  clean definitional sentences (1+ for the seeded chapters); richer item types
  come with LLM-backed generation.

### Next — M4 (Website)

- Marketing/landing pages + the web app: auth UI, chat-first home, Study and
  Exam Practice sections, dashboard/progress, paywall UI — polished to the brand.

**Pausing for human review before starting M4.**

---

## M2 — Content pipeline + RAG + grounded chat — _complete (2026-06-29)_

### What was done

- **Shared RAG primitives (`@yenetta/shared/rag`):** isomorphic, deterministic
  embedding (FNV-1a hashing vectorizer with stopword removal + bigrams, 1536-dim
  to match `text-embedding-3-small`), `chunkText`, `cosineSimilarity`,
  `toPgVector`, grounded-prompt builder, and the honest-fallback constant. The
  same embedder runs in the API (queries) and the worker (chunks) so vectors are
  comparable without a network call; OpenAI embeddings drop in when a key is set.
- **Ingestion worker (`@yenetta/ingestion`):** the full pipeline
  `extract(OCR) → cleanText → classify → chunk → embed → pgvector`, exposed as
  `runIngestionPipeline()` and wrapped by a **BullMQ worker** (`main.ts`). PDF
  text extraction via pdf-parse (Tesseract is a future drop-in); classification
  routes a document to the most similar chapter (embedding-based) with year
  detection and admin overrides. Idempotent re-ingest.
- **LLM provider, real + stub:** OpenAI `chat`/`embed` over `fetch` with tiered
  model routing; the stub returns deterministic embeddings and a grounded answer
  derived from the retrieved context (so the whole flow works offline/in tests).
- **Scoped vector retrieval (`RetrievalService`):** filters by
  subject/chapter/grade/type/year FIRST, then top-k cosine via raw SQL pgvector
  (`embedding <=> $1::vector`).
- **Grounded tutor chat (`POST /chat`):** quota check → scoped retrieval →
  keep only chunks above an absolute + relative similarity gate → if none, an
  honest "not in the curriculum yet" fallback **with no LLM call** (no
  hallucination); otherwise a grounded, **cited** answer. Conversations + messages
  (with `citedSources`) persisted.
- **Cost control (`cost/`):** model router (default cheap, escalate only when
  needed), per-call **usage logging with cost estimation** (`usage_events`),
  per-tier **daily quota enforcement** (429 before any spend), and an in-memory
  **response cache** for identical (scope + question) — a shared-output saving.
- **Admin pipeline (`/admin/documents`):** multipart upload → `content_document`
  → inline processing (dev) or **enqueue to the BullMQ worker** (`INGESTION_MODE`);
  status endpoint for the UI. **Web admin page** (`/admin`) to upload and watch
  status transition to `embedded`.
- **Seed:** curriculum prose embedded per chapter (7 chunks), a sample past-exam
  paper (Chemistry 2015) with exam-question chunks, and quota rows.
- **Tests:** chat grounding/fallback/cache/quota, cost pricing + router + quota,
  RAG embedding relevance + chunking + prompt, ingestion cleanText + classify.

### Acceptance checks

Verified end-to-end against **live Postgres 16 + pgvector + Redis**:

| Check | Result |
| --- | --- |
| Ask about a seeded chapter → grounded answer **with sources** | "cell organelles/photosynthesis" → grounded, source = _Cell Biology_ |
| Ask outside the corpus → honest fallback (no hallucination) | "2022 World Cup" → "not in the curriculum yet", no sources, no LLM call |
| Admin uploads a doc → ingests → retrievable | inline AND **queue/worker** (`uploaded → embedded`, "job 1 completed"); new content answerable |
| `usage_events` logged with cost estimates | rows per call (feature/model/tokens/cost); `gpt-4o-mini` row = $0.00042 |
| Caching of shared outputs | identical question: call 1 `cached:false`, call 2 `cached:true` |

`pnpm lint`, `pnpm typecheck`, `pnpm test` (44 tests) all pass.

### Decisions

- **Deterministic stub embedding is shared and isomorphic** so ingestion and
  query embeddings always match; stopword removal + bigrams give clean
  grounded-vs-fallback separation. Threshold = absolute floor (0.18) plus a
  relative gate (within 55% of the top match), capped at 3 sources.
- **Two ingestion modes:** `inline` (API runs the pipeline; zero infra for dev)
  and `queue` (API enqueues, BullMQ worker processes). Both call the same
  `runIngestionPipeline`. Default inline.
- **pgvector reads/writes use raw SQL** (Prisma can't handle the `vector` type);
  everything else stays in Prisma.
- **Quotas enforced before spend**; usage logged after, with cost estimated from
  a per-model price table. Stub models cost $0 (so dev/test is free).
- **Admin endpoints are auth-only for M2**; role-based admin access is deferred.

### Assumptions

- "OCR" currently means PDF text-layer extraction (pdf-parse) + UTF-8 text;
  scanned-image OCR (Tesseract) is a clean drop-in at the extract stage.
- Chat UI is M4; the M2 web deliverable is the admin pipeline page, which takes
  a pasted access token until the auth UI lands.

### Next — M3 (Study & exam features)

- Chapter summaries, study notes, flashcards (+ spaced repetition), AI quizzes.
- Past-exam practice by year/chapter ($0 AI) + timed mock exams.
- Per-chapter generated outputs cached; progress + weak-area detection.

**Pausing for human review before starting M3.**

---

## M1 — Backend core — _complete (2026-06-29)_

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
| Register/login via OTP (dev code in response + logs) | `otp/request` returns `devCode`; `otp/verify` returns user + entitlement + tokens |
| Seeded subjects/chapters queryable via API | `GET /subjects`, `?grade=12` filter, `/subjects/:id/chapters` all return seeded rows |
| Auth-protected route works | `/users/me` → 401 without token, 200 with valid token |
| Unit tests for auth + entitlements pass | 20/20 (26 across the monorepo) |
| Extras demonstrated | OTP rate-limit (6th req → 429), bad input → 400, profile persists, refresh rotation + old-token revocation (→ 401) |

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

## M0 — Scaffold & tooling — _complete (2026-06-29)_

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
| `docker compose config` valid (pgvector + Redis) | valid (`docker compose up` works on Docker Desktop) |
| `pnpm lint` | pass (0 errors, 0 warnings) |
| `pnpm typecheck` | pass (all 5 packages, incl. Next.js + Expo) |
| `pnpm test` | pass (7 tests across 5 packages) |
| Hello-world screens read the brand theme | web + mobile render wordmark/colors from `@yenetta/shared` |

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

- Real logo image files are not in the repo yet; the UI falls back to a 
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
