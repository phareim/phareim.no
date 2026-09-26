/**
 * Roblox hair: chunky accessory shapes around the rounded-box head,
 * painted in hair markers (common.ts HAIR) into a front layer (over the
 * head) and a back layer (behind head and body). The style colours and
 * lights them like the other parts.
 */
import type { HairStyle, PixelBuffer } from '../types'
import { HAIR } from './common'
import { fillCircle, fillEllipse, fillRect, fillRoundRect, set } from './pixels'
import type { Rect } from './pixels'

export function paintRobloxHair(front: PixelBuffer, back: PixelBuffer, style: HairStyle, h: Rect): void {
  const { x, y, w } = h
  const cx = x + w / 2
  const H = HAIR.base
  const capTop = () => fillRoundRect(front, x - 1, y - 2, w + 2, 6, 3, H)
  switch (style) {
    case 'none':
      return
    case 'short':
      capTop()
      fillRect(front, x - 1, y + 3, 2, 4, H); fillRect(front, x + w - 1, y + 3, 2, 4, H)
      fillRect(front, x + 1, y + 3, 5, 1, H); fillRect(front, x + w - 5, y + 3, 3, 1, H)
      break
    case 'long':
      fillRoundRect(back, x - 2, y + 1, w + 4, 22, 3, H)
      capTop()
      fillRect(front, x + 1, y + 3, 4, 1, H); fillRect(front, x + w - 5, y + 3, 4, 1, H)
      fillRoundRect(front, x - 2, y + 2, 4, 17, 2, H); fillRoundRect(front, x + w - 2, y + 2, 4, 17, 2, H)
      break
    case 'ponytail':
      capTop()
      fillRect(front, x - 1, y + 3, 2, 3, H); fillRect(front, x + w - 1, y + 3, 2, 3, H)
      fillRect(front, x + 1, y + 3, 8, 1, H); fillRect(front, x - 1, y + 3, 2, 4, H)
      fillEllipse(back, x + w + 1.5, y + 10, 3.2, 7.5, H)
      fillEllipse(back, x + w - 1, y + 2, 3.5, 3.5, H)
      fillRect(back, x + w - 0, y + 3, 3, 2, HAIR.tie)
      break
    case 'pigtails':
      capTop()
      fillRect(front, x + 1, y + 3, w - 2, 1, H)
      for (const s of [-1, 1]) {
        const tx = s < 0 ? x - 4 : x + w
        fillRoundRect(back, tx, y + 5, 4, 11, 2, H)
        fillRect(front, tx, y + 5, 4, 2, HAIR.tie)
      }
      break
    case 'curly':
      // Big round curls all over the top, down the sides past the chin.
      fillRoundRect(front, x - 2, y - 3, w + 4, 7, 3, H)
      for (let i = 0; i < 6; i++) fillCircle(front, x - 1 + i * 3.2, y - 2.5, 3, H)
      for (let i = 0; i < 5; i++) fillCircle(front, x + 0.5 + i * 3.25, y + 3, 1.6, H)
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) fillCircle(back, s < 0 ? x - 1 : x + w + 1, y + 1 + k * 3.4, 3, H)
      for (let i = 0; i < 6; i++) set(front, Math.round(x + i * 3.2), y - 3 + (i % 2), HAIR.light)
      break
    case 'bun':
      fillRoundRect(front, x - 1, y - 1, w + 2, 5, 2, H)
      fillRect(front, x - 1, y + 3, 2, 2, H); fillRect(front, x + w - 1, y + 3, 2, 2, H)
      // A big bun on top with a band round its base.
      fillCircle(front, cx, y - 5.5, 5.2, H)
      fillCircle(front, cx - 1.5, y - 7, 1.6, HAIR.light)
      fillRect(front, cx - 4, y - 1, 8, 2, HAIR.tie)
      break
    case 'spiky':
      capTop()
      // Five bold spikes, the middle ones tallest, fanning out.
      for (let i = 0; i < 5; i++) {
        const tall = [5, 7, 8, 7, 5][i]!
        const sx = x - 2 + i * 3.6
        const lean = (i - 2) * 0.35
        for (let k = 0; k < tall; k++) fillRect(front, sx + lean * k + (k * 2.5) / tall, y - 1 - k, Math.max(1, Math.round(5 * (1 - k / tall))), 1, H)
      }
      fillRect(front, x - 1, y + 3, 2, 3, H); fillRect(front, x + w - 1, y + 3, 2, 3, H)
      for (let i = 0; i < 4; i++) set(front, x + 1 + i * 3, y + 3, H)
      break
    case 'afro':
      fillEllipse(back, cx, y + 4, w / 2 + 5.5, 10.5, H)
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 7) * Math.PI
        fillCircle(back, cx + Math.cos(a) * (w / 2 + 5), y + 4 + Math.sin(a) * 10, 2.5, H)
      }
      fillRoundRect(front, x - 1, y - 2, w + 2, 6, 3, H)
      break
  }
}
