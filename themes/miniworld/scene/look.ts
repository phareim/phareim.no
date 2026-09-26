/**
 * Mini World's look (2026-09-26): the site's pixel look in daylight.
 *
 * The scene renders into a small render target (about 300–400 logical
 * pixels on the short side), a post pass draws a one-pixel outline where
 * depth jumps (the silhouettes of people, houses and trees) and converts to
 * sRGB, and the result is scaled up by a whole number with nearest
 * sampling, so every logical pixel is a crisp k×k block on the screen.
 *
 * Shading is toon (three bands) with a warm sun, a sky/ground hemisphere
 * and hard pixel shadows from a small shadow map around the player
 * (none in low-power mode, where the blob shadow under the feet remains).
 */
import * as THREE from 'three'

// ---------------------------------------------------------------- palette

/** Candy daylight. Hex, sRGB. */
export const C = {
  skyTop: '#4fb2ff',
  skyHor: '#c9f1ff',
  sea: '#3aa6e8',
  seaLight: '#7fd4ff',
  foam: '#eafcff',
  grass: '#7fe0a0',
  grass2: '#6fd494',
  grassDark: '#52bf7e',
  sand: '#ffe3a3',
  sand2: '#ffd98a',
  road: '#c9c0dd',
  road2: '#bdb3d4',
  plaza: '#ffd0e4',
  plaza2: '#fff0f6',
  fair: '#ffe9b8',
  fair2: '#ffd6e8',
  path: '#f2d6a8',
  trunk: '#a8704a',
  leaf: '#4fc46f',
  leaf2: '#7fe07f',
  pink: '#ff8ac8',
  candy: '#ff5fa8',
  yellow: '#ffd84f',
  mint: '#7ff0c8',
  lilac: '#b89aff',
  sky: '#8fd8ff',
  white: '#fff8fc',
  stone: '#e4dcf4',
  stone2: '#cfc4e8',
  red: '#ff4f6f',
  orange: '#ff9f3f',
  wood: '#d6955e',
  dark: '#3a2c4a',
  window: '#aee8ff',
  lamp: '#fff4b0',
} as const

export type Hex = string

// ---------------------------------------------------------------- materials

let gradient: THREE.DataTexture | null = null

/** Three soft bands: shade, mid, lit. Shared by every toon material. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255])
  gradient = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

/** The material for merged, vertex-coloured blocks. */
export function blockMaterial(opts: { transparent?: boolean } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), transparent: !!opts.transparent })
}

/** Unlit vertex colours: windows, lamp heads, glowing things. */
export function glowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true })
}

export function toon(color: Hex, emissive?: Hex): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: toonGradient() })
  if (emissive) m.emissive = new THREE.Color(emissive)
  return m
}

