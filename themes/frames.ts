/**
 * The games on another address that this page can show inside itself
 * (docs/games/frame.md). Installed as a web app, a link out would open the
 * browser's own bar over the game; a frame keeps the app's whole screen.
 * Keyed by the exit's id in the town, and the address is the exit's own
 * (tests/portal-world.test.mjs holds the two together). An address is never
 * read from the URL: `/?frame=<id>` names one of these or nothing.
 */
export interface FramedGame {
  id: string
  /** For the page title and the frame's label. */
  name: string
  url: string
}

export const FRAMED_GAMES: Record<string, { name: string; url: string }> = {
  adventure: { name: 'Adventure', url: 'https://adventure.phareim.no' },
  pizzarescue: { name: 'Pizza Rescue', url: 'https://fighter.phareim.no/?look=wasteland&from=phareim' },
  nova: { name: "Nova's Solo Rescue", url: 'https://nova.phareim.no/?from=phareim' },
  eventyrland: { name: 'Eventyrland', url: 'https://eventyrland.phareim.no' },
}

/** The framed game `/?frame=<id>` names, or null for anything else. */
export function framedGame(id: unknown): FramedGame | null {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(FRAMED_GAMES, id)) return null
  return { id, ...FRAMED_GAMES[id]! }
}

/**
 * What the frame and a game inside it say to each other (`postMessage`):
 *   game → frame  `{ type: 'phareim:hello' }`  the game listens, and has no way home on screen: tell it about the
 *                 screen, and the frame's house stays (or comes back)
 *   game → frame  `{ type: 'phareim:ready' }`  the game's own way home is on screen: the frame's house goes
 *   game → frame  `{ type: 'phareim:home' }`   back to the town
 *   frame → game  `{ type: 'phareim:frame', insets: { top, right, bottom, left }, installed }`  the screen's safe
 *                 edges in CSS px, and whether the page runs as an installed app; sent again when they change
 */
export const FRAME_HELLO = 'phareim:hello'
export const FRAME_READY = 'phareim:ready'
export const FRAME_HOME = 'phareim:home'
export const FRAME_SCREEN = 'phareim:frame'

export interface FrameInsets { top: number; right: number; bottom: number; left: number }

/** A message from a framed game, or null when it is none of ours. */
export function frameMessage(data: unknown): typeof FRAME_HELLO | typeof FRAME_READY | typeof FRAME_HOME | null {
  const type = data && typeof data === 'object' ? (data as { type?: unknown }).type : null
  return type === FRAME_HELLO || type === FRAME_READY || type === FRAME_HOME ? type : null
}
