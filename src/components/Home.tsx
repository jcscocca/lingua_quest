import { useMemo, useRef, useState } from 'react'
import type { Deck } from '../lib/deck'
import { estimatedVocab, exportAll, importAll, strongCount, useEngine } from '../lib/engine'
import { effectiveToday, pausedSince } from '../lib/focus'
import { type LANGS, type LangInfo, langLabel } from '../lib/lang'
import { countDue } from '../lib/queue'
import { THEME_LABEL, THEMES } from '../lib/themes'
import { todayString } from '../lib/date'

export function Home({ deck, lang, langs, onStartSession, onStartProbe, onOpenCollection, onSwitchLang }: {
  deck: Deck
  lang: LangInfo
  langs: typeof LANGS
  onStartSession: (theme: string | null) => void
  onStartProbe: () => void
  onOpenCollection: () => void
  onSwitchLang: (lang: string) => void
}) {
  const states = useEngine(s => s.states)
  const profile = useEngine(s => s.profile)
  const fileRef = useRef<HTMLInputElement>(null)
  // While paused, every metric freezes at the pause date.
  const today = effectiveToday(profile, lang.code, todayString())
  const paused = pausedSince(profile, lang.code)

  const vocab = estimatedVocab(profile, lang.code)
  const strong = strongCount(states, today)
  const [theme, setTheme] = useState('')
  // The CTA's due count matches the scope the session will actually run in.
  const scopedDeck = useMemo(
    () => (theme ? { ...deck, items: deck.items.filter(it => it.theme === theme) } : deck),
    [deck, theme],
  )
  const dueCount = useMemo(() => countDue(scopedDeck, states, today), [scopedDeck, states, today])
  const probed = profile.frontier[lang.code] !== undefined

  async function handleExport() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lingua-quest-backup.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 0)
  }

  async function handleImportFile(f: File) {
    try {
      const parsed = JSON.parse(await f.text())
      await importAll(parsed)
    } catch (e) {
      alert(String(e))
      return
    }
    await useEngine.getState().hydrate(lang.code)
  }

  return (
    <div className="home">
      <header className="topbar">
        <h1>🗺️ Lingua Quest</h1>
      </header>

      <div className="course-bar">
        <span className="course-current">{langLabel(lang.code)}</span>
        <label className="course-switch">
          Language:{' '}
          <select value={lang.code} onChange={e => onSwitchLang(e.target.value)}>
            {langs.map(l => (
              <option key={l} value={l}>{langLabel(l)}{profile.paused?.[l] ? ' ⏸' : ''}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats">
        <span title="Estimated vocabulary size">📚 {vocab} known</span>
        <span title="Words at strong retention">💪 {strong} strong</span>
        <span title="Due for review today">⏰ {dueCount} due</span>
      </div>

      {paused ? (
        <div className="review-callout">
          <strong>⏸️ Reviews frozen since {paused}</strong>
          <span>No backlog accrues while {langLabel(lang.code)} is paused. Resume to pick up exactly where you left off.</span>
          <button onClick={() => void useEngine.getState().resumeLang()}>Resume</button>
        </div>
      ) : (
        <>
          {!probed && (
            <div className="review-callout">
              <strong>🧭 Estimate what you already know</strong>
              <span>Take a quick probe to seed your {langLabel(lang.code)} vocabulary instantly.</span>
              <button onClick={onStartProbe}>Run the probe</button>
            </div>
          )}

          <div className="home-primary">
            <button className="cta" onClick={() => onStartSession(theme || null)}>
              {dueCount === 0 ? 'Learn new words →' : `Start session — ${dueCount} due →`}
            </button>
            <label className="course-switch">
              Theme:{' '}
              <select value={theme} onChange={e => setTheme(e.target.value)}>
                <option value="">All words</option>
                {THEMES.map(t => (
                  <option key={t} value={t}>{THEME_LABEL[t]}</option>
                ))}
              </select>
            </label>
            {probed && <button className="back" onClick={onStartProbe}>Re-run the probe</button>}
          </div>
        </>
      )}

      <div className="stats">
        <button onClick={onOpenCollection}>📖 Collection</button>
        {!paused && (
          <button
            title="Freeze this language's schedule while you focus on the other"
            onClick={() => void useEngine.getState().pauseLang()}
          >
            ⏸ Pause
          </button>
        )}
        <button onClick={() => void handleExport()}>Export</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          hidden
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <footer className="home-footer">
        <p className="muted">Progress is saved in your browser — no account needed. Use Export to back it up.</p>
        <p className="muted">
          About the data:{' '}
          {deck.sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 ? ', ' : ''}
              <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> ({s.license})
            </span>
          ))}
        </p>
      </footer>
    </div>
  )
}
