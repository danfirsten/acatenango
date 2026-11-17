/**
 * The stored archive matches the parser that ships with it. A parser change
 * bumps PARSER_VERSION and re-derives every record from its raw text, so no
 * file on disk is left at an older version or disagrees with a fresh parse.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { type Bulletin, PARSER_VERSION } from './bulletin';
import { parseBulletin } from './parse-bulletin';

const DIR = path.join(process.cwd(), 'data', 'bulletins');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

describe('data/bulletins', () => {
  it('holds records', () => {
    assert.ok(files.length > 0);
  });

  it(`stores every record at parser version ${PARSER_VERSION}`, () => {
    const stale = files.filter((f) => (JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Bulletin).parserVersion !== PARSER_VERSION);
    assert.deepEqual(stale, [], 'run the re-parse over these records');
  });

  it('stores what the parser reads from each raw text', () => {
    for (const f of files) {
      const b = JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Bulletin;
      assert.equal(b.date, f.replace(/\.json$/, ''), `${f} is named for its date`);
      assert.ok(b.raw.trim().length > 0, `${f} keeps its raw text`);
      const fresh = parseBulletin(b.raw);
      assert.deepEqual(b.parsed, fresh.parsed, `${f} parsed fields`);
      assert.deepEqual(b.warnings, fresh.warnings, `${f} warnings`);
    }
  });
});
