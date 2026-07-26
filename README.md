# 🗺️ Lingua Quest

A single-player **vocabulary trainer** in the spirit of old Memrise: pure
spaced repetition over real frequency-ranked word decks, all in-browser with
no accounts. **Spanish** 🇪🇸 and **French** 🇫🇷, 3,000 words each.

No skill tree, no XP, no streaks — just an honest picture of what you know
and a daily queue that keeps it that way.

## How it works

- **The probe** — a short placement test that samples words across frequency
  bands, estimates how many words you already know, and seeds them into the
  schedule as mature (so you review to *maintain* them, not relearn them).
  Seed intervals are jittered so maintenance reviews arrive as a steady
  trickle, never an avalanche.
- **Sessions** — due reviews first (most overdue first), padded with new
  words fed in by frequency rank. Each word climbs a 6-level ladder, and the
  test escalates with maturity:
  - **Choice** — recognize the English meaning (levels 0–2)
  - **Type** — produce the word from its meaning, accent-lenient
    (levels 3–4)
  - **Audio** — type what you hear, spoken by the browser's Web Speech API
    (level 5; degrades to a visible transcription task without TTS)
- **The collection** — browse or search the whole deck with each word's
  schedule state, and reset any word you want to relearn from scratch.
- **Honest metrics** — estimated vocabulary, words at strong retention, and
  today's real review backlog. A wrong answer drops a word back toward cheap
  recognition so it re-stabilizes fast.

## Run it

    npm install
    npm run dev        # → http://localhost:5173

## Develop

    npm test           # unit tests (scheduler, probe, queue, grading, persistence)
    npm run validate   # content gate: structure + every deck item passes the grader
    npm run build      # typecheck + production build
    npm run e2e        # Playwright smoke test against the built site

## Content

Decks are generated JSON under `public/content/<lang>/deck.json` — ~3,000
lemmas with English glosses, ordered by a dense frequency `rank` the probe
depends on. Item ids (`lang:lemma:pos`) are stable across regeneration, so
your schedule survives a deck rebuild.

    npm run build:deck      # Spanish — FrequencyWords + Wiktionary via doozan/spanish_data
    npm run build:deck:fr   # French  — kaikki.org wiktextract + FrequencyWords

Raw sources download into a gitignored `raw/`. Gloss corrections live in
`scripts/overrides.<lang>.json` — edit the override, rebuild the deck, and
`npm run validate` gates the result (CI runs it on every push).

## Progress

Stored per-language in IndexedDB — no accounts. **Export / Import** on the
home screen backs up everything as JSON. The deployed site lives at
[jcscocca.github.io/lingua_quest](https://jcscocca.github.io/lingua_quest/),
built and smoke-tested by CI on every push to `main`.
