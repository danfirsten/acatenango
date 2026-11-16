/**
 * Regenerates the golden snapshots in src/lib/__fixtures__/golden/ from the
 * archived bulletins' raw text.
 *
 *   node --import tsx scripts/golden.ts          # write snapshots
 *   node --import tsx scripts/golden.ts --check  # exit 1 if any differ
 *
 * Run it on purpose, after changing the parser, then read `git diff` on the
 * snapshots: every changed line is a value the parser now reads differently.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parseBulletin } from '../src/lib/parse-bulletin';

const ROOT = path.resolve(import.meta.dirname, '..');
const ARCHIVE = path.join(ROOT, 'data', 'bulletins');
const GOLDEN = path.join(ROOT, 'src', 'lib', '__fixtures__', 'golden');

function snapshotOf(raw: string, date: string): string {
  const { parsed, warnings, parserVersion } = parseBulletin(raw);
  return JSON.stringify({ date, parserVersion, warnings, parsed }, null, 2) + '\n';
}

const check = process.argv.includes('--check');
mkdirSync(GOLDEN, { recursive: true });
const dates: string[] = [];
let differ = 0;
for (const file of readdirSync(ARCHIVE).filter((f) => f.endsWith('.json')).sort()) {
  const bulletin = JSON.parse(readFileSync(path.join(ARCHIVE, file), 'utf8')) as {
    date: string;
    raw: string;
  };
  dates.push(bulletin.date);
  const out = path.join(GOLDEN, `${bulletin.date}.json`);
  const next = snapshotOf(bulletin.raw, bulletin.date);
  let prev = '';
  try { prev = readFileSync(out, 'utf8'); } catch { /* new day */ }
  if (prev !== next) {
    differ++;
    if (!check) writeFileSync(out, next);
  }
}
if (!check) {
  for (const f of readdirSync(GOLDEN)) {
    if (f.endsWith('.json') && !dates.includes(f.slice(0, -5))) rmSync(path.join(GOLDEN, f));
  }
}
console.log(`${dates.length} bulletins, ${differ} snapshot${differ === 1 ? '' : 's'} ${check ? 'differ' : 'written'}`);
if (check && differ) process.exit(1);
