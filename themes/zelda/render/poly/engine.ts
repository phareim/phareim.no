/**
 * The polygon view's machine: WebGL2 drawing triangles into a picture the
 * size of the classic scene (one px to the classic px), the way a 1996
 * console drew them. Knows nothing of the game: `view.ts` hands it geometry
 * (`mesh.ts`'s vertices), pictures and a few numbers.
 *
 * What makes it that machine, each a value of the look (`PolyLook`), so a
 * later look can turn it the other way:
 * - textures are read texel by texel, never filtered, no mipmaps;
 * - texture coordinates run straight across the screen between a triangle's
 *   corners instead of in perspective (`affine`): the textures swim;
 * - every corner lands on a whole px (`snap`): the polygons wobble;
 * - light is worked out at the corners and runs across the triangle, and a
 *   triangle has one normal, so the facets show;
 * - 32 768 colours with an ordered dither between them (`bits`);
 * - the world ends a short way off, dissolving in dithered steps (`far`).
 */
import { bindTex, program, programsReady, rgb, type GL, type Program, type Tex, texture, upload, uploadPart } from '../iso/gl'
import { AT, STRIDE } from './mesh'
import type { Mat4 } from './camera'

export interface Lamp { x: number; y: number; z: number; r: number; c: [number, number, number] }

export interface PolyLook {
  /** 0 perspective-correct textures … 1 affine. */
  affine: number
  /** 0 … 1: how far a corner is pulled onto the px grid. */
  snap: number
  /** Colour bits a channel: 5 is the 15-bit machine, 8 full colour. */
  bits: number
  /** Materials over the classic ground, 0 … 1 (the turn brings them in). */
  materials: number
  /** How far the border between two grounds frays, 0 … 1. */
  fray: number
  /** How much a lamp lights only what faces it. */
  side: number
  /** How dark the sun's shadows lie, 0 … 1. */
  shadow: number
  /** The eye distance (tiles) where the world begins to dissolve, and where it is gone. */
  far: [number, number]
  /** The colour the distance takes on before it dissolves. */
  haze: [number, number, number]
  /** How much of that colour, at the edge. */
  hazeAmount: number
}

