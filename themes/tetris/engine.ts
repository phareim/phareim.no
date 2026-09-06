// utils/tetris.ts — pure Tetris engine: no Vue, no DOM, fully deterministic given rng

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

function rotateMatrixCW(m: number[][]): number[][] {
  const n = m.length
  const out: number[][] = []
  for (let i = 0; i < n; i++) {
    const row: number[] = []
    for (let j = 0; j < n; j++) {
      const src = m[n - 1 - j]
      row.push(src ? (src[i] === 1 ? 1 : 0) : 0)
    }
    out.push(row)
  }
  return out
}

const BASE_SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
}

function buildStates(base: number[][]): number[][][] {
  const states: number[][][] = [base]
  for (let k = 1; k < 4; k++) {
    const prev = states[k - 1] as number[][]
    states.push(rotateMatrixCW(prev))
  }
  return states
}

export const PIECE_SHAPES: Record<PieceType, number[][][]> = {
  I: buildStates(BASE_SHAPES.I),
  O: buildStates(BASE_SHAPES.O),
  T: buildStates(BASE_SHAPES.T),
  S: buildStates(BASE_SHAPES.S),
  Z: buildStates(BASE_SHAPES.Z),
  J: buildStates(BASE_SHAPES.J),
  L: buildStates(BASE_SHAPES.L)
}

// SRS wall kicks, x right+, y down+ (guideline tables converted from y-up)
export const KICKS: {
  JLSTZ: Record<string, [number, number][]>
  I: Record<string, [number, number][]>
} = {
  JLSTZ: {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  },
  I: {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  }
}

export type EngineEvent =
  | { type: 'lock' }
  | { type: 'clear', rows: number[], count: number }
  | { type: 'levelup', level: number }
  | { type: 'over' }
  | { type: 'score', score: number }

export interface ActivePiece {
  type: PieceType
  rot: number
  x: number
  y: number
}

export interface TetrisEngineOpts {
  cols?: number
  rows?: number
  onEvent?: (e: EngineEvent) => void
  rng?: () => number
}

const LOCK_DELAY_MS = 500
const MAX_LOCK_RESETS = 15
const CLEAR_SCORES = [0, 100, 300, 500, 800]

function shapeOf(type: PieceType, rot: number): number[][] {
  const states = PIECE_SHAPES[type] as number[][][]
  return (states[((rot % 4) + 4) % 4] as number[][]) || []
}

export class TetrisEngine {
  cols = 10
  rows = 20
  board: (PieceType | null)[][] = []
  active: ActivePiece | null = null
  next: PieceType = 'T'
  hold: PieceType | null = null
  canHold = true
  score = 0
  lines = 0
  level = 1
  over = false
  pendingClear: number[] = []

  private bag: PieceType[] = []
  private rng: () => number
  private onEvent?: (e: EngineEvent) => void
  private fallTimer = 0
  private lockTimer = 0
  private lockResets = 0

  constructor(opts: TetrisEngineOpts = {}) {
    if (opts.cols !== undefined) this.cols = opts.cols
    if (opts.rows !== undefined) this.rows = opts.rows
    this.onEvent = opts.onEvent
    this.rng = opts.rng || Math.random
    this.reset()
  }

  reset(): void {
    this.board = []
    for (let r = 0; r < this.rows; r++) {
      const row: (PieceType | null)[] = []
      for (let c = 0; c < this.cols; c++) row.push(null)
      this.board.push(row)
    }
    this.score = 0
    this.lines = 0
    this.level = 1
    this.over = false
    this.hold = null
    this.canHold = true
    this.pendingClear = []
    this.bag = []
    this.fallTimer = 0
    this.lockTimer = 0
    this.lockResets = 0
    this.next = this.drawFromBag()
    this.spawnActive()
  }

  move(dx: -1 | 1): boolean {
    const a = this.active
    if (!a || this.over || this.pendingClear.length > 0) return false
    if (this.collides(a.type, a.rot, a.x + dx, a.y)) return false
    a.x += dx
    this.bumpLockDelay()
    return true
  }

