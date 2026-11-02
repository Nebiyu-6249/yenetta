#!/usr/bin/env node
// Waits until every URL answers 2xx, or a timeout passes. Works the same from
// PowerShell and Git Bash, which is why it exists instead of a shell loop.
//
//   node .claude/skills/yenetta-local-validate/scripts/wait-for.mjs [--timeout 240] URL [URL ...]
//
// Exit code 0 when all are up, 1 on timeout (prints which ones never answered).
const args = process.argv.slice(2);
const ti = args.indexOf('--timeout');
const timeoutS = ti >= 0 ? Number(args[ti + 1]) : 240;
const urls = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--timeout');
if (urls.length === 0) {
  console.error('usage: wait-for.mjs [--timeout seconds] URL [URL ...]');
  process.exit(1);
}

const deadline = Date.now() + timeoutS * 1000;
const up = new Map(urls.map((u) => [u, false]));
const started = Date.now();
while (Date.now() < deadline && [...up.values()].includes(false)) {
  for (const u of urls.filter((x) => !up.get(x))) {
    try {
      // Next.js compiles a route on first request in dev, which can take a while.
      const res = await fetch(u, { signal: AbortSignal.timeout(90_000) });
      if (res.ok) {
        up.set(u, true);
        console.log(`up   ${u} after ${Math.round((Date.now() - started) / 1000)}s`);
      }
    } catch {
      // not up yet
    }
  }
  if ([...up.values()].includes(false)) await new Promise((r) => setTimeout(r, 2000));
}
const down = urls.filter((u) => !up.get(u));
for (const u of down) console.log(`DOWN ${u} after ${timeoutS}s`);
process.exit(down.length ? 1 : 0);
