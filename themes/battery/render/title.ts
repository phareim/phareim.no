/**
 * The title screen behind the page's menu. Placeholder.
 */
import type { PixelStage } from '../../base/pixel/stage'
import { drawBigText, bigTextWidth } from '../../base/pixel/sprites'

export function drawTitle(stage: PixelStage, t: number) {
  const g = stage.begin()
  g.fillStyle = '#0b0616'
  g.fillRect(0, 0, stage.vw, stage.vh)
  const n = stage.vw >= 360 ? 2 : 1
  const lines = ['NIGHT OF THE', 'DEAD BATTERY']
  lines.forEach((l, i) => {
    const w = bigTextWidth(l, n)
    drawBigText(g, l, Math.round((stage.vw - w) / 2), 30 + i * 9 * n, n, i ? '#ffd23f' : '#c7a6ff', '#1c1030')
  })
  void t
  stage.present({ ambient: null })
}