  rotate(dir: 1 | -1): boolean {
    const a = this.active
    if (!a || this.over || this.pendingClear.length > 0) return false
    if (a.type === 'O') return true
    const from = ((a.rot % 4) + 4) % 4
    const to = (((a.rot + dir) % 4) + 4) % 4
    const table = a.type === 'I' ? KICKS.I : KICKS.JLSTZ
    const kicks = table[`${from}>${to}`] || [[0, 0]]
    for (const kick of kicks) {
      const dx = kick[0] as number
      const dy = kick[1] as number
      if (!this.collides(a.type, to, a.x + dx, a.y + dy)) {
        a.rot = to
        a.x += dx
        a.y += dy
        this.bumpLockDelay()
        return true
      }
    }
    return false
  }

  softDrop(): boolean {
    const a = this.active
    if (!a || this.over || this.pendingClear.length > 0) return false
    if (this.collides(a.type, a.rot, a.x, a.y + 1)) return false
    a.y += 1
    this.score += 1
    this.fallTimer = 0
    this.emit({ type: 'score', score: this.score })
    return true
  }

  hardDrop(): number {
    const a = this.active
    if (!a || this.over || this.pendingClear.length > 0) return 0
    const target = this.ghostY()
    const dist = target - a.y
    a.y = target
    if (dist > 0) {
      this.score += dist * 2
      this.emit({ type: 'score', score: this.score })
    }
    this.lockPiece()
    return dist
  }

  holdPiece(): boolean {
    const a = this.active
    if (!a || this.over || !this.canHold || this.pendingClear.length > 0) return false
    if (this.hold === null) {
      this.hold = a.type
      this.spawnActive()
    } else {
      const swapped = this.hold
      this.hold = a.type
      this.active = { type: swapped, rot: 0, x: this.spawnX(swapped), y: 0 }
      this.resetPieceClock()
      if (this.collides(swapped, 0, (this.active as ActivePiece).x, 0)) {
        this.gameOver()
      }
    }
    this.canHold = false
    return true
  }

  tick(dtMs: number): void {
    if (this.over || !this.active || this.pendingClear.length > 0) return
    if (dtMs <= 0) return
    const a = this.active
    if (this.collides(a.type, a.rot, a.x, a.y + 1)) {
      this.lockTimer += dtMs
      if (this.lockTimer >= LOCK_DELAY_MS) this.lockPiece()
      return
    }
    this.lockTimer = 0
    this.fallTimer += dtMs
    const step = this.gravityMs()
    while (this.fallTimer >= step) {
      this.fallTimer -= step
      if (!this.collides(a.type, a.rot, a.x, a.y + 1)) {
        a.y += 1
        this.lockResets = 0
        if (this.collides(a.type, a.rot, a.x, a.y + 1)) {
          this.fallTimer = 0
          break
        }
      } else {
        break
      }
    }
  }

  ghostY(): number {
    const a = this.active
    if (!a) return 0
    let y = a.y
    while (!this.collides(a.type, a.rot, a.x, y + 1)) y += 1
    return y
  }

  gravityMs(): number {
    return Math.max(80, 800 - (this.level - 1) * 70)
  }

