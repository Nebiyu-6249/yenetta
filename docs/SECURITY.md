# Yenetta - Security and Hardening

Working tracker for the Security and Hardening build delta. Status tags:

- `[built]` implemented in the codebase
- `[partial]` exists, needs hardening
- `[new]` not yet implemented
- `[process]` operational/legal/infra, not code (tracked here for the launch gate)

The **Pre-launch gate** (last section) is a hard release blocker.

Project rule - NO EMOJIS anywhere (UI, code, comments, commits, seed, logs,
docs). Enforced by `scripts/check-no-emoji.mjs`, wired into `pnpm lint`, a
dedicated CI step, and the pre-commit hook. `[built]`

---

## 1. Transport, headers, CORS, cookies

- Force HTTPS + HSTS with preload. `[built]` app-level (Helmet sets HSTS
  `max-age=63072000; includeSubDomains; preload`); TLS termination/redirect at
  the edge/proxy is `[process]`.
- Full security-header set (CSP, frame-ancestors/X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy). `[built]` - Helmet on the API
  (`main.ts`) and `headers()` in `next.config.mjs` for the web app. Verified
  live: CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy all emitted.
- Lock CORS to known origins (no `*`), from `CORS_ORIGINS` env. `[built]` -
  allowlist enforced; a disallowed origin gets no Access-Control-Allow-Origin.
- Secure cookie flags (Secure, HttpOnly, SameSite). `[new]` - tokens are
  currently Bearer/JSON; if cookies are introduced for web sessions, set flags.

## 2. Authentication and session

- Server-side auth on every protected route. `[built]` (global JwtAuthGuard).
- Argon2/bcrypt for any passwords (admin/staff accounts). `[new]` - primary
  auth is phone-OTP; hashing applies once staff password login exists.
- Revoke tokens / reset session on credential change. `[new]`.
- Short-TTL, single-use reset links; rate-limit reset requests. `[new]`.
- Prevent user enumeration - identical responses regardless of account
  existence. `[new]` (OTP request already returns a uniform shape; audit the
  error paths).
- Lock accounts after N failed OTP/login attempts, with backoff. `[partial]`
  (OTP attempt lockout exists; add per-phone/IP backoff + login lockout).
- Rotating, revocable refresh tokens with reuse detection. `[built]` (jti +
  revoke-on-rotate; add explicit reuse-detection alarm). `[partial]`

## 3. Input, injection, output

- Validate all input with zod. `[built]`.
- Parameterized queries incl. raw pgvector SQL. `[built]` (retrieval and chunk
  insert use parameter binding, not string concatenation).
- Sanitize on store, escape on render. `[partial]` - React/Next escape by
  default and AI answers are rendered as text (never dangerouslySetInnerHTML);
  add explicit sanitization for any rich fields.
- Limit request/body size; reject oversized payloads. `[built]` - JSON/urlencoded
  capped at `REQUEST_BODY_LIMIT` (default 1mb); oversized returns 413 with a
  safe generic body. Verified live.

## 4. File uploads

- Whitelist types (pdf, txt, md, common images) and verify by content
  (magic bytes), not just extension. `[built]` - `validateUpload` checks the
  extension whitelist AND the file's magic bytes; a fake `.pdf` or `.exe` is
  rejected (415). Verified live.
- Cap file size; store outside webroot; never serve as executable; type/AV
  scan. `[built]` (size cap at 15MB via multer + validateUpload; uploads are
  held in memory and parsed, never written to a served path; malformed files
  fail safe with 422). AV scan hook is `[new]`.

## 5. Payments (Chapa)

- Verify webhook signatures (HMAC, timing-safe). `[built]`.
- Server-side pricing - never trust client amounts. `[new]` - move plan prices
  to a server catalog; ignore any client-supplied amount.
- Idempotency keys + replay-window + server-side amount/currency verification +
  reconciliation. `[partial]` (webhook is idempotent on `success`; add
  replay-window + amount/currency assertions + reconciliation job).
- Never store card/PIN (PCI handled by Chapa). `[built]`.

## 6. Data and database

- Least-privilege DB roles (app role: no DDL/superuser). `[new]` - migrations
  run as an owner role; the runtime app connects as a restricted role.
- Row-Level Security as defense-in-depth (tenant/student scoping). `[new]`.
- Object-level authorization / no IDOR - every fetch checks ownership. `[partial]`
  (chat/plans/progress already scope by userId; audit every record read).
- Encrypt sensitive data at rest (AES-256). `[new]` - disk/volume encryption +
  app-level encryption for the most sensitive columns.
- Personal-data vs content DB split already enables in-country hosting.
  `[built]` (cross-domain refs are plain IDs, no cross-DB FKs).

## 7. Secrets

- Secrets in env/secrets-manager, never in repo or client bundle. `[built]`.
- Purge any secrets from git history + rotate. `[process]`.
- Secret scanning in CI (gitleaks/trufflehog); scheduled rotation. `[new]`.

## 8. Rate limiting, bots, abuse

- Global + per-user + per-endpoint limits (Redis). `[partial]` (per-user OTP +
  AI quotas exist; add a global/edge limiter and per-endpoint limits).
- Bot protection / CAPTCHA on signup + OTP request. `[new]`.
- Per-tier AI caps (daily free / weekly paid) + cost ceilings. `[partial]`
  (daily AI quota + usage_events cost logging exist; add weekly caps + hard
  monthly cost ceiling per user/tenant).

## 9. Logging, monitoring, config hardening

- Tamper-evident audit log of security events + all admin actions; anomaly
  alerts; never log secrets/PII. `[new]`.
