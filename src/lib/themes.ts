// The canonical theme taxonomy. A theme tags a word into a topical study
// cluster; most of the deck (function words, abstract vocabulary) is untagged
// on purpose — a theme session is a drill, not a partition.

export const THEMES = [
  'food-drink',
  'animals',
  'nature-weather',
  'body-health',
  'family-people',
  'home',
  'clothing',
  'colors',
  'numbers',
  'time-calendar',
  'travel-transport',
  'places-city',
  'school-work',
  'money-shopping',
  'emotions-character',
  'communication-media',
  'politics-society',
  'sports-leisure',
] as const

export type Theme = (typeof THEMES)[number]

export const THEME_LABEL: Record<Theme, string> = {
  'food-drink': '🍽️ Food & drink',
  animals: '🐾 Animals',
  'nature-weather': '🌦️ Nature & weather',
  'body-health': '🩺 Body & health',
  'family-people': '👪 Family & people',
  home: '🏠 Home',
  clothing: '👕 Clothing',
  colors: '🎨 Colors',
  numbers: '🔢 Numbers',
  'time-calendar': '📅 Time & calendar',
  'travel-transport': '✈️ Travel & transport',
  'places-city': '🏙️ Places & city',
  'school-work': '🎓 School & work',
  'money-shopping': '💶 Money & shopping',
  'emotions-character': '💛 Emotions & character',
  'communication-media': '💬 Communication & media',
  'politics-society': '🏛️ Politics & society',
  'sports-leisure': '⚽ Sports & leisure',
}

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}
