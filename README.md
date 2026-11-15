![Fuego: a live monitor for Volcán de Fuego. Hoop camps across the valley while the plume rises one dot a day.](docs/assets/banner.png)

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

## The mountain is real

The 3D view is not a sculpted or procedural mountain. `scripts/fetch-terrain.ts`
pulls [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) — public
domain, SRTM-derived, no API key — decodes the terrarium RGB elevation encoding,
and bakes a 512×512 heightmap covering 14.2 km of the Acatenango–Fuego massif at
about 28 m per pixel.

The fetch verifies itself against published summit elevations and refuses to
write a heightmap that does not match:

```
Fuego:      DEM 3771 m vs published 3763 m  (+8 m)
Acatenango: DEM 3967 m vs published 3976 m  (−9 m)
```

Every vertex, the contour lines, and the height the ash column is drawn to all
derive from those numbers. The one liberty is vertical exaggeration (×1.55),
disclosed on the page — 2.9 km of relief across 14 km reads as a gentle mound at
true scale.

The heightmap ships as a PNG rather than JSON: elevation is packed 16-bit across
the red and green channels, which is ~420 KB instead of about a megabyte of
text, and the browser decodes it for free.

## Architecture

```
scripts/fetch-terrain.ts  Bakes the real elevation heightmap (run once)
src/lib/scene/massif.ts   Three.js terrain, ash plume, ember and camera rig
scripts/collect.ts        Fetches and archives the day's bulletin
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

INSIVUMEH publishes the daily bulletin at a **deterministic, date-addressable
URL** — there is nothing to scrape:

```
https://insivumeh.gob.gt/wp-content/uploads/{YYYY}/{MM}/BVD-{YYYY}-{MM}-{DD}.pdf
```

Their own page never links bulletins; its JavaScript probes this pattern over
the last few days. Addressing it directly is more reliable than scraping, and it
makes historical backfill a matter of iterating dates.

An earlier link-scraping approach is deliberately gone. It resolved to *news
articles about* bulletins rather than bulletins, and extracted a pyroclastic
flow runout distance as though it were an ash drift figure — a wrong value
silently recorded as data, which is worse than a missing one.

Also relevant:
[Smithsonian Global Volcanism Program](https://volcano.si.edu) — Fuego is
volcano `342090`; weekly reports are plain HTML and useful for cross-checking.

## Status

**The daily bulletin PDFs are scans with no text layer.** Each page is a single
drawn image, so `pdfjs` returns zero text items and the parser never sees
anything. The collector detects this and archives nothing rather than writing an
empty record that would look like a collected day.

So the pipeline needs OCR before real data flows:

- `tesseract-ocr` plus the `spa` language pack, installed in the workflow
- rasterise each page, OCR it, and feed the text to the existing parser
- expect OCR noise (`4,5OO` for `4,500`), so the parser's number handling and
  its below-summit sanity check matter more, not less

Everything downstream of the parser is unaffected — raw text is still preserved
verbatim, so once OCR lands, re-running `build:index` re-derives the archive.

The parser itself is tested against fixtures that reproduce real bulletin
phrasing, but not yet against captured documents. Re-validate once OCR produces
real text.

### Local development note

Node's built-in `fetch` ignores `HTTPS_PROXY`. Behind a proxy, run the collector
as `NODE_USE_ENV_PROXY=1 npm run collect` (Node ≥ 22.21). CI needs no such flag.
