/**
 * What the studio's panels share, provided by Game.vue: sounds, the
 * drawing board, the JA/NEI question, a short message, and switching the
 * tool tab. The save itself is useFigur()'s (one per page).
 */
import type { InjectionKey } from 'vue'
import type { GarmentKind, Texture } from '../types'
import type { Sfx } from './sfx'

export type ToolTab = 'body' | 'hair' | 'clothes' | 'draw' | 'pip'

/** How the drawing board opens: from blank, from a worn built-in piece, or on a drawn piece (saves over it). */
export interface BoardStart {
  kind: GarmentKind
  tex?: Texture
  /** A drawn piece's id: LAGRE saves over it. */
  editId?: string
  name?: string
}

export interface FigurContext {
  sfx(name: Sfx): void
  openBoard(start: BoardStart): void
  /** Ask JA/NEI; `yes` runs on JA. */
  ask(text: string, yes: () => void): void
  say(text: string): void
  setTab(tab: ToolTab): void
}

export const FG_CTX: InjectionKey<FigurContext> = Symbol('figur')
