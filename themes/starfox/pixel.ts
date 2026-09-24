/**
 * Star Fox in Neon Shrine's pixel look (2026-09-24): the Super FX idea in
 * the portal's paint. The three.js scene renders into a render target at
 * the pixel stage's logical size (~320×200 on a monitor), a post pass
 * snaps every pixel to Neon Shrine's palette with a 4×4 Bayer dither, and
 * the result is handed to the shared 2D stage (themes/base/pixel/stage.ts)
 * as its scene: light map, whole-number upscale, bloom, scanlines and
 * vignette, like every other pixel game. The ground is Neon Shrine's grass
 * and rose path seen from above, drawn by a shader in world space.
 */
import * as THREE from 'three'

// ---------------------------------------------------------------- palette

/** Everything the quantizer may output: Neon Shrine's sprite, sky and terrain colours. */
export const QUANT_PALETTE = [
  // sky, dusk to night
  '#0b0616', '#140b26', '#1c1030', '#2a1a4c', '#43246e', '#6a2a7c', '#a8347e', '#e0508a',
  // sun
  '#fff1b0', '#ffd23f', '#ff8a3d', '#ff2fa0',
  // ridges
  '#2c2058', '#6a4fb0', '#1c1440', '#d0509e',
  // canopy + grass
  '#0f3445', '#1b5763', '#2a8579', '#5fd6b8', '#245573', '#2d6682', '#1b4560', '#163a52', '#3f8fa8', '#6fd2d6',
  // path
  '#7d4d7c', '#9b6593', '#5e3862',
  // stone
  '#3a2f70', '#4a3d88', '#271f50', '#1f1a3c',
  // sprite palette
  '#2ff3ff', '#1a9fc4', '#fff4ff', '#cfc6ff', '#8f86b8', '#5a5285', '#9a4ff0', '#54259e', '#ff8ae0', '#b01874',
  '#c4861c', '#ff3b5c', '#9e1638', '#2f5fd0', '#1a2f78', '#b6ff4a', '#4f9a2a', '#3fd8b0', '#1f7a6e',
  // clay (ember sector)
  '#5b2a1c', '#b0543a', '#e07a4e',
]

