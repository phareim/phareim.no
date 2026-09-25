/**
 * What a room painter, an NPC painter and the hero rig give the renderer.
 * Everything draws in room pixels (the renderer has already translated for
 * the camera and clipped to the scene), except lights, which also take room
 * pixels and are moved onto the stage by the renderer.
 */
import type { ActorState, GameState, RoomId } from '../types'

export type G = CanvasRenderingContext2D

export interface View {
  room: RoomId
  /** Room x at the view's left edge. */
  camX: number
  /** View width in room pixels. */
  w: number
  /** Seconds since the game began. */
  t: number
  /** Storm light 0–1 (lightning). */
  flash: number
  /** Who is speaking right now (actor id) or null: for talking mouths. */
  talking: string | null
}

/** Add a glow pool at room (x, y), radius r, colour, alpha. */
export type LightFn = (x: number, y: number, r: number, color: string, a?: number) => void

export interface RoomPainter {
  /** Static background, painted once into a w×144 canvas (cached). */
  paint(g: G, w: number, h: number): void
  /** Light-map base colour: dark means candle and lamp pools matter. */
  ambient(s: GameState, v: View): string
  /** Animated and state-dependent things behind the actors (open drawers, a raised rod, NPCs). */
  back?(g: G, s: GameState, v: View): void
  /** Things in front of the actors (a foreground chair, rain on the glass, the booth's glass). */
  front?(g: G, s: GameState, v: View): void
  /** Glow pools for the light map. */
  lights?(L: LightFn, s: GameState, v: View): void
  /** Drawn after the light map at full brightness (ghost glow, sparks, lit windows during a strike). */
  glow?(g: G, s: GameState, v: View): void
}

/** Draws a hero (or the Professor) standing with feet at (a.x, a.y). */
export interface ActorPainter {
  (g: G, id: string, a: ActorState, v: View, walking: boolean, s: GameState): void
}

/** Draws one of the house's people with feet at (a.x, a.y), in the room they're in. */
export interface NpcPainter {
  (g: G, a: ActorState, v: View, s: GameState): void
}
