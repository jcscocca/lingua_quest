# Focus Mode + Confusables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two learner-facing follow-ons from the redesign spec — per-language pause with frozen intervals, and ES↔FR false-friend surfacing — per `docs/superpowers/specs/2026-07-26-focus-confusables-design.md`.

**Architecture:** Focus mode is a pure module (`focus.ts`) + two engine actions + Home UI; pausing freezes all due-ness math at the pause date, resuming shifts every due date forward by the paused span. Confusables are mined at build time from the two committed decks into `public/content/confusables.json` (shared pure logic in `confusables.ts`), loaded at runtime as a nullable enhancement, and displayed in the card feedback panel and the Collection.

**Tech Stack:** existing — TypeScript, React, zustand, idb-keyval, vitest (+fake-indexeddb), tsx scripts, Playwright.

**File map:**
- Create: `src/lib/focus.ts`, `src/lib/focus.test.ts`, `src/lib/confusables.ts`, `src/lib/confusables.test.ts`, `scripts/build-confusables.ts`, `scripts/overrides.confusables.json`, `public/content/confusables.json` (generated)
- Modify: `src/lib/engine.ts` (Profile.paused + 2 actions), `src/lib/engine.test.ts`, `src/components/Home.tsx`, `src/App.tsx`, `src/components/SessionScreen.tsx`, `src/components/DeckCard.tsx`, `src/components/Collection.tsx`, `src/styles.css`, `scripts/validate-deck.ts`, `package.json`

---

### Task 1: Focus logic (`focus.ts`)

**Files:** Create `src/lib/focus.ts`, `src/lib/focus.test.ts`; Modify `src/lib/engine.ts` (Profile only)

- [ ] **Step 1: Add `paused` to Profile** in `src/lib/engine.ts`:

```ts
export interface Profile {
  version: 2
  /** estimated frontier / vocab size per language */
  frontier: Record<string, number>
  /** focus mode: lang → date its schedule froze (absent = running) */
  paused?: Record<string, string>
  hydrated: boolean
}
```

- [ ] **Step 2: Write failing tests** `src/lib/focus.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Profile } from './engine'
import { effectiveToday, pausedSince, shiftStates } from './focus'
import type { ItemState } from './srs'

const profile = (paused?: Record<string, string>): Profile =>
  ({ version: 2, frontier: {}, paused, hydrated: true })

const state = (due: string): ItemState =>
  ({ level: 3, interval: 8, due, lapses: 1, seen: '2026-07-01', origin: 'probe' })

describe('pausedSince / effectiveToday', () => {
  it('reports the pause date only for the paused language', () => {
    const p = profile({ es: '2026-07-10' })
    expect(pausedSince(p, 'es')).toBe('2026-07-10')
    expect(pausedSince(p, 'fr')).toBeUndefined()
  })
  it('freezes the effective date at the pause date', () => {
    expect(effectiveToday(profile({ es: '2026-07-10' }), 'es', '2026-07-20')).toBe('2026-07-10')
    expect(effectiveToday(profile({ es: '2026-07-10' }), 'fr', '2026-07-20')).toBe('2026-07-20')
    expect(effectiveToday(profile(), 'es', '2026-07-20')).toBe('2026-07-20')
  })
})

describe('shiftStates', () => {
  it('moves every due date forward by the paused span', () => {
    const out = shiftStates({ a: state('2026-07-12'), b: state('2026-07-30') }, 10)
    expect(out.a.due).toBe('2026-07-22')
    expect(out.b.due).toBe('2026-08-09')
    expect(out.a.level).toBe(3) // untouched fields survive
  })
  it('is a no-op (same reference) for zero or negative spans', () => {
    const states = { a: state('2026-07-12') }
    expect(shiftStates(states, 0)).toBe(states)
    expect(shiftStates(states, -3)).toBe(states)
  })
})
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/lib/focus.test.ts` → FAIL (module missing)

- [ ] **Step 4: Implement** `src/lib/focus.ts`:

```ts
// Focus mode. Pausing a language freezes its schedule where it stands: all
// due-ness math evaluates against the pause date, and resuming shifts every
// due date forward by the paused span — earned overdue debt is preserved,
// but none accrues while frozen.

import { addDays } from './date'
import type { Profile } from './engine'
import type { ItemState } from './srs'

export function pausedSince(profile: Profile, lang: string): string | undefined {
  return profile.paused?.[lang]
}

/** The date due-ness math should use: frozen at the pause date while paused. */
export function effectiveToday(profile: Profile, lang: string, today: string): string {
  const p = pausedSince(profile, lang)
  return p && p < today ? p : today
}

/** Resume after `days` paused: every due date moves forward by the span. */
export function shiftStates(states: Record<string, ItemState>, days: number): Record<string, ItemState> {
  if (days <= 0) return states
  return Object.fromEntries(Object.entries(states).map(([id, s]) => [id, { ...s, due: addDays(s.due, days) }]))
}
```

- [ ] **Step 5: Verify pass** — `npx vitest run src/lib/focus.test.ts` → PASS
- [ ] **Step 6: Commit** — `git add src/lib && git commit -m "feat(focus): pure pause/freeze/shift logic"`

### Task 2: Engine pause/resume actions

**Files:** Modify `src/lib/engine.ts`, `src/lib/engine.test.ts`

- [ ] **Step 1: Write failing tests** (append to `src/lib/engine.test.ts`, following its existing fake-indexeddb setup):

```ts
describe('focus mode', () => {
  it('pause stamps today; resume shifts dues by the paused span and clears the stamp', async () => {
    const today = todayString()
    await useEngine.getState().hydrate('es')
    await useEngine.getState().grade('es:hola:interj', true) // creates a state due tomorrow
    const before = useEngine.getState().states['es:hola:interj'].due

    // Backdate the pause 5 days so resume has a real span to shift.
    const past = addDays(today, -5)
    await idbSet('lingua-quest-profile', { version: 2, frontier: {}, paused: { es: past }, hydrated: false })
    await useEngine.getState().hydrate('es')
    expect(useEngine.getState().profile.paused?.es).toBe(past)

    await useEngine.getState().resumeLang()
    const after = useEngine.getState().states['es:hola:interj']
    expect(after.due).toBe(addDays(before, 5)) // overdue-at-pause debt preserved, no new debt
    expect(useEngine.getState().profile.paused?.es).toBeUndefined()
    // shifted state was persisted, not just set in memory
    const persisted = await idbGet('es:hola:interj', itemStore('es'))
    expect((persisted as ItemState).due).toBe(after.due)
  })

  it('pauseLang persists the stamp; resume with no stamp is a no-op', async () => {
    await useEngine.getState().hydrate('es')
    await useEngine.getState().resumeLang() // nothing paused — must not throw or shift
    await useEngine.getState().pauseLang()
    expect(useEngine.getState().profile.paused?.es).toBe(todayString())
    const saved = await idbGet('lingua-quest-profile')
    expect((saved as Profile).paused?.es).toBe(todayString())
  })

  it('export carries paused through import', async () => {
    await useEngine.getState().hydrate('es')
    await useEngine.getState().pauseLang()
    const file = await exportAll()
    expect(file.profile.paused?.es).toBe(todayString())
    await importAll(file)
    const saved = await idbGet('lingua-quest-profile')
    expect((saved as Profile).paused?.es).toBe(todayString())
  })
})
```

