/**
 * Panel portraits: the hero's head painted by the same head code as the
 * rig, at 1× for the wide panel (cropped to 24×13, a face in a letterbox)
 * and 2× for the phone panel (≤ 34×34, short ears showing).
 */
import { makeCanvas } from '../../../base/pixel/stage'
import type { HeroId } from '../../types'
import { Doll } from './doll'
import { LOOKS } from './looks'
import { head, setEarScale } from './heads'
import { baseRig } from './poses'
import type { FrameDesc } from './poses'

export function paintPortrait(id: HeroId, k: 1 | 2, blink: boolean, flop: boolean): HTMLCanvasElement {
  // The phone portrait hugs the face a little tighter so head and ear nubs fit 34 px.
  const L = k === 2 && id !== 'dag' ? { ...LOOKS[id], headRx: LOOKS[id].headRx - 0.3, headRy: LOOKS[id].headRy - 0.5 } : LOOKS[id]
  const r = baseRig('front')
  if (id === 'dag') { r.eyes = 'half'; r.mouth = 'smile' }
  if (id === 'kjell') r.brows = 'worried'
  if (id === 'espen') { r.eyes = 'wide'; r.mouth = 'grin' }
  if (blink) r.eyes = 'closed'
  if (flop) r.ears = 'flop'
  const desc: FrameDesc = { id, view: 'front', pose: '', f: 0, walk: -1, blink, talk: 0, idle: '', flop }
  const S = k
  const size = 56 * S
  const d = new Doll(size, size, size / 2, size / 2, S)
  setEarScale(k === 2 ? (flop ? 0.55 : 0.26) : 1)
  if (id === 'dag') {
    // Shoulders under the beard.
    d.ell(0, 12, 12, 5, L.suit, { line: 'k' })
  } else {
    d.ell(0, 10.5, 7.5, 4, L.suit, { line: 'k' })
  }
  head(d, L, 0, 0, r, desc)
  setEarScale(1)
  const full = d.render()
  // Crop round the face.
  const cw = k === 2 ? 34 : 24
  const ch = k === 2 ? 34 : 13
  const cy = (k === 2 ? (id === 'dag' ? -15 : -19) : id === 'dag' ? -5 : -6) + size / 2
  const cx = size / 2 - Math.floor(cw / 2)
  const c = makeCanvas(cw, ch)
  c.getContext('2d')!.drawImage(full, -cx, -cy)
  return c
}
