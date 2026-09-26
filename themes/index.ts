import type { Component } from 'vue'

// Every theme's CSS is global: the `.{id}-page` class on the app root
// carries the --theme-* tokens for all routes, not just the landing page.
import './base/fonts.css'
import './base/pixel/pixel.css'
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
import './portal/theme.css'
import './radio/theme.css'
import './battery/theme.css'
import './miniworld/theme.css'

// Static imports on purpose: a cabinet should not wait for a chunk, and the
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
import PortalLanding from './portal/Landing.vue'
import RadioLanding from './radio/Landing.vue'
import BatteryLanding from './battery/Landing.vue'
import MiniworldLanding from './miniworld/Landing.vue'

export interface ThemeDefinition {
  /** Short id. Doubles as the CSS root class (`${id}-page`) and the `?theme=` value. */
  id: string
  /** Human name, shown in the page title. */
  name: string
  /** `<meta name="theme-color">` for light and dark system schemes. */
  themeColor: string
  themeColorDark?: string
  /** Full landing page. Owns everything inside the viewport. */
  landing: Component
  /** Optional: rendered behind every route (starfield, texture, …). */
  backdrop?: Component
  /**
   * Parked: no way in from the portal, but still reachable with
   * `?theme=<id>` so it can be worked on.
   */
  disabled?: boolean
  /**
   * The front door, shown on `/`, with no home chip. Exactly one theme
   * has it.
   */
  home?: true
  /**
   * The theme is a radio of its own: the site radio widget (the six game
   * stations, top-right) is not shown, and the theme holds that radio silent.
   */
  ownRadio?: true
}

export const allThemes: ThemeDefinition[] = [
  {
    // The Portal (2026-09-24): the neon town on `/` that leads to everything
    // else, and Neon Shrine's coast and shrine beyond it (one world since
    // 2026-09-24). Replaced Player One and the random first-visit theme.
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
    // Night of the Dead Battery (2026-09-26): a DOTT-style point-and-click
    // adventure. `ownRadio`: it plays its own score and holds the radio silent.
    id: 'battery',
    name: 'Night of the Dead Battery',
    ownRadio: true,
    themeColor: '#07040d',
    themeColorDark: '#07040d',
    landing: BatteryLanding,
  },
  {
    // Mini World (2026-09-26): Ulrikke's game, a sunny blocky 3D town (three.js,
    // loaded in its own chunk by the landing). `ownRadio`: it plays its own music.
    id: 'miniworld',
    name: 'Mini World',
    ownRadio: true,
    themeColor: '#6ecbff',
    themeColorDark: '#6ecbff',
    landing: MiniworldLanding,
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
    id: 'tetris',
    name: 'Tetris',
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: TetrisLanding,
  },
  {
    // Hall of Fame (2026-09-08): the world ranking of the six score games.
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
    // Radio (2026-09-25): the generative radio from radio.phareim.no, reached
    // through the radio station's door in the town, not an arcade cabinet.
    id: 'radio',
    name: 'Radio',
    ownRadio: true,
    themeColor: '#0b0616',
    themeColorDark: '#0b0616',
    landing: RadioLanding,
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

/** The live games: not parked, not the portal. The portal's hidden link list names them. */
export const liveThemes: ThemeDefinition[] = allThemes.filter(t => !t.disabled && !t.home)

/** The theme on `/`. */
export const homeTheme: ThemeDefinition = allThemes.find(t => t.home)!

/** Any theme, disabled and home included — for the `?theme=` deep link. */
export function isAnyThemeId(id: unknown): id is string {
  return typeof id === 'string' && allThemes.some(t => t.id === id)
}

/**
 * Ids a theme used to have. Old links keep working.
 * `hacker` was the Cyberpunk shmup, renamed to Galaga 2026-09-08;
 * `playerone` was the profile theme, retired for the portal 2026-09-24;
 * `zelda` was Neon Shrine, merged into the portal's world 2026-09-24.
 */
const LEGACY_THEME_IDS: Record<string, string> = { hacker: 'galaga', playerone: 'portal', zelda: 'portal' }

/** Maps a legacy id onto its current one; anything else is returned as-is. */
export function resolveThemeId(id: unknown): unknown {
  return typeof id === 'string' && id in LEGACY_THEME_IDS ? LEGACY_THEME_IDS[id] : id
}
