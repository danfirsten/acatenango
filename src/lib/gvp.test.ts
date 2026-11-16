import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { attachGvp, type IndexEntry } from '../../scripts/build-index';
import { collectWeeks, recordFromPage } from '../../scripts/gvp';
import { htmlToText } from './fetch-text';
import {
  GVP_PARSER_VERSION,
  clearlyDisagree,
  compareWeek,
  parseGvp,
  reportText,
  reportUrl,
  weekStart,
  weekStarts,
  type DayFigures,
} from './gvp';
import { NO_REPORT, WEEK_FAR, WEEK_METRES, WEEK_RELATIVE, WEEK_TYPICAL, WRONG_WEEK } from './__fixtures__/gvp';

const textOf = (html: string) => reportText(htmlToText(html)) ?? '';

test('weeks run Wednesday to Tuesday and the report appears the Wednesday after', () => {
  assert.equal(weekStart('2025-11-05'), '2025-11-05');
  assert.equal(weekStart('2025-11-11'), '2025-11-05');
  assert.equal(weekStart('2025-11-12'), '2025-11-12');
  assert.deepEqual(weekStarts('2025-11-06', '2025-11-25'), ['2025-11-05', '2025-11-12']);
  assert.equal(reportUrl('2025-11-05'), 'https://volcano.si.edu/showreport.cfm?doi=GVP.WVAR20251112-342090');
});

test('reportText keeps the report verbatim and stops before the sources', () => {
  const t = textOf(WEEK_TYPICAL);
  assert.match(t, /^Report for 5 November-11 November 2025/);
  assert.match(t, /4-8 explosions per hour/);
  assert.doesNotMatch(t, /Sources|Geologic|tracking|color: red/);
  assert.equal(reportText('nothing here'), null);
});

test('parseGvp reads the rate and the altitude', () => {
  const { parsed, warnings } = parseGvp(textOf(WEEK_TYPICAL));
  assert.deepEqual(parsed.explosionsPerHour, { min: 4, max: 8 });
  assert.deepEqual(parsed.ashColumnMasl, { min: 4500, max: 4800 });
  assert.deepEqual(warnings, []);
});

test('parseGvp reads metres and a single figure', () => {
  const { parsed } = parseGvp(textOf(WEEK_METRES));
  assert.deepEqual(parsed.explosionsPerHour, { min: 6, max: 6 });
  assert.deepEqual(parsed.ashColumnMasl, { min: 4500, max: 4700 });
});

test('parseGvp leaves out what is not stated: no rate, and a height above the crater is not an altitude', () => {
  const { parsed, warnings } = parseGvp(textOf(WEEK_RELATIVE));
  assert.equal(parsed.explosionsPerHour, null);
  assert.equal(parsed.ashColumnMasl, null);
  assert.deepEqual(warnings, ['explosionsPerHour', 'ashColumnMasl']);
});

test('clearlyDisagree needs a gap past the tolerance, not just a difference', () => {
  assert.equal(clearlyDisagree('explosions', { min: 4, max: 8 }, { min: 5, max: 9 }), false);
  assert.equal(clearlyDisagree('explosions', { min: 4, max: 8 }, { min: 9, max: 10 }), false); // gap 1
  assert.equal(clearlyDisagree('explosions', { min: 14, max: 20 }, { min: 4, max: 8 }), true);
  assert.equal(clearlyDisagree('ash', { min: 4500, max: 4800 }, { min: 4300, max: 4500 }), false);
  assert.equal(clearlyDisagree('ash', { min: 6200, max: 6200 }, { min: 4300, max: 4800 }), true);
});

const day = (date: string, rate: [number, number] | null, ash: [number, number] | null): DayFigures => ({
  date, url: `https://insivumeh.example/${date}.pdf`,
  explosionsMin: rate?.[0] ?? null, explosionsMax: rate?.[1] ?? null,
  ashMinMasl: ash?.[0] ?? null, ashMaxMasl: ash?.[1] ?? null,
});

const record = (html: string, week: string) => recordFromPage(week, html, '2026-01-01T00:00:00Z')!;

test('compareWeek: overlapping ranges agree, and only that week\'s bulletins count', () => {
  const mark = compareWeek(record(WEEK_TYPICAL, '2025-11-05'), [
    day('2025-11-04', [90, 99], null), // the day before the week: ignored
    day('2025-11-06', [3, 6], [4400, 4700]),
    day('2025-11-08', [6, 9], [4600, 4800]),
  ]);
  assert.equal(mark.state, 'agree');
  assert.equal(mark.end, '2025-11-11');
  assert.deepEqual(mark.checks[0].bulletins, { min: 3, max: 9 });
  assert.equal(mark.checks[0].days, 2);
  assert.deepEqual(mark.bulletins.map((b) => b.date), ['2025-11-06', '2025-11-08']);
});

