/**
 * The 16-bit view's GPU side: what `view.ts` gathers each frame (pictures,
 * geometry, lamps), drawn in the passes `shaders.ts` describes. It knows
 * nothing of the game: tiles are numbers, lamps are numbers.
 *
 * Throws from `createEngine` when the browser has no WebGL2; the view then
 * falls back to the canvas one.
 */
import type { Cam } from './camera'
import type { Rect } from './project'
import { bindTarget, bindTex, program, programsReady, resizeTarget, target, targetOk, texture, upload, uploadPart, type GL, type Program, type Target, type Tex } from './gl'
import * as S from './shaders'

/** Floats per vertex of the world's geometry: position 3, screen offset 2, picture px 2, meta 4. */
export const VERT = 11
/** Floats per vertex of a lamp: corner 2, lamp x y z r, colour 3. */
export const LVERT = 9
/** Floats per vertex of a blob shadow: corner 2, local x y, strength. */
export const BVERT = 5

export interface Look {
  soft: number
  bump: number
  round: number
  emit: number
  directional: number
  occlude: number
  /** How much of a lamp's light hangs in the air over the ground it lights. */
  glow: number
  /** Unit vector toward the sun: x, y on the ground, z up. */
  sun: [number, number, number]
  shadowLen: number
  shadow: number
  shadowTint: [number, number, number]
  shading: number
  rim: number
  ao: number
  clouds: number
  cloudDrift: number
  water: number
  mirror: number
  /** How much wet ground shows what shines above it. */
  wet: number
  haze: number
  hazeColor: [number, number, number]
  skyTop: [number, number, number]
  skyHorizon: [number, number, number]
  sky: boolean
  mist: number
  mistColor: [number, number, number]
  rays: number
  colorBits: number
  bloom: number
  vignette: number
  scanlines: number
  wind: number
}

export interface FrameIn {
  cam: Cam
  R: Rect
  /** The tile data's extent: its corner tile (the land beyond the edge reaches below zero) and its size. */
  mapX: number
  mapY: number
  mapW: number
  mapH: number
  /** The map itself, and how much what lies outside it sinks into the dusk (0: not at all). */
  inner: Rect
  far: number
  rooms: Rect[]
  time: number
  outdoors: boolean
  ambient: [number, number, number]
  voidColor: [number, number, number]
  hero: { x: number; y: number }
  verts: Float32Array
  vertCount: number
  lights: Float32Array
  lightCount: number
  blobs: Float32Array
  blobCount: number
  look: Look
  fade: number
  /** The hero's own vertices, drawn once more where something stands in front of them. */
  ghost: { start: number; count: number } | null
  /** Mosaic block in hi-res px (1: none), the scanline wave's reach in px, the iris (device px: x, y, radius; a negative radius is open). */
  mosaic: number
  wave: number
  iris: [number, number, number]
  /** A colour the whole world is multiplied by (white: none). */
  cast: [number, number, number]
  /** Where crowns thin out: the hero on the scene (hi-res px), their depth, the radius (0: nowhere). */
  veil: [number, number, number, number]
  /** Device px: the canvas, one hi-res px, where the scene's corner lands, the classic scanline pitch. */
  W: number
  H: number
  hs: number
  offX: number
  offY: number
  scanStep: number
}

