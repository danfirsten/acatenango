@AGENTS.md

# Fuego

A static monitor for Volcán de Fuego, Guatemala (Next.js `output: 'export'`, Three.js, no server). Read `README.md` and, for UI work, `docs/design.md` and `vendor/ink-and-paper/DESIGN.md` first.

- **The repository is the database.** `.github/workflows/collect.yml` runs on a schedule, OCRs INSIVUMEH's daily bulletin and commits `data/bulletins/<date>.json`. It must stay a live scheduled workflow (it is in `actionsKeep`); never make it dispatch-only.
- **Raw text is sacred.** Every record keeps the bulletin's raw text verbatim and the `parserVersion` that read it. The parser (`src/lib/parse-bulletin.ts`) is pure; a change bumps `PARSER_VERSION` and `npm run build:index` re-derives everything.
- **Missing is never zero.** A field the bulletin didn't state is `null` and is shown as missing (a gap, "not reported"), never drawn or counted as 0. A wrong value is worse than a missing one.
- **Not an official warning.** Fuego is an unofficial archive that lags the observatory. Never word anything as safety advice; point to INSIVUMEH and CONRED for alerts.
- External data: INSIVUMEH bulletins (credited, shown verbatim), AWS Terrain Tiles (public domain), Smithsonian GVP (credited). There is no `src/lib/services/`; fetchers live in `src/lib/` and `scripts/` and must work offline in tests with fixtures.
- Writing style for page copy and docs: plain words, British English, no em dashes.

<!-- sasori -->
## Sasori

This repo is built by the Sasori factory. Read `.claude/sasori/quality-bar.md`, `.claude/sasori/design-bar.md` and `.claude/sasori/protocol.md` before changing code. In a cloud session, `.claude/sasori/cloud.md` says how GitHub is reached (REST through `gh api`, or the GitHub MCP; GraphQL and `gh pr`/`gh issue` don't work).

- A prompt starting `SASORI TRACK` means: use the `track` skill and finish the issue without stopping to ask.
- Reviews before merge come from the `review-gate` skill, and for UI work the `design-review` skill, each run as a fresh subagent. Merges come only from the conductor's merge train (`.claude/sasori/merge-train.sh`).
- UI work follows `docs/design.md` and the `frontend-design` skill.
- Project settings (checks, base, hot files, merge method) are in `.sasori/config.json`; QA routes in `.sasori/qa.json`, plus one file per issue in `.sasori/qa.d/` (add a file there; don't edit `qa.json`). Tickets are GitHub issues.
- Every external service works keyless through `src/lib/services/` (`.claude/sasori/stack.md`). Never wait on a key; record it with a `needs-you` comment.
- This repo's own conventions in this file, `AGENTS.md` and the PR template win over Sasori's defaults.
