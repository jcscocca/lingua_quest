# Theme-Filtered Sessions Implementation Plan

> Compact plan (design + tasks in one doc — the feature reuses established patterns).
> User request (2026-07-26): create theme labels for both decks, confirm each theme
> has a solid amount of content, and add words where a theme is under-represented.

**Goal:** Every themable word in both decks carries one of 18 canonical theme tags;
sparse themes are topped up with new appended vocabulary; sessions can be filtered
to one theme.

**Design:**

- **Taxonomy** (`src/lib/themes.ts`): 18 fixed kebab-case themes (food-drink,
  animals, nature-weather, body-health, family-people, home, clothing, colors,
  numbers, time-calendar, travel-transport, places-city, school-work,
  money-shopping, emotions-character, communication-media, politics-society,
  sports-leisure) + display labels. Function words and abstract vocabulary stay
  untagged (`theme` absent) — a theme session is a topical drill, not a partition
  of the whole deck.
- **Classification**: 12 parallel subagents tag each deck's 3,000 items from
  their glosses (conservative: only clear topical fits). Merged and filtered to
  valid ids/themes into `scripts/themes.<lang>.json` (id → theme), the committed
  source of truth — same curation pattern as the gloss overrides.
- **Additions** (`scripts/additions.<lang>.json`): array of `{lemma, pos, gloss[],
  theme}` authored to fill sparse themes. Appended AFTER the frequency-ranked
  3,000 (ranks 3001+…): existing ranks never shift, the probe's frequency bands
  stay honest, and themed additions surface via theme sessions or the tail of the
  new-word queue.
- **Coverage bar**: ≥25 words per theme per language (colors: ≥15 — a small closed
  class). Sparse themes get additions until they clear the bar.
- **Apply script** (`scripts/apply-themes.ts`, `npm run apply:themes`): reads both
  maps + additions, appends missing additions with dense ranks, stamps `theme` on
  every mapped item, clears stale tags, rewrites both `deck.json`s. Idempotent;
  rerun after any deck regeneration.
- **Validate gate**: any `item.theme` must be in the canonical list.
- **Session filter**: `assembleSession(..., {theme})` restricts reviews AND new
  words to the theme. Home gets a theme `<select>` beside the session CTA; App
  passes the choice to SessionScreen.

**Tasks** (each: test-first where logic, tsc + vitest green, commit):

1. `src/lib/themes.ts` — THEMES const, Theme type, THEME_LABEL. ✅ when imported by queue test.
2. Queue filter — failing test in `queue.test.ts` (themed session contains only
   themed items, due-first preserved, new-word fill respects theme), then the
   filter in `assembleSession`.
3. `scripts/apply-themes.ts` + `apply:themes` npm script + validate-deck theme
   check (+ its own dry idempotency check via a second run).
4. Merge classifier output → `scripts/themes.<lang>.json`; spot-check per-theme
   member lists; fix obvious misfiles by editing the map.
5. Coverage audit; author `scripts/additions.<lang>.json` for sparse themes;
   `npm run apply:themes`; `npm run validate`.
6. Home theme picker + App/SessionScreen wiring.
7. Gates + browser verification (start a themed session, see only themed words) +
   deploy via merge to main.
