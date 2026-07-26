import { describe, expect, it } from 'vitest'
import type { Profile } from './engine'
import { effectiveToday, pausedSince, shiftStates } from './focus'
import type { ItemState } from './srs'

const profile = (paused?: Record<string, string>): Profile =>
  ({ version: 2, frontier: {}, paused, hydrated: true })

const state = (due: string): ItemState =>
  ({ level: 3, interval: 8, due, lapses: 1, seen: '2026-07-01', origin: 'probe' })

describe('pausedSince / effectiveToday', () => {
  it('reports the pause date only for the paused language', () => {
    const p = profile({ es: '2026-07-10' })
    expect(pausedSince(p, 'es')).toBe('2026-07-10')
    expect(pausedSince(p, 'fr')).toBeUndefined()
  })
  it('freezes the effective date at the pause date', () => {
    expect(effectiveToday(profile({ es: '2026-07-10' }), 'es', '2026-07-20')).toBe('2026-07-10')
    expect(effectiveToday(profile({ es: '2026-07-10' }), 'fr', '2026-07-20')).toBe('2026-07-20')
    expect(effectiveToday(profile(), 'es', '2026-07-20')).toBe('2026-07-20')
  })
})

describe('shiftStates', () => {
  it('moves every due date forward by the paused span', () => {
    const out = shiftStates({ a: state('2026-07-12'), b: state('2026-07-30') }, 10)
    expect(out.a.due).toBe('2026-07-22')
    expect(out.b.due).toBe('2026-08-09')
    expect(out.a.level).toBe(3)
  })
  it('is a no-op (same reference) for zero or negative spans', () => {
    const states = { a: state('2026-07-12') }
    expect(shiftStates(states, 0)).toBe(states)
    expect(shiftStates(states, -3)).toBe(states)
  })
})