export interface Frame {
  m: Mat4
  /** The eye, world tiles (for the distance), and the land's lift and the turn's own-height multipliers (GROW, SINK, RISE, FALL). */
  eye: [number, number, number]
  lift: number
  roles: [number, number, number, number]
  ambient: [number, number, number]
  sunDir: [number, number, number]
  sunColor: [number, number, number]
  lamps: Lamp[]
  /** The region the classic pictures cover: map px origin and size. */
  region: [number, number, number, number]
  /** The field the kind map covers: tile origin. */
  field: [number, number]
  /** The shore field: world origin, lattice points per tile. */
  shore: [number, number, number]
  /** The room drawn (tiles), or none: what lies outside dissolves to black. */
  room: [number, number, number, number] | null
  /** The hero on the screen (px, from the top), how far they reach on it (px), and their eye distance: what stands nearer over them is stippled. */
  hero: [number, number, number, number] | null
  time: number
  look: PolyLook
  chunks: Array<{ buf: WebGLBuffer; count: number }>
  dynamic: { data: Float32Array; count: number }
  blobs: { data: Float32Array; count: number }
}

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aGround;
layout(location=2) in vec3 aNormal;
layout(location=3) in vec2 aUv;
layout(location=4) in float aTex;
layout(location=5) in vec3 aColor;
layout(location=6) in float aSun;
layout(location=7) in float aRole;
layout(location=8) in float aFlags;
layout(location=9) in float aZk;
uniform mat4 uM;
uniform vec2 uView;
uniform vec3 uEye;
uniform float uLift;
uniform vec4 uRoles;
uniform float uSnap;
uniform vec3 uAmbient;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uShadow;
uniform int uLampN;
uniform vec4 uLampPos[16];
uniform vec3 uLampCol[16];
uniform float uSide;
out vec3 vUvw;
out vec2 vUv;
out vec3 vLight;
out vec3 vColor;
out float vDist;
out vec2 vWorld;
flat out int vTex;
flat out int vFlags;
void main() {
  float m = aRole < 0.5 ? 1.0 : aRole < 1.5 ? uRoles.x : aRole < 2.5 ? uRoles.y : aRole < 3.5 ? uRoles.z : uRoles.w;
  vec3 p = vec3(aPos.xy, aPos.z * m + (aGround + aZk) * uLift);
  vec4 c = uM * vec4(p, 1.0);
  // The machine had no fractions of a px: every corner lands on one.
  if (uSnap > 0.0 && c.w > 0.0) {
    vec2 px = (c.xy / c.w * 0.5 + 0.5) * uView;
    px = mix(px, floor(px) + 0.5, uSnap);
    c.xy = (px / uView * 2.0 - 1.0) * c.w;
  }
  gl_Position = c;
  // (Interpolated in perspective, uv·w over w is uv run straight across the screen: affine mapping.)
  float w = max(c.w, 1e-4);
  vUvw = vec3(aUv * w, w);
  vUv = aUv;
  vColor = aColor;
  vTex = int(aTex + 0.5);
  vFlags = int(aFlags + 0.5);
  vDist = length(p - uEye);
  vWorld = aPos.xy;
  // The light, at the corners.
  vec3 n = normalize(aNormal);
  // The sky lights from above and a little from the north-west, so every facet of a knoll takes its own share.
  float sky = 0.12 + 1.08 * max(0.0, dot(n, normalize(vec3(-0.55, -0.2, 0.81))));
  float inSun = mix(1.0, aSun, uShadow);
  vec3 L = uAmbient * sky * mix(1.0, 0.62 + 0.38 * aSun, uShadow);
  L += uSunCol * max(0.0, dot(n, uSunDir)) * inSun;
  for (int i = 0; i < 16; i++) {
    if (i >= uLampN) break;
    vec3 d = uLampPos[i].xyz - p;
    float dist = length(d);
    float a = clamp(1.0 - dist / uLampPos[i].w, 0.0, 1.0);
    if (a <= 0.0) continue;
    float face = mix(1.0, clamp(dot(n, d / max(dist, 1e-3)) * 1.3 + 0.25, 0.0, 1.0), uSide);
    L += uLampCol[i] * a * a * (3.0 - 2.0 * a) * face;
  }
  vLight = L;
}`

const FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vUvw;
in vec2 vUv;
in vec3 vLight;
in vec3 vColor;
in float vDist;
in vec2 vWorld;
flat in int vTex;
flat in int vFlags;
uniform sampler2D uMats;
uniform sampler2D uObjs;
uniform sampler2D uBase;
uniform sampler2D uAtlas;
uniform sampler2D uKind;
uniform sampler2D uShore;
uniform vec4 uRegion;
uniform vec2 uField;
uniform vec3 uShoreAt;
uniform float uAffine;
uniform float uMat;
uniform float uFray;
uniform float uTime;
uniform vec2 uFar;
uniform vec3 uHaze;
uniform float uHazeK;
uniform vec4 uRoom;
uniform int uRoomOn;
uniform vec4 uHero;
uniform float uBits;
uniform int uBlob;
out vec4 o;

float bayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 fetchPic(sampler2D s, vec2 px) {
  vec2 q = floor(px) - uRegion.xy;
  if (q.x < 0.0 || q.y < 0.0 || q.x >= uRegion.z || q.y >= uRegion.w) return vec4(0.0);
  return texelFetch(s, ivec2(q), 0);
}
vec4 kindAt(vec2 w) {
  ivec2 k = ivec2(floor(w) - uField);
  ivec2 size = textureSize(uKind, 0);
  if (k.x < 0 || k.y < 0 || k.x >= size.x || k.y >= size.y) return vec4(0.0);
  return texelFetch(uKind, k, 0);
}
vec3 matAt(float idx, vec2 w) {
  vec2 t = mod(floor(w * 16.0), 64.0);
  return texelFetch(uMats, ivec2(t) + ivec2(int(idx) * 64, 0), 0).rgb;
}
void main() {
  // (People and things are sprites: the machine drew those straight, not as warped polygons.)
  vec2 uv = vTex == 3 ? vUv : mix(vUv, vUvw.xy / vUvw.z, uAffine);
  vec4 c = vec4(1.0);
  vec3 glow = vec3(0.0);
  if (vTex == 1) {
    // The ground: its material by kind, the border between two kinds frayed a texel at a time.
    vec2 tq = floor(uv * 16.0);
    vec4 k = kindAt(uv);
    vec2 j = vec2(hash(tq), hash(tq + 17.0)) - 0.5;
    vec4 kj = kindAt(uv + j * 0.5 * uFray);
    float idx = k.r * 255.0;
    if (idx > 0.5 && kj.r * 255.0 > 0.5) idx = kj.r * 255.0;
    vec4 base = fetchPic(uBase, uv * 16.0);
    vec3 col = base.a > 0.5 ? base.rgb : matAt(max(idx - 1.0, 0.0), uv);
    if (idx > 0.5) col = mix(col, matAt(idx - 1.0, uv), uMat);
    // What the classic art lays on the ground, unless something stands there in its place.
    float bare = k.g * 255.0;
    float fy = fract(uv.y) * 16.0;
    if (bare < 0.5 || (bare < 1.5 && fy < 6.0)) {
      vec4 ob = fetchPic(uObjs, uv * 16.0);
      col = col * (1.0 - ob.a) + ob.rgb;
    }
    c = vec4(col, 1.0);
  } else if (vTex == 2) {
    c = fetchPic(uObjs, uv);
  } else if (vTex == 6) {
    c = fetchPic(uBase, uv);
  } else if (vTex == 3) {
    c = texelFetch(uAtlas, ivec2(floor(uv)), 0);
  } else if (vTex == 4) {
    // Water: deep indigo, crests that run, glints, and at the shore foam (or a pool's neon rim).
    vec2 q = floor(uv * 16.0) / 16.0;
    float t = uTime;
    float wave = sin(q.x * 2.3 + q.y * 0.9 + t * 1.4) * sin(q.y * 3.1 - t * 0.8 + q.x * 0.5);
    vec3 col = vec3(0.055, 0.09, 0.30);
    if (wave > 0.42) col = vec3(0.09, 0.16, 0.44);
    if (wave > 0.78) col = vec3(0.16, 0.30, 0.62);
    if (hash(q * 7.0 + floor(t * 2.5)) > 0.992) glow = vec3(0.45, 0.95, 1.0);
    vec2 sp = (uv - uShoreAt.xy) * uShoreAt.z + 0.5;
    float s = texture(uShore, sp / vec2(textureSize(uShore, 0))).r * 4.0 - 2.0;
    float b = bayer(gl_FragCoord.xy);
    if (vColor.r > 0.5) {
      if (s > -0.07) glow = vec3(0.18, 0.95, 1.0);
      else if (s > -0.16 && b > 0.5) col = vec3(0.12, 0.45, 0.7);
    } else if (s > -0.06 + 0.04 * sin(q.x * 9.0 + t * 2.0) || (s > -0.14 && b > 0.62)) col = vec3(0.62, 0.84, 1.0);
    c = vec4(col, 1.0);
  } else if (vTex == 5) {
    float d = length(uv);
    if (d > 1.0 || (d > 0.72 && bayer(gl_FragCoord.xy) > 0.5)) discard;
    o = vec4(vec3(vColor.r), 1.0);
    return;
  } else if (vTex >= 10) {
    vec2 t = mod(floor(uv), 64.0);
    c = vec4(texelFetch(uMats, ivec2(t) + ivec2((vTex - 10) * 64, 0), 0).rgb, 1.0);
  }
  if (c.a < 0.5) discard;
  vec3 tex = c.rgb / max(c.a, 1e-3);
  vec3 lit = tex * (vTex == 4 ? vec3(1.0) : vColor) * (vTex == 4 ? 0.55 + 0.6 * vLight : vLight);
  if ((vFlags & 2) != 0) lit = max(lit, tex * vColor);
  // Neon in the classic art shines by itself.
  float hi = max(tex.r, max(tex.g, tex.b));
  float lo = min(tex.r, min(tex.g, tex.b));
  if (vTex != 1 && vTex != 4 && hi > 0.78 && hi - lo > 0.42) lit = max(lit, tex * 0.92);
  lit += glow;
  float b = bayer(gl_FragCoord.xy);
  // A room: what lies outside it is dark.
  if (uRoomOn == 1) {
    vec2 d = max(uRoom.xy - vWorld, vWorld - (uRoom.xy + uRoom.zw));
    if (max(d.x, d.y) > 0.001) discard;
  }
  // The distance: hazed, then gone in dithered steps.
  float fd = clamp((vDist - uFar.x) / max(uFar.y - uFar.x, 1e-3), 0.0, 1.0);
  fd = floor(fd * 5.0) / 5.0;
  if (fd > 0.0 && fd >= b) discard;
  lit = mix(lit, uHaze, fd * uHazeK);
  // What stands between the camera and the hero is seen through.
  if ((vFlags & 1) != 0 && uHero.z > 0.0 && vDist < uHero.w - 0.5) {
    vec2 dd = (gl_FragCoord.xy - uHero.xy) / vec2(uHero.z * 0.7, uHero.z);
    if (dot(dd, dd) < 1.0 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
  }
  // 32 768 colours, the dither between them.
  if (uBits < 7.5) {
    float lv = exp2(uBits) - 1.0;
    lit = floor(clamp(lit, 0.0, 1.0) * lv + b) / lv;
  }
  o = vec4(clamp(lit, 0.0, 1.0), 1.0);
}`

