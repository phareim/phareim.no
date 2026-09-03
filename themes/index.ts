import type { Component } from 'vue'

// Every theme's CSS is global: the `.{id}-page` class on the app root
// carries the --theme-* tokens for all routes, not just the landing page.
import './scandi/theme.css'
import './hacker/theme.css'
import './space/theme.css'
import './tufte/theme.css'

// Static imports on purpose: a swipe should not wait for a chunk, and the
// whole set is small (the Cyberpunk game is the only big one).
import ScandiLanding from './scandi/Landing.vue'
import HackerLanding from './hacker/Landing.vue'
import SpaceLanding from './space/Landing.vue'
import SpaceStarfield from './space/Starfield.vue'
import TufteLanding from './tufte/Landing.vue'

export interface ThemeDefinition {
  /** Short id. Doubles as the CSS root class (`${id}-page`) and the cookie value. */
  id: string
  /** Human name, shown in the pager tooltip. */
  name: string
  /** `<meta name="theme-color">` for light and dark system schemes. */
  themeColor: string
  themeColorDark?: string
  /** Full landing page. Owns everything inside the viewport. */
  landing: Component
  /** Optional: rendered behind every route (starfield, texture, …). */
  backdrop?: Component
}

// Order matters: swiping left/right walks this list, wrapping at the ends.
export const themes: ThemeDefinition[] = [
  {
    id: 'scandi',
    name: 'Scandinavian Glass',
    themeColor: '#f5f5f3',
    themeColorDark: '#1a1c1e',
    landing: ScandiLanding,
  },
  {
    id: 'hacker',
    name: 'Cyberpunk',
    themeColor: '#0a0a0a',
    landing: HackerLanding,
  },
  {
    id: 'space',
    name: 'Space',
    themeColor: '#0a0a0f',
    landing: SpaceLanding,
    backdrop: SpaceStarfield,
  },
  {
    id: 'tufte',
    name: 'Tufte',
    themeColor: '#fbf9f4',
    themeColorDark: '#14130f',
    landing: TufteLanding,
  },
]

export const themeIds = themes.map(t => t.id)

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && themeIds.includes(id)
}

export function randomThemeId(): string {
  return themeIds[Math.floor(Math.random() * themeIds.length)]
}
