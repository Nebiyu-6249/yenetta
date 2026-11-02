#!/usr/bin/env node
// Prints the top-3 retrieval similarities for in- and out-of-curriculum probe
// questions, using the ACTIVE embedding model from .env. Use it after
// db:reembed to see where the supporting-similarity floor should sit
// (in-curriculum top scores should clear it, out-of-curriculum should not).
//
//   node .claude/skills/yenetta-local-validate/scripts/similarity-probe.mjs [repoRoot] ["extra IN question" ...]
//
// Needs OPENAI_API_KEY in .env (with the stub, scores are not comparable to a
// real model, so there is nothing to tune). Costs a fraction of a cent.
// Reads the database directly via the API package's Prisma client.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const [rootArg, ...extra] = process.argv.slice(2);
const ROOT = resolve(rootArg ?? '.');
const envFile = join(ROOT, '.env');
if (!existsSync(envFile)) {
  console.error(`No .env at ${envFile}`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+#.*$/, '').trim())
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!env.OPENAI_API_KEY || env.LLM_PROVIDER === 'stub') {
  console.error('The stub embedder is active (no OPENAI_API_KEY): nothing to calibrate.');
  process.exit(1);
}
const model = env.EMBEDDING_MODEL || 'text-embedding-3-small';
const { PrismaClient } = createRequire(join(ROOT, 'packages/api/package.json'))('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

// Defaults match the seed dataset; pass real-curriculum questions as extra args.
const probes = [
  ['IN ', 'Explain the role of cell organelles such as mitochondria and chloroplasts'],
  ['IN ', 'What is photosynthesis?'],
  ['IN ', 'What is an acid and what is a base?'],
  ['IN ', 'What is a polynomial function?'],
  ...extra.map((q) => ['IN ', q]),
  ['OUT', 'Who won the 2022 FIFA World Cup final?'],
  ['OUT', 'What is the capital of France?'],
  ['OUT', 'How do I bake chocolate chip cookies?'],
  ['OUT', 'Explain how a car engine works'],
];

const res = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
  body: JSON.stringify({ model, input: probes.map((p) => p[1]) }),
});
if (!res.ok) {
  console.error(`OpenAI embeddings failed: ${res.status}`);
  process.exit(1);
}
const data = (await res.json()).data;
const tops = { 'IN ': [], OUT: [] };
console.log(`model=${model}  floor override RETRIEVAL_MIN_SIMILARITY=${env.RETRIEVAL_MIN_SIMILARITY || '(unset: 0.30 for real models)'}`);
for (let i = 0; i < probes.length; i++) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT left(c.text, 28) AS t, 1 - (c.embedding <=> $1::vector) AS s
     FROM content_chunks c WHERE c."embeddingModel" = $2
     ORDER BY c.embedding <=> $1::vector LIMIT 3`,
    `[${data[i].embedding.join(',')}]`,
    model,
  );
  if (rows.length === 0) {
    console.error(`No chunks embedded with ${model}: run pnpm --filter @yenetta/api db:reembed`);
    break;
  }
  const top = Number(rows[0].s);
  tops[probes[i][0]].push(top);
  const detail = rows.map((r) => `${Number(r.s).toFixed(2)} ${String(r.t).replace(/\s+/g, ' ')}`).join(' | ');
  console.log(`${probes[i][0]} top=${top.toFixed(3)}  ${probes[i][1].slice(0, 46).padEnd(46)} [${detail}]`);
}
if (tops['IN '].length && tops.OUT.length) {
  const minIn = Math.min(...tops['IN ']);
  const maxOut = Math.max(...tops.OUT);
  console.log(
    `\nlowest IN top=${minIn.toFixed(3)}  highest OUT top=${maxOut.toFixed(3)}  ` +
      (minIn > maxOut ? `gap midpoint=${((minIn + maxOut) / 2).toFixed(3)}` : 'OVERLAP: no single floor separates these'),
  );
}
await prisma.$disconnect();
