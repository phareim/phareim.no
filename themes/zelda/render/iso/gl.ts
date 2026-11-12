/**
 * The little WebGL2 the 16-bit view needs: programs, textures, render
 * targets. Nothing here knows the game.
 */
export type GL = WebGL2RenderingContext

export interface Program {
  p: WebGLProgram
  /** A uniform's location, looked up once. */
  u(name: string): WebGLUniformLocation | null
}

export function program(gl: GL, vs: string, fs: string, attribs: readonly string[] = []): Program {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) ?? ''
      gl.deleteShader(s)
      throw new Error(`shader: ${log}\n${src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`)
    }
    return s
  }
  const p = gl.createProgram()!
  const v = make(gl.VERTEX_SHADER, vs)
  const f = make(gl.FRAGMENT_SHADER, fs)
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a))
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(p)}`)
  const locs = new Map<string, WebGLUniformLocation | null>()
  return {
    p,
    u(name) {
      let l = locs.get(name)
      if (l === undefined) { l = gl.getUniformLocation(p, name); locs.set(name, l) }
      return l
    },
  }
}

export interface Tex { t: WebGLTexture; w: number; h: number }

export interface TexOptions {
  /** gl.RGBA8 unless given. */
  internal?: number
  format?: number
  type?: number
  linear?: boolean
  repeat?: boolean
}

export function texture(gl: GL, w: number, h: number, o: TexOptions = {}): Tex {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  const filter = o.linear ? gl.LINEAR : gl.NEAREST
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  const wrap = o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  const tex: Tex = { t, w: 0, h: 0 }
  resizeTexture(gl, tex, w, h, o)
  return tex
}

export function resizeTexture(gl: GL, tex: Tex, w: number, h: number, o: TexOptions = {}): void {
  if (tex.w === w && tex.h === h) return
  tex.w = w
  tex.h = h
  gl.bindTexture(gl.TEXTURE_2D, tex.t)
  gl.texImage2D(gl.TEXTURE_2D, 0, o.internal ?? gl.RGBA8, w, h, 0, o.format ?? gl.RGBA, o.type ?? gl.UNSIGNED_BYTE, null)
}

/** Put a canvas (or raw bytes) into a texture, as it is: row 0 at the top. */
export function upload(gl: GL, tex: Tex, src: HTMLCanvasElement | OffscreenCanvas): void {
  gl.bindTexture(gl.TEXTURE_2D, tex.t)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  if (tex.w !== src.width || tex.h !== src.height) {
    tex.w = src.width
    tex.h = src.height
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src)
  } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src)
}

export interface Target { fb: WebGLFramebuffer; tex: Tex[]; depth: WebGLRenderbuffer | null; w: number; h: number; opts: TexOptions[]; withDepth: boolean }

/** A render target with one or more colour textures and, if asked, a depth buffer. */
export function target(gl: GL, w: number, h: number, opts: TexOptions[], withDepth = false): Target {
  const fb = gl.createFramebuffer()!
  const t: Target = { fb, tex: opts.map(o => texture(gl, 1, 1, o)), depth: withDepth ? gl.createRenderbuffer() : null, w: 0, h: 0, opts, withDepth }
  resizeTarget(gl, t, w, h)
  return t
}

export function resizeTarget(gl: GL, t: Target, w: number, h: number): void {
  w = Math.max(1, Math.round(w))
  h = Math.max(1, Math.round(h))
  if (t.w === w && t.h === h) return
  t.w = w
  t.h = h
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
  t.tex.forEach((tex, i) => {
    resizeTexture(gl, tex, w, h, t.opts[i])
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex.t, 0)
  })
  if (t.depth) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth)
  }
  gl.drawBuffers(t.tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i))
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

export function targetOk(gl: GL, t: Target): boolean {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return ok
}

export function bindTarget(gl: GL, t: Target | null, w = 0, h = 0): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null)
  gl.viewport(0, 0, t ? t.w : w, t ? t.h : h)
}

export function bindTex(gl: GL, unit: number, tex: Tex | WebGLTexture, loc: WebGLUniformLocation | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, (tex as Tex).t ?? (tex as WebGLTexture))
  gl.uniform1i(loc, unit)
}

/** '#rrggbb' as 0..1. */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
