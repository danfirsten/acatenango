# Ink and paper

Dan's design and motion system, first built for danfirstenberg.com (`df-portfolio4`) and now used across his tools (Watson, Embassy). The values live in `tokens/tokens.css`; this file is the rules for using them.

**Principle:** black and white everywhere, so photos and screenshots are the only colour. Plain words, real numbers, no em dashes.

## Colour

The palette, as it is:

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0B0B` | text on light, the dark background |
| `paper` | `#F7F7F4` | the light background, text on dark |
| `white` | `#FFFFFF` | light cards |
| `mute` | `#5E5E5A` | secondary text on light (6.3:1) |
| `line` | `#E4E4DF` | dividers on light |
| `well` | `#E9E9E4` | image placeholders, chips |
| `ink-text` | `#F2F2EE` | primary text on dark |
| `ink-mute` | `#8F8F8A` | secondary text on dark (6.2:1) |
| `ink-soft` | `#B4B4AF` | body text on dark |
| `ink-line` | `#262626` | dividers on dark |
| `ink-tile`, `ink-tile-line` | `#161616`, `#242424` | cards on dark |
| `warm` | `#1C1815` | the stage behind phone screenshots |

Components use the **theme roles**, never the palette directly. That way one component works in both themes:

| Role | Light | Dark |
|---|---|---|
| `--bg` | paper | ink |
| `--surface` | white | ink-tile |
| `--fg` | ink | ink-text |
| `--soft` | `#2A2A28` | ink-soft |
| `--muted` | mute | ink-mute |
| `--rule` | line | ink-line |
| `--fill` | well | ink-tile-line |
| `--inv-bg`, `--inv-fg` | ink on paper | paper on ink |

How a theme is chosen:
- **Light** is the default.
- `data-theme="dark"` on `<html>` forces dark.
- `data-theme="auto"` follows the system.
- `.dark` or `.light` on any section switches just that section. This is how the site alternates light and dark chapters.

**There are no accent colours.** State is carried by shape and words:
- **Live:** a disc that breathes.
- **Errors:** an outline and a plain sentence.
- **People or series:** marks (below).

## Type

- **Geist** (variable) for everything. **Geist Mono** for labels, dates and numbers. Both are self-hosted through Fontsource.
- **Display:** weight 500, −0.06em tracking, line-height 0.9, `clamp(56px, 11.6vw, 168px)`.
- **H2:** 500, −0.045em, line-height 1, `clamp(44px, 5vw, 72px)`.
- **Lede:** `clamp(18px, 1.55vw, 22px)`, line-height 1.45, −0.012em.
- **Body:** 15–16px, line-height 1.5.
- **Labels:** mono 11–12px, +0.06em, in the muted colour.
  - On editorial pages they're uppercase.
  - Inside dense tools (`data-surface="app"` or `.label.is-quiet`) they keep the mono but drop the capitals, because caps read as shouting there.
- **Numbers:** tabular figures (`.num`).

## Layout and shape

- **Grid:** max width 1440px, side gutter `clamp(16px, 4.45vw, 64px)`, section padding `clamp(80px, 11vw, 160px)`. Spacing steps of 4px.
- **Radius by role:**
  - 20px for media
  - 24px for cards
  - 32px for large tiles
  - 12px for chips and fields
  - 999px for buttons and pills
- **Elevation:** flat with a 1px rule at rest. One shadow (`--shadow`), and only on things that float (popovers, an answer card).
- **Buttons:** pills at least 48px tall, with 24px side padding.
  - Primary: solid ink.
  - Secondary: a 1px outline.
  - Links: underlined with a 4px offset, plus a ↗ when they leave the page.
- **Image tags:** a dark pill at 78% with a background blur, mono uppercase, 14px from the bottom-left corner.
- **Section header:** a mono label row, with the chapter on the left and context on the right (`04 · Selected work`).
- **Breakpoints:**
  - 1100px: two-column layouts stack.
  - 900px: the nav becomes a Menu button, and rows switch to native swipe.
  - 600px: grids drop to one or two columns.

## Marks

When things must be told apart without colour (speakers, room members, chart series), use marks drawn in ink, 12px:
1. solid disc
2. ring
3. half-filled disc
4. hatched disc
5. dotted ring

From 6 on, repeat them with a mono numeral beside.

## Motion

