/**
 * Space Voyagers II: a frame. three.js draws the view into a small canvas
 * of its own (one logical pixel a pixel); that goes into one buffer of
 * logical pixels with the HUD and the dashboard drawn over it; the buffer
 * goes onto the page's canvas once, at a whole number of device pixels a
 * logical pixel, with no smoothing (DESIGN.md, "The picture").
 *
 * Colours pass through untouched: the output is not colour-managed, the sky
 * pictures are not decoded, so every tone on screen is a palette tone.
 */
import * as THREE from 'three'
import { SHIPS } from '../engine/balance'
import { shipAt } from '../engine/ships'
import type { Voyage } from '../engine/world'
import type { Monitor } from '../story/director'
import { drawDash } from './dash'
import { addFx, clearFx, drawHud } from './hud'
import type { HudState } from './hud'
import { computeLayout } from './layout'
import type { Layout, Screen } from './layout'
import { C, SPACE } from './palette'
import { frame as border, rect, textC } from './pix'

const running = (w: Voyage): boolean => w.mission.stage === 'fly' || w.mission.stage === 'launch' || w.mission.stage === 'auto'
import { createScene } from './scene'
import type { Scene3D, SkyPiece } from './scene'

const HEADS: Partial<Record<string, string>> = {
  rat: '/voyagers2/head-rat.png', bear: '/voyagers2/head-bear.png', gorilla: '/voyagers2/head-gorilla.png', hound: '/voyagers2/head-hound.png',
}

export interface Renderer {
  layout: Layout
  scene: Scene3D
  resize(screen: Screen): void
  /** Read this tick's events for effects (once a tick, after `step`). */
  events(w: Voyage): void
  draw(w: Voyage, mon: Monitor, ui: HudState, frame: number): void
  setSky(pieces: SkyPiece[], act: number): void
  dispose(): void
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const glCanvas = document.createElement('canvas')
  const gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
  gl.autoClear = false
  gl.setPixelRatio(1)
  gl.outputColorSpace = THREE.LinearSRGBColorSpace
  const scene = createScene(gl)
  const buffer = document.createElement('canvas')
  const g = buffer.getContext('2d')!
  const out = canvas.getContext('2d')!
  let act = 0

  const r: Renderer = {
    layout: computeLayout({ cssW: 390, cssH: 844, dpr: 1, safeBottom: 0, widget: null, touch: false }),
    scene,
    resize(screen) {
      const l = computeLayout(screen)
      r.layout = l
      buffer.width = l.W
      buffer.height = l.H
      g.imageSmoothingEnabled = false
      gl.setSize(l.view.w, l.view.h, false)
      scene.resize(l.view.w, l.view.h)
      canvas.width = l.W * l.n
      canvas.height = l.H * l.n
      canvas.style.width = `${l.cssW}px`
      canvas.style.height = `${l.cssH}px`
      out.imageSmoothingEnabled = false
    },
    events(w) {
      for (const e of w.events) {
        if (e.type === 'kill' && e.pos) {
          const kind = (e.kind ?? 'rat') as keyof typeof SHIPS
          scene.explode(w, kind, e.pos.x, e.pos.y, e.pos.z)
          const big = SHIPS[kind]?.capital === true
          addFx({ kind: 'boom', x: e.pos.x, y: e.pos.y, z: e.pos.z, life: big ? 60 : 30, r: (SHIPS[kind]?.r ?? 8) * (big ? 0.6 : 2.2) })
          if (e.value && e.b === w.player) addFx({ kind: 'word', x: e.pos.x, y: e.pos.y, z: e.pos.z, life: 50, r: 0, text: '+' + e.value })
          // The Franchise's pilots are mascots: the head comes off on its spring and floats away.
          const head = HEADS[kind]
          if (head) addFx({ kind: 'head', x: e.pos.x, y: e.pos.y, z: e.pos.z, life: 100, r: 0, text: head })
        } else if ((e.type === 'armourHit' || e.type === 'shieldHit') && e.pos && e.a !== undefined) {
          scene.hit(e.a)
          const s = shipAt(w, e.a)
          if (e.type === 'shieldHit' && s) addFx({ kind: 'shield', x: s.pos.x, y: s.pos.y, z: s.pos.z, life: 8, r: s.r * (SHIPS[s.kind].capital ? 1 : 1.6) })
          else addFx({ kind: 'spark', x: e.pos.x, y: e.pos.y, z: e.pos.z, life: 6, r: 0 })
        } else if (e.type === 'missileMiss' && e.pos) {
          addFx({ kind: 'boom', x: e.pos.x, y: e.pos.y, z: e.pos.z, life: 14, r: 3 })
        }
      }
    },
    draw(w, mon, ui, frame) {
      const l = r.layout
      scene.render(w, frame)
      g.drawImage(glCanvas, l.view.x, l.view.y)
      const sp = SPACE[Math.max(0, Math.min(SPACE.length - 1, act))]!
      drawHud(g, l, w, scene.camera, scene.view, mon, ui, frame, sp.mid)
      drawDash(g, l, w, mon, ui.menu, frame)
      if (ui.paused) {
        rect(g, C.bakelite, 0, Math.floor(l.view.h / 2) - 14, l.W, 26)
        textC(g, 'PAUSED', l.W / 2, Math.floor(l.view.h / 2) - 9, C.gold)
        textC(g, l.touch ? 'TAP TO GO ON' : 'P TO GO ON · HOLD ESC TO TURN BACK', l.W / 2, Math.floor(l.view.h / 2) + 2, C.textDim)
        if (l.touch) {
          // Turning back: home to the Deep Dish, the sortie not flown.
          const b = l.turnBack
          rect(g, C.bakelite, b.x, b.y, b.w, b.h)
          border(g, C.bezelHi, b.x, b.y, b.w, b.h)
          textC(g, 'TURN BACK', b.x + b.w / 2, b.y + 6, C.text)
        }
      } else if (l.touch && running(w)) {
        // The pause chip: two bars in the view's top-left corner.
        const p = l.pause
        rect(g, C.bakelite, p.x, p.y, p.w, p.h)
        border(g, C.bezel, p.x, p.y, p.w, p.h)
        rect(g, C.textDim, p.x + 6, p.y + 4, 2, 8)
        rect(g, C.textDim, p.x + 10, p.y + 4, 2, 8)
      }
      out.drawImage(buffer, 0, 0, l.W * l.n, l.H * l.n)
    },
    setSky(pieces, a) {
      act = a
      scene.setSky(pieces, a)
    },
    dispose() {
      clearFx()
      scene.dispose()
      gl.dispose()
    },
  }
  return r
}
