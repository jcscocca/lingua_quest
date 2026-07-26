// Mine ES↔FR false friends from the committed decks. Run: npm run build:confusables

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { confusableSide, findFalseFriends } from '../src/lib/confusables'
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
