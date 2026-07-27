// Content finisher: stamps theme tags (scripts/themes.<lang>.json) and example
// sentences (scripts/examples.<lang>.json) onto the committed decks, and
// appends the curated themed additions from scripts/additions.<lang>.json
// (ranks continue densely after the frequency 3,000 so existing ranks and the
// probe's bands never shift). Idempotent — rerun after any deck regeneration.
// Run: npm run apply:content

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { itemId, type Deck, type DeckItem } from '../src/lib/deck'
import { isTheme } from '../src/lib/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const readJson = (p: string) => JSON.parse(readFileSync(root + p, 'utf8'))

interface Addition {
  lemma: string
  pos: string
  gloss: string[]
  theme: string
  ex?: { t: string; en: string }
}

for (const lang of ['es', 'fr']) {
  const deckPath = `public/content/${lang}/deck.json`
  const deck = readJson(deckPath) as Deck
  const themes = (existsSync(root + `scripts/themes.${lang}.json`) ? readJson(`scripts/themes.${lang}.json`) : {}) as Record<string, string>
  const additions = (existsSync(root + `scripts/additions.${lang}.json`) ? readJson(`scripts/additions.${lang}.json`) : []) as Addition[]
  const examples = (existsSync(root + `scripts/examples.${lang}.json`) ? readJson(`scripts/examples.${lang}.json`) : {}) as Record<string, { t: string; en: string }>

  for (const [id, theme] of Object.entries(themes)) {
    if (!isTheme(theme)) throw new Error(`themes.${lang}.json: "${theme}" (${id}) is not a canonical theme`)
  }

  const byId = new Map(deck.items.map(it => [it.id, it]))
  let appended = 0
  for (const a of additions) {
    if (!isTheme(a.theme)) throw new Error(`additions.${lang}.json: "${a.theme}" (${a.lemma}) is not a canonical theme`)
    const id = itemId(lang, a.lemma, a.pos)
    if (byId.has(id)) continue
    const item: DeckItem = { id, lemma: a.lemma, pos: a.pos, gloss: a.gloss, rank: deck.items.length + 1, theme: a.theme, ...(a.ex ? { ex: a.ex } : {}) }
    deck.items.push(item)
    byId.set(id, item)
    appended++
  }

  const additionTheme = new Map(additions.map(a => [itemId(lang, a.lemma, a.pos), a.theme]))
  let tagged = 0
  let exampled = 0
  for (const it of deck.items) {
    const theme = themes[it.id] ?? additionTheme.get(it.id)
    if (theme) {
      it.theme = theme
      tagged++
    } else {
      delete it.theme
    }
    const ex = examples[it.id]
    if (ex) {
      it.ex = ex
      exampled++
    }
  }

  if (exampled > 0 && !deck.sources.some(s => s.name.startsWith('Tatoeba'))) {
    deck.sources.push({ name: 'Tatoeba (example sentences)', url: 'https://tatoeba.org', license: 'CC BY 2.0 FR' })
  }

  writeFileSync(root + deckPath, JSON.stringify(deck, null, 0) + '\n')
  console.log(`✓ ${lang}: ${tagged} themed, ${exampled} exampled, ${appended} appended (deck now ${deck.items.length} items)`)
}
