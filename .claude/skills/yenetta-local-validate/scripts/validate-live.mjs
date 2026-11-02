#!/usr/bin/env node
// Yenetta live validation: exercises every milestone's API surface against a
// RUNNING stack (API on :3001 by default) and prints PASS / FAIL / SKIP per check.
//
//   node .claude/skills/yenetta-local-validate/scripts/validate-live.mjs [repoRoot] [--api URL] [--skip-admin]
//
// Covers: M0 health; M1 OTP auth, refresh rotation, profile, taxonomy; M2 grounded
// chat + honest fallback + cache + RBAC + upload->embedded->grounded; M3 study,
// SRS, past papers, mocks, progress; M6 premium gates, Chapa webhook (signature,
// underpayment, success, idempotency), voucher, offline token; M7 plans, study
// guide, memory, stats, leaderboard, analytics, Amharic chat; admin TOTP MFA
// (enroll, challenge, replay rejection, disable).
//
// Side effects (dev DB only): creates 2-3 throwaway student users, one payment,
// one uploaded test document ("validate-live-krebs-cycle.md"), and enrolls then
// disables MFA on ADMIN_PHONE. With a real OPENAI_API_KEY it makes ~6 small
// chat calls. Never prints secrets. Takes ~1-2 minutes (waits for fresh TOTP
// codes because each code is accepted only once).
//
// Exit code: 0 all PASS/SKIP, 1 any FAIL, 2 API unreachable.
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ROOT = resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--api') ?? '.');
const BASE = opt('--api', process.env.API ?? 'http://localhost:3001') + '/api';
const UPLOAD_NAME = 'validate-live-krebs-cycle.md';

function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+#.*$/, '').trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}
const env = readEnv(join(ROOT, '.env'));

const results = [];
const record = (area, check, status, detail = '') =>
  results.push({ area, check, status, detail: String(detail).replace(/\s+/g, ' ').slice(0, 150) });
const pass = (a, c, ok, d) => record(a, c, ok ? 'PASS' : 'FAIL', d);
const skip = (a, c, why) => record(a, c, 'SKIP', why);

async function req(method, path, { body, token, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function shape(json) {
  if (Array.isArray(json)) return `array(${json.length})`;
  if (json && typeof json === 'object') return Object.keys(json).slice(0, 8).join(',');
  return String(json).slice(0, 80);
}

/** Calls a route; PASS when the status is in `expect`. A 404 means "not wired". */
async function hit(area, label, method, path, opts = {}, expect = [200, 201]) {
  try {
    const r = await req(method, path, opts);
    const ok = expect.includes(r.status);
    const why = r.status === 404 && !expect.includes(404) ? 'NOT WIRED (404) ' : '';
    pass(area, `${label} -> ${r.status}`, ok, ok ? shape(r.json) : why + JSON.stringify(r.json));
    return r;
  } catch (e) {
    pass(area, `${label} -> ERROR`, false, e.message);
    return { status: 0, json: null };
  }
}

// Independent RFC 6238 TOTP (deliberately not the repo's implementation).
function base32Decode(s) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret, { period = 30, digits = 6, algo = 'sha1' } = {}) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / period)));
  const mac = createHmac(algo, base32Decode(secret)).update(buf).digest();
  const o = mac[mac.length - 1] & 0xf;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
/** Each TOTP step is accepted once, so a second code needs the next step. */
const waitNextStep = (period = 30) =>
  new Promise((r) => setTimeout(r, period * 1000 - (Date.now() % (period * 1000)) + 1000));

class RateLimited extends Error {}
async function login(phone) {
  const r1 = await req('POST', '/auth/otp/request', { body: { phone } });
  if (r1.status === 429) throw new RateLimited(`OTP rate limit for ${phone} (5/hour per phone, 5/min per IP)`);
  if (r1.status !== 200 || !r1.json.devCode) throw new Error(`otp/request ${r1.status} ${JSON.stringify(r1.json)}`);
  return req('POST', '/auth/otp/verify', { body: { phone, code: r1.json.devCode } });
}