| Curve | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23,1,.32,1)` | fades, hovers |
| `--ease-expo` | `cubic-bezier(.16,1,.3,1)` | headline rises, image settle |
| `--ease-inout` | `cubic-bezier(.77,0,.175,1)` | image wipes, the clip, curtains |
| `--ease-drawer` | `cubic-bezier(.32,.72,0,1)` | menus, drawers, morphs |

**Editorial pages (the site):**
- **Headline rise:** each line slides up from 110% through its own mask, over 1s on expo, staggered 70ms per line (`<Lines>`).
- **Fade:** opacity 0 → 1 while rising 18px, 0.9s on out (`<Fade>`).
- **The clip** (the signature move):
  - The mask opens from `inset(15% round 32px)` to `inset(0)` over 1.2s on in-out.
  - At the same time, the image settles from 1.15× to 1× over 1.6s on expo (`<ClipImage>`).
- **Counters:** count up over about 2s with an exponential ease-out (`<Counter>`).
- **Loader:** counts to 100 while fonts and the hero load (at least 1.1s), then the curtain lifts on in-out.
- **Smooth scroll:** Lenis at lerp 0.1, with pinned chapters on GSAP ScrollTrigger (`@danfirsten/ink-and-paper/scroll`).
- **Marquee:** 60 seconds per loop.

**Tools and apps** (the same curves, app speed):
- **Durations:**
  - `--dur-quick` 150ms: press, hover and focus.
  - `--dur-base` 220ms: something new appearing.
  - `--dur-slow` 320ms: drawers.
- **No fade-and-slide on lists that update live:** a new row fades in place, so a column you're reading doesn't jump.
- **One orchestrated moment per product:** for example, Watson's answer opens with the clip. Everything else stays quiet.
- **The only looping animation is a live status disc**, breathing in opacity.

**Everywhere:**
- **Press:** scale to 0.97.
- **Hover:** 200–300ms.
- **Image hover:** zooms to 1.04, on fine pointers only.
- **Reduced motion:** every transform is turned off and everything shows in its final state. Opacity and colour changes may stay.

## Voice

- Short, plain sentences, first person on personal pages.
- Every number has a source and a date.
- No adjectives like "passionate", and no em dashes.
- In tools:
  - Buttons say exactly what happens ("Start listening", "Stop and save").
  - Errors say what happened and how to fix it, without apologising.
  - Empty states say what will appear and offer the first action.

## Characters

Pip came from the portfolio (`df-portfolio4/src/lib/pip.ts`). The cast gives each of the five marks the same body and eyes, so a tool can have a character without adding colour. The art is in [`characters/`](characters), drawn in `currentColor`.

| Mark | Character | Its move | Use it for |
|---|---|---|---|
| solid disc | **Pip** | becomes punctuation: the period, an ellipsis while thinking, the dot on an i | the site, this system, anything personal |
| ring | **Hoop** | looks through itself like a lens | tools that watch or listen (Watson, Fuego, TagSentry) |
| half-filled disc | **Dusk** | fills as a job runs | things that run on a schedule or know about the dark (Gantt, Patronus) |
| hatched disc | **Scratch** | circles, ticks and hatches what it reads | tools that write or grade (Shipping log, Hookwright, Streakplate) |
| dotted ring | **Stitch** | leaves a dotted seam between what it joins | tools that connect things (Sasori, semantic-merge, Halfcourt) |

- **Same body:** radius 14 at 1×, eyes at ±0.36r. The eyes are holes or ink, never a colour.
- **Family resemblance:** they blink, sleep, blot when thrown, and are always the opposite of what's under them.
- **Only Pip roams.** The others live in their tool's banner, icon, loading and empty states.
- **One moment per project.** Like the portfolio's case studies, each tool gets one bit that belongs only to it. Footprints are Spoor's moment, not Pip's.

## Banners

Each repository's README opens with a banner in the style of Greenfield's: the same frame every time, one scene that changes.

- **Frame:** 1200 × 400 design, exported at 2400 × 800 (3:1). Mono label top left (`danfirsten / repo`), the name in Geist 500 at −0.06em, a one-line lede, a mono line of facts bottom left.
- **Scene:** right half. One character doing that project's moment. Paper for tools people use in the open, ink for things that run in the background or at night.
- **No colour.** If a banner needs colour, it comes from a real screenshot.
- **Copy:** from the repository's own README or brief. No invented numbers.

Sources are in [`banners/`](banners), one HTML file per repository. `npm run banners` renders them to `banners/png/` with Playwright (`npx playwright install chromium` once). Each repository keeps its copy at `docs/assets/banner.png`.
