# Focus mode & confusable pairs — design

Two follow-on features from the redesign spec
(`2026-07-24-memrise-redesign-design.md`, "Follow-on features"), designed as
clean extensions of the shipped engine. User approved building both
("All of it. go", 2026-07-26).

---

## 1. Focus mode with frozen intervals

**Problem.** Running two languages in parallel, pushing hard on one lets the
other's reviews pile into an overdue avalanche that punishes coming back —
the exact failure the jittered probe seeding was built to avoid, recreated at
the whole-language level.

**Semantics: pausing stops a language's clock.** Pausing language L at date
P freezes its schedule exactly as it stood at P. While paused:

- All due-ness math (due count, strong count, per-word status) evaluates
  against **P**, not the real today — the numbers stop moving.
- Studying L is blocked: the session and probe entry points are replaced by
  a Resume action. (Grading against a frozen clock would mix time frames;
  an explicit resume keeps one coherent timeline.)

**Resuming shifts the snapshot forward.** On resume at date T, every item
state's `due` moves forward by `dayDiff(P, T)` days, then the pause mark is
cleared. A word due in 3 days when paused is due 3 days after resume; a word
2 days overdue at pause is exactly 2 days overdue on resume — earned debt is
preserved, but no new debt accrues while paused. A same-day resume (or a
negative diff from clock skew) shifts by 0 and is a pure no-op.

**Data.** `Profile` gains an optional `paused?: Record<string, string>`
(lang → pause date). Profile version stays 2: the field is additive, old
backups import unchanged, and new backups carry it through the existing
wholesale profile export/import.

**Modules.**

- `src/lib/focus.ts` (pure): `pausedSince(profile, lang)`,
  `effectiveToday(profile, lang, today)` (pause date if paused, else today),
  `shiftStates(states, days)`.
- `engine.ts` actions `pauseLang()` / `resumeLang()` for the **active**
  language only (the only one whose states are hydrated; the UI only offers
  the toggle there). Resume persists shifted states with `setMany`, then
  updates the profile.

**UI (Home).**

- Not paused: a small "⏸ Pause reviews" button in the utility row.
- Paused: a banner — "⏸️ Reviews frozen since {date}" — with a "Resume"
  button, replacing the session/probe CTAs. Stats show the frozen numbers.
- The language `<select>` marks paused languages with ⏸ so the state is
  visible from the other language.
- Collection stays browsable while paused (read-only view of the snapshot).

**Testing.** Shift math (incl. 0/negative); frozen due/strong counts via
`effectiveToday`; overdue-at-pause preserved through resume; engine
pause→resume integration on fake-indexeddb; export/import round-trips
`paused`.

---

## 2. Confusable pairs (ES↔FR false friends)

**Problem.** For a learner running Spanish and French together, identical
spellings with different meanings (es *salir* "to leave" / fr *salir* "to
dirty") are the highest-interference words. The app knows both decks; it
should surface the collision at exactly the moment the word is in front of
you.

**Mining (build time).** `scripts/build-confusables.ts`:

1. Load both committed decks.
2. Key every item by its folded lemma (`normalize` + `foldAccents` from
   `check.ts` — the grader's own equivalence).
3. For each folded form in both languages, pair ES×FR items whose gloss
   token sets are **disjoint** — same form, no shared meaning = false
   friend. Shared-meaning pairs (es/fr *importante*…) are cognates, not
   confusing, and are skipped.
   - Gloss tokens: lowercase, parentheticals stripped, split on
     non-letters, minus stopwords (`to a an the of s`). Overlap = any
     shared token.
4. Apply `scripts/overrides.confusables.json`:
   `{ "drop": ["<esId>|<frId>", …], "add": [{ "es": "<esId>", "fr": "<frId>" }, …] }`
   — drop kills a noisy automatic pair, add forces one the folded-form rule
   can't see (e.g. near-identical spellings). Same curation pattern as the
   deck override files.
5. Emit `public/content/confusables.json`:
   `{ generated, pairs: [{ form, es: {id, lemma, pos, gloss}, fr: {id, lemma, pos, gloss} }] }`
   (glosses truncated to the first two senses — display payload only).

**Runtime.** `src/lib/confusables.ts` owns the shared pure logic
(`findFalseFriends`, gloss-overlap — imported by the build script, unit
tested) plus `loadConfusables(base)` (fetch; `null` on any failure — the
feature is an enhancement and silently absent when the file is missing) and
`indexConfusables(pairs)` → `Map<itemId, pair>` for O(1) lookup from either
language.

**Surfacing.** The warning names the *other* language's meaning:

> 🚧 Faux ami — French **salir** means "to dirty".

- **Card feedback** (`DeckCard`): shown in the reveal panel after answering,
  right or wrong — the moment of maximum attention.
- **Collection** (`VocabCard`): the same line, compact, so pairs are
  discoverable when browsing.
- `App` fetches confusables once at startup (static, language-independent)
  and passes the index to `SessionScreen` and `Collection`.

**Integrity.** `validate-deck.ts` additionally checks every id in
`confusables.json` resolves in the current decks — a deck regeneration that
renames or drops a lemma fails the gate instead of shipping dangling pairs.

**Testing.** Overlap/disjoint gloss cases; folded-form matching (accents,
œ); drop/add overrides honored; index lookup from both sides; a
known-true pair (salir) present in the generated file if the miner finds it,
asserted via the validate gate rather than a brittle fixture.

---

## Build order

Focus mode first (pure engine + Home, no content step), then confusables
(content artifact + two display sites). Both land behind the full gate
(`test`, `validate`, `build`, `e2e`) and a browser verification pass.
