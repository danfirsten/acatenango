# Fuego

A live monitor for **Volcán de Fuego**, Guatemala — one of the most
consistently active volcanoes on Earth, and the one that erupts across the
valley while you camp on Acatenango.

The site is a static export with no server and no database. A scheduled
GitHub Action fetches INSIVUMEH's daily volcanic bulletin, parses it, and
commits the result. **The repository is the database**: every day is a commit,
so the git history *is* the time series.

## Why it's built this way

Fuego's bulletins are published for a short window and then rotate away. Any
field the parser fails to extract today would be lost permanently — so every
record stores the **raw bulletin text verbatim** alongside the parsed fields,
plus the `parserVersion` that produced them. The parser is a pure function of
that raw text, which means improving it later re-derives the entire archive
with no re-fetching and no data loss. `build-index` re-parses any record whose
version is behind automatically.

The parser degrades rather than fails. Bulletins are written by hand and the
phrasing drifts, so each field is extracted independently: a field that can't
be found yields `null` and a warning. Partial data is useful; a crashed
collector that gets muted is a permanent outage.

## Architecture

```
scripts/collect.ts        Discovers and archives the day's bulletin
scripts/build-index.ts    Rolls the archive into a compact time series
src/lib/parse-bulletin.ts The parser — pure, tested, versioned
src/lib/fetch-text.ts     HTML and PDF text extraction
data/bulletins/*.json     One record per day, raw text preserved
data/index.json           Generated; what the site reads at build time
```

### Parsing notes

The bulletins are Spanish, and Spanish prose collides badly with compass
abbreviations — `se` is a pronoun, `no` is a negation, `o` means "or". So
spelled-out directions are matched case-insensitively while abbreviations are
matched **uppercase only**, and both only inside the dispersal clause.

Similarly, `Ceniza` is both a barranca on Fuego's flank and the ordinary word
for *ash*, so drainage names are only matched inside a clause that actually
names barrancas.

Numbers are ambiguous too: `4,500` and `4.500` both mean 4500, while `1.1 km`
is a decimal. These are disambiguated by shape rather than locale.

Ash columns below Fuego's 3,763 m summit are flagged as misparses, not readings.

## Development

```bash
npm install
npm test            # parser tests — no network required
npm run collect     # fetch and archive today's bulletin
npm run build:index # rebuild data/index.json from the archive
npm run dev
```

`BULLETIN_URL=<url> npm run collect` bypasses discovery and fetches a specific
bulletin — useful for backfilling or for testing against a known document.

## Data sources

- [INSIVUMEH](https://insivumeh.gob.gt) — Guatemala's national institute for
  seismology, volcanology, meteorology and hydrology. Daily bulletins.
- [Smithsonian Global Volcanism Program](https://volcano.si.edu) — Fuego is
  volcano `342090`. Weekly reports, used for historical backfill.

## Status

Collector and parser are in place and tested against representative fixtures.
The fixtures reproduce real bulletin phrasing but are not yet captured
documents — the first live runs will produce real ones, and the parser should
be re-validated against them.
