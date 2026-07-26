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

// Note: 'in'/'on' are NOT stopwords — for prepositions the gloss IS the word.
const STOP = new Set(['to', 'a', 'an', 'the', 'of', 's', 'or'])

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
