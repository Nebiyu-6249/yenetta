#!/usr/bin/env node
// Project rule: NO EMOJIS anywhere (UI copy, code, comments, seed data, logs,
// docs). This check fails CI on any emoji codepoint in a tracked text file.
//
// Detection: Unicode Extended_Pictographic (covers emoji pictographs) minus a
// tiny allowlist of legacy symbols that are not emoji in practice.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EMOJI = /\p{Extended_Pictographic}/u;
const ALLOW = new Set(['©', '®']); // (c), (r)
const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|ico|bmp|woff2?|ttf|otf|eot|pdf|zip|gz|mp[34]|mov|wav|jks|keystore)$/i;

function trackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8' });
  return out.split('\n').filter((f) => f && !SKIP_EXT.test(f));
}

const findings = [];
for (const file of trackedFiles()) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let col = 0;
    for (const ch of line) {
      col++;
      if (EMOJI.test(ch) && !ALLOW.has(ch)) {
        findings.push({ file, line: i + 1, col, ch, cp: ch.codePointAt(0) });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`\nNo-emoji rule violated: ${findings.length} emoji codepoint(s) found.\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}:${f.col}  U+${f.cp.toString(16).toUpperCase()} ${f.ch}`);
  }
  console.error('\nRemove all emojis (see Security & Hardening spec, project rule).');
  process.exit(1);
}

console.log('No-emoji check passed: no emoji codepoints found.');