export interface Engine {
  canvas: HTMLCanvasElement
  /** The picture the ground quad shows (16 px to the tile, covering R). */
  flat(c: HTMLCanvasElement): void
  /** Everything standing, top-down, same size. */
  objs(c: HTMLCanvasElement): void
  /** The frame's people and things, one cell each, in the canvas's top h rows. */
  atlas(c: HTMLCanvasElement, h: number): void
  /** Shots, sparks and the flash, scene-sized. */
  fx(c: HTMLCanvasElement): void
  /** The backdrop behind the map's edge, scene-sized. */
  sky(c: HTMLCanvasElement): void
  /** Plants: colour and normals. */
  flora(albedo: HTMLCanvasElement, normal: HTMLCanvasElement): void
  /** The hero's figure (`figure.ts`), w × h px: its colours with a straight alpha, and its normals with its glow in their alpha. */
  figure(albedo: Uint8ClampedArray, normal: Uint8ClampedArray, w: number, h: number): void
  /** Per tile: r = height of what stands there / 4, g = 1 for water, b = how wet the ground is. */
  tiles(data: Uint8Array, w: number, h: number): void
  draw(f: FrameIn): void
  /**
   * Are the shaders built? 'wait' while the driver compiles them off the main thread; 'failed' when this GPU
   * would not take them. `block`: stop and wait for them here (the lab, which draws in one go).
   */
  ready(block?: boolean): 'yes' | 'wait' | 'failed'
  /** True when lamps can light things from the side (needs float render targets). */
  directional: boolean
  lost(): boolean
  dispose(): void
}

/** The light buffer's side in px, and its px per tile at best. */
const LB = 512
const LB_PER_TILE = 8

export function createEngine(): Engine {
  const canvas = document.createElement('canvas')
  // The scene is small: the laptop's quiet GPU is enough, and waking the other one costs battery.
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'default' }) as GL | null
  if (!gl) throw new Error('no WebGL2')
  try { return build(canvas, gl) } catch (e) {
    // What was made so far goes with the context: nothing of a failed engine stays behind.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    throw e
  }
}