function hexVec(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// ---------------------------------------------------------------- sector looks

export interface PixelSector {
  skyTop: string; skyMid: string; skyHor: string
  fog: string
  grass: [string, string, string, string] // base, light patch, dark patch, blade tip
  path: [string, string, string] // base, light, dark
  neon: string
  ridge: string
}

/** Neon Shrine versions of the four sector moods (balance.ts keeps the old tokens). */
export const PIXEL_SECTORS: PixelSector[] = [
  // 1 — the coast at dusk
  { skyTop: '#0b0616', skyMid: '#43246e', skyHor: '#e0508a', fog: '#6a2a7c', grass: ['#245573', '#2d6682', '#1b4560', '#6fd2d6'], path: ['#7d4d7c', '#9b6593', '#5e3862'], neon: '#ff2fa0', ridge: '#2c2058' },
  // 2 — Whisper Woods at night
  { skyTop: '#0b0616', skyMid: '#0f3445', skyHor: '#2a8579', fog: '#1b5763', grass: ['#1b5763', '#2a8579', '#0f3445', '#5fd6b8'], path: ['#4a3d88', '#6a4fb0', '#271f50'], neon: '#3fd8b0', ridge: '#0f3445' },
  // 3 — ember
  { skyTop: '#140b26', skyMid: '#5b2a1c', skyHor: '#ff8a3d', fog: '#b0543a', grass: ['#5e3862', '#7d4d7c', '#3a2f70', '#e07a4e'], path: ['#b0543a', '#e07a4e', '#5b2a1c'], neon: '#ffd23f', ridge: '#5b2a1c' },
  // 4 — Mirror Lake blue
  { skyTop: '#0b0616', skyMid: '#1a2f78', skyHor: '#2f5fd0', fog: '#1a2f78', grass: ['#163a52', '#245573', '#1a2f78', '#6fd2d6'], path: ['#4a3d88', '#8f86b8', '#271f50'], neon: '#2ff3ff', ridge: '#1a2f78' },
]

export function pixelSector(sector: number): PixelSector {
  const s = Math.max(1, Math.floor(sector))
  return PIXEL_SECTORS[(s - 1) % PIXEL_SECTORS.length]!
}

// ---------------------------------------------------------------- ground

const GROUND_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const GROUND_FRAG = /* glsl */ `
  varying vec3 vWorld;
  uniform float uOffset; uniform float uPulse;
  uniform vec3 g0; uniform vec3 g1; uniform vec3 g2; uniform vec3 tip;
  uniform vec3 p0; uniform vec3 p1; uniform vec3 p2;
  uniform vec3 neon; uniform vec3 hor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 w = vec2(vWorld.x, vWorld.z - uOffset);
    // One ground "pixel" is a quarter unit; patches are two units.
    vec2 t = floor(w * 4.0);
    vec2 b = floor(w * 0.5);
    float dist = length(vWorld - cameraPosition);
    float n = hash(b);
    vec3 col = g0;
    // Patches thin out with distance, so the far field stays calm.
    float far = clamp((dist - 40.0) / 80.0, 0.0, 1.0);
    if (n > 0.72 + far * 0.28) col = g1; else if (n < 0.22 - far * 0.22) col = g2;
    // Blades and flowers only up close: far away they would shimmer as noise.
    float near = step(dist, 55.0);
    float blade = hash(t);
    if (near > 0.5) {
      if (blade > 0.992) col = tip;
      else if (blade > 0.982) col = mix(g1, tip, 0.5);
      if (blade < 0.0008) col = vec3(1.0, 0.54, 0.88); // a pink flower now and then
    }
    // The rose path down the flight lane, stones at its edges, a neon strip.
    float ax = abs(w.x);
    if (ax < 3.0) {
      col = p0;
      float s = hash(t + 17.0);
      if (near > 0.5) { if (s > 0.9) col = p1; else if (s < 0.08) col = p2; }
    } else if (ax < 3.5) {
      col = p2;
    } else if (ax < 3.75) {
      float dash = step(0.5, fract(w.y * 0.25));
      col = mix(p2, neon, dash * (0.55 + 0.45 * uPulse));
    }
    // Distance fog in bands, not a smooth ramp: a smooth ramp dithers into static.
    float fade = floor(exp(-dist * 0.011) * 5.0 + 0.5) / 5.0;
    gl_FragColor = vec4(mix(hor, col, fade), 1.0);
  }`

export function createGroundMaterial(): THREE.ShaderMaterial {
  const c = (h: string) => new THREE.Color(h)
  return new THREE.ShaderMaterial({
    depthWrite: false,
    fog: false,
    uniforms: {
      uOffset: { value: 0 }, uPulse: { value: 0 },
      g0: { value: c('#245573') }, g1: { value: c('#2d6682') }, g2: { value: c('#1b4560') }, tip: { value: c('#6fd2d6') },
      p0: { value: c('#7d4d7c') }, p1: { value: c('#9b6593') }, p2: { value: c('#5e3862') },
      neon: { value: c('#ff2fa0') }, hor: { value: c('#6a2a7c') },
    },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  })
}

export function tintGround(mat: THREE.ShaderMaterial, s: PixelSector) {
  const u = mat.uniforms
  ;(u.g0!.value as THREE.Color).set(s.grass[0])
  ;(u.g1!.value as THREE.Color).set(s.grass[1])
  ;(u.g2!.value as THREE.Color).set(s.grass[2])
  ;(u.tip!.value as THREE.Color).set(s.grass[3])
  ;(u.p0!.value as THREE.Color).set(s.path[0])
  ;(u.p1!.value as THREE.Color).set(s.path[1])
  ;(u.p2!.value as THREE.Color).set(s.path[2])
  ;(u.neon!.value as THREE.Color).set(s.neon)
  ;(u.hor!.value as THREE.Color).set(s.fog)
}

// ---------------------------------------------------------------- quantize pass

const QUANT_FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec3 pal[${QUANT_PALETTE.length}];
  uniform float spread;
  varying vec2 vUv;
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = y * 4 + x;
    float m[16];
    m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
    m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
    float v = 0.0;
    for (int k = 0; k < 16; k++) if (k == i) v = m[k];
    return (v + 0.5) / 16.0 - 0.5;
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    vec3 c = toSRGB(clamp(texture2D(tScene, vUv).rgb, 0.0, 1.0));
    c += bayer(gl_FragCoord.xy) * spread;
    vec3 best = pal[0];
    float bd = 1e9;
    for (int i = 0; i < ${QUANT_PALETTE.length}; i++) {
      vec3 d = c - pal[i];
      // Weighted RGB distance (green matters most to the eye).
      float dd = d.r * d.r * 0.30 + d.g * d.g * 0.59 + d.b * d.b * 0.11;
      if (dd < bd) { bd = dd; best = pal[i]; }
    }
    gl_FragColor = vec4(best, 1.0);
  }`

export interface PixelPipeline {
  setSize(w: number, h: number): void
  /** Render the scene at logical size, quantized, into the renderer's canvas. */
  render(scene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}

export function createPixelPipeline(renderer: THREE.WebGLRenderer): PixelPipeline {
  const rt = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  })
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: rt.texture },
      pal: { value: QUANT_PALETTE.map(hexVec) },
      spread: { value: 0.05 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: QUANT_FRAG,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const post = new THREE.Scene()
  post.add(quad)
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  return {
    setSize(w, h) {
      renderer.setPixelRatio(1)
      renderer.setSize(w, h, false)
      rt.setSize(w, h)
    },
    render(scene, camera) {
      renderer.setRenderTarget(rt)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(post, postCam)
    },
    dispose() {
      rt.dispose()
      mat.dispose()
      quad.geometry.dispose()
    },
  }
}

// ---------------------------------------------------------------- lights

const tmp = new THREE.Vector3()

/**
 * Project a world point to logical pixels. Returns null behind the camera.
 * `r` world units become a pixel radius at that depth (clamped).
 */
export function project(camera: THREE.PerspectiveCamera, vw: number, vh: number, x: number, y: number, z: number, r: number, min = 2, max = 60): { x: number; y: number; r: number } | null {
  tmp.set(x, y, z).project(camera)
  if (tmp.z > 1 || tmp.z < -1) return null
  const sx = (tmp.x + 1) * 0.5 * vw
  const sy = (1 - tmp.y) * 0.5 * vh
  const dist = camera.position.distanceTo(tmp.set(x, y, z))
  const pxPerUnit = vh / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.1, dist))
  return { x: sx, y: sy, r: Math.max(min, Math.min(max, r * pxPerUnit)) }
}
