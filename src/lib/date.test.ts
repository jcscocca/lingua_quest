import { describe, expect, it } from 'vitest'
import { addDays, dayDiff, todayString } from './date'

describe('date helpers', () => {
  it('formats today as YYYY-MM-DD', () => {
    expect(todayString(new Date('2026-03-05T12:00:00Z'))).toBe('2026-03-05')
  })
  it('adds and diffs days', () => {
    expect(addDays('2026-07-23', 4)).toBe('2026-07-27')
    expect(dayDiff('2026-07-23', '2026-07-27')).toBe(4)
  })
})
