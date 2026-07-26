import { useMemo, useState } from 'react'
import { otherSide, type ConfusablePair } from '../lib/confusables'
import type { Deck, DeckItem } from '../lib/deck'
import { useEngine } from '../lib/engine'
import { langInfo, type LangInfo } from '../lib/lang'
import type { ItemState } from '../lib/srs'
import { SpeakButton } from './SpeakButton'

export function Collection({ deck, lang, confusables, onBack }: {
  deck: Deck
  lang: LangInfo
  confusables?: Map<string, ConfusablePair> | null
  onBack: () => void
}) {
  const states = useEngine(s => s.states)
  const [q, setQ] = useState('')

  const known = useMemo(
    () => deck.items.filter(it => (states[it.id]?.level ?? 0) >= 4).length,
    [deck.items, states],
  )

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return deck.items
    return deck.items.filter(
      it => it.lemma.toLowerCase().includes(query) || it.gloss.some(g => g.toLowerCase().includes(query)),
    )
  }, [deck.items, q])

  return (
    <div className="collection">
      <header className="topbar">
        <button className="back" onClick={onBack}>← Back</button>
        <h2>📖 Collection</h2>
        <span className="progress-count">{deck.items.length} words · {known} known</span>
      </header>

      <div className="vocab-search">
        <input
          className="text-answer"
          placeholder="Search words…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="vocab-grid">
        {filtered.map(item => (
          <VocabCard key={item.id} item={item} voice={lang.locale} state={states[item.id]} pair={confusables?.get(item.id)} />
        ))}
        {filtered.length === 0 && <p className="empty">No matches for “{q}”.</p>}
      </div>
    </div>
  )
}

function VocabCard({ item, voice, state, pair }: {
  item: DeckItem
  voice: string
  state: ItemState | undefined
  pair?: ConfusablePair
}) {
  const friend = pair ? otherSide(pair, item.id) : null
  return (
    <div className="vocab-card">
      <div className="vocab-es">
        {item.lemma} <SpeakButton text={item.lemma} voice={voice} />
      </div>
      <div className="vocab-en">{item.gloss.join(', ')}</div>
      {friend && (
        <div className="confusable">
          🚧 {langInfo(friend.lang).flag} <strong>{friend.side.lemma}</strong> = {friend.side.gloss.join(', ')}
        </div>
      )}
      <div className="vocab-pos">{item.pos}</div>
      <div className="status">
        {!state ? (
          <span className="muted">new</span>
        ) : (
          <span>
            <span className="pips">{'●'.repeat(state.level)}{'○'.repeat(5 - state.level)}</span>{' '}
            <span className="count">due {state.due}</span>
          </span>
        )}
      </div>
      <button disabled={!state} onClick={() => void useEngine.getState().resetItem(item.id)}>
        Reset
      </button>
    </div>
  )
}
