/** One gesture controls one piece. Axis locking prevents diagonal drops. */
export class TetrisGesture {
  private x: number
  private y: number
  private axis: 'x' | 'y' | null = null
  private travelled = 0
  constructor(private startX: number, private startY: number, private startTime: number, private cell: number) {
    this.x = startX
    this.y = startY
  }
  move(x: number, y: number, time: number): { horizontal: number, down: number } {
    const dx = x - this.startX, dy = y - this.startY
    this.travelled = Math.max(this.travelled, Math.hypot(dx, dy))
    if (!this.axis && this.travelled >= 10) this.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    let horizontal = 0, down = 0
    const step = Math.max(14, this.cell)
    if (this.axis === 'x') {
      horizontal = Math.trunc((x - this.x) / step)
      if (horizontal) this.x += horizontal * step
      // Follow the finger at edges too: reversing never has a long dead zone.
    } else if (this.axis === 'y' && time - this.startTime > 300) {
      down = Math.max(0, Math.trunc((y - this.y) / step))
      if (down) this.y += down * step
    }
    return { horizontal, down }
  }
  end(x: number, y: number, time: number): 'rotate' | 'drop' | 'hold' | null {
    const dx = x - this.startX, dy = y - this.startY
    const duration = time - this.startTime
    const distance = Math.max(this.travelled, Math.hypot(dx, dy))
    if (distance < 10 && duration < 350) return 'rotate'
    if (this.axis !== 'x' && Math.abs(dy) > Math.abs(dx) * 1.5) {
      if (dy > 60 && duration <= 300) return 'drop'
      if (dy < -48 && duration < 600) return 'hold'
    }
    return null
  }
}