async function main() {
  const health = await req('GET', '/health').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`API not reachable at ${BASE}/health. Start it first (see SKILL.md step 7).`);
    process.exit(2);
  }
  pass('M0', 'GET /health -> 200', true, shape(health.json));

  const suffix = String(Date.now()).slice(-7);
  const studentPhone = `+25191${suffix}`;

  // ---- M1 auth, profile, taxonomy
  await hit('M1', 'GET /users/me without token', 'GET', '/users/me', {}, [401]);
  const o1 = await req('POST', '/auth/otp/request', { body: { phone: studentPhone } });
  pass('M1', `POST /auth/otp/request -> ${o1.status}`, o1.status === 200 && !!o1.json.devCode, o1.json.devCode ? 'devCode returned' : JSON.stringify(o1.json));
  await hit('M1', 'POST /auth/otp/verify wrong code', 'POST', '/auth/otp/verify', { body: { phone: studentPhone, code: '000000' } }, [400, 401]);
  const v = await req('POST', '/auth/otp/verify', { body: { phone: studentPhone, code: o1.json.devCode } });
  pass('M1', `POST /auth/otp/verify -> ${v.status}`, v.status === 200 && !!v.json.accessToken, `tier=${v.json?.entitlement?.tier} role=${v.json?.user?.role}`);
  if (!v.json?.accessToken) return;
  let token = v.json.accessToken;
  await hit('M1', 'GET /users/me', 'GET', '/users/me', { token });
  await hit('M1', 'PATCH /users/me', 'PATCH', '/users/me', { token, body: { name: 'Validate', grade: 12, stream: 'natural' } });
  const rr = await hit('M1', 'POST /auth/refresh', 'POST', '/auth/refresh', { body: { refreshToken: v.json.refreshToken } });
  await hit('M1', 'POST /auth/refresh reusing old token', 'POST', '/auth/refresh', { body: { refreshToken: v.json.refreshToken } }, [401]);
  if (rr.json?.accessToken) token = rr.json.accessToken;
  const subj = await hit('M1', 'GET /subjects', 'GET', '/subjects', { token });
  const subjects = Array.isArray(subj.json) ? subj.json : [];
  pass('M1', 'subjects seeded', subjects.length > 0, subjects.map((s) => `${s.name}/${s.grade}`).join('; ') || 'none: run db:seed');
  const chapters = [];
  for (const s of subjects) {
    const c = await req('GET', `/subjects/${s.id}/chapters`, { token });
    if (Array.isArray(c.json)) chapters.push(...c.json);
  }
  pass('M1', 'GET /subjects/:id/chapters', chapters.length > 0, `${chapters.length} chapters`);
  const cid = (chapters.find((c) => /cell biology/i.test(c.title)) ?? chapters[0])?.id;

  // ---- M2 grounded chat (questions match the seed dataset)
  const inMsg = 'Explain the role of cell organelles such as mitochondria and chloroplasts';
  const inQ = await hit('M2', 'POST /chat in-curriculum', 'POST', '/chat', { token, body: { message: inMsg } });
  pass('M2', 'in-curriculum answer grounded + cited', inQ.json?.grounded === true && inQ.json?.sources?.length > 0,
    inQ.json?.grounded ? `sources=${JSON.stringify(inQ.json.sources.map((s) => s.chapterTitle))}` : 'fallback: check API boot log for the RetrievalService embedding-model warning (run db:reembed)');
  const outQ = await hit('M2', 'POST /chat out-of-curriculum', 'POST', '/chat', { token, body: { message: 'Who won the 2022 FIFA World Cup final?' } });
  pass('M2', 'out-of-curriculum -> honest fallback', outQ.json?.grounded === false && (outQ.json?.sources?.length ?? 0) === 0, outQ.json?.answer);
  const again = await req('POST', '/chat', { token, body: { message: inMsg } });
  pass('M2', 'repeat question served from cache', again.json?.cached === true, `cached=${again.json?.cached}`);
  await hit('M2', 'GET /chat/conversations', 'GET', '/chat/conversations', { token });
  await hit('M2', 'student GET /admin/documents (RBAC)', 'GET', '/admin/documents', { token }, [403]);

  // ---- M3 study + exams
  await hit('M3', 'GET /chapters/:id/summary', 'GET', `/chapters/${cid}/summary`, { token });
  const s2 = await req('GET', `/chapters/${cid}/summary`, { token });
  pass('M3', 'summary served from cache on repeat', s2.json?.cached === true, `cached=${s2.json?.cached}`);
  await hit('M3', 'GET /chapters/:id/notes', 'GET', `/chapters/${cid}/notes`, { token });
  await hit('M3', 'GET /chapters/:id/flashcards', 'GET', `/chapters/${cid}/flashcards`, { token });
  const quiz = await hit('M3', 'GET /chapters/:id/quiz', 'GET', `/chapters/${cid}/quiz`, { token });
  if (quiz.json?.id) {
    await hit('M3', 'POST /quizzes/:id/attempts', 'POST', `/quizzes/${quiz.json.id}/attempts`, { token, body: { answers: quiz.json.questions.map((q) => ({ questionId: q.id, answer: 'x' })) } });
  }
  // SR cards are created for a chapter only when chapterId is passed.
  const due = await hit('M3', 'GET /srs/due?chapterId', 'GET', `/srs/due?chapterId=${cid}`, { token });
  const fid = Array.isArray(due.json) ? due.json[0]?.flashcardId : undefined;
  if (fid) await hit('M3', 'POST /srs/review', 'POST', '/srs/review', { token, body: { flashcardId: fid, grade: 4 } });
  else pass('M3', 'POST /srs/review', false, 'no due card returned for the chapter');
  const papers = await hit('M3', 'GET /exams/papers', 'GET', '/exams/papers', { token });
  const paperId = Array.isArray(papers.json) ? papers.json[0]?.id : undefined;
  const prac = await hit('M3', 'GET /exams/practice?paperId', 'GET', `/exams/practice?paperId=${paperId}`, { token });
  pass('M3', 'practice hides answers', Array.isArray(prac.json) && prac.json.every((q) => q.answer === undefined), `n=${Array.isArray(prac.json) ? prac.json.length : '?'}`);
  const dl = await hit('M3', 'GET /exams/practice/download', 'GET', `/exams/practice/download?paperId=${paperId}`, { token });
  if (Array.isArray(dl.json) && dl.json.length) {
    const sub = await hit('M3', 'POST /exams/practice/submit', 'POST', '/exams/practice/submit', { token, body: { answers: dl.json.map((q) => ({ questionId: q.id, answer: q.answer })) } });
    pass('M3', 'practice graded with correct answers', sub.json?.correct === dl.json.length, `${sub.json?.correct}/${sub.json?.total}`);
  }
  const mocks = await hit('M3', 'GET /exams/mocks', 'GET', '/exams/mocks', { token });
  const mockId = Array.isArray(mocks.json) ? mocks.json[0]?.id : undefined;
  await hit('M6', 'free POST /exams/mocks/:id/start (premium gate)', 'POST', `/exams/mocks/${mockId}/start`, { token }, [402, 403]);
  await hit('M3', 'GET /progress', 'GET', '/progress', { token });
  const future = new Date(Date.now() + 30 * 864e5).toISOString();
  await hit('M7', 'free POST /plans (premium gate)', 'POST', '/plans', { token, body: { examDate: future, dailyMinutes: 60 } }, [402, 403]);
  await hit('M7', 'free GET /chapters/:id/study-guide (premium gate)', 'GET', `/chapters/${cid}/study-guide`, { token }, [402, 403]);

  // ---- M6 payments + entitlements
  await hit('M6', 'GET /entitlements', 'GET', '/entitlements', { token });
  await hit('M6', 'GET /entitlements/token', 'GET', '/entitlements/token', { token });
  const co = await hit('M6', 'POST /payments/checkout', 'POST', '/payments/checkout', { token, body: {} });
  if (!env.CHAPA_WEBHOOK_SECRET) {
    skip('M6', 'Chapa webhook checks', 'CHAPA_WEBHOOK_SECRET not set in .env');
  } else {
    const signed = (obj) => {
      const raw = JSON.stringify(obj);
      return { raw, headers: { 'Content-Type': 'application/json', 'chapa-signature': createHmac('sha256', env.CHAPA_WEBHOOK_SECRET).update(raw).digest('hex') } };
    };
    const good = signed({ tx_ref: co.json?.txRef, status: 'success', amount: 299, currency: 'ETB' });
    await hit('M6', 'webhook bad signature', 'POST', '/payments/webhook', { raw: good.raw, headers: { 'Content-Type': 'application/json', 'chapa-signature': 'deadbeef' } }, [401]);
    // Underpayment marks its payment failed, so use a second checkout for it.
    const co2 = await req('POST', '/payments/checkout', { token, body: {} });
    await hit('M6', 'webhook underpaid amount', 'POST', '/payments/webhook', signed({ tx_ref: co2.json?.txRef, status: 'success', amount: 1, currency: 'ETB' }), [400]);
    const w = await hit('M6', 'webhook signed success', 'POST', '/payments/webhook', good);
    pass('M6', 'webhook activates payment', w.json?.status === 'success', JSON.stringify(w.json));
    const w2 = await req('POST', '/payments/webhook', good);
    pass('M6', `webhook redelivery -> ${w2.status}`, w2.json?.status === 'idempotent', JSON.stringify(w2.json));
  }
  const ent = await req('GET', '/entitlements', { token });
  if (ent.json?.tier !== 'premium') {
    // Fall back to the dev voucher so the premium checks below still run.
    await req('POST', '/payments/voucher', { token, body: { code: 'YENETTA-PREMIUM' } });
  }
  const ent2 = await req('GET', '/entitlements', { token });
  pass('M6', 'tier premium after purchase', ent2.json?.tier === 'premium', `tier=${ent2.json?.tier} dailyAiLimit=${ent2.json?.quotas?.dailyAiLimit}`);
  const ms = await hit('M6', 'premium POST /exams/mocks/:id/start', 'POST', `/exams/mocks/${mockId}/start`, { token });
  if (ms.json?.attemptId) {
    await hit('M3', 'POST /exams/mocks/attempts/:id/submit', 'POST', `/exams/mocks/attempts/${ms.json.attemptId}/submit`, { token, body: { answers: ms.json.questions.map((q) => ({ questionId: q.id, answer: 'A' })), durationSeconds: 120 } });
  }

  // ---- M7 as premium
  const plan = await hit('M7', 'premium POST /plans', 'POST', '/plans', { token, body: { examDate: future, dailyMinutes: 60 } });
  await hit('M7', 'GET /plans/current', 'GET', '/plans/current', { token });
  if (plan.json?.id) {
    await hit('M7', 'POST /plans/:id/adapt', 'POST', `/plans/${plan.json.id}/adapt`, { token });
    const item = plan.json.items?.[0]?.id;
    if (item) await hit('M7', 'POST /plans/items/:id/complete', 'POST', `/plans/items/${item}/complete`, { token });
  }
  await hit('M7', 'premium GET /chapters/:id/study-guide', 'GET', `/chapters/${cid}/study-guide`, { token });
  await hit('M7', 'GET /memory', 'GET', '/memory', { token });
  await hit('M7', 'GET /stats', 'GET', '/stats', { token });
  await hit('M7', 'POST /stats/leaderboard-opt-in', 'POST', '/stats/leaderboard-opt-in', { token, body: { optIn: true } });
  await hit('M7', 'GET /leaderboard', 'GET', '/leaderboard', { token });
  await hit('M7', 'GET /analytics', 'GET', '/analytics', { token });
  const am = await hit('M7', 'POST /chat language=am', 'POST', '/chat', { token, body: { message: 'What is an acid and what is a base?', language: 'am' } });
  pass('M7', 'Amharic chat grounded', am.json?.grounded === true, am.json?.answer);

  // ---- Voucher on a second student
  try {
    const v2 = await login(`+25192${suffix}`);
    await hit('M6', 'POST /payments/voucher bad code', 'POST', '/payments/voucher', { token: v2.json.accessToken, body: { code: 'NOPE-123' } }, [400, 404, 422]);
    await hit('M6', 'POST /payments/voucher YENETTA-PREMIUM', 'POST', '/payments/voucher', { token: v2.json.accessToken, body: { code: 'YENETTA-PREMIUM' } });
  } catch (e) {
    (e instanceof RateLimited ? skip : (a, c, d) => pass(a, c, false, d))('M6', 'voucher checks', e.message);
  }

  if (flag('--skip-admin')) return skip('ADMIN', 'admin, ingestion and MFA checks', '--skip-admin');
  if (!env.ADMIN_PHONE) return skip('ADMIN', 'admin, ingestion and MFA checks', 'ADMIN_PHONE not set in .env (then re-run db:seed)');
  await adminChecks(env.ADMIN_PHONE, token, cid);
}

