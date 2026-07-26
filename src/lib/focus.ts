// Focus mode. Pausing a language freezes its schedule where it stands: all
// due-ness math evaluates against the pause date, and resuming shifts every
// due date forward by the paused span — earned overdue debt is preserved,
// but none accrues while frozen.

import { addDays } from './date'
import type { Profile } from './engine'
import type { ItemState } from './srs'

export function pausedSince(profile: Profile, lang: string): string | undefined {
  return profile.paused?.[lang]
}

/** The date due-ness math should use: frozen at the pause date while paused. */
export function effectiveToday(profile: Profile, lang: string, today: string): string {
  const p = pausedSince(profile, lang)
  return p && p < today ? p : today
}

/** Resume after `days` paused: every due date moves forward by the span. */
export function shiftStates(states: Record<string, ItemState>, days: number): Record<string, ItemState> {
  if (days <= 0) return states
  return Object.fromEntries(Object.entries(states).map(([id, s]) => [id, { ...s, due: addDays(s.due, days) }]))
}
