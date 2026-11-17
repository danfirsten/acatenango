<!-- sasori:approved gate=design date=2026-11-17 -->
# Fuego: design direction

Fuego is built in Dan's ink and paper system (`vendor/ink-and-paper`, see its `DESIGN.md`). Dan chose it on 17 November 2026 from the UI and UX design canvas, boards A to D: the first screen, replaying a day, motion and the engraved 3D scene. Where the system already decides something (black and white, Geist, pills, the curves, marks, the voice), Fuego follows it exactly. This file only adds what a volcano monitor needs on top.

## Subject, audience, job

- **Subject:** one volcano erupting across a valley, seen from a camp on the next summit, and the record of what the observatory wrote down each day.
- **Audience:** hikers planning or on the Acatenango climb, usually on a phone, sometimes in strong sun on the way up, sometimes in the dark at camp, often with poor signal. Many read Spanish first.
- **Job:** say in one sentence what the latest bulletin reported, show how it looks from camp, and let people read the record honestly. Never act as a safety service.

## Colour

- **Black and white everywhere**, from the system's theme roles (`--bg`, `--surface`, `--fg`, `--soft`, `--muted`, `--rule`, `--fill`). Components never use the palette directly.
- **The scene is the photo.** Ink and paper has no accent: colour only comes from real images. In Fuego the terrain render plays that part. The lava glow and the crater stay ember orange, and the plume is a warm grey ash, both inside the scene only. Nothing in the page around the scene is orange: no ember buttons, links, labels or chart lines.
- **Paper by day, ink after dark.** `data-theme="auto"` on `<html>`: paper reads better in glare on the climb, ink suits camp at night. Both themes are first class and both are checked by QA.
- **State without colour** is carried by marks and words (below), never by hue.

## Type

- **Geist** for everything, **Geist Mono** for labels, dates and numbers, with tabular figures (`.num`). Self-hosted, as the system does.
- **Labels** are mono 11 to 12 px, sentence case inside the page (`data-surface="app"`), in `--muted`. Nothing below 11 px.
- **The day's sentence** is the largest text on a phone's first screen: Geist 500, about 26 px on a phone, −0.035em, line-height 1.1.
- **Wordmark:** "Fuego" in Geist 500 at −0.05em, with Pip's full stop after it.

## Shape

- **Radius by role:** 20 px for the scene and media, 24 px for cards, 12 px for chips, 999 px for buttons and pills.
- **Buttons are pills at least 48 px tall** (44 px only for the two compact official links in the notice). Primary is solid ink, secondary a 1 px outline. Links that leave the site carry ↗.
- **Image tags** on the scene: a dark pill at 78% with blur, mono, 14 px from the bottom-left (`Orbit · 16 Nov`).
- **Flat**, with 1 px rules. The only shadow is on things that float.

## Marks: missing is never zero

The system's five marks are how the page shows the state of a value. Used the same in the readout, the chart, the lanes and the camp panel, always with the words beside them:

| Mark | Meaning |
|---|---|
| solid disc | **Reported.** The figure as the bulletin wrote it. |
| ring | **Said none.** The bulletin says so in words. |
| hatched disc | **Not reported.** Hatched, never drawn or counted as 0. |
| dotted ring | **Held.** The scene shows an earlier day's plume; that date is named. |
| half-filled disc | **Continuous.** Emission with no hourly count. |

On the chart a day with no rate is a hatched band with no line across it.

## Hoop

Hoop (the ring, `vendor/ink-and-paper/characters/hoop.svg`) is the cast member for tools that watch. In Fuego it appears in three places only:
- on the "From camp" view switch,
- as the cursor on the record: Hoop sits over the selected day like a lens and the line inside it goes bold,
- asleep (eyes as closed lines) beside "Offline · saved copy". A still drawing, not a loop.

Hoop is always the opposite of what is under it.

## The scene: the mountain as an engraving

The same real terrain, camera and plume. Only the terrain shader, the sky and the summit labels change.
- **Hatching instead of shading.** Light from the same sun direction. Faces turned away get one set of lines, the darkest a second crossing set. Lines are drawn in world space so they stay put as the camera orbits, and spacing stays about 7 px at any distance by blending two scales, so nothing pops. Close up (From camp) the hatching must not coarsen.
- **Contours every 100 m, index contours every 500 m**, like a printed survey map.
- **Distance thins the drawing:** far ground fades to bare paper (or bare ink), not to blue haze.
- **Paper theme:** ink lines on paper, lines are shadow. **Ink theme:** light lines on ink, lines are light, thinner than on paper so it isn't busy.
- **Sky** is the page's own `--bg`. Summit labels use the system's label style.
- **Lava and crater keep ember; the plume is a warm grey ash**, not blue-grey.
- The vertical exaggeration (×1.55) stays disclosed.

