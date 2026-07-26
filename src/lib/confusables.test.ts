import { describe, expect, it } from 'vitest'
import type { DeckItem } from './deck'
import { findFalseFriends, glossesOverlap, indexConfusables, otherSide } from './confusables'

const item = (id: string, lemma: string, gloss: string[], pos = 'n'): DeckItem =>
  ({ id, lemma, pos, gloss, rank: 1 })

const esSalir = item('es:salir:v', 'salir', ['to leave', 'to go out'], 'v')
const frSalir = item('fr:salir:v', 'salir', ['to dirty', 'to soil'], 'v')
const esImportante = item('es:importante:adj', 'importante', ['important'], 'adj')
const frImportante = item('fr:importante:adj', 'importante', ['important'], 'adj')

describe('glossesOverlap', () => {
  it('sees shared meaning through stopwords and parentheticals', () => {
    expect(glossesOverlap(['to leave (a place)'], ['leave', 'depart'])).toBe(true)
    expect(glossesOverlap(['to leave'], ['to dirty'])).toBe(false) // "to" is noise
  })
})

describe('findFalseFriends', () => {
  it('pairs same-form disjoint-meaning items and skips cognates', () => {
    const pairs = findFalseFriends([esSalir, esImportante], [frSalir, frImportante])
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
    expect(otherSide(pair, 'es:otro:adj')).toBeNull()
  })
})
