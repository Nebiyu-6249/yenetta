#!/usr/bin/env node
// Creates a dev .env from .env.example with freshly generated secrets.
// Refuses to overwrite an existing .env (it may hold a real OpenAI key).
// Never prints secret values.
//
//   node .claude/skills/yenetta-local-validate/scripts/init-env.mjs [repoRoot] [--admin-phone +2519XXXXXXXX]
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const pi = args.indexOf('--admin-phone');
const adminPhone = pi >= 0 ? args[pi + 1] : '+251900000001';
const ROOT = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--admin-phone') ?? '.');
const target = join(ROOT, '.env');
const example = join(ROOT, '.env.example');

if (!/^\+?\d{9,15}$/.test(adminPhone)) {
  console.error(`--admin-phone must be 9-15 digits with optional +, got ${adminPhone}`);
  process.exit(1);
}
if (existsSync(target)) {
  console.log(`.env already exists at ${target}; leaving it unchanged.`);
  process.exit(0);
}

const hex = (n) => randomBytes(n).toString('hex');
const values = {
  JWT_ACCESS_SECRET: hex(32),
  JWT_REFRESH_SECRET: hex(32),
  MFA_ENCRYPTION_KEY: hex(32),
  // Lets the validation script sign test Chapa webhooks locally.
  CHAPA_WEBHOOK_SECRET: hex(24),
  ADMIN_PHONE: adminPhone,
  // Blank = offline stub LLM. Any non-empty value is treated as a real key.
  OPENAI_API_KEY: '',
  SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

let text = readFileSync(example, 'utf8');
for (const [key, value] of Object.entries(values)) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (!re.test(text)) {
    console.error(`.env.example has no ${key}= line; update this script.`);
    process.exit(1);
  }
  text = text.replace(re, `${key}=${value}`);
}
writeFileSync(target, text);
console.log(`Wrote ${target}: generated JWT/MFA/Chapa-webhook secrets, ADMIN_PHONE=${adminPhone}, stub LLM.`);
