import { describe, expect, it } from 'vitest'
import { LANGS, langInfo, langLabel } from './lang'

describe('langInfo', () => {
  it('gives each shipped language its own locale and prompts', () => {
    for (const code of LANGS) {
      const info = langInfo(code)
      expect(info.code).toBe(code)
      expect(info.locale.startsWith(code)).toBe(true)
      expect(info.typePrompt).toBeTruthy()
      expect(info.correct).toBeTruthy()
    }
  })

  it('does not hand one language another language strings', () => {
    expect(langInfo('fr').locale).not.toBe(langInfo('es').locale)
    expect(langInfo('fr').typePrompt).not.toBe(langInfo('es').typePrompt)
    expect(langInfo('fr').correct).not.toBe(langInfo('es').correct)
  })

  it('falls back to the bare code for an unknown language rather than another one', () => {
    const info = langInfo('de')
    expect(info.code).toBe('de')
    expect(info.locale).toBe('de')
    expect(info.name).toBe('DE')
    expect(info.typePrompt).not.toBe(langInfo('es').typePrompt)
  })
})

describe('langLabel', () => {
  it('reads as flag + name for a shipped language', () => {
    expect(langLabel('es')).toBe('🇪🇸 Spanish')
  })

  it('degrades to the uppercased code when there is no entry', () => {
    expect(langLabel('de')).toBe('DE')
  })
})