function build(canvas: HTMLCanvasElement, gl: GL): Engine {
  let contextLost = false
  canvas.addEventListener('webglcontextlost', () => { contextLost = true })

  const float = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')

  const geom = program(gl, S.GEOM_VS, S.GEOM_FS, S.GEOM_ATTRIBS)
  const ground = program(gl, S.GROUND_VS, S.GROUND_FS, ['aPos'])
  const lightP = program(gl, S.LIGHT_VS, S.LIGHT_FS, S.LIGHT_ATTRIBS)
  const blobP = program(gl, S.BLOB_VS, S.BLOB_FS, S.BLOB_ATTRIBS)
  const litP = program(gl, S.QUAD_VS, S.LIT_FS, ['aPos'])
  const compP = program(gl, S.QUAD_VS, S.COMPOSITE_FS, ['aPos'])
  const brightP = program(gl, S.QUAD_VS, S.BRIGHT_FS, ['aPos'])
  const blurP = program(gl, S.QUAD_VS, S.BLUR_FS, ['aPos'])
  const finishP = program(gl, S.QUAD_VS, S.FINISH_FS, ['aPos'])
  const programs = [geom, ground, lightP, blobP, litP, compP, brightP, blurP, finishP]
  let built: 'yes' | 'wait' | 'failed' = 'wait'

  // --- buffers ---------------------------------------------------------------
  const quadVao = gl.createVertexArray()!
  gl.bindVertexArray(quadVao)
  const quadBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  function dynamic(layout: number[]): { vao: WebGLVertexArrayObject; buf: WebGLBuffer; cap: number } {
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const stride = layout.reduce((a, b) => a + b, 0) * 4
    let off = 0
    layout.forEach((n, i) => {
      gl.enableVertexAttribArray(i)
      gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off)
      off += n * 4
    })
    return { vao, buf, cap: 0 }
  }
  const geomB = dynamic([3, 2, 2, 4])
  const groundB = dynamic([2])
  const lightB = dynamic([2, 4, 3])
  const blobB = dynamic([2, 3])
  gl.bindVertexArray(null)

  function fill(b: { buf: WebGLBuffer; cap: number }, data: Float32Array, floats: number) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf)
    if (floats > b.cap) {
      b.cap = Math.max(floats, b.cap * 2, 4096)
      gl.bufferData(gl.ARRAY_BUFFER, b.cap * 4, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, floats)
  }

  // --- pictures ----------------------------------------------------------------
  const flatT = texture(gl, 1, 1)
  const objsT = texture(gl, 1, 1)
  const atlasT = texture(gl, 1, 1)
  const fxT = texture(gl, 1, 1)
  const skyT = texture(gl, 1, 1, { linear: false })
  const floraT = texture(gl, 1, 1)
  const floraNT = texture(gl, 1, 1)
  const figT = texture(gl, 1, 1)
  const figNT = texture(gl, 1, 1)
  const tilesT = texture(gl, 1, 1)
  const tilesLinT = texture(gl, 1, 1, { linear: true })

  // --- render targets ----------------------------------------------------------
  const rgba8 = {}
  const gbuf = target(gl, 1, 1, [rgba8, rgba8, rgba8], true)
  const lf = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, linear: true }
  let lbuf = float ? target(gl, LB, LB, [lf, lf, lf]) : null
  // A GPU that will not draw into half-floats still gets its lamps, lit flat, in eight bits.
  const directional = !!lbuf && targetOk(gl, lbuf)
  if (!directional) {
    if (lbuf) { gl.deleteFramebuffer(lbuf.fb); lbuf.tex.forEach(t => gl.deleteTexture(t.t)) }
    lbuf = target(gl, LB, LB, [{ linear: true }, { linear: true }, { linear: true }])
  }
  const lights = lbuf!
  const blob = target(gl, LB, LB, [{ linear: true }])
  const lit = target(gl, 1, 1, [rgba8])
  const comp = target(gl, 1, 1, [{ linear: true }])
  const bloomA = target(gl, 1, 1, [{ linear: true }])
  const bloomA2 = target(gl, 1, 1, [{ linear: true }])
  const bloomB = target(gl, 1, 1, [{ linear: true }])
  const bloomB2 = target(gl, 1, 1, [{ linear: true }])
  if (!targetOk(gl, gbuf)) throw new Error('no G-buffer')

  function camera(p: Program, cam: Cam) {
    gl.uniform2f(p.u('uEx'), cam.ex.x, cam.ex.y)
    gl.uniform2f(p.u('uEy'), cam.ey.x, cam.ey.y)
    gl.uniform1f(p.u('uZs'), cam.zs)
    gl.uniform2f(p.u('uOrigin'), cam.ox, cam.oy)
    gl.uniform2f(p.u('uSize'), cam.sw, cam.sh)
    gl.uniform4f(p.u('uDepth'), cam.dv[0], cam.dv[1], cam.dv[2], cam.d0)
    gl.uniform1f(p.u('uDepthInv'), cam.dInv)
  }
  function ground2(p: Program, cam: Cam) {
    gl.uniform2f(p.u('uSize'), cam.sw, cam.sh)
    gl.uniform2f(p.u('uOrigin'), cam.ox, cam.oy)
    gl.uniform4f(p.u('uInv'), cam.inv[0], cam.inv[1], cam.inv[2], cam.inv[3])
    gl.uniform1f(p.u('uZs'), cam.zs)
  }
  const roomRects = new Float32Array(8)
  function rooms(p: Program, f: FrameIn) {
    const n = Math.min(2, f.rooms.length)
    for (let i = 0; i < n; i++) {
      const z = f.rooms[i]!
      roomRects[i * 4] = z.x; roomRects[i * 4 + 1] = z.y; roomRects[i * 4 + 2] = z.w; roomRects[i * 4 + 3] = z.h
    }
    gl.uniform4fv(p.u('uRooms'), roomRects)
    gl.uniform1i(p.u('uRoomCount'), n)
  }
  const fullscreen = () => { gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4) }
  const groundVerts = new Float32Array(8)

  function draw(f: FrameIn) {
    const g = gl!
    const { cam, R, look } = f
    if (canvas.width !== f.W || canvas.height !== f.H) { canvas.width = f.W; canvas.height = f.H }
    resizeTarget(g, gbuf, cam.sw, cam.sh)
    resizeTarget(g, lit, cam.sw, cam.sh)
    resizeTarget(g, comp, cam.sw, cam.sh)
    const qw = Math.max(1, Math.ceil(cam.sw / 4))
    const qh = Math.max(1, Math.ceil(cam.sh / 4))
    resizeTarget(g, bloomA, qw, qh)
    resizeTarget(g, bloomA2, qw, qh)
    resizeTarget(g, bloomB, Math.ceil(qw / 2), Math.ceil(qh / 2))
    resizeTarget(g, bloomB2, Math.ceil(qw / 2), Math.ceil(qh / 2))

    // How many light-buffer px a tile gets: all of R must fit.
    const lr = Math.min(LB_PER_TILE, Math.floor(LB / Math.max(R.w, R.h)))
    const lscale = lr / LB

    // --- 1. geometry -------------------------------------------------------------
    bindTarget(g, gbuf)
    g.disable(g.BLEND)
    g.enable(g.DEPTH_TEST)
    g.depthFunc(g.LEQUAL)
    g.depthMask(true)
    g.clearColor(0, 0, 0, 0)
    g.clearDepth(1)
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)

    g.useProgram(ground.p)
    camera(ground, cam)
    rooms(ground, f)
    g.uniform4f(ground.u('uRect'), R.x, R.y, R.w, R.h)
    g.uniform2f(ground.u('uOrg'), f.mapX, f.mapY)
    g.uniform1f(ground.u('uSoft'), look.soft)
    g.uniform1f(ground.u('uBump'), look.bump)
    g.uniform1f(ground.u('uEmit'), look.emit)
    bindTex(g, 0, flatT, ground.u('uFlat'))
    bindTex(g, 1, tilesT, ground.u('uTiles'))
    groundVerts.set([R.x, R.y, R.x + R.w, R.y, R.x, R.y + R.h, R.x + R.w, R.y + R.h])
    g.bindVertexArray(groundB.vao)
    fill(groundB, groundVerts, 8)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)

    if (f.vertCount > 0) {
      g.useProgram(geom.p)
      camera(geom, cam)
      g.uniform1f(geom.u('uTime'), f.time)
      g.uniform3f(geom.u('uHero'), f.hero.x, f.hero.y, look.wind)
      g.uniform1f(geom.u('uSoft'), look.soft)
      g.uniform1f(geom.u('uBump'), look.bump)
      g.uniform1f(geom.u('uRound'), look.round)
      g.uniform1f(geom.u('uEmit'), look.emit)
      // A billboard faces the viewer, tipped up a little so the ground's light reaches it.
      const vn = Math.hypot(cam.dv[0], cam.dv[1], cam.dv[2] * 0.55) || 1
      g.uniform3f(geom.u('uViewN'), cam.dv[0] / vn, cam.dv[1] / vn, (cam.dv[2] * 0.55) / vn)
      const rn = Math.hypot(cam.inv[0], cam.inv[2]) || 1
      g.uniform3f(geom.u('uRight'), cam.inv[0] / rn, cam.inv[2] / rn, 0)
      bindTex(g, 0, objsT, geom.u('uObjs'))
      bindTex(g, 1, atlasT, geom.u('uAtlas'))
      bindTex(g, 2, floraT, geom.u('uFlora'))
      bindTex(g, 3, floraNT, geom.u('uFloraN'))
      bindTex(g, 4, figT, geom.u('uFig'))
      bindTex(g, 5, figNT, geom.u('uFigN'))
      g.bindVertexArray(geomB.vao)
      fill(geomB, f.verts, f.vertCount * VERT)
      g.uniform1f(geom.u('uGhost'), 0)
      g.uniform4f(geom.u('uVeil'), f.veil[0], f.veil[1], f.veil[2], f.veil[3])
      g.uniform1f(geom.u('uSceneH'), cam.sh)
      g.drawArrays(g.TRIANGLES, 0, f.vertCount)
      if (f.ghost && f.ghost.count > 0) {
        g.depthFunc(g.GREATER)
        g.depthMask(false)
        g.uniform1f(geom.u('uGhost'), 1)
        g.drawArrays(g.TRIANGLES, f.ghost.start, f.ghost.count)
        g.depthMask(true)
        g.depthFunc(g.LEQUAL)
      }
    }
    g.disable(g.DEPTH_TEST)

    // --- 2. lamps and blob shadows, top-down ---------------------------------------
    g.bindFramebuffer(g.FRAMEBUFFER, lights.fb)
    g.viewport(0, 0, LB, LB)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
    if (f.lightCount > 0) {
      g.enable(g.BLEND)
      g.blendEquation(g.FUNC_ADD)
      g.blendFunc(g.ONE, g.ONE)
      g.useProgram(lightP.p)
      g.uniform4f(lightP.u('uRect'), R.x, R.y, R.w, R.h)
      g.uniform2f(lightP.u('uScale'), lscale, lscale)
      g.uniform2f(lightP.u('uMap'), f.mapW, f.mapH)
      g.uniform2f(lightP.u('uOrg'), f.mapX, f.mapY)
      g.uniform1f(lightP.u('uOcclude'), look.occlude)
      bindTex(g, 0, tilesT, lightP.u('uTiles'))
      g.bindVertexArray(lightB.vao)
      fill(lightB, f.lights, f.lightCount * 6 * LVERT)
      g.drawArrays(g.TRIANGLES, 0, f.lightCount * 6)
    }
    g.bindFramebuffer(g.FRAMEBUFFER, blob.fb)
    g.viewport(0, 0, LB, LB)
    g.clear(g.COLOR_BUFFER_BIT)
    if (f.blobCount > 0) {
      g.enable(g.BLEND)
      g.blendEquation(g.MAX)
      g.blendFunc(g.ONE, g.ONE)
      g.useProgram(blobP.p)
      g.uniform4f(blobP.u('uRect'), R.x, R.y, R.w, R.h)
      g.uniform2f(blobP.u('uScale'), lscale, lscale)
      g.bindVertexArray(blobB.vao)
      fill(blobB, f.blobs, f.blobCount * 6 * BVERT)
      g.drawArrays(g.TRIANGLES, 0, f.blobCount * 6)
      g.blendEquation(g.FUNC_ADD)
    }
    g.disable(g.BLEND)

    // --- 3. lit ----------------------------------------------------------------------
    bindTarget(g, lit)
    g.useProgram(litP.p)
    ground2(litP, cam)
    bindTex(g, 0, gbuf.tex[0]!, litP.u('uG0'))
    bindTex(g, 1, gbuf.tex[1]!, litP.u('uG1'))
    bindTex(g, 2, gbuf.tex[2]!, litP.u('uG2'))
    bindTex(g, 3, lights.tex[0]!, litP.u('uL0'))
    bindTex(g, 4, lights.tex[1]!, litP.u('uL1'))
    bindTex(g, 5, lights.tex[2]!, litP.u('uL2'))
    bindTex(g, 6, blob.tex[0]!, litP.u('uBlob'))
    bindTex(g, 7, tilesT, litP.u('uTiles'))
    bindTex(g, 8, tilesLinT, litP.u('uTilesLin'))
    g.uniform2f(litP.u('uMap'), f.mapW, f.mapH)
    g.uniform2f(litP.u('uOrg'), f.mapX, f.mapY)
    g.uniform4f(litP.u('uRect'), R.x, R.y, R.w, R.h)
    g.uniform2f(litP.u('uLScale'), lscale, lscale)
    g.uniform3f(litP.u('uAmbient'), f.ambient[0], f.ambient[1], f.ambient[2])
    g.uniform1f(litP.u('uDirectional'), directional ? look.directional : 0)
    g.uniform3f(litP.u('uSun'), look.sun[0], look.sun[1], look.sun[2])
    g.uniform1f(litP.u('uShadowLen'), look.shadowLen)
    g.uniform1f(litP.u('uShadow'), look.shadow)
    g.uniform3f(litP.u('uShadowTint'), look.shadowTint[0], look.shadowTint[1], look.shadowTint[2])
    g.uniform1f(litP.u('uShading'), look.shading)
    g.uniform1f(litP.u('uRim'), look.rim)
    g.uniform1f(litP.u('uAo'), look.ao)
    g.uniform1f(litP.u('uGlow'), look.glow)
    g.uniform1f(litP.u('uOutdoors'), f.outdoors ? 1 : 0)
    g.uniform1f(litP.u('uK'), cam.k)
    g.uniform1f(litP.u('uTime'), f.time)
    g.uniform1f(litP.u('uClouds'), look.clouds)
    g.uniform1f(litP.u('uCloudDrift'), look.cloudDrift)
    fullscreen()

    // --- 4. composite -----------------------------------------------------------------
    bindTarget(g, comp)
    g.useProgram(compP.p)
    ground2(compP, cam)
    bindTex(g, 0, lit.tex[0]!, compP.u('uLit'))
    bindTex(g, 1, gbuf.tex[1]!, compP.u('uG1'))
    bindTex(g, 2, gbuf.tex[2]!, compP.u('uG2'))
    bindTex(g, 3, lights.tex[0]!, compP.u('uL0'))
    bindTex(g, 4, tilesLinT, compP.u('uTilesLin'))
    bindTex(g, 5, fxT, compP.u('uFx'))
    bindTex(g, 6, skyT, compP.u('uSky'))
    g.uniform2f(compP.u('uMap'), f.mapW, f.mapH)
    g.uniform2f(compP.u('uOrg'), f.mapX, f.mapY)
    g.uniform4f(compP.u('uInner'), f.inner.x, f.inner.y, f.inner.w, f.inner.h)
    g.uniform1f(compP.u('uFar'), f.far)
    g.uniform4f(compP.u('uRect'), R.x, R.y, R.w, R.h)
    g.uniform2f(compP.u('uLScale'), lscale, lscale)
    g.uniform1f(compP.u('uTime'), f.time)
    g.uniform1f(compP.u('uK'), cam.k)
    g.uniform1f(compP.u('uMirror'), look.mirror)
    g.uniform1f(compP.u('uHaze'), f.outdoors ? look.haze : 0)
    g.uniform3f(compP.u('uHazeColor'), look.hazeColor[0], look.hazeColor[1], look.hazeColor[2])
    g.uniform3f(compP.u('uSkyTop'), look.skyTop[0], look.skyTop[1], look.skyTop[2])
    g.uniform3f(compP.u('uSkyHorizon'), look.skyHorizon[0], look.skyHorizon[1], look.skyHorizon[2])
    g.uniform1f(compP.u('uSkyOn'), look.sky ? 1 : 0)
    g.uniform3f(compP.u('uVoid'), f.voidColor[0], f.voidColor[1], f.voidColor[2])
    g.uniform1f(compP.u('uColorBits'), look.colorBits)
    g.uniform1f(compP.u('uWater'), look.water)
    g.uniform3f(compP.u('uCast'), f.cast[0], f.cast[1], f.cast[2])
    g.uniform1f(compP.u('uWet'), look.wet)
    g.uniform1f(compP.u('uMist'), look.mist)
    g.uniform3f(compP.u('uMistColor'), look.mistColor[0], look.mistColor[1], look.mistColor[2])
    g.uniform1f(compP.u('uRays'), look.rays)
    fullscreen()

    // --- 5. bloom and the finish ---------------------------------------------------------
    if (look.bloom > 0) {
      bindTarget(g, bloomA)
      g.useProgram(brightP.p)
      bindTex(g, 0, comp.tex[0]!, brightP.u('uSrc'))
      g.uniform2f(brightP.u('uTexel'), 1 / cam.sw, 1 / cam.sh)
      fullscreen()
      g.useProgram(blurP.p)
      const blur = (src: Target, dst: Target, dx: number, dy: number) => {
        bindTarget(g, dst)
        bindTex(g, 0, src.tex[0]!, blurP.u('uSrc'))
        g.uniform2f(blurP.u('uStep'), dx / src.w, dy / src.h)
        g.uniform2f(blurP.u('uDst'), dst.w, dst.h)
        fullscreen()
      }
      blur(bloomA, bloomA2, 1, 0)
      blur(bloomA2, bloomA, 0, 1)
      blur(bloomA, bloomB2, 1, 0)
      blur(bloomB2, bloomB, 0, 1)
      blur(bloomB, bloomB2, 1.6, 0)
      blur(bloomB2, bloomB, 0, 1.6)
    }
    bindTarget(g, null, f.W, f.H)
    g.useProgram(finishP.p)
    bindTex(g, 0, comp.tex[0]!, finishP.u('uScene'))
    bindTex(g, 1, bloomA.tex[0]!, finishP.u('uBloomA'))
    bindTex(g, 2, bloomB.tex[0]!, finishP.u('uBloomB'))
    g.uniform2f(finishP.u('uScreen'), f.W, f.H)
    g.uniform2f(finishP.u('uSize'), cam.sw, cam.sh)
    g.uniform1f(finishP.u('uHs'), f.hs)
    g.uniform2f(finishP.u('uOff'), f.offX, f.offY)
    g.uniform1f(finishP.u('uBloom'), look.bloom)
    g.uniform1f(finishP.u('uVignette'), look.vignette)
    g.uniform1f(finishP.u('uScan'), look.scanlines)
    g.uniform1f(finishP.u('uScanStep'), f.scanStep)
    g.uniform1f(finishP.u('uFade'), f.fade)
    g.uniform3f(finishP.u('uFadeTo'), 11 / 255, 6 / 255, 22 / 255)
    g.uniform1f(finishP.u('uMosaic'), f.mosaic)
    g.uniform1f(finishP.u('uWave'), f.wave)
    g.uniform1f(finishP.u('uTime'), f.time)
    g.uniform3f(finishP.u('uIris'), f.iris[0], f.iris[1], f.iris[2])
    fullscreen()
    g.bindVertexArray(null)
  }

  return {
    canvas,
    directional,
    flat: c => upload(gl, flatT, c),
    objs: c => upload(gl, objsT, c),
    atlas: (c, h) => uploadPart(gl, atlasT, c, c.width, h),
    fx: c => upload(gl, fxT, c),
    sky: c => upload(gl, skyT, c),
    flora(albedo, normal) { upload(gl, floraT, albedo); upload(gl, floraNT, normal) },
    figure(albedo, normal, w, h) {
      for (const [t, data] of [[figT, albedo], [figNT, normal]] as const) {
        gl.bindTexture(gl.TEXTURE_2D, t.t)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        // Colour and alpha as they are: the shader multiplies, and a normal's alpha is its glow.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        if (t.w !== w || t.h !== h) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
          t.w = w
          t.h = h
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data)
      }
    },
    tiles(data, w, h) {
      for (const t of [tilesT, tilesLinT] as Tex[]) {
        gl.bindTexture(gl.TEXTURE_2D, t.t)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        // These are numbers, not a picture: nothing is multiplied into them.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
        t.w = w
        t.h = h
      }
    },
    draw,
    ready(block = false) {
      if (built === 'wait') built = programsReady(gl, programs, block)
      return built
    },
    lost: () => contextLost || gl.isContextLost(),
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext() },
  }
}
