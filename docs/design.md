# Fuego: design direction

This records the look the site already has, so later work keeps it. Tokens live in `src/app/globals.css`.

## Subject and audience

- **Subject:** one volcano erupting across a valley at night, seen from a camp on the next summit.
- **Audience:** hikers planning or on the Acatenango climb (often on a phone, sometimes with poor signal), and people who follow Fuego. Many read Spanish first.
- **Job:** show what Fuego is doing lately, honestly, and how that looks from camp. Never act as a safety service.

## Look

- **Ember on alpine night.** A blue-biased dark ground (`--ground #0B1016`, `--surface #121A22`, `--line #1E2A34`), ink `#E7EEF4`, muted `#7F909E`, ash `#93A7B8`. The only warm colour is `--ember #E8622C`, and it belongs to the volcano and live data. Don't add a second accent.
- **Type:** Barlow for body, Barlow Condensed for labels (uppercase, `0.14em` tracking). Tabular figures for numbers.
- **The bold move:** the mountain is real terrain, and the record drives it. Scrubbing the tempo chart moves the plume to that day's ash column and drift. Keep the chart and the scene showing the same number.
- **Missing data** is visibly missing: a break in the line, a hatched or empty mark, a "not reported" label. Never zero.

## Motion

- Camera moves and the plume ease slowly; nothing bounces.
- `prefers-reduced-motion`: no camera orbit, no plume drift; the scene holds still and the numbers carry the meaning.

## Voice

Calm and factual, like an observer's log. Says what the bulletin reported and when. Never "safe", "dangerous" or advice about whether to climb; for that, it links INSIVUMEH and CONRED.

## Widths

390, 768 and 1440. On a phone both summits are in frame, the readout doesn't cover Fuego, and the chart stays legible (labels at least 11 px).
