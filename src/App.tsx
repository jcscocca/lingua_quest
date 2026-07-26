// Thin router: hydrates the engine, loads the active language's deck, and
// switches between the four screens. All behavior lives in the screens/engine.

import { useEffect, useState } from 'react'
import { Collection } from './components/Collection'
import { Home } from './components/Home'
import { ProbeScreen } from './components/ProbeScreen'
import { SessionScreen } from './components/SessionScreen'
import { loadConfusables, type ConfusablePair } from './lib/confusables'
import type { Deck } from './lib/deck'
import { loadDeck } from './lib/deck'
import { useEngine } from './lib/engine'
import { LANGS, langInfo } from './lib/lang'

type View = 'home' | 'probe' | 'session' | 'collection'

const DEFAULT_LANG = 'es'

export default function App() {
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('home')
  const [confusables, setConfusables] = useState<Map<string, ConfusablePair> | null>(null)
  const hydrated = useEngine(s => s.hydrated)

  useEffect(() => {
    void useEngine.getState().hydrate(DEFAULT_LANG)
    // Display-only enhancement: a missing file just means no warnings.
    void loadConfusables(import.meta.env.BASE_URL).then(setConfusables)
  }, [])

  useEffect(() => {
    setDeck(null)
    setError(null)
    setView('home')
    loadDeck(import.meta.env.BASE_URL, lang).then(setDeck).catch(e => setError(String(e)))
  }, [lang])

  function switchLang(next: string) {
    setLang(next)
    void useEngine.getState().hydrate(next)
  }

  if (error)
    return (
      <div className="load-error">
        <p>Failed to load content: {error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    )

  const info = langInfo(lang)
  if (!deck || !hydrated) return <div className="loading">{info.loading}</div>

  switch (view) {
    case 'probe':
      return <ProbeScreen deck={deck} lang={info} onDone={() => setView('home')} />
    case 'session':
      return <SessionScreen deck={deck} lang={info} confusables={confusables} onDone={() => setView('home')} />
    case 'collection':
      return <Collection deck={deck} lang={info} confusables={confusables} onBack={() => setView('home')} />
    default:
      return (
        <Home
          deck={deck}
          lang={info}
          langs={LANGS}
          onStartSession={() => setView('session')}
          onStartProbe={() => setView('probe')}
          onOpenCollection={() => setView('collection')}
          onSwitchLang={switchLang}
        />
      )
  }
}