  cells(): { x: number, y: number, type: PieceType }[] {
    const a = this.active
    if (!a) return []
    const out: { x: number, y: number, type: PieceType }[] = []
    const shape = shapeOf(a.type, a.rot)
    for (let dy = 0; dy < shape.length; dy++) {
      const row = shape[dy] as number[]
      if (!row) continue
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] === 1) out.push({ x: a.x + dx, y: a.y + dy, type: a.type })
      }
    }
    return out
  }

  finishClear(): void {
    if (this.pendingClear.length === 0) return
    const doomed = new Set(this.pendingClear)
    const kept: (PieceType | null)[][] = []
    for (let r = 0; r < this.rows; r++) {
      if (!doomed.has(r)) {
        const row = this.board[r] as (PieceType | null)[]
        kept.push(row ? row.slice() : this.emptyRow())
      }
    }
    while (kept.length < this.rows) kept.unshift(this.emptyRow())
    this.board = kept
    this.pendingClear = []
  }

  private emptyRow(): (PieceType | null)[] {
    const row: (PieceType | null)[] = []
    for (let c = 0; c < this.cols; c++) row.push(null)
    return row
  }

  private drawFromBag(): PieceType {
    if (this.bag.length === 0) {
      const fresh: PieceType[] = PIECE_TYPES.slice()
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1))
        const tmp = fresh[i] as PieceType
        fresh[i] = fresh[j] as PieceType
        fresh[j] = tmp
      }
      this.bag = fresh
    }
    return (this.bag.pop() as PieceType) || 'T'
  }

  private spawnX(type: PieceType): number {
    const w = type === 'I' ? 4 : type === 'O' ? 2 : 3
    return Math.max(0, Math.floor((this.cols - w) / 2))
  }

  private spawnActive(): void {
    const type = this.next
    this.next = this.drawFromBag()
    const x = this.spawnX(type)
    if (this.collides(type, 0, x, 0)) {
      this.active = null
      this.gameOver()
      return
    }
    this.active = { type, rot: 0, x, y: 0 }
    this.resetPieceClock()
  }

  private resetPieceClock(): void {
    this.fallTimer = 0
    this.lockTimer = 0
    this.lockResets = 0
  }

  private bumpLockDelay(): void {
    const a = this.active
    if (!a) return
    if (this.lockResets >= MAX_LOCK_RESETS) return
    if (this.collides(a.type, a.rot, a.x, a.y + 1)) {
      this.lockTimer = 0
      this.lockResets += 1
    }
  }

  private collides(type: PieceType, rot: number, x: number, y: number): boolean {
    const shape = shapeOf(type, rot)
    for (let dy = 0; dy < shape.length; dy++) {
      const row = shape[dy] as number[]
      if (!row) continue
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] !== 1) continue
        const bx = x + dx
        const by = y + dy
        if (bx < 0 || bx >= this.cols || by >= this.rows) return true
        if (by < 0) continue
        const brow = this.board[by] as (PieceType | null)[]
        if (brow && brow[bx] !== null) return true
      }
    }
    return false
  }

  private lockPiece(): void {
    const a = this.active
    if (!a || this.over) return
    let aboveTop = false
    const shape = shapeOf(a.type, a.rot)
    for (let dy = 0; dy < shape.length; dy++) {
      const row = shape[dy] as number[]
      if (!row) continue
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] !== 1) continue
        const bx = a.x + dx
        const by = a.y + dy
        if (by < 0) {
          aboveTop = true
          continue
        }
        if (bx < 0 || bx >= this.cols || by >= this.rows) continue
        const brow = this.board[by] as (PieceType | null)[]
        if (brow) brow[bx] = a.type
      }
    }
    this.emit({ type: 'lock' })
    const full: number[] = []
    for (let r = 0; r < this.rows; r++) {
      const row = this.board[r] as (PieceType | null)[]
      if (row && row.every((v) => v !== null)) full.push(r)
    }
    if (full.length > 0) {
      this.pendingClear = full
      const count = full.length
      const gained = (CLEAR_SCORES[count] || 0) * this.level
      this.score += gained
      this.lines += count
      const nextLevel = Math.floor(this.lines / 10) + 1
      this.emit({ type: 'clear', rows: full.slice(), count })
      this.emit({ type: 'score', score: this.score })
      if (nextLevel > this.level) {
        this.level = nextLevel
        this.emit({ type: 'levelup', level: this.level })
      }
    }
    if (aboveTop) {
      this.active = null
      this.gameOver()
      return
    }
    this.canHold = true
    this.spawnActive()
  }

  private gameOver(): void {
    if (this.over) return
    this.over = true
    this.emit({ type: 'over' })
  }

  private emit(e: EngineEvent): void {
    if (this.onEvent) this.onEvent(e)
  }
}
