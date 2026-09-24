import type { Component } from 'vue'

// Every theme's CSS is global: the `.{id}-page` class on the app root
// carries the --theme-* tokens for all routes, not just the landing page.
import './base/fonts.css'
import './scandi/theme.css'
import './galaga/theme.css'
import './breakout/theme.css'
import './space/theme.css'
import './desk/theme.css'
import './rtype/theme.css'
import './invaders/theme.css'
import './starfox/theme.css'
import './outrun/theme.css'
import './tetris/theme.css'
import './anotherworld/theme.css'
import './shore/theme.css'
import './leaderboard/theme.css'
import './hangar/theme.css'
import './zelda/theme.css'
import './portal/theme.css'

// Static imports on purpose: a swipe should not wait for a chunk, and the
// whole set is small (the Galaga game is the only big one).
import ScandiLanding from './scandi/Landing.vue'
import GalagaLanding from './galaga/Landing.vue'
import BreakoutLanding from './breakout/Landing.vue'
import SpaceLanding from './space/Landing.vue'
import SpaceStarfield from './space/Starfield.vue'
import DeskLanding from './desk/Landing.vue'
import RtypeLanding from './rtype/Landing.vue'
import InvadersLanding from './invaders/Landing.vue'
import StarfoxLanding from './starfox/Landing.vue'
import OutrunLanding from './outrun/Landing.vue'
import TetrisLanding from './tetris/Landing.vue'
import AnotherworldLanding from './anotherworld/Landing.vue'
import ShoreLanding from './shore/Landing.vue'
import LeaderboardLanding from './leaderboard/Landing.vue'
import HangarLanding from './hangar/Landing.vue'
import ZeldaLanding from './zelda/Landing.vue'
import PortalLanding from './portal/Landing.vue'

export interface ThemeDefinition {
  /** Short id. Doubles as the CSS root class (`${id}-page`) and the `?theme=` value. */
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
   * Parked: out of the swipe order and the pager, but still reachable with
   * `?theme=<id>` so it can be worked on.
   */
  disabled?: boolean
  /**
   * The front door, shown on `/`. Never in the rotation, never picked by a
   * swipe or `setTheme`, and it has no pager. Exactly one theme has it.
   */
  home?: true
}

// Order matters: swiping left/right walks this list, wrapping at the ends.
export const allThemes: ThemeDefinition[] = [
  {
    // The Portal (2026-09-24): the neon town on `/` that leads to everything
    // else. Replaced Player One and the random first-visit theme.
    id: 'portal',
    home: true,
    name: 'Portal',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: PortalLanding,
  },
  {
    id: 'anotherworld',
    name: 'Another Shore',
    themeColor: '#2a1446',
    themeColorDark: '#2a1446',
    landing: AnotherworldLanding,
  },
  {
    id: 'shore',
    // Parked 2026-09-07 (the "WALK — ENTER" take); still reachable with ?theme=shore.
    disabled: true,
    name: 'Another Shore II',
    themeColor: '#1f414f',
    landing: ShoreLanding,
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
    id: 'galaga',
    name: 'Galaga',
    themeColor: '#0b0616',
    landing: GalagaLanding,
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
    id: 'outrun',
    name: 'OutRun',
    themeColor: '#0b0616',
    landing: OutrunLanding,
  },
  {
    id: 'zelda',
    // Rebuilt 2026-09-22; live in the rotation since 2026-09-23.
    name: 'Neon Shrine',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: ZeldaLanding,
  },
  {
    id: 'tetris',
    name: 'Tetris',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: TetrisLanding,
  },
  {
    // Hall of Fame (2026-09-08): the world ranking of the six score games.
    // Follows the arcade; the Hangar closes the rotation after it.
    id: 'leaderboard',
    name: 'Hall of Fame',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: LeaderboardLanding,
  },
  {
    // Hangar (2026-09-09): the pilot profile — avatar, high scores and
    // the 3D ship the player flies in every ship game. Last of all, after
    // the board it reads from.
    id: 'hangar',
    name: 'Hangar',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: HangarLanding,
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
export const themes: ThemeDefinition[] = allThemes.filter(t => !t.disabled && !t.home)

/** The theme on `/`. */
export const homeTheme: ThemeDefinition = allThemes.find(t => t.home)!

export const themeIds = themes.map(t => t.id)

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && themeIds.includes(id)
}

/** Any theme, disabled and home included — for the `?theme=` deep link. */
export function isAnyThemeId(id: unknown): id is string {
  return typeof id === 'string' && allThemes.some(t => t.id === id)
}

/**
 * Ids a theme used to have. Old links keep working.
 * `hacker` was the Cyberpunk shmup, renamed to Galaga 2026-09-08;
 * `playerone` was the profile theme, retired for the portal 2026-09-24.
 */
const LEGACY_THEME_IDS: Record<string, string> = { hacker: 'galaga', playerone: 'portal' }

/** Maps a legacy id onto its current one; anything else is returned as-is. */
export function resolveThemeId(id: unknown): unknown {
  return typeof id === 'string' && id in LEGACY_THEME_IDS ? LEGACY_THEME_IDS[id] : id
}
