// Everything that varies per language: the label, the BCP-47 locale used for
// TTS and for the `lang` attribute on answer inputs, and the handful of UI
// strings written IN the target language. One table, so adding a language is
// one entry rather than an edit in four files.

export const LANGS = ['es', 'fr'] as const
export type LangCode = (typeof LANGS)[number]

export interface LangInfo {
  code: string
  name: string
  flag: string
  /** BCP-47 tag: picks the TTS voice and tags the answer input. */
  locale: string
  /** Placeholder on an input that asks the learner to produce the word. */
  typePrompt: string
  /** Interjection on a right answer. */
  correct: string
  /** Shown while the deck is still loading. */
  loading: string
}

export const LANGUAGES: Record<LangCode, LangInfo> = {
  es: {
    code: 'es',
    name: 'Spanish',
    flag: '🇪🇸',
    locale: 'es-ES',
    typePrompt: 'Escribe en español…',
    correct: '¡Correcto!',
    loading: 'Loading… ¡Un momento!',
  },
  fr: {
    code: 'fr',
    name: 'French',
    flag: '🇫🇷',
    locale: 'fr-FR',
    typePrompt: 'Écris en français…',
    correct: 'Bravo !',
    loading: 'Loading… un instant !',
  },
}

/** Resolve a language code. An unknown code degrades to neutral defaults —
 *  never to another language's voice or prompts. */
export function langInfo(code: string): LangInfo {
  return (
    LANGUAGES[code as LangCode] ?? {
      code,
      name: code.toUpperCase(),
      flag: '',
      locale: code,
      typePrompt: 'Type your answer…',
      correct: 'Correct!',
      loading: 'Loading…',
    }
  )
}

export function langLabel(code: string): string {
  const { flag, name } = langInfo(code)
  return flag ? `${flag} ${name}` : name
}