async function adminChecks(adminPhone, studentToken, cid) {
  let a1;
  try {
    a1 = await login(adminPhone);
  } catch (e) {
    if (e instanceof RateLimited) return skip('ADMIN', 'admin checks', `${e.message}. Wait, or clear: DELETE FROM auth_otps WHERE phone='${adminPhone}'`);
    throw e;
  }
  if (a1.json?.mfaRequired) {
    return skip('ADMIN', 'admin checks', 'MFA is still enabled from an aborted run; reset it with the SQL in references/troubleshooting.md');
  }
  const at = a1.json?.accessToken;
  const role = a1.json?.user?.role;
  pass('ADMIN', `admin login -> ${a1.status}`, !!at && role === 'admin', `role=${role}${role === 'admin' ? '' : ' (re-run db:seed after setting ADMIN_PHONE)'}`);
  if (!at) return;
  await hit('ADMIN', 'admin GET /admin/documents', 'GET', '/admin/documents', { token: at });
  await hit('ADMIN', 'admin GET /admin/audit', 'GET', '/admin/audit?limit=5', { token: at });
  await hit('ADMIN', 'student GET /me/mfa (admin-only)', 'GET', '/me/mfa', { token: studentToken }, [403]);

  // Ingestion end to end: upload -> embedded -> retrievable.
  const md = '# Cellular Respiration\n\nThe Krebs cycle, also called the citric acid cycle, takes place in the mitochondrial matrix. Each turn of the Krebs cycle releases carbon dioxide and produces NADH and FADH2, which feed the electron transport chain to make ATP.\n';
  const fd = new FormData();
  fd.append('file', new Blob([md], { type: 'text/markdown' }), UPLOAD_NAME);
  if (cid) fd.append('chapterId', cid);
  const up = await hit('M2', 'admin POST /admin/documents (upload .md)', 'POST', '/admin/documents', { token: at, body: fd });
  if (up.json?.id) {
    let st = up.json.status;
    for (let i = 0; i < 30 && st !== 'embedded' && st !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      st = (await req('GET', `/admin/documents/${up.json.id}`, { token: at })).json?.status;
    }
    pass('M2', 'uploaded doc reaches embedded', st === 'embedded', `status=${st}${st === 'embedded' ? '' : ' (INGESTION_MODE=queue needs the ingestion worker running)'}`);
    const kq = await req('POST', '/chat', { token: studentToken, body: { message: 'Where does the Krebs cycle take place and what does it produce?' } });
    pass('M2', 'chat grounded on uploaded doc', kq.json?.grounded === true, kq.json?.answer);
  }

  // TOTP MFA: enroll, challenge-only re-login, replay rejection, disable.
  const en = await hit('ADMIN', 'POST /me/mfa/enroll', 'POST', '/me/mfa/enroll', { token: at });
  const secret = en.json?.secret;
  if (!secret) return;
  const q = new URL(en.json.otpauthUri.replace('otpauth://', 'http://')).searchParams;
  const o = { period: Number(q.get('period') ?? 30), digits: Number(q.get('digits') ?? 6), algo: (q.get('algorithm') ?? 'SHA1').toLowerCase() };
  await hit('ADMIN', 'POST /me/mfa/confirm wrong code', 'POST', '/me/mfa/confirm', { token: at, body: { code: '000000' } }, [400, 401]);
  await hit('ADMIN', 'POST /me/mfa/confirm', 'POST', '/me/mfa/confirm', { token: at, body: { code: totp(secret, o) } });

  let a2;
  try {
    a2 = await login(adminPhone);
  } catch (e) {
    // Leave the account usable: disable MFA with a fresh code before bailing.
    await waitNextStep(o.period);
    await req('POST', '/me/mfa/disable', { token: at, body: { code: totp(secret, o) } });
    return skip('ADMIN', 'MFA login checks', `${e.message} (MFA was disabled again)`);
  }
  pass('ADMIN', 're-login yields MFA challenge only', a2.json?.mfaRequired === true && !a2.json?.accessToken, shape(a2.json));
  const mt = a2.json?.mfaToken;
  await hit('ADMIN', 'mfaToken used as bearer', 'GET', '/admin/documents', { token: mt }, [401]);
  await hit('ADMIN', 'POST /auth/mfa/verify wrong code', 'POST', '/auth/mfa/verify', { body: { mfaToken: mt, code: '000000' } }, [400, 401]);
  const reused = await req('POST', '/auth/mfa/verify', { body: { mfaToken: mt, code: totp(secret, o) } });
  pass('ADMIN', `TOTP code reused from confirm -> ${reused.status}`, reused.status === 401, 'each code is accepted once');
  await waitNextStep(o.period);
  const c1 = totp(secret, o);
  const mv = await hit('ADMIN', 'POST /auth/mfa/verify (fresh code)', 'POST', '/auth/mfa/verify', { body: { mfaToken: mt, code: c1 } });
  const at2 = mv.json?.accessToken;
  if (!at2) return;
  await hit('ADMIN', 'admin route with MFA-completed token', 'GET', '/admin/documents', { token: at2 });
  const replay = await req('POST', '/auth/mfa/verify', { body: { mfaToken: mt, code: c1 } });
  pass('ADMIN', `challenge + code replay -> ${replay.status}`, replay.status === 401, 'replay rejected');
  await hit('ADMIN', 'disable with already-used code', 'POST', '/me/mfa/disable', { token: at2, body: { code: c1 } }, [401]);
  await waitNextStep(o.period);
  const c2 = totp(secret, o);
  const replay2 = await req('POST', '/auth/mfa/verify', { body: { mfaToken: mt, code: c2 } });
  pass('ADMIN', `consumed challenge + fresh code -> ${replay2.status}`, replay2.status === 401, 'challenge is single-use');
  // Leave ADMIN_PHONE without MFA so the script can run again.
  await hit('ADMIN', 'POST /me/mfa/disable (fresh code)', 'POST', '/me/mfa/disable', { token: at2, body: { code: c2 } });
}

const started = Date.now();
main()
  .catch((e) => pass('SCRIPT', 'fatal', false, e.stack))
  .finally(() => {
    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    for (const r of results) console.log(`${pad(r.status, 4)}  ${pad(r.area, 6)} ${pad(r.check, 56)} ${r.detail}`);
    const n = (s) => results.filter((r) => r.status === s).length;
    console.log(`\n${n('PASS')} passed, ${n('FAIL')} failed, ${n('SKIP')} skipped in ${Math.round((Date.now() - started) / 1000)}s against ${BASE}`);
    process.exitCode = n('FAIL') ? 1 : 0;
  });