// ---------------------------------------------------------------- sky

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 top; uniform vec3 hor; uniform vec3 below; uniform vec3 sunDir; uniform vec3 sunCol;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Bands, not a smooth ramp: smooth ramps turn to mush at pixel size.
    float k = floor(smoothstep(-0.02, 0.55, h) * 6.0 + 0.5) / 6.0;
    vec3 col = mix(hor, top, k);
    if (h < -0.02) col = mix(hor, below, clamp(-h * 3.0, 0.0, 1.0));
    float s = dot(d, sunDir);
    if (s > 0.9985) col = sunCol;
    else if (s > 0.996) col = mix(col, sunCol, 0.55);
    else if (s > 0.99) col = mix(col, sunCol, 0.22);
    gl_FragColor = vec4(col, 1.0);
  }`

export interface SkyLook {
  top: Hex
  hor: Hex
  below: Hex
  fog: Hex
  fogNear: number
  fogFar: number
}

export const SKIES: Record<'day' | 'high' | 'room' | 'meadow' | 'stage', SkyLook> = {
  day: { top: C.skyTop, hor: C.skyHor, below: C.sea, fog: '#bfeaff', fogNear: 70, fogFar: 190 },
  /** Obby-himmelen: above the clouds. */
  high: { top: '#3f9cff', hor: '#e6f7ff', below: '#ffffff', fog: '#dff4ff', fogNear: 80, fogFar: 220 },
  room: { top: '#ffd8ec', hor: '#fff0f7', below: '#ffd8ec', fog: '#fff0f7', fogNear: 60, fogFar: 200 },
  meadow: { top: '#5fbcff', hor: '#fff1c4', below: '#7fe0a0', fog: '#e8f6e0', fogNear: 60, fogFar: 160 },
  stage: { top: '#2a1a4c', hor: '#8a4fd0', below: '#2a1a4c', fog: '#5a2f8a', fogNear: 60, fogFar: 160 },
}

export function createSky(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(C.skyTop) },
      hor: { value: new THREE.Color(C.skyHor) },
      below: { value: new THREE.Color(C.sea) },
      sunDir: { value: new THREE.Vector3(0.5, 0.62, 0.35).normalize() },
      sunCol: { value: new THREE.Color('#fff6c8') },
    },
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return mesh
}

export function setSky(sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>, scene: THREE.Scene, look: SkyLook) {
  const u = sky.material.uniforms
  ;(u.top!.value as THREE.Color).set(look.top)
  ;(u.hor!.value as THREE.Color).set(look.hor)
  ;(u.below!.value as THREE.Color).set(look.below)
  const fog = scene.fog as THREE.Fog | null
  if (fog) { fog.color.set(look.fog); fog.near = look.fogNear; fog.far = look.fogFar } else scene.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar)
}

// ---------------------------------------------------------------- lights

export interface Lights {
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  /** Keeps the shadow box around the player, snapped to shadow texels. */
  follow(x: number, y: number, z: number): void
  dispose(): void
}

const SUN_DIR = new THREE.Vector3(0.5, 0.95, 0.35).normalize()

export function createLights(scene: THREE.Scene, shadows: boolean): Lights {
  const hemi = new THREE.HemisphereLight('#d8f2ff', '#ffd0e8', 1.5)
  const sun = new THREE.DirectionalLight('#fff4dc', 2.1)
  sun.position.copy(SUN_DIR).multiplyScalar(60)
  const R = 28
  if (shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    const cam = sun.shadow.camera
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R
    cam.near = 1; cam.far = 160
    sun.shadow.bias = -0.0015
    sun.shadow.normalBias = 0.12
  }
  scene.add(hemi, sun, sun.target)
  const texel = (2 * R) / 1024
  const basisX = new THREE.Vector3(), basisY = new THREE.Vector3(), v = new THREE.Vector3()
  // Light-space axes, for snapping the shadow box to whole texels (no crawl).
  basisX.crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize()
  basisY.crossVectors(SUN_DIR, basisX).normalize()
  return {
    sun, hemi,
    follow(x, y, z) {
      v.set(x, y, z)
      const a = Math.round(v.dot(basisX) / texel) * texel
      const b = Math.round(v.dot(basisY) / texel) * texel
      const c = v.dot(SUN_DIR)
      v.copy(basisX).multiplyScalar(a).addScaledVector(basisY, b).addScaledVector(SUN_DIR, c)
      sun.target.position.copy(v)
      sun.position.copy(v).addScaledVector(SUN_DIR, 70)
      sun.target.updateMatrixWorld()
    },
    dispose() {
      scene.remove(hemi, sun, sun.target)
      sun.shadow.map?.dispose()
      sun.dispose()
      hemi.dispose()
    },
  }
}

// ---------------------------------------------------------------- pipeline

const POST_FRAG = /* glsl */ `
  uniform sampler2D tColor; uniform sampler2D tDepth;
  uniform vec2 texel; uniform float cNear; uniform float cFar; uniform float outline;
  varying vec2 vUv;
  float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * cNear * cFar / (cFar + cNear - z * (cFar - cNear)); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 c = texture2D(tColor, vUv).rgb;
    if (outline > 0.5) {
      float d = lin(texture2D(tDepth, vUv).r);
      float a = lin(texture2D(tDepth, vUv + vec2(texel.x, 0.0)).r);
      float b = lin(texture2D(tDepth, vUv - vec2(texel.x, 0.0)).r);
      float e = lin(texture2D(tDepth, vUv + vec2(0.0, texel.y)).r);
      float f = lin(texture2D(tDepth, vUv - vec2(0.0, texel.y)).r);
      float far = max(max(a, b), max(e, f));
      // This pixel belongs to something standing in front of what is next to it: ink it.
      if (far - d > 0.9 + d * 0.16 && d < cFar * 0.5) c = c * vec3(0.42, 0.36, 0.52);
    }
    gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
  }`

const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const BLIT_FRAG = /* glsl */ `uniform sampler2D tMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(tMap, vUv); }`

export interface Look {
  readonly renderer: THREE.WebGLRenderer
  /** Logical size and whole-number scale. */
  readonly size: { w: number; h: number; k: number }
  resize(cssW: number, cssH: number, dpr: number): void
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void
  dispose(): void
}

export function createLook(canvas: HTMLCanvasElement, opts: { lowPower: boolean }): Look {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: opts.lowPower ? 'low-power' : 'high-performance', stencil: false })
  renderer.setPixelRatio(1)
  renderer.autoClear = true
  renderer.setClearColor(new THREE.Color(C.skyHor), 1)
  if (!opts.lowPower) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.BasicShadowMap
  }
  const makeRT = (depth: boolean) => {
    const rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: depth, generateMipmaps: false,
    })
    if (depth) {
      rt.depthTexture = new THREE.DepthTexture(2, 2)
      rt.depthTexture.minFilter = THREE.NearestFilter
      rt.depthTexture.magFilter = THREE.NearestFilter
    }
    return rt
  }
  const rtScene = makeRT(true)
  const rtPost = makeRT(false)
  const quadGeo = new THREE.PlaneGeometry(2, 2)
  const postMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture },
      texel: { value: new THREE.Vector2(0.5, 0.5) }, cNear: { value: 0.3 }, cFar: { value: 400 }, outline: { value: 1 },
    },
  })
  const blitMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: BLIT_FRAG, depthTest: false, depthWrite: false, uniforms: { tMap: { value: rtPost.texture } } })
  const quad = new THREE.Mesh(quadGeo, postMat)
  quad.frustumCulled = false
  const quadScene = new THREE.Scene()
  quadScene.add(quad)
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const size = { w: 2, h: 2, k: 1 }
  let devW = 2, devH = 2
  const short = opts.lowPower ? 250 : 330

  return {
    renderer,
    size,
    resize(cssW, cssH, dpr) {
      const r = Math.min(3, Math.max(1, dpr || 1))
      devW = Math.max(2, Math.round(cssW * r))
      devH = Math.max(2, Math.round(cssH * r))
      // The largest whole scale that keeps the short side at least `short` logical pixels.
      const k = Math.max(1, Math.floor(Math.min(devW, devH) / short))
      size.k = k
      size.w = Math.ceil(devW / k)
      size.h = Math.ceil(devH / k)
      renderer.setSize(devW, devH, false)
      rtScene.setSize(size.w, size.h)
      rtPost.setSize(size.w, size.h)
      ;(postMat.uniforms.texel!.value as THREE.Vector2).set(1 / size.w, 1 / size.h)
    },
    render(scene, camera) {
      postMat.uniforms.cNear!.value = camera.near
      postMat.uniforms.cFar!.value = camera.far
      renderer.setRenderTarget(rtScene)
      renderer.render(scene, camera)
      quad.material = postMat
      renderer.setRenderTarget(rtPost)
      renderer.render(quadScene, quadCam)
      // Whole-number upscale: the logical image is k× its size, centred, the
      // few overhanging device pixels cropped.
      renderer.setRenderTarget(null)
      const W = size.w * size.k, H = size.h * size.k
      renderer.setViewport(Math.floor((devW - W) / 2), Math.floor((devH - H) / 2), W, H)
      quad.material = blitMat
      renderer.render(quadScene, quadCam)
      renderer.setViewport(0, 0, devW, devH)
    },
    dispose() {
      rtScene.depthTexture?.dispose()
      rtScene.dispose()
      rtPost.dispose()
      postMat.dispose()
      blitMat.dispose()
      quadGeo.dispose()
      renderer.dispose()
    },
  }
}