- Disable directory listing; remove sample/admin default routes. `[partial]`
  (no directory listing in Nest/Next; gate the admin upload route behind RBAC).
- Trim prod API responses - no stack traces/internal fields. `[built]` -
  `AllExceptionsFilter` returns a generic body for 5xx in production and never
  leaks stacks; 4xx validation bodies are preserved.

## 10. Dependencies / supply chain

- Automated dependency scanning (Dependabot/Renovate) + SCA + lockfile
  integrity + image scanning. `[new]`.

## 11. Additional web/infra controls

- MFA on all admin and school-admin accounts. `[new]`.
- Encrypted backups + tested restore + retention. `[process]`.
- WAF + CDN + DDoS protection, fail-safe to cached content. `[process]`.
- SSRF protection in ingestion and any server-side URL fetch (allowlist, block
  internal ranges). `[new]` (ingestion currently ingests uploaded bytes, not
  URLs; enforce the allowlist before any URL-fetch feature ships).
- SIM-swap / ATO mitigations: device binding, re-auth for sensitive changes
  (payment, phone change), new-device login notifications. `[new]`.
- Question-bank scraping protection: no bulk endpoints, per-user content-fetch
  rate limits, per-account watermark/trace. `[partial]` (retrieval returns only
  what a feature needs; add per-account content rate limits + tracing).
- Incident response + breach process. `[process]`.
- SAST in CI; third-party pen test before launch. `[new]`/`[process]`.

## 12. AI / LLM security (OWASP LLM Top 10, 2025)

- LLM01 Prompt Injection. `[partial]` - system prompt is separated from
  untrusted user+retrieved content and instructs that data cannot change rules;
  add an external guardrail/output check, not prompt wording alone.
- LLM02 Sensitive Info Disclosure. `[partial]` - no cross-user chat/memory
  leakage (all scoped by userId); add PII redaction in prompts/logs.
- LLM03 Supply Chain. `[partial]` - provider + model ids pinned via env;
  vet/pin dependencies.
- LLM04 Data/Model Poisoning (priority). `[built]` - content_chunks carry
  `visibility` + `ownerId`; retrieval only ever returns PUBLIC chunks plus the
  requesting user's OWN private chunks, and a private-content answer is never
  written to the shared response cache. Verified live: user A's private upload
  grounds only for A; user B gets an honest fallback. Admin-review gating of
  public curriculum still relies on the (not-yet-RBAC) admin path.
- LLM05 Improper Output Handling (priority). `[built]` - AI output is rendered
  as text, never HTML; never used to build SQL/commands.
- LLM06 Excessive Agency (priority). `[built]` - the chat surface cannot trigger
  privileged/financial/admin/mutating actions; capabilities are scoped to the
  invoking user.
- LLM07 System Prompt Leakage. `[built]` - no secrets/keys/business logic in the
  system prompt.
- LLM08 Vector/Embedding Weaknesses (priority). `[partial]` - document/user-level
  isolation in the vector store is enforced (public + own-private only, see
  LLM04) and verified. Enterprise cross-tenant (school) isolation via a tenant
  id + RLS, and embedding-inversion limits, are still `[new]`.
- LLM09 Misinformation. `[built]` - grounding + citations + honest
  "not in the curriculum" fallback; human-QA loop on generated exam questions.
- LLM10 Unbounded Consumption (priority). `[partial]` - per-tier daily caps +
  max-output caps + cost logging exist; add per-tenant token/cost budgets.
- Adversarial red-team (jailbreak/prompt-injection) before launch. `[process]`.

## 13. Minors' data and compliance

- Data minimization: phone, first name, grade, stream only. `[built]` (schema
  collects exactly these).
- Tutor safety guardrails on; in-domain, age-appropriate. `[partial]`.
- School console: teachers see roster status + aggregate usage, not full chat
  history. `[new]` (school console not built yet).
- Consent at onboarding + privacy policy. `[process]`.
- Proclamation 1321/2024: in-country personal-data storage `[built-enabled]`;
  72-hour breach notification `[process]`; DPIA `[process]`; DPO `[process]`;
  cross-border transfer restrictions `[process]`; registration `[process]`.

## 14. Admin consoles

- Internal Admin Console (Yenetta staff): content/user/org/pricing/usage/QA/
  security management behind admin RBAC + MFA + optional IP allowlist + full
  audit logging. Its own milestone. `[new]` (only a minimal content-upload page
  exists today).
- School Admin Console (enterprise): scoped to one org - roster upload, seat
  status, aggregate usage; tenant-isolated, least privilege, cannot see other
  tenants or individual student chat beyond policy. `[new]`.

---

## Pre-launch security gate (release blocker)

Do not launch to students until every box is checked:

- [ ] All `[new]`/`[partial]` items above implemented and verified.
- [ ] Security headers (CSP + HSTS), HTTPS, and locked CORS confirmed in prod.
- [ ] Payments: server-side pricing, signed + idempotent webhooks, amount
      verification tested end-to-end.
- [ ] Tenant isolation verified in the relational DB and the vector store
      (a school/student cannot read another's data).
- [ ] AI red-team pass: prompt-injection, jailbreak, output-handling, cost-abuse.
- [ ] Encrypted backups with a successfully tested restore.
- [ ] Secret scan clean; git history purged; keys rotated.
- [ ] Dependency + container scans clean; SAST run.
- [ ] Admin + school-admin MFA enforced; audit logging live.
- [ ] Data-protection: in-country personal-data storage, DPIA done, breach
      process documented, privacy policy + consent live.
- [ ] Third-party penetration test completed and criticals resolved.
- [x] No-emoji lint rule passing across the monorepo.