test('compareWeek: ranges that clearly disagree are flagged, never corrected', () => {
  const rec = record(WEEK_FAR, '2025-11-12');
  const before = JSON.stringify(rec);
  const mark = compareWeek(rec, [day('2025-11-13', [4, 8], [4300, 4800]), day('2025-11-14', [5, 7], null)]);
  assert.equal(mark.state, 'differ');
  assert.deepEqual(mark.checks.map((c) => c.differs), [true, true]);
  assert.equal(JSON.stringify(rec), before);
});

test('compareWeek: a field either side leaves out cannot disagree, and a week with nothing to compare is unchecked', () => {
  const rec = record(WEEK_RELATIVE, '2025-11-19');
  assert.equal(compareWeek(rec, [day('2025-11-20', [4, 8], [4300, 4800])]).state, 'unchecked');
  assert.equal(compareWeek(record(WEEK_TYPICAL, '2025-11-05'), [day('2025-11-06', null, null)]).state, 'unchecked');
});

test('recordFromPage refuses a page that is not for the week asked', () => {
  assert.equal(recordFromPage('2025-11-05', WRONG_WEEK, 'x'), null);
  assert.equal(recordFromPage('2025-11-05', NO_REPORT, 'x'), null);
  assert.equal(recordFromPage('2025-11-05', '<p>Report for 15 November-21 November 2025</p>', 'x'), null);
  const r = recordFromPage('2025-11-05', WEEK_TYPICAL, 'x')!;
  assert.equal(r.parserVersion, GVP_PARSER_VERSION);
  assert.equal(r.url, reportUrl('2025-11-05'));
});

test('collectWeeks fetches only what is missing, offline, and writes the raw text', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gvp-'));
  const pages: Record<string, string> = {
    [reportUrl('2025-11-05')]: WEEK_TYPICAL,
    [reportUrl('2025-11-12')]: WEEK_FAR,
  };
  const asked: string[] = [];
  const fetcher = async (url: string) => (asked.push(url), pages[url] ?? null);
  const weeks = ['2025-11-05', '2025-11-12', '2025-11-19'];

  const first = await collectWeeks(weeks, fetcher, () => 'T', dir);
  assert.deepEqual(first.written, ['2025-11-05', '2025-11-12']);
  assert.deepEqual(first.missing, ['2025-11-19']);
  const saved = JSON.parse(await readFile(path.join(dir, '2025-11-05.json'), 'utf8'));
  assert.equal(saved.raw, textOf(WEEK_TYPICAL));
  assert.deepEqual(saved.parsed.explosionsPerHour, { min: 4, max: 8 });

  asked.length = 0;
  const second = await collectWeeks(weeks, fetcher, () => 'T', dir);
  assert.deepEqual(second.written, []);
  assert.deepEqual(asked, [reportUrl('2025-11-19')]); // only the unavailable week is tried again
});

test('attachGvp marks each day of a week, with the full comparison on the first', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gvp-'));
  await collectWeeks(['2025-11-12'], async () => WEEK_FAR, () => 'T', dir);
  const entry = (date: string, rate: [number, number]): IndexEntry => ({
    date, explosionsMin: rate[0], explosionsMax: rate[1], ashMinMasl: null, ashMaxMasl: null, driftKm: null,
    driftDirections: [], incandescenceMinM: null, incandescenceMaxM: null, drainages: [], lavaFlowM: null,
    phenomena: [], ashfallCommunities: [], warnings: [],
  });
  const entries = [entry('2025-11-11', [5, 6]), entry('2025-11-13', [4, 8]), entry('2025-11-14', [5, 7])];
  const urls = new Map(entries.map((e) => [e.date, `https://insivumeh.example/${e.date}.pdf`]));
  assert.equal(await attachGvp(entries, urls, dir), 1);
  assert.equal(entries[0].gvp, undefined);
  assert.equal(entries[1].gvp?.state, 'differ');
  assert.equal(entries[1].gvp?.mark?.week, '2025-11-12');
  assert.equal(entries[2].gvp?.mark, undefined);
  assert.deepEqual(entries[1].gvp?.mark?.bulletins.map((b) => b.url), [
    'https://insivumeh.example/2025-11-13.pdf', 'https://insivumeh.example/2025-11-14.pdf',
  ]);
  assert.equal(await attachGvp([entry('2025-11-13', [4, 8])], urls, path.join(dir, 'none')), 0);
});