(Adjust imports to the file's existing ones: `idbGet`/`idbSet` come from `idb-keyval`, plus `addDays` from `./date`, `itemStore`, `exportAll`, `importAll`, `Profile` from `./engine`, `ItemState` from `./srs`.)

- [ ] **Step 2: Verify failure** — `npx vitest run src/lib/engine.test.ts` → FAIL (`pauseLang` not a function)

- [ ] **Step 3: Implement** in `src/lib/engine.ts` — add to the `EngineStore` interface:

```ts
  pauseLang(): Promise<void>
  resumeLang(): Promise<void>
```

and to the store (mirroring `applyProbe`'s read-merge-persist pattern):

```ts
  async pauseLang() {
    const { activeLang } = get()
    const saved = await idbGet<Profile>(PROFILE_KEY).catch(() => undefined)
    const base = saved && saved.version === 2 ? saved : get().profile
    const profile: Profile = { ...base, hydrated: true, paused: { ...base.paused, [activeLang]: todayString() } }
    await idbSet(PROFILE_KEY, profile)
    set({ profile })
  },

  async resumeLang() {
    const { activeLang, states, profile } = get()
    const since = profile.paused?.[activeLang]
    if (!since) return
    const shifted = shiftStates(states, dayDiff(since, todayString()))
    if (shifted !== states) await setMany(Object.entries(shifted), itemStore(activeLang))
    const saved = await idbGet<Profile>(PROFILE_KEY).catch(() => undefined)
    const base = saved && saved.version === 2 ? saved : profile
    const paused = { ...base.paused }
    delete paused[activeLang]
    const next: Profile = { ...base, hydrated: true, paused }
    await idbSet(PROFILE_KEY, next)
    set({ profile: next, states: shifted })
  },
```

Imports to extend: `dayDiff` from `./date`, `shiftStates` from `./focus`.

- [ ] **Step 4: Verify pass** — `npx vitest run src/lib/engine.test.ts` → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(focus): engine pause/resume — shift-on-resume, persisted"`

### Task 3: Home UI for focus mode

**Files:** Modify `src/components/Home.tsx`, `src/styles.css` (only if a class is missing)

Contract (structural — follow existing Home idioms):

- [ ] **Step 1:** Imports: `effectiveToday, pausedSince` from `../lib/focus`; keep `todayString` from `../lib/date`.
- [ ] **Step 2:** `const today = effectiveToday(profile, lang.code, todayString())` (replaces the bare `todayString()`) — due/strong counts freeze automatically. `const paused = pausedSince(profile, lang.code)`.
- [ ] **Step 3:** When `paused`, render **instead of** the probe callout and `.home-primary` block:

```tsx
<div className="review-callout">
  <strong>⏸️ Reviews frozen since {paused}</strong>
  <span>No backlog accrues while {langLabel(lang.code)} is paused. Resume to pick up exactly where you left off.</span>
  <button onClick={() => void useEngine.getState().resumeLang()}>Resume</button>
</div>
```

- [ ] **Step 4:** When not paused, add to the utility row (next to Export/Import): `<button title="Freeze this language's schedule while you focus on the other" onClick={() => void useEngine.getState().pauseLang()}>⏸ Pause</button>`
- [ ] **Step 5:** Mark paused languages in the switcher: `{langLabel(l)}{profile.paused?.[l] ? ' ⏸' : ''}`.
- [ ] **Step 6:** Acceptance: `npx tsc --noEmit` clean; `npm test` green; in the browser — pause hides both CTAs and shows the banner with frozen counts; resume restores them; the select shows ⏸ beside the paused language from the other language's Home.
- [ ] **Step 7: Commit** — `git commit -am "feat(focus): Home pause/resume UI, frozen metrics"`

### Task 4: Confusables logic (`confusables.ts`)

**Files:** Create `src/lib/confusables.ts`, `src/lib/confusables.test.ts`

- [ ] **Step 1: Write failing tests** `src/lib/confusables.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { DeckItem } from './deck'
import { findFalseFriends, glossesOverlap, indexConfusables, otherSide } from './confusables'

const item = (id: string, lemma: string, gloss: string[], pos = 'n'): DeckItem =>
  ({ id, lemma, pos, gloss, rank: 1 })

const esSalir = item('es:salir:v', 'salir', ['to leave', 'to go out'], 'v')
const frSalir = item('fr:salir:v', 'salir', ['to dirty', 'to soil'], 'v')
const esImportante = item('es:importante:adj', 'importante', ['important'], 'adj')
const frImportant = item('fr:importante:adj', 'importante', ['important'], 'adj')

describe('glossesOverlap', () => {
  it('sees shared meaning through stopwords and parentheticals', () => {
    expect(glossesOverlap(['to leave (a place)'], ['leave', 'depart'])).toBe(true)
    expect(glossesOverlap(['to leave'], ['to dirty'])).toBe(false) // "to" is noise
  })
})

describe('findFalseFriends', () => {
  it('pairs same-form disjoint-meaning items and skips cognates', () => {
    const pairs = findFalseFriends([esSalir, esImportante], [frSalir, frImportant])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].es.id).toBe('es:salir:v')
    expect(pairs[0].fr.id).toBe('fr:salir:v')
  })
  it('matches across accents via the grader fold', () => {
    const pairs = findFalseFriends(
      [item('es:té:n', 'té', ['tea'])],
      [item('fr:te:pron', 'te', ['you (object)'], 'pron')],
    )
    expect(pairs).toHaveLength(1)
    expect(pairs[0].form).toBe('te')
  })
})

describe('index and lookup', () => {
  it('finds the pair from either side and names the other side', () => {
    const [pair] = findFalseFriends([esSalir], [frSalir])
    const idx = indexConfusables([pair])
    expect(idx.get('es:salir:v')).toBe(pair)
    expect(otherSide(pair, 'es:salir:v')).toEqual({ lang: 'fr', side: pair.fr })
    expect(otherSide(pair, 'fr:salir:v')).toEqual({ lang: 'es', side: pair.es })
  })
})
```

- [ ] **Step 2: Verify failure** — `npx vitest run src/lib/confusables.test.ts` → FAIL

- [ ] **Step 3: Implement** `src/lib/confusables.ts`:

```ts
// ES↔FR false friends: same folded spelling, disjoint meanings. Mined at build
// time (scripts/build-confusables.ts) into public/content/confusables.json and
// loaded here as a display-only enhancement — absent file, absent feature.

import { foldAccents, normalize } from './check'
import type { DeckItem } from './deck'

export interface ConfusableSide {
  id: string
  lemma: string
  pos: string
  gloss: string[]
}

export interface ConfusablePair {
  form: string
  es: ConfusableSide
  fr: ConfusableSide
}

export interface ConfusablesFile {
  generated: string
  pairs: ConfusablePair[]
}

const STOP = new Set(['to', 'a', 'an', 'the', 'of', 's', 'or', 'in', 'on'])

function glossTokens(glosses: string[]): Set<string> {
  const out = new Set<string>()
  for (const g of glosses)
    for (const t of g.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-zà-ÿ]+/))
      if (t && !STOP.has(t)) out.add(t)
  return out
}

export function glossesOverlap(a: string[], b: string[]): boolean {
  const ta = glossTokens(a)
  for (const t of glossTokens(b)) if (ta.has(t)) return true
  return false
}

export function confusableSide(it: DeckItem): ConfusableSide {
  return { id: it.id, lemma: it.lemma, pos: it.pos, gloss: it.gloss.slice(0, 2) }
}

/** Same folded form (the grader's own equivalence), no shared gloss token. */
export function findFalseFriends(es: DeckItem[], fr: DeckItem[]): ConfusablePair[] {
  const byForm = new Map<string, DeckItem[]>()
  for (const it of es) {
    const f = foldAccents(normalize(it.lemma))
    byForm.set(f, [...(byForm.get(f) ?? []), it])
  }
  const pairs: ConfusablePair[] = []
  for (const frIt of fr) {
    const f = foldAccents(normalize(frIt.lemma))
    for (const esIt of byForm.get(f) ?? [])
      if (!glossesOverlap(esIt.gloss, frIt.gloss))
        pairs.push({ form: f, es: confusableSide(esIt), fr: confusableSide(frIt) })
  }
  return pairs.sort((a, b) => a.form.localeCompare(b.form))
}

/** O(1) lookup from either language's item id (first pair wins on homographs). */
export function indexConfusables(pairs: ConfusablePair[]): Map<string, ConfusablePair> {
  const m = new Map<string, ConfusablePair>()
  for (const p of pairs) {
    if (!m.has(p.es.id)) m.set(p.es.id, p)
    if (!m.has(p.fr.id)) m.set(p.fr.id, p)
  }
  return m
}

export function otherSide(pair: ConfusablePair, itemId: string): { lang: string; side: ConfusableSide } | null {
  if (pair.es.id === itemId) return { lang: 'fr', side: pair.fr }
  if (pair.fr.id === itemId) return { lang: 'es', side: pair.es }
  return null
}

export async function loadConfusables(base: string): Promise<Map<string, ConfusablePair> | null> {
  try {
    const res = await fetch(`${base}content/confusables.json`)
    if (!res.ok) return null
    const file = (await res.json()) as ConfusablesFile
    return indexConfusables(file.pairs)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Verify pass**, then **Commit** — `git add src/lib && git commit -m "feat(confusables): false-friend mining + lookup logic"`

### Task 5: Build script, overrides, generated file, validate gate

**Files:** Create `scripts/build-confusables.ts`, `scripts/overrides.confusables.json`; Modify `package.json`, `scripts/validate-deck.ts`

- [ ] **Step 1:** `scripts/overrides.confusables.json` starts as `{ "drop": [], "add": [] }`.

- [ ] **Step 2:** `scripts/build-confusables.ts`:

```ts
// Mine ES↔FR false friends from the committed decks. Run: npm run build:confusables

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { confusableSide, findFalseFriends, type ConfusablePair } from '../src/lib/confusables'
import type { Deck } from '../src/lib/deck'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p: string) => JSON.parse(readFileSync(root + p, 'utf8'))

const es = read('public/content/es/deck.json') as Deck
const fr = read('public/content/fr/deck.json') as Deck
const overrides = read('scripts/overrides.confusables.json') as { drop?: string[]; add?: { es: string; fr: string }[] }

const dropped = new Set(overrides.drop ?? [])
let pairs = findFalseFriends(es.items, fr.items).filter(p => !dropped.has(`${p.es.id}|${p.fr.id}`))

const esById = new Map(es.items.map(it => [it.id, it]))
const frById = new Map(fr.items.map(it => [it.id, it]))
for (const a of overrides.add ?? []) {
  const e = esById.get(a.es)
  const f = frById.get(a.fr)
  if (!e || !f) throw new Error(`override add refers to a missing item: ${a.es} / ${a.fr}`)
  pairs.push({ form: `${e.lemma}/${f.lemma}`, es: confusableSide(e), fr: confusableSide(f) })
}
const seen = new Set<string>()
pairs = pairs.filter(p => {
  const k = `${p.es.id}|${p.fr.id}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

const out = { generated: new Date().toISOString().slice(0, 10), pairs }
writeFileSync(root + 'public/content/confusables.json', JSON.stringify(out, null, 1) + '\n')
console.log(`✓ ${pairs.length} confusable pair(s) → public/content/confusables.json`)
```

- [ ] **Step 3:** `package.json` scripts: `"build:confusables": "tsx scripts/build-confusables.ts"`.

- [ ] **Step 4:** Run `npm run build:confusables`; **spot-check the full pair list** (it should be dozens, not hundreds — same-form lemmas shared by the top-3000 of two Romance languages are rare, and cognates are filtered). Curate real noise into `drop` (a pair whose glosses do secretly overlap, e.g. synonym wording) and rebuild. The classic *salir* pair should be present if both decks carry the lemma.

- [ ] **Step 5:** Extend `scripts/validate-deck.ts` — after `validateDecks()`, a sibling gate:

```ts
export function validateConfusables(): Issue[] {
  const issues: Issue[] = []
  const path = `${CONTENT}confusables.json`
  if (!existsSync(path)) return issues // optional artifact
  let file: { pairs?: { es?: { id?: string }; fr?: { id?: string } }[] }
  try { file = JSON.parse(readFileSync(path, 'utf8')) } catch (e) { return [{ where: 'confusables.json', msg: `unreadable: ${String(e)}` }] }
  const ids = (lang: string) => {
    const deck = JSON.parse(readFileSync(`${CONTENT}${lang}/deck.json`, 'utf8')) as Deck
    return new Set(deck.items.map(it => it.id))
  }
  const esIds = ids('es'), frIds = ids('fr')
  for (const [i, p] of (file.pairs ?? []).entries()) {
    if (!p.es?.id || !esIds.has(p.es.id)) issues.push({ where: `confusables#${i}`, msg: `es id ${p.es?.id} not in es deck` })
    if (!p.fr?.id || !frIds.has(p.fr.id)) issues.push({ where: `confusables#${i}`, msg: `fr id ${p.fr?.id} not in fr deck` })
  }
  return issues
}
```

and include it in the CLI runner: `const issues = [...validateDecks(), ...validateConfusables()]` (success message can mention confusables).

- [ ] **Step 6:** `npm run validate` → passes; **Commit** — `git add -A && git commit -m "feat(confusables): build script, overrides, generated pairs, validate gate"`

### Task 6: Surface confusables in the UI

**Files:** Modify `src/App.tsx`, `src/components/SessionScreen.tsx`, `src/components/DeckCard.tsx`, `src/components/Collection.tsx`, `src/styles.css`

Contract:

- [ ] **Step 1:** `App.tsx` — `const [confusables, setConfusables] = useState<Map<string, ConfusablePair> | null>(null)`; on mount `void loadConfusables(import.meta.env.BASE_URL).then(setConfusables)` (never blocks render); pass `confusables` to `SessionScreen` and `Collection`.
- [ ] **Step 2:** `SessionScreen` — accept `confusables?: Map<string, ConfusablePair> | null`, forward to `DeckCard`.
- [ ] **Step 3:** `DeckCard` — accept the same prop; in the feedback panel (after the reveal line, before the example), when `confusables?.get(item.id)` yields a pair:

```tsx
{friend && (
  <p className="confusable">
    🚧 False friend — {langInfo(friend.lang).name} <strong>{friend.side.lemma}</strong> means “{friend.side.gloss.join(', ')}”.
  </p>
)}
```

where `const friend = pair ? otherSide(pair, item.id) : null` (import `otherSide` from `../lib/confusables`, `langInfo` from `../lib/lang`).
- [ ] **Step 4:** `Collection` — accept the prop; `VocabCard` renders the same `.confusable` line under the gloss when its item has a pair.
- [ ] **Step 5:** `styles.css` — one rule, matching the file's idiom: `.confusable { color: <the app's warning tone, reuse an existing amber if present>; font-size: .9em; }`
- [ ] **Step 6:** Acceptance: `npx tsc --noEmit` clean; unit tests green; in the browser, answering a paired word (search one in the Collection first to know one) shows the warning in feedback, and the Collection entry shows it too. App still renders with `confusables.json` blocked (dev-tools network override or temporary rename) — feature silently absent.
- [ ] **Step 7: Commit** — `git commit -am "feat(confusables): surface false friends on card feedback and in the Collection"`

### Task 7: Full gates + browser verification

- [ ] `npm test` → all green; `npm run validate` → decks + confusables valid; `npm run build` → clean; `npm run e2e` → smoke passes (Home CTAs unchanged when not paused).
- [ ] Browser pass per the design doc: pause/resume round-trip with visible frozen counts; a false-friend card end to end. Screenshot for the user.
- [ ] Push `main`; confirm the Pages deploy workflow goes green.

---

## Self-review

**Spec coverage:** freeze semantics + effectiveToday → Tasks 1,3; shift-on-resume incl. preserved debt → Tasks 1,2; blocked study while paused (CTAs replaced) → Task 3; paused marker in switcher → Task 3; export/import carries `paused` → Task 2 test; mining + fold + disjoint glosses → Tasks 4,5; overrides drop/add → Task 5; integrity gate → Task 5; feedback + Collection surfacing, nullable load → Task 6; e2e/browser/deploy → Task 7. ✓

**Placeholder scan:** logic tasks are complete code + tests; component tasks are contracts with exact expressions and acceptance criteria (established convention from the Plan-2 UI plan). No TBDs. ✓

**Type consistency:** `Profile.paused` optional record matches `pausedSince`/Home usage; `shiftStates` (not `shiftDue`) used in engine; `ConfusablePair`/`confusableSide`/`otherSide` names consistent across Tasks 4–6; `validateConfusables` returns the existing `Issue` shape. ✓
