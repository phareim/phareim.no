import type { Component } from 'vue'

// Every theme's CSS is global: the `.{id}-page` class on the app root
// carries the --theme-* tokens for all routes, not just the landing page.
import './base/fonts.css'
import './scandi/theme.css'
import './hacker/theme.css'
import './breakout/theme.css'
import './space/theme.css'
import './desk/theme.css'
import './rtype/theme.css'
import './invaders/theme.css'
import './starfox/theme.css'
import './tetris/theme.css'
import './anotherworld/theme.css'

// Static imports on purpose: a swipe should not wait for a chunk, and the
// whole set is small (the Cyberpunk game is the only big one).
import ScandiLanding from './scandi/Landing.vue'
import HackerLanding from './hacker/Landing.vue'
import BreakoutLanding from './breakout/Landing.vue'
import SpaceLanding from './space/Landing.vue'
import SpaceStarfield from './space/Starfield.vue'
import DeskLanding from './desk/Landing.vue'
import RtypeLanding from './rtype/Landing.vue'
import InvadersLanding from './invaders/Landing.vue'
import StarfoxLanding from './starfox/Landing.vue'
import TetrisLanding from './tetris/Landing.vue'
import AnotherworldLanding from './anotherworld/Landing.vue'

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
  /**
   * Parked: out of the swipe order, the pager, the random pick and the
   * cookie, but still reachable with `?theme=<id>` so it can be worked on.
   */
  disabled?: boolean
}

// Order matters: swiping left/right walks this list, wrapping at the ends.
export const allThemes: ThemeDefinition[] = [
  {
    id: 'anotherworld',
    name: 'Another Shore',
    themeColor: '#254b59',
    landing: AnotherworldLanding,
  },
  {
    id: 'scandi',
    disabled: true,
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
    id: 'breakout',
    name: 'Breakout',
    themeColor: '#0b0616',
    landing: BreakoutLanding,
  },
  {
    id: 'rtype',
    name: 'R-Type',
    themeColor: '#0b0616',
    landing: RtypeLanding,
  },
  {
    id: 'invaders',
    name: 'Space Invaders',
    themeColor: '#0b0616',
    landing: InvadersLanding,
  },
  {
    id: 'starfox',
    name: 'Star Fox',
    themeColor: '#0b0616',
    landing: StarfoxLanding,
  },
  {
    id: 'tetris',
    name: 'Tetris',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: TetrisLanding,
  },
  {
    id: 'space',
    disabled: true,
    name: 'Space',
    themeColor: '#0a0a0f',
    landing: SpaceLanding,
    backdrop: SpaceStarfield,
  },
  {
    id: 'desk',
    disabled: true,
    name: 'Tufte Desk',
    themeColor: '#7a7062',
    themeColorDark: '#2a2622',
    landing: DeskLanding,
  },
]

/** The live rotation. Disabled themes are only reachable by deep link. */
export const themes: ThemeDefinition[] = allThemes.filter(t => !t.disabled)

export const themeIds = themes.map(t => t.id)

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && themeIds.includes(id)
}

/** Any theme, disabled ones included — for the `?theme=` deep link. */
export function isAnyThemeId(id: unknown): id is string {
  return typeof id === 'string' && allThemes.some(t => t.id === id)
}

export function randomThemeId(): string {
  return themeIds[Math.floor(Math.random() * themeIds.length)]
}
