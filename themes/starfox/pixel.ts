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
import type { BiomeId } from './story'

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
  // Biome modes (2026-09-25): 0 grass, 1 sea, 2 woods, 3 ember, 4 lake, 5 space (no ground).
  uniform float uMode; uniform float uTime; uniform float uPath;
  uniform vec3 sTop; uniform vec3 sMid; uniform vec3 sHor; uniform vec3 ridgeC; uniform vec3 sunC;
  uniform vec3 uSunDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 skyAt(float h) {
    vec3 col = mix(sHor, sMid, smoothstep(0.0, 0.32, h));
    return mix(col, sTop, smoothstep(0.28, 0.85, h));
  }

  vec3 grassGround(vec2 w, vec2 t, float dist, float near) {
    vec2 b = floor(w * 0.5);
    float n = hash(b);
    vec3 col = g0;
    // Patches thin out with distance, so the far field stays calm.
    float far = clamp((dist - 40.0) / 80.0, 0.0, 1.0);
    if (n > 0.72 + far * 0.28) col = g1; else if (n < 0.22 - far * 0.22) col = g2;
    // Blades and flowers only up close: far away they would shimmer as noise.
    float blade = hash(t);
    if (near > 0.5) {
      if (blade > 0.992) col = tip;
      else if (blade > 0.982) col = mix(g1, tip, 0.5);
      if (blade < 0.0008) col = vec3(1.0, 0.54, 0.88); // a pink flower now and then
    }
    return col;
  }

  // Sea: swell bands rolling toward the ship, foam on the crests, sun glitter.
  vec3 seaGround(vec2 w, vec2 t, float dist, float near, vec3 view) {
    vec2 q = (t + 0.5) * 0.25;
    float ph = q.y * 0.55 + sin(q.x * 0.21 + uTime * 0.5) * 1.4 + uTime * 1.3;
    float wave = sin(ph);
    float far = clamp((dist - 50.0) / 90.0, 0.0, 1.0);
    vec3 col = g0;
    if (wave > 0.62 + far * 0.3) col = g1;
    else if (wave < -0.55 - far * 0.4) col = g2;
    if (near > 0.5 && wave > 0.93 && hash(floor(q * 1.5)) > 0.35) col = tip;
    // Glitter: the sun's reflection, sparkling pixels along its path.
    vec3 r = vec3(view.x, -view.y, view.z);
    float g = dot(r, uSunDir);
    float sp = hash(t + floor(uTime * 7.0) * 13.0);
    if (g > 0.985 && sp > 0.55) col = sunC;
    else if (g > 0.95 && sp > 0.9) col = tip;
    return col;
  }

  // Woods from above: round crowns lit from the north-west, dark gaps, glow spores.
  vec3 woodsGround(vec2 w, vec2 t, float dist, float near) {
    vec2 q = (t + 0.5) * 0.25;
    vec2 cell = floor(q / 3.2);
    vec3 col = g2;
    float best = 9.0; vec2 bd = vec2(0.0); float bh = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 o = (c + 0.5 + (vec2(hash(c), hash(c + 7.1)) - 0.5) * 0.5) * 3.2;
      float rad = 1.5 + hash(c + 3.3) * 0.7;
      vec2 d = (q - o) / rad;
      float k = length(d);
      // The nearer crown (in its own size) wins, so crowns overlap in layers.
      if (k < 1.0 && (best >= 1.0 || hash(c + 9.9) > bh)) { best = k; bd = d; bh = hash(c + 9.9); }
    }
    if (best < 1.0) {
      float lit = dot(bd, normalize(vec2(-0.7, -0.7)));
      col = g0;
      if (lit > 0.35 && best > 0.2) col = g1;
      if (lit < -0.45 && best > 0.55) col = mix(g0, g2, 0.6);
      if (best > 0.9) col = mix(g0, g2, 0.6);
      if (near > 0.5 && hash(t) > 0.985) col = g1;
    }
    // Spores drift up out of the gaps: sparse, blinking.
    float s = hash(t * 1.37 + floor(uTime * 1.2 + hash(floor(t / 6.0)) * 5.0) * 17.0);
    if (dist < 110.0 && s > 0.9985) col = tip;
    return col;
  }

  // Ember: basalt plates (a Voronoi field) split by glowing lava veins that breathe.
  vec3 emberGround(vec2 w, vec2 t, float dist, float near) {
    vec2 q = (t + 0.5) * 0.25 / 2.6;
    vec2 cell = floor(q);
    float f1 = 9.0; float f2 = 9.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 o = c + vec2(hash(c), hash(c + 5.3)) * 0.8 + 0.1;
      float d = length(q - o);
      if (d < f1) { f2 = f1; f1 = d; id = c; } else if (d < f2) { f2 = d; }
    }
    float e = f2 - f1;
    float n = hash(id);
    vec3 col = n > 0.66 ? g1 : (n < 0.3 ? g2 : g0);
    float pulse = 0.5 + 0.5 * sin(uTime * 2.2 + n * 6.0);
    float farK = 1.0 - clamp((dist - 30.0) / 120.0, 0.0, 0.75);
    float wide = (0.035 + 0.025 * pulse) * farK;
    if (e < wide) col = e < wide * 0.45 ? tip : p0;
    else if (e < wide + 0.04 * farK) col = p2;
    if (n > 0.965) col = hash(t + floor(uTime * 3.0)) > 0.8 ? tip : p0; // a lava pool
    else if (near > 0.5 && hash(t) > 0.995) col = p1; // an ember
    return col;
  }

  // Lake: a mirror of the sky and the ridges, with a slow shimmer.
  vec3 lakeGround(vec2 w, vec2 t, float dist, float near, vec3 view) {
    vec3 r = vec3(view.x, -view.y, view.z);
    vec2 q = (t + 0.5) * 0.25;
    float rip = sin(q.y * 1.7 + uTime * 1.4 + sin(q.x * 0.5) * 2.0);
    float h = r.y + rip * 0.006;
    float az = atan(r.x, -r.z);
    float ridge = 0.05 + 0.06 * abs(sin(az * 3.1 + 0.6)) + 0.035 * abs(sin(az * 9.3 + 1.0)) + 0.015 * abs(sin(az * 23.0));
    vec3 col = skyAt(h);
    if (h < ridge) col = ridgeC;
    if (h < ridge * 0.45) col = mix(ridgeC, g2, 0.5);
    if (dot(r, uSunDir) > 0.994 && fract(h * 90.0) > 0.4) col = sunC;
    // Shimmer lines and a little depth up close.
    if (rip > 0.97 && hash(floor(q * vec2(0.5, 4.0))) > 0.5) col = mix(col, tip, 0.6);
    col = mix(col, g0, 0.18);
    return col;
  }

  void main() {
    int mode = int(uMode + 0.5);
    if (mode == 5) discard;
    vec2 w = vec2(vWorld.x, vWorld.z - uOffset);
    // One ground "pixel" is a quarter unit.
    vec2 t = floor(w * 4.0);
    float dist = length(vWorld - cameraPosition);
    vec3 view = normalize(vWorld - cameraPosition);
    float near = step(dist, 55.0);
    vec3 col;
    if (mode == 1) col = seaGround(w, t, dist, near, view);
    else if (mode == 2) col = woodsGround(w, t, dist, near);
    else if (mode == 3) col = emberGround(w, t, dist, near);
    else if (mode == 4) col = lakeGround(w, t, dist, near, view);
    else col = grassGround(w, t, dist, near);
    // The path down the flight lane, stones at its edges, a neon strip.
    if (uPath > 0.5) {
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
    } else if (uPath < -0.5) {
      // Buoy line: neon marks down both edges of the lane, beating with the music.
      float ax = abs(abs(w.x) - 11.5);
      if (ax < 0.25 && fract(w.y * 0.0625) < 0.12) col = mix(p2, neon, 0.55 + 0.45 * uPulse);
    }
    // Distance fog in bands, not a smooth ramp: a smooth ramp dithers into static.
    float fog = mode == 4 ? 0.0035 : 0.011;
    float fade = floor(exp(-dist * fog) * 5.0 + 0.5) / 5.0;
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
      // Biome uniforms; the defaults are the grass mode with its rose path.
      uMode: { value: 0 }, uTime: { value: 0 }, uPath: { value: 1 },
      sTop: { value: c('#0b0616') }, sMid: { value: c('#43246e') }, sHor: { value: c('#e0508a') },
      ridgeC: { value: c('#2c2058') }, sunC: { value: c('#fff1b0') },
      uSunDir: { value: new THREE.Vector3(300, 26, -471).normalize() },
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

// ---------------------------------------------------------------- biomes

// The one BiomeId union lives in story.ts (the sector table); re-exported here for the renderer.
export type { BiomeId }

export const BIOME_IDS: readonly BiomeId[] = ['coast', 'woods', 'ember', 'lake', 'space']

/** Ground shader modes. 'grass' is the old look (PIXEL_SECTORS + tintGround). */
export const GROUND_MODES = { grass: 0, sea: 1, woods: 2, ember: 3, lake: 4, space: 5 } as const

/**
 * A biome's whole look: sky, fog, ridges and ground. The ground colours
 * mean different things per mode (sea: base/crest/trough/foam; woods:
 * crown/lit crown/gap/spore; ember: basalt/light basalt/dark basalt/lava
 * core, with `path` as lava/ember/vein rim; lake: water tint for the mirror).
 */
export interface BiomeLook extends PixelSector {
  mode: number
  /** 1 a path down the lane (grass look), 0 none, −1 neon buoy lines at the lane edges. */
  path: [string, string, string]
  lanePath: 1 | 0 | -1
  /** Star density on the sky, 0–1. */
  stars: number
  /** Nebula colours on the sky (space), or null. */
  nebula: [string, string] | null
  /** A ringed planet far below the horizon (space). */
  planet: boolean
  /** Whether the flat-shaded ridges and the striped sun belong on the horizon. */
  ridges: boolean
  sun: boolean
  /** Arches, mines and other shared props pick this up (their neon edge). */
  accent: string
  /** Hull tint for ground turrets and girders in this biome. */
  groundTint: string
}

export const BIOMES: Record<BiomeId, BiomeLook> = {
  coast: {
    mode: GROUND_MODES.sea, lanePath: -1,
    skyTop: '#0b0616', skyMid: '#43246e', skyHor: '#e0508a', fog: '#6a2a7c',
    grass: ['#245573', '#2d6682', '#1b4560', '#6fd2d6'], path: ['#7d4d7c', '#9b6593', '#5e3862'],
    neon: '#ff2fa0', ridge: '#2c2058', stars: 0.25, nebula: null, planet: false, ridges: true, sun: true,
    accent: '#ff2fa0', groundTint: '#4a3d88',
  },
  woods: {
    mode: GROUND_MODES.woods, lanePath: 0,
    skyTop: '#0b0616', skyMid: '#0f3445', skyHor: '#2a8579', fog: '#1b5763',
    grass: ['#1b5763', '#2a8579', '#0f3445', '#5fd6b8'], path: ['#4a3d88', '#6a4fb0', '#271f50'],
    neon: '#3fd8b0', ridge: '#0f3445', stars: 0.7, nebula: null, planet: false, ridges: true, sun: false,
    accent: '#3fd8b0', groundTint: '#1b5763',
  },
  ember: {
    mode: GROUND_MODES.ember, lanePath: 0,
    skyTop: '#140b26', skyMid: '#5b2a1c', skyHor: '#ff8a3d', fog: '#b0543a',
    grass: ['#1f1a3c', '#271f50', '#1c1030', '#ffd23f'], path: ['#ff8a3d', '#e07a4e', '#b0543a'],
    neon: '#ffd23f', ridge: '#5b2a1c', stars: 0.1, nebula: null, planet: false, ridges: true, sun: true,
    accent: '#ff8a3d', groundTint: '#5b2a1c',
  },
  lake: {
    mode: GROUND_MODES.lake, lanePath: -1,
    skyTop: '#0b0616', skyMid: '#1a2f78', skyHor: '#2f5fd0', fog: '#1a2f78',
    grass: ['#163a52', '#245573', '#1a2f78', '#6fd2d6'], path: ['#4a3d88', '#8f86b8', '#271f50'],
    neon: '#2ff3ff', ridge: '#1a2f78', stars: 0.8, nebula: null, planet: false, ridges: true, sun: true,
    accent: '#2ff3ff', groundTint: '#8f86b8',
  },
  space: {
    mode: GROUND_MODES.space, lanePath: 0,
    skyTop: '#0b0616', skyMid: '#140b26', skyHor: '#2a1a4c', fog: '#1c1030',
    grass: ['#1c1030', '#2a1a4c', '#0b0616', '#cfc6ff'], path: ['#43246e', '#6a2a7c', '#1c1030'],
    neon: '#9a4ff0', ridge: '#1c1440', stars: 1, nebula: ['#2a1a4c', '#43246e'], planet: true, ridges: false, sun: false,
    accent: '#9a4ff0', groundTint: '#5a5285',
  },
}

/** Put a biome on the ground material (and the sky material, if given). Hard cut, like the sector moods. */
export function setBiome(ground: THREE.ShaderMaterial, id: BiomeId, sky?: THREE.ShaderMaterial | null) {
  const b = BIOMES[id]
  tintGround(ground, b)
  const u = ground.uniforms
  u.uMode!.value = b.mode
  u.uPath!.value = b.lanePath
  ;(u.sTop!.value as THREE.Color).set(b.skyTop)
  ;(u.sMid!.value as THREE.Color).set(b.skyMid)
  ;(u.sHor!.value as THREE.Color).set(b.skyHor)
  // The lake mirrors the ridges as the dark shapes they read as on the horizon.
  ;(u.ridgeC!.value as THREE.Color).set('#1c1440')
  if (sky) setSkyBiome(sky, id)
}

/** Back to the grass look of a PIXEL_SECTORS mood (the pre-biome ground). */
export function setGrass(ground: THREE.ShaderMaterial, s: PixelSector) {
  tintGround(ground, s)
  ground.uniforms.uMode!.value = GROUND_MODES.grass
  ground.uniforms.uPath!.value = 1
}

/** Per-frame biome clock: waves, veins, spores, shimmer and twinkle. */
export function tickBiome(ground: THREE.ShaderMaterial | null, sky: THREE.ShaderMaterial | null, t: number) {
  if (ground) ground.uniforms.uTime!.value = t
  if (sky) sky.uniforms.uTime!.value = t
}

/** Where the sun is, seen from the camera (for the sea's glitter and the lake's reflection). */
export function setSunDir(ground: THREE.ShaderMaterial, x: number, y: number, z: number) {
  ;(ground.uniforms.uSunDir!.value as THREE.Vector3).set(x, y, z).normalize()
}

// ---------------------------------------------------------------- sky

const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const SKY_FRAG = /* glsl */ `
  varying vec3 vPos;
  uniform vec3 top; uniform vec3 mid; uniform vec3 hor;
  uniform float uStars; uniform float uNeb; uniform vec3 neb1; uniform vec3 neb2; uniform float uTime;
  float hash3(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  uniform float uPlanet; uniform vec3 plA; uniform vec3 plB; uniform vec3 plC;
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }
  void main() {
    vec3 d = normalize(vPos);
    float h = d.y;
    vec3 col = mix(hor, mid, smoothstep(0.0, 0.32, h));
    col = mix(col, top, smoothstep(0.28, 0.85, h));
    col = mix(mid, col, smoothstep(-0.25, 0.0, h));
    if (uNeb > 0.0) {
      // Nebula in hard steps (a smooth cloud dithers into static at pixel size).
      float n = noise(d * 4.0) * 0.55 + noise(d * 9.0 + 4.0) * 0.3 + noise(d * 21.0) * 0.15;
      float band = 1.0 - abs(d.y * 2.2 - 0.35 + sin(d.x * 2.6) * 0.4);
      n *= clamp(band, 0.0, 1.0) * uNeb;
      if (n > 0.6) col = neb2; else if (n > 0.47) col = neb1; else if (n > 0.4) col = mix(col, neb1, 0.5);
    }
    if (uPlanet > 0.0) {
      // A ringed planet far below: we are above the sky now.
      vec3 pd = normalize(vec3(-0.55, -0.12, -1.0));
      vec3 ax = normalize(cross(pd, vec3(0.0, 1.0, 0.0)));
      vec3 ay = cross(ax, pd);
      vec2 lp = vec2(dot(d, ax), dot(d, ay)) / 0.23;
      float fwd = dot(d, pd);
      float rr = length(lp);
      // The ring behind and in front of the disc: a tilted ellipse band.
      vec2 rp = vec2(lp.x, (lp.y - lp.x * 0.18) * 4.2);
      float ring = length(rp);
      bool onRing = fwd > 0.0 && ring > 1.35 && ring < 1.85 && fract(ring * 5.0) > 0.25;
      if (fwd > 0.0 && rr < 1.0 && !(onRing && lp.y - lp.x * 0.18 < 0.0)) {
        float band = sin(lp.y * 9.0 + sin(lp.x * 3.0) * 0.8);
        col = band > 0.3 ? plA : plB;
        float shade = dot(lp, normalize(vec2(-0.8, 0.5))) + sqrt(max(0.0, 1.0 - rr * rr)) * 0.2;
        if (shade < -0.35) col = plC;
        if (rr > 0.93 && shade > 0.0) col = plA;
      } else if (onRing) {
        col = lp.x < -0.2 ? plA : plB;
      }
    }
    if (uStars > 0.0 && h > -0.05) {
      vec3 cell = floor(d * 420.0);
      float s = hash3(cell);
      float lim = 1.0 - 0.0035 * uStars * smoothstep(-0.05, 0.25, h);
      if (s > lim) {
        float tw = hash3(cell + floor(uTime * 1.5));
        col = tw > 0.25 ? vec3(0.81, 0.78, 1.0) : vec3(1.0, 0.96, 1.0);
        if (s > 1.0 - 0.0004 * uStars) col = vec3(1.0, 0.82, 0.25);
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }`

/** The dusk sky sphere with stars and a nebula per biome (the lab uses it; Flight still has its own). */
export function createSkyMaterial(): THREE.ShaderMaterial {
  const c = (h: string) => new THREE.Color(h)
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: c('#0b0616') }, mid: { value: c('#43246e') }, hor: { value: c('#e0508a') },
      uStars: { value: 0 }, uNeb: { value: 0 }, neb1: { value: c('#43246e') }, neb2: { value: c('#a8347e') },
      uPlanet: { value: 0 }, plA: { value: c('#e0508a') }, plB: { value: c('#a8347e') }, plC: { value: c('#43246e') },
      uTime: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
  })
}

export function setSkyBiome(sky: THREE.ShaderMaterial, id: BiomeId) {
  const b = BIOMES[id]
  const u = sky.uniforms
  ;(u.top!.value as THREE.Color).set(b.skyTop)
  ;(u.mid!.value as THREE.Color).set(b.skyMid)
  ;(u.hor!.value as THREE.Color).set(b.skyHor)
  u.uStars!.value = b.stars
  u.uNeb!.value = b.nebula ? 1 : 0
  u.uPlanet!.value = b.planet ? 1 : 0
  if (b.nebula) {
    ;(u.neb1!.value as THREE.Color).set(b.nebula[0])
    ;(u.neb2!.value as THREE.Color).set(b.nebula[1])
  }
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
