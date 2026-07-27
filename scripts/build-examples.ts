// Match every deck lemma to a short Tatoeba sentence with an English
// translation → scripts/examples.<lang>.json (id → {t, en}), applied to the
// decks by apply-content.ts. Sources: downloads.tatoeba.org per-language
// exports, pre-downloaded and bunzipped into raw/ (gitignored).
// Run: npm run build:examples

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Deck } from '../src/lib/deck'

const root = fileURLToPath(new URL('..', import.meta.url))

const MIN_LEN = 12
const MAX_LEN = 70
const MAX_EN = 90

function loadSentences(file: string): Map<number, string> {
  const m = new Map<number, string>()
  for (const line of readFileSync(root + 'raw/' + file, 'utf8').split('\n')) {
    const tab1 = line.indexOf('\t')
    if (tab1 < 0) continue
    const tab2 = line.indexOf('\t', tab1 + 1)
    m.set(Number(line.slice(0, tab1)), line.slice(tab2 + 1))
  }
  return m
}

function tokens(text: string): Set<string> {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const t of lower.split(/[^\p{L}'-]+/u)) if (t) out.add(t)
  for (const t of lower.split(/[^\p{L}]+/u)) if (t) out.add(t)
  return out
}

for (const [lang, prefix] of [['es', 'spa'], ['fr', 'fra']] as const) {
  const deck = JSON.parse(readFileSync(root + `public/content/${lang}/deck.json`, 'utf8')) as Deck
  const target = loadSentences(`${prefix}_sentences.tsv`)

  // target sentence id → its English translation ids
  const links = new Map<number, number>()
  const neededEng = new Set<number>()
  for (const line of readFileSync(root + `raw/${prefix}-eng_links.tsv`, 'utf8').split('\n')) {
    const [a, b] = line.split('\t')
    const tid = Number(a)
    const eid = Number(b)
    if (!tid || !eid || links.has(tid)) continue
    links.set(tid, eid)
    neededEng.add(eid)
  }

  const eng = new Map<number, string>()
  for (const line of readFileSync(root + 'raw/eng_sentences.tsv', 'utf8').split('\n')) {
    const tab1 = line.indexOf('\t')
    if (tab1 < 0) continue
    const id = Number(line.slice(0, tab1))
    if (!neededEng.has(id)) continue
    const tab2 = line.indexOf('\t', tab1 + 1)
    eng.set(id, line.slice(tab2 + 1))
  }

  // inverted index: word → candidate sentence ids (translated, sane length)
  const byWord = new Map<string, number[]>()
  for (const [id, text] of target) {
    if (text.length > MAX_LEN || text.length < MIN_LEN) continue
    const eid = links.get(id)
    if (!eid || !eng.has(eid)) continue
    if ((eng.get(eid) as string).length > MAX_EN) continue
    for (const w of tokens(text)) {
      const arr = byWord.get(w)
      if (arr) arr.push(id)
      else byWord.set(w, [id])
    }
  }

  const examples: Record<string, { t: string; en: string }> = {}
  let matched = 0
  for (const it of deck.items) {
    const ids = byWord.get(it.lemma.toLowerCase())
    if (!ids) continue
    // shortest sentence wins; ties break on lower id (older ≈ more vetted)
    let best: number | null = null
    for (const id of ids) {
      if (best === null) { best = id; continue }
      const a = (target.get(id) as string).length
      const b = (target.get(best) as string).length
      if (a < b || (a === b && id < best)) best = id
    }
    if (best === null) continue
    const t = target.get(best) as string
    // the validate gate requires the lemma verbatim inside the sentence
    if (!t.toLowerCase().includes(it.lemma.toLowerCase())) continue
    examples[it.id] = { t, en: eng.get(links.get(best) as number) as string }
    matched++
  }

  writeFileSync(root + `scripts/examples.${lang}.json`, JSON.stringify(examples, null, 0) + '\n')
  console.log(`✓ ${lang}: ${matched}/${deck.items.length} lemmas matched to example sentences`)
}