export interface Engine {
  canvas: HTMLCanvasElement
  ready(block?: boolean): 'yes' | 'wait' | 'failed'
  lost(): boolean
  /** A static stretch of geometry, kept on the GPU until it is let go. */
  keep(data: Float32Array, count: number): { buf: WebGLBuffer; count: number }
  drop(c: { buf: WebGLBuffer }): void
  materials(data: Uint8Array, w: number, h: number): void
  objs(c: HTMLCanvasElement, w: number, h: number): void
  base(c: HTMLCanvasElement, w: number, h: number): void
  atlas(c: HTMLCanvasElement, rows: number): void
  kinds(data: Uint8Array, w: number, h: number): void
  shoreField(data: Uint8Array, w: number, h: number): void
  draw(f: Frame, vw: number, vh: number): void
  dispose(): void
}

export function createEngine(): Engine {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, depth: true, preserveDrawingBuffer: false }) as GL | null
  if (!gl) throw new Error('no WebGL2')
  const prog: Program = program(gl, VS, FS)
  const tex = {
    mats: texture(gl, 1, 1),
    objs: texture(gl, 1, 1),
    base: texture(gl, 1, 1),
    atlas: texture(gl, 1, 1),
    kind: texture(gl, 1, 1),
    shore: texture(gl, 1, 1, { linear: true }),
  }
  const dyn = gl.createBuffer()!
  const blobBuf = gl.createBuffer()!
  const vao = gl.createVertexArray()!

  /** Raw bytes into a texture (RGBA8 or R8). */
  function raw(t: Tex, data: Uint8Array, w: number, h: number, r8 = false) {
    gl!.bindTexture(gl!.TEXTURE_2D, t.t)
    gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1)
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl!.texImage2D(gl!.TEXTURE_2D, 0, r8 ? gl!.R8 : gl!.RGBA8, w, h, 0, r8 ? gl!.RED : gl!.RGBA, gl!.UNSIGNED_BYTE, data)
    t.w = w
    t.h = h
  }

  function bindLayout(buf: WebGLBuffer) {
    const g = gl!
    g.bindBuffer(g.ARRAY_BUFFER, buf)
    const s = STRIDE * 4
    const attr = (loc: number, size: number, off: number) => { g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, size, g.FLOAT, false, s, off * 4) }
    attr(0, 3, AT.pos); attr(1, 1, AT.ground); attr(2, 3, AT.normal); attr(3, 2, AT.uv); attr(4, 1, AT.tex)
    attr(5, 3, AT.color); attr(6, 1, AT.sun); attr(7, 1, AT.role); attr(8, 1, AT.flags); attr(9, 1, AT.zk)
  }

  return {
    canvas,
    ready: block => programsReady(gl, [prog], block),
    lost: () => gl.isContextLost(),
    keep(data, count) {
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * STRIDE), gl.STATIC_DRAW)
      return { buf, count }
    },
    drop(c) { gl.deleteBuffer(c.buf) },
    materials(data, w, h) { raw(tex.mats, data, w, h) },
    objs(c, w, h) { uploadPart(gl, tex.objs, c, w, h) },
    base(c, w, h) { uploadPart(gl, tex.base, c, w, h) },
    atlas(c, rows) { uploadPart(gl, tex.atlas, c, c.width, rows) },
    kinds(data, w, h) { raw(tex.kind, data, w, h) },
    shoreField(data, w, h) { raw(tex.shore, data, w, h, true) },
    draw(f, vw, vh) {
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.clearColor(0, 0, 0, 0)
      gl.clearDepth(1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.disable(gl.CULL_FACE)
      gl.disable(gl.BLEND)
      gl.useProgram(prog.p)
      gl.bindVertexArray(vao)
      const u = (n: string) => prog.u(n)
      const L = f.look
      gl.uniformMatrix4fv(u('uM'), false, new Float32Array(f.m))
      gl.uniform2f(u('uView'), vw, vh)
      gl.uniform3f(u('uEye'), ...f.eye)
      gl.uniform1f(u('uLift'), f.lift)
      gl.uniform4f(u('uRoles'), ...f.roles)
      gl.uniform1f(u('uSnap'), L.snap)
      gl.uniform3f(u('uAmbient'), ...f.ambient)
      gl.uniform3f(u('uSunDir'), ...f.sunDir)
      gl.uniform3f(u('uSunCol'), ...f.sunColor)
      gl.uniform1f(u('uShadow'), L.shadow)
      gl.uniform1f(u('uSide'), L.side)
      const n = Math.min(16, f.lamps.length)
      const lp = new Float32Array(64)
      const lc = new Float32Array(48)
      for (let i = 0; i < n; i++) {
        const l = f.lamps[i]!
        lp.set([l.x, l.y, l.z, l.r], i * 4)
        lc.set(l.c, i * 3)
      }
      gl.uniform1i(u('uLampN'), n)
      gl.uniform4fv(u('uLampPos'), lp)
      gl.uniform3fv(u('uLampCol'), lc)
      bindTex(gl, 0, tex.mats, u('uMats'))
      bindTex(gl, 1, tex.objs, u('uObjs'))
      bindTex(gl, 2, tex.base, u('uBase'))
      bindTex(gl, 3, tex.atlas, u('uAtlas'))
      bindTex(gl, 4, tex.kind, u('uKind'))
      bindTex(gl, 5, tex.shore, u('uShore'))
      gl.uniform4f(u('uRegion'), ...f.region)
      gl.uniform2f(u('uField'), ...f.field)
      gl.uniform3f(u('uShoreAt'), ...f.shore)
      gl.uniform1f(u('uAffine'), L.affine)
      gl.uniform1f(u('uMat'), L.materials)
      gl.uniform1f(u('uFray'), L.fray)
      gl.uniform1f(u('uTime'), f.time)
      gl.uniform2f(u('uFar'), ...L.far)
      gl.uniform3f(u('uHaze'), ...L.haze)
      gl.uniform1f(u('uHazeK'), L.hazeAmount)
      gl.uniform1i(u('uRoomOn'), f.room ? 1 : 0)
      gl.uniform4f(u('uRoom'), ...(f.room ?? [0, 0, 0, 0]))
      // (gl_FragCoord runs up from the bottom.)
      gl.uniform4f(u('uHero'), ...(f.hero ? [f.hero[0], vh - f.hero[1], f.hero[2], f.hero[3]] as [number, number, number, number] : [0, 0, 0, 0] as [number, number, number, number]))
      gl.uniform1f(u('uBits'), L.bits)
      for (const c of f.chunks) {
        bindLayout(c.buf)
        gl.drawArrays(gl.TRIANGLES, 0, c.count)
      }
      if (f.dynamic.count) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dyn)
        gl.bufferData(gl.ARRAY_BUFFER, f.dynamic.data.subarray(0, f.dynamic.count * STRIDE), gl.STREAM_DRAW)
        bindLayout(dyn)
        gl.drawArrays(gl.TRIANGLES, 0, f.dynamic.count)
      }
      if (f.blobs.count) {
        // Shadows on the ground: the ground under them darkened, never lit away.
        gl.bindBuffer(gl.ARRAY_BUFFER, blobBuf)
        gl.bufferData(gl.ARRAY_BUFFER, f.blobs.data.subarray(0, f.blobs.count * STRIDE), gl.STREAM_DRAW)
        bindLayout(blobBuf)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.DST_COLOR, gl.ZERO)
        gl.depthMask(false)
        gl.enable(gl.POLYGON_OFFSET_FILL)
        gl.polygonOffset(-2, -4)
        gl.drawArrays(gl.TRIANGLES, 0, f.blobs.count)
        gl.disable(gl.POLYGON_OFFSET_FILL)
        gl.depthMask(true)
        gl.disable(gl.BLEND)
      }
      gl.bindVertexArray(null)
    },
    dispose() {
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    },
  }
}

export { rgb }