## Layout

### First screen on a phone (390 × 844)

Top to bottom, with no scrolling needed to read the day:
1. **Compact notice strip:** "Unofficial archive. Copied from INSIVUMEH's bulletin, so it lags the observatory." with two outline pills, `INSIVUMEH ↗` and `CONRED ↗`. Shown on every visit, never dismissable, never alarming.
2. **Top row:** the wordmark, and the bulletin's age as a pill (`16 Nov · today`, `yesterday`, `3 days old` with a dashed edge when behind).
3. **The scene** in a 20 px clip, about 250 px tall, with its image tag bottom-left and the `From camp` switch (Hoop) bottom-right inside the scene.
4. **The day's sentence**, built by code from the parsed fields (camp panel wording).
5. **Three figures** in a row under a 1 px ink rule: explosions per hour, column height, drift.
6. **"See the N-day record"**, a solid ink pill.

On desktop the same order runs in two columns: the scene large on the left, the sentence, figures and camp panel on the right.

### Replaying a day

- Leaving the latest day turns the age pill into a dotted ring reading `Replaying 29 Jul` (the "held" mark).
- A **replay bar** comes up pinned to the bottom: previous day, the date, next day, and a solid `Back to 16 Nov`.
- The camp panel and the figures describe the selected day and name the bulletin's date.
- The chart is schematic ink: a 1 px line, a 1 px baseline, a faint mid rule, hatched bands for missing days, Hoop as the cursor.

## Motion

The system's curves and app-speed durations (`--dur-quick` 150 ms, `--dur-base` 220 ms, `--dur-slow` 320 ms).

| When | What | Curve |
|---|---|---|
| Load, once | **The orchestrated moment: the clip opens on the mountain.** The scene's mask opens from `inset(15% round 32px)` to `inset(0 round 20px)` over 1.2 s while the image settles from 1.15× to 1× over 1.6 s. Words and figures are already there; the scene arrives inside them. | `--ease-inout`, `--ease-expo` |
| Scrub | Hoop glides to the day; figures swap in place with a short fade. No counting up, no sliding. | 150 ms `--ease-out` |
| Scene | The plume's height and lean settle to the selected day. | settle on `--ease-expo` |
| Replay | The replay bar comes up like a drawer, and goes when you return to the latest day. | `--dur-slow` `--ease-drawer` |
| Switch view | Orbit to From camp is Fuego's slow camera ease; the image tag's text changes in place. | camera ease; tag 150 ms |
| Press | Scale to 0.97. | `--dur-quick` |

- **No breathing "live" disc.** The system's only loop means live; Fuego is an archive that lags the observatory, so it must not borrow that signal. There is no looping animation at all.
- **Reduced motion:** final states only. No clip, no settle, no camera orbit, no plume drift, no Hoop glide. Opacity changes may stay. The scene holds still and renders only when something changes.

### Interactions list (filmed by QA)

| Route | Selector | Action | Label |
|---|---|---|---|
| `/` | `.massif` | load | The clip opens on the mountain (the moment) |
| `/` | `.massif-views button:last-child` | click | Switch to the view from camp |
| `/` | the record's scrub | focus and arrow keys | Hoop moves to the day; the replay bar comes up |
| `/es/` | the same three | as above | Spanish |

## Voice

Calm and factual, like an observer's log, in plain words, British English, no em dashes. It says what the bulletin reported and when. Never "safe", "dangerous" or advice about climbing; for alerts it points to INSIVUMEH and CONRED. Every string has its Spanish twin in `src/i18n/es.ts`, natural rather than literal, and the notice keeps its meaning exactly.

## Widths

390, 768 and 1440, in paper and ink. On a phone both summits are in frame, the readout never covers Fuego, touch targets are at least 44 px, and the first screen holds the sentence and the three figures.

## Checked against the generic defaults

- Black and white with a single orange glow only inside the scene: the colour is the volcano's, not a UI accent.
- No card kit, no gradient washes, no emoji. Marks and words carry state.
- One moment (the clip) and no loops.
