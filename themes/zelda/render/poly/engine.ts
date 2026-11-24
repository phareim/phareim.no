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
import { AT, HSTRIDE, STRIDE } from './mesh'
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
  /** How far the water is this view's own (0: the classic picture's). */
  water: number
  /** Normals shared at the corners (1) or one a facet (0). */
  smooth: number
  /** Textures filtered at half their size (1) or read texel by texel (0). */
  filter: number
  /** The ground's and the walls' materials filtered between texels (default: as `filter`). */
  matFilter?: number
  /** The filtered ground this many mip levels softer than its pixels want (anisotropic read). */
  sharpBias?: number
  /** The distance swallowed by fog (1) or dissolved in dither (0). */
  fog: number
  /** Walls' faces between the eye and the hero are seen through too (the camera may stand on any side). */
  faces?: boolean
  /** The painted page, where it is here (else the materials). */
  painted?: boolean
  /** Lamps lit per pixel (1) or per corner (0). */
  perPixel?: number
  /** A share of the lamps' light added in the air over what they reach. */
  air?: number
}

export interface Frame {
  m: Mat4
  /** How the far land bends up toward the horizon: height added per tile² of distance beyond the second number. */
  bend: [number, number]
  /** How much a facet's turn counts in its light (the turn's ease). */
  facet: number
  /** Each painted material's repeat (16, in `MATERIALS` order; 1: 32 texels a tile). */
  matScale?: Float32Array
  /** The heightfield's origin (tiles), cells a tile, and tiles a unit; the sun's way on the ground and its climb a tile. */
  heightAt?: [number, number, number, number]
  sunRay?: [number, number, number]
  /** Picture px to one cell of the vertex snap's grid, and of the dither's and the stipple's (none: 1). */
  grid?: number
  cell?: number
  /** Samples a px for smooth edges (the 64-bit look; 0: hard edges). */
  msaa?: number
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
  /** Of those, the ones near enough to the eye that something on them may fade (the translucent pass draws only these). */
  nearChunks?: Array<{ buf: WebGLBuffer; count: number }>
  dynamic: { data: Float32Array; count: number }
  blobs: { data: Float32Array; count: number }
  /** Where the spill map lies (field x, y, texels a tile) and how strong it is now (0: off). */
  spillAt?: [number, number, number, number]
  /** The hero's hair colour (0-1): what the inside of its head shows. */
  hairIn?: [number, number, number]
  /** Lamps' halos (`TEX.HALO`), drawn last, added in. */
  halos?: { data: Float32Array; count: number }
  /**
   * The hero model, skinned on the GPU: which uploaded mesh (`heroMesh`), its six bones (3 x 4 rows each, 72 numbers),
   * where it stands (x, y, tiles per metre, the mesh's lowest point), which way it faces (unit vector), the ground.
   */
  heroSkin?: { key: string; bones: Float32Array; place: [number, number, number, number]; face: [number, number]; g: number } | null
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
layout(location=10) in vec3 aSNormal;
/** The hero model, skinned here (uSkin 1): its two bones and the first one's weight; the six bones as 3 x 4 rows; where
 * it stands (x, y, tiles per metre, the mesh's lowest point), which way it faces, and the ground's height under it. */
layout(location=11) in vec2 aBone;
layout(location=12) in float aBoneW;
uniform int uSkin;
uniform vec4 uBones[18];
uniform vec4 uPlace;
uniform vec2 uFace;
uniform float uSkinG;
vec3 boneAt(int b, vec3 v, float t) { return vec3(dot(uBones[b].xyz, v) + uBones[b].w * t, dot(uBones[b + 1].xyz, v) + uBones[b + 1].w * t, dot(uBones[b + 2].xyz, v) + uBones[b + 2].w * t); }
vec3 skinned(vec3 v, float t) {
  vec3 m = aBoneW * boneAt(int(aBone.x + 0.5) * 3, v, t) + (1.0 - aBoneW) * boneAt(int(aBone.y + 0.5) * 3, v, t);
  // Model (x right, y up, z back) to the world: the face (-z) along the body's heading, the right (+x) to its right.
  vec2 f = uFace, r = vec2(-uFace.y, uFace.x);
  return vec3(m.x * r - m.z * f, m.y);
}
uniform mat4 uM;
uniform vec2 uView;
/** The bloom's own pass (as uGlowOnly in the fragment stage). */
uniform int uGlowOnlyV;
/** The snap's grid: px of the picture to one cell (a classic px or half of it, however fine the picture). */
uniform float uGrid;
uniform vec3 uEye;
uniform float uLift;
uniform vec2 uBend;
uniform float uFacet;
uniform float uSmooth;
uniform vec4 uRoles;
uniform float uSnap;
uniform vec3 uAmbient;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uShadow;
/** The sun's shadows, marched per corner through a heightfield of the land and what stands on it (no bake: the hour moves them smoothly). */
uniform sampler2D uHeights;
uniform vec4 uHeightAt;
uniform vec3 uSunRay;
float sunAt(vec3 p) {
  ivec2 size = textureSize(uHeights, 0);
  for (int i = 1; i < 34; i++) {
    float t = 0.15 + float(i) * 0.22;
    vec2 q = p.xy + uSunRay.xy * t;
    float ray = p.z + uSunRay.z * t;
    if (ray > 6.0) return 1.0;
    ivec2 c = ivec2(floor((q - uHeightAt.xy) * uHeightAt.z));
    if (c.x < 0 || c.y < 0 || c.x >= size.x || c.y >= size.y) continue;
    vec2 h = texelFetch(uHeights, c, 0).rg * uHeightAt.w;
    if (max(h.x * uLift, h.y) > ray + 0.03) return 0.0;
  }
  return 1.0;
}
uniform sampler2D uSpill;
uniform vec4 uSpillAt;
uniform int uLampN;
uniform vec4 uLampPos[16];
uniform vec3 uLampCol[16];
uniform float uSide;
out vec3 vUvw;
out vec2 vUv;
out vec3 vLight;
out vec3 vLamp;
out vec3 vPos;
out vec3 vN;
out vec3 vColor;
out float vDist;
out vec2 vWorld;
flat out int vTex;
flat out int vFlags;
void main() {
  vec3 inPos = aPos, inN = aNormal, inSN = aSNormal;
  float inGround = aGround;
  if (uSkin == 1) {
    vec3 w = skinned(aPos, 1.0);
    inPos = vec3(uPlace.xy + uPlace.z * w.xy, uPlace.z * (w.z - uPlace.w));
    inN = normalize(skinned(aNormal, 0.0));
    inSN = normalize(skinned(aSNormal, 0.0));
    inGround = uSkinG;
  }
  // Over the turn this view's own things come up out of the ground and the classic stand-ins go down into it
  // (moved, never squashed: what is under the ground is hidden by it). A role's share is how far it is up.
  float m = aRole < 0.5 ? 1.0 : aRole < 1.5 ? uRoles.x : aRole < 2.5 ? uRoles.y : aRole < 3.5 ? uRoles.z : uRoles.w;
  // (A tree's role carries its own delay as a fraction: a wood comes up over the turn tree by tree, never all at once.)
  if (aRole > 0.5 && aRole < 1.5) { float dl = (aRole - 1.0) / 0.45; m = clamp(m * 1.7 - dl * 0.7, 0.0, 1.0); }
  // (Wholly in the ground, it is not drawn at all: where there is no floor over it, beyond a room's kerb, it would show.)
  if (aRole > 0.5 && m <= 0.0001) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float deep = aRole < 0.5 ? 0.0 : aRole < 1.5 ? 3.2 : aRole < 2.5 ? 1.5 : aRole < 3.5 ? 1.7 : 1.5;
  vec3 p = vec3(inPos.xy, inPos.z - (1.0 - m) * deep + (inGround + aZk) * uLift);
  // The far land bends up toward the horizon, so the world meets the sky as a ridge, wherever the eye stands.
  float hd = max(0.0, length(p.xy - uEye.xy) - uBend.y);
  // (Never up past the eye: a ridge under the sky, not a rim over it, as the camera comes down while the bend grows.)
  p.z += min(uBend.x * hd * hd, max(0.0, uEye.z - 0.35 - p.z));
  vec4 c = uM * vec4(p, 1.0);
  // The machine had no fractions of a px: every corner lands on one.
  if (uSnap > 0.0 && c.w > 0.0) {
    vec2 px = (c.xy / c.w * 0.5 + 0.5) * uView;
    px = mix(px, (floor(px / uGrid) + 0.5) * uGrid, uSnap);
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
  vWorld = inPos.xy;
  // The light, at the corners.
  vec3 n = normalize(mix(inN, inSN, uSmooth));
  // The sky lights from above and a little from the north-west, so every facet of a knoll takes its own share.
  float sky = mix(1.0, 0.12 + 1.08 * max(0.0, dot(n, normalize(vec3(-0.55, -0.2, 0.81)))), uFacet);
  // (The bloom's own pass outputs only what shines by itself: no light worked out for it.)
  if (uGlowOnlyV == 1) { vLight = vec3(0.0); vLamp = vec3(0.0); vPos = p; vN = n; return; }
  float lit = uShadow > 0.0 ? sunAt(p + inN * 0.02) : 1.0;
  float inSun = mix(1.0, lit, uShadow);
  vec3 L = uAmbient * sky * mix(1.0, 0.62 + 0.38 * lit, uShadow);
  L += uSunCol * max(0.0, dot(n, uSunDir)) * inSun;
  // The lamps apart from the rest, so the 64-bit machine can light them per pixel (lampsAt in the fragment shader).
  vec3 lampL = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uLampN) break;
    vec3 d = uLampPos[i].xyz - p;
    float dist = length(d);
    float a = clamp(1.0 - dist / uLampPos[i].w, 0.0, 1.0);
    if (a <= 0.0) continue;
    float face = mix(1.0, clamp(dot(n, d / max(dist, 1e-3)) * 1.3 + 0.25, 0.0, 1.0), uSide);
    lampL += uLampCol[i] * a * a * (3.0 - 2.0 * a) * face;
  }
  // What windows, signs and the fountain spill round them: read like a lamp (per corner here; per pixel below).
  if (uSpillAt.w > 0.0) lampL += textureLod(uSpill, (p.xy - uSpillAt.xy) * uSpillAt.z / vec2(textureSize(uSpill, 0)), 0.0).rgb * 2.0 * uSpillAt.w;
  // The crown of a knoll a shade lighter than its foot, so the land rolls even where the light is flat.
  float crown = 1.0 + 0.2 * clamp(inGround * uLift, 0.0, 1.5) * uFacet;
  vLight = L * crown;
  vLamp = lampL * crown;
  vPos = p;
  vN = n;
}`

const FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vUvw;
in vec2 vUv;
in vec3 vLight;
in vec3 vLamp;
in vec3 vPos;
in vec3 vN;
uniform int uLampNf;
uniform vec4 uLampPosF[16];
uniform vec3 uLampColF[16];
uniform float uSideF;
/** The hero model's inside, seen through the hole at the back of its hair: the look's own hair colour. */
uniform vec3 uHairIn;
/** The spill map (as in the vertex stage), read per pixel in the 64-bit look. */
uniform sampler2D uSpill;
uniform vec4 uSpillAt;
/** The eye and the hour's ambient light (as in the vertex stage): for the hero's rim. */
uniform vec3 uEye;
uniform vec3 uAmbient;
/** 0: the lamps' light as the corners worked it out; 1: per pixel (the 64-bit machine: smooth, no lattice). */
uniform float uPerPixel;
/** How much of a lamp's light hangs in the air over what it reaches, added on top (the classic picture's glow). */
uniform float uAir;
/** The turn's ease (as in the vertex stage): the light is capped as the classic light map is at its flat end. */
uniform float uFacet;
vec3 lampsAt(vec3 p, vec3 n) {
  vec3 L = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uLampNf) break;
    vec3 d = uLampPosF[i].xyz - p;
    float dist = length(d);
    float a = clamp(1.0 - dist / uLampPosF[i].w, 0.0, 1.0);
    if (a <= 0.0) continue;
    float face = mix(1.0, clamp(dot(n, d / max(dist, 1e-3)) * 1.3 + 0.25, 0.0, 1.0), uSideF);
    // (Per pixel, a pool: a bright core under the lamp as well as the soft reach, so its colour lies on the ground.)
    float a2 = a * a;
    L += uLampColF[i] * (a2 * (3.0 - 2.0 * a) + 1.1 * a2 * a2) * face;
  }
  return L;
}
in vec3 vColor;
in float vDist;
in vec2 vWorld;
flat in int vTex;
flat in int vFlags;
uniform sampler2D uMats;
uniform sampler2D uObjs;
uniform sampler2D uBase;
uniform sampler2D uAtlas;
uniform sampler2D uHeroTex;
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
uniform int uGlowOnly;
uniform float uWater;
uniform float uFilter;
/** The ground's and the walls' materials filtered between texels (0: texel by texel). */
uniform float uMatFilter;
uniform float uFog;
uniform int uFaces;
/** 0: the opaque pass; 1: the 64-bit look's translucent pass (what is partly faded, blended in, no depth written). */
uniform int uTrans;
uniform int uBlob;
out vec4 o;

uniform float uCell;
/** The ordered dither, on its own grid (a classic px or half of it): fine pixels would make it vanish. */
float bayer(vec2 p) {
  p = floor(p / uCell);
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
uniform float uMatSide;
/** The plain material page, and how far a painted page that has just arrived has faded in over it (1: wholly). */
uniform sampler2D uMatsLo;
uniform float uPaintMix;
uniform float uMatTile;
/** Each material's repeat: texels of the page to the tile, as a multiple of the page's own (the paintings differ in scale). */
uniform float uMatScale[16];
/** The footprint of a texel of this pixel (from the uv's screen derivatives, taken before any branch). */
vec2 gFoot;
/** The uv's screen derivatives (taken before any branch), and how many material texels a unit of the uv read is. */
vec2 gDx, gDy;
/** The hero model seen from inside (through the hole at the back of its hair): drawn as the hair's dark, unlit. */
bool gInside = false;
float gGs;
/** The painted page as layers, one a material, each with its own repeat, mip maps and anisotropic filtering (when 1). */
uniform highp sampler2DArray uMatArr;
uniform float uAniso;
/** The 64-bit look's ground read this many mip levels softer than the pixel wants (the meter's steadiness). */
uniform float uSharpBias;
/** The page being read: the bound one (painted, or the plain materials), or the plain one under a painted page's fade-in. */
bool gLo;
float gSide;
float gTile;
vec3 matTexel(float idx, vec2 t, int lod) {
  int side = int(gSide) >> lod;
  ivec2 q = ivec2(mod(floor(t / float(1 << lod)), float(side)));
  ivec2 at = q + ivec2(int(idx) * side, 0);
  return gLo ? texelFetch(uMatsLo, at, 0).rgb : texelFetch(uMats, at, lod).rgb;
}
/** A material read between texels at level lod, k texels of the top level to one of it. */
vec3 matBilin(float idx, vec2 t, int lod, float k) {
  vec2 p = t / k - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 o = vec2(1.0, 0.0);
  return mix(mix(matTexel(idx, i * k, lod), matTexel(idx, (i + o) * k, lod), f.x), mix(matTexel(idx, (i + o.yx) * k, lod), matTexel(idx, (i + 1.0) * k, lod), f.x), f.y);
}
/**
 * A material at texel coordinates t: texel by texel up close; seen small, from the page's smaller levels (box-filtered),
 * so far ground and walls do not shimmer; in the 64-bit machine filtered between texels too.
 */
vec3 matAtPage(float idx, vec2 t, float foot) {
  // (t counts sixteen texels a tile; a page with more to the tile is read at its own, and at the material's own repeat.)
  float sc = gTile / 16.0 * (gLo ? 1.0 : uMatScale[int(idx)]);
  t *= sc;
  float fp = foot * sc;
  // (Hard texels take the level whose texel is about the pixel; filtered ones a level softer, as a filtering machine's
  // mip map would, and between levels by the fraction, so the look's easing never switches the ground's level at once.)
  float lf = log2(max(fp, 1.0));
  int lod = gSide >= 128.0 ? clamp(int(floor(lf + 0.25)), 0, 5) : 0;
  vec3 hard = matTexel(idx, t, lod);
  // (The ground and the walls may be filtered while the figures stay texel by texel: uMatFilter. How much softer
  // the filtered read is goes by uFilter: the 64-bit machine's a level softer, the 32-bit look's half a level.)
  if (uMatFilter <= 0.001) return hard;
  // A small page is read at half its size and smears (the 64-bit machine's tiny textures); a painted one is not tiny.
  vec3 soft;
  if (gSide >= 128.0) {
    float ls = clamp(lf + 0.25 + 1.25 * uFilter + 0.5 * uMatFilter * (1.0 - uFilter), 0.0, 5.0);
    int l0 = int(floor(ls));
    int l1 = min(l0 + 1, 5);
    soft = mix(matBilin(idx, t, l0, float(1 << l0)), matBilin(idx, t, l1, float(1 << l1)), ls - float(l0));
  } else soft = matBilin(idx, t, 0, 1.0 + uFilter);
  // The painted page through the GPU's own filter: trilinear and anisotropic, so the ground is sharp near the eye and
  // steady far off (16 samples along a slanting look instead of a softer level). The 32-bit look's steady ground half
  // a level softer still; the 64-bit look's at the mip level the pixel wants.
  if (!gLo && gSide >= 128.0 && uAniso > 0.5) {
    float k = exp2(0.5 * uMatFilter * (1.0 - uFilter) + uSharpBias) * gGs * sc / gSide;
    soft = textureGrad(uMatArr, vec3(t / gSide, idx), gDx * k, gDy * k).rgb;
  }
  return mix(hard, soft, uMatFilter);
}
/** A material: from the bound page, and while a painted page fades in over the plain one, from both. */
vec3 matAtT(float idx, vec2 t, float foot) {
  gLo = false; gSide = uMatSide; gTile = uMatTile;
  vec3 c = matAtPage(idx, t, foot);
  if (uPaintMix < 0.999) {
    gLo = true; gSide = 64.0; gTile = 16.0;
    c = mix(matAtPage(idx, t, foot), c, uPaintMix);
  }
  return c;
}
vec3 matAt(float idx, vec2 w) {
  gGs = 16.0;
  return matAtT(idx, w * 16.0, max(gFoot.x, gFoot.y) * 16.0);
}
/** A classic picture at px: texel by texel, or filtered between texels. */
vec4 pic(sampler2D s, vec2 px) {
  vec4 hard = fetchPic(s, px);
  if (uFilter <= 0.001) return hard;
  vec2 p = px - 0.5;
  vec2 i = floor(p) + 0.5;
  vec2 f = fract(p);
  vec4 soft = mix(mix(fetchPic(s, i), fetchPic(s, i + vec2(1.0, 0.0)), f.x), mix(fetchPic(s, i + vec2(0.0, 1.0)), fetchPic(s, i + 1.0), f.x), f.y);
  return mix(hard, soft, uFilter);
}
vec4 atlasTexel(vec2 q) {
  ivec2 size = textureSize(uAtlas, 0);
  return texelFetch(uAtlas, clamp(ivec2(q), ivec2(0), size - 1), 0);
}
/** A figure's picture: texel by texel, or filtered (paper figures in a soft world). */
vec4 premul(vec4 c) { return vec4(c.rgb * c.a, c.a); }
vec4 atlasAt(vec2 px) {
  vec4 hard = atlasTexel(floor(px));
  if (uFilter <= 0.001) return hard;
  // The soft look's paper figures: each texel a clean square at any size, its edges smoothed over a pixel of the
  // screen (not smeared over a texel); the colours mixed premultiplied, so no dark fringe from the clear texels round
  // a figure, and the alpha test cuts a clean edge. (Returned premultiplied: the caller divides by alpha.)
  vec2 fw = max(gFoot, vec2(1e-3));
  vec2 p = px - 0.5;
  vec2 i = floor(p);
  vec2 f = clamp((fract(p) - 0.5) / min(fw, vec2(1.0)) + 0.5, 0.0, 1.0);
  vec4 soft = mix(mix(premul(atlasTexel(i)), premul(atlasTexel(i + vec2(1.0, 0.0))), f.x), mix(premul(atlasTexel(i + vec2(0.0, 1.0))), premul(atlasTexel(i + 1.0)), f.x), f.y);
  return mix(premul(hard), soft, uFilter);
}
void main() {
  // (People and things are sprites: the machine drew those straight, not as warped polygons.)
  vec2 uv = vTex == 3 || vTex == 7 ? vUv : mix(vUv, vUvw.xy / vUvw.z, uAffine);
  // The land's materials on a slope (the soft look): projected straight down, a bank seen head-on squeezes them into
  // long streaks across it; stretched along the slope by about its own steepness, they keep their size (the kinds
  // are still looked up at the true uv).
  vec2 muv = uv;
  if (vTex == 1 && uFilter > 0.001) {
    vec3 sn = normalize(vN);
    muv = uv - sn.xy / max(sn.z, 0.35) * vPos.z * 0.5 * uFilter;
  }
  gFoot = fwidth(muv);
  gDx = dFdx(muv);
  gDy = dFdy(muv);
  // (Part 9: whether this pixel fades is decided first, so the translucent pass and a dropped pixel cost no lighting.)
  // The 64-bit camera walks among things: what stands near the eye (a tree it stands in, a sign at the hero's back)
  // fades away, gone at a tile and a half; a paper figure nearer the eye than the hero fades over its last tile; and
  // what stands between the eye and the hero is seen through in a soft-edged window. The 64-bit look does all three
  // with real transparency (fade: the opaque pass leaves out what is partly faded, the translucent pass blends it
  // in, uTrans); never a dither, never a card's rectangle. The 32-bit machine stipples, as it did.
  float fade = 1.0;
  // (What lies flat on the ground never stands between the eye and the hero: it is never faded or cut.)
  bool see = ((vFlags & 1) != 0 || ((vFlags & 4) != 0 && uFaces == 1)) && (uFaces == 0 || abs(normalize(vN).z) < 0.95);
  if (uFaces == 1) {
    if (vTex == 3 && see) fade = min(fade, smoothstep(uHero.w - 0.9, uHero.w - 0.2, vDist));
    // (A figure over the hero, by the amount the view worked out for it: bits 5-9 of its flags.)
    if (vTex == 3) fade = min(fade, 1.0 - 0.9 * float((vFlags >> 5) & 31) / 31.0);
    if (see && vDist < uHero.w - 0.6) fade = min(fade, clamp((vDist - 1.2) / max(0.5, uHero.w - 1.8), 0.0, 1.0));
    if (see && uHero.z > 0.0 && vDist < uHero.w - 0.5) {
      vec2 dd = (gl_FragCoord.xy - uHero.xy) / vec2(uHero.z * 0.7, uHero.z);
      fade = min(fade, smoothstep(0.65, 1.0, dot(dd, dd)));
    }
    if (uTrans == 0 && fade < 0.999) discard;
    if (uTrans == 1 && (fade >= 0.999 || fade <= 0.002)) discard;
  } else {
    if (uTrans == 1) discard;
    if (see && uHero.z > 0.0 && vDist < uHero.w - 0.5) {
      vec2 dd = (gl_FragCoord.xy - uHero.xy) / vec2(uHero.z * 0.7, uHero.z);
      vec2 sc = floor(gl_FragCoord.xy / uCell);
      if (dot(dd, dd) < 1.0 && mod(sc.x + sc.y, 2.0) < 1.0) discard;
    }
  }
  vec4 c = vec4(1.0);
  vec3 glow = vec3(0.0);
  /** What shines by itself in the classic art: bright, saturated colours (neon, screens, lit letters, crystals). */
  vec3 neon = vec3(0.0);
  if (vTex == 1) {
    // The ground: its material by kind, the border between two kinds frayed a texel at a time.
    vec2 tq = floor(uv * 16.0);
    vec4 k = kindAt(uv);
    vec2 j = vec2(hash(tq), hash(tq + 17.0)) - 0.5;
    vec4 kj = kindAt(uv + j * 0.5 * uFray);
    float idx = k.r * 255.0;
    if (idx > 0.5 && kj.r * 255.0 > 0.5) idx = kj.r * 255.0;
    vec4 base = pic(uBase, uv * 16.0);
    vec3 col = base.a > 0.5 ? base.rgb : matAt(max(idx - 1.0, 0.0), muv);
    if (idx > 0.5) col = mix(col, matAt(idx - 1.0, muv), uMat);
    // What the classic art lays on the ground, unless something stands there in its place.
    float bare = k.g * 255.0;
    float fy = fract(uv.y) * 16.0;
    if (bare < 0.5 || (bare < 1.5 && fy < 6.0)) {
      vec4 ob = pic(uObjs, uv * 16.0);
      col = col * (1.0 - ob.a) + ob.rgb;
      if (ob.a > 0.5) { vec3 q = ob.rgb / ob.a; float h2 = max(q.r, max(q.g, q.b)); float l2 = min(q.r, min(q.g, q.b)); if (h2 > 0.6 && h2 - l2 > 0.5 * h2) neon = q; }
    }
    c = vec4(col, 1.0);
  } else if (vTex == 2) {
    c = pic(uObjs, uv);
  } else if (vTex == 6) {
    c = pic(uBase, uv);
  } else if (vTex == 3) {
    c = atlasAt(uv);
  } else if (vTex == 7) {
    // The hero model: its texture texel by texel, or filtered (the 64-bit look). (The mesh's own uv, never warped.)
    ivec2 hs = textureSize(uHeroTex, 0);
    vec2 hp = vUv * vec2(hs);
    vec4 hard = texelFetch(uHeroTex, clamp(ivec2(hp), ivec2(0), hs - 1), 0);
    c = mix(hard, texture(uHeroTex, vUv), uFilter);
    c.a = 1.0;
    // (Seen from inside, through the small hole at the back of the hair, the face's own texture would read as eyes on the
    // back of the head: the model's inside is the hair's dark.)
    gInside = dot(normalize(vN), normalize(uEye - vPos)) < 0.12;
    if (gInside) c.rgb = uHairIn;
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
    // (The 64-bit look's foam is a soft band, not a stipple: the dither's threshold becomes the band's middle.)
    float b = mix(bayer(gl_FragCoord.xy), 0.5, step(0.5, uFilter));
    if (vColor.r > 0.5) {
      if (s > -0.07) glow = vec3(0.18, 0.95, 1.0);
      else if (s > -0.16 && b > 0.5) col = vec3(0.12, 0.45, 0.7);
    } else if (s > -0.06 + 0.04 * sin(q.x * 9.0 + t * 2.0) || (s > -0.14 && b > 0.62)) col = vec3(0.62, 0.84, 1.0);
    // (Through the turn the classic picture's water gives way to this one's, not in one frame.)
    if (uWater < 1.0) { vec4 ba = fetchPic(uBase, uv * 16.0); if (ba.a > 0.5) col = mix(ba.rgb / ba.a, col, uWater); }
    c = vec4(col, 1.0);
  } else if (vTex == 8) {
    // A lamp's halo, behind what stands in front of the lamp, fading with the fog.
    float d = length(vUv);
    if (d > 1.0) discard;
    float fd2 = clamp((vDist - uFar.x) / max(uFar.y - uFar.x, 1e-3), 0.0, 1.0);
    float a = (1.0 - d) * (1.0 - d) * (1.0 - fd2);
    o = vec4(vColor * a, 1.0);
    return;
  } else if (vTex == 5) {
    // A shadow: the 32-bit machine's stippled ellipse, the 64-bit one's soft and round, darkest under the feet
    // (mixed by the filter, so the change of look never switches it at once). Multiplied onto the ground.
    float d = length(uv);
    if (d > 1.0) discard;
    float hard = d > 0.72 && bayer(gl_FragCoord.xy) > 0.5 ? 0.0 : 1.0;
    float soft = 1.0 - smoothstep(0.15, 1.0, d);
    float a = mix(hard, soft * soft * (3.0 - 2.0 * soft), uFilter);
    o = vec4(vec3(mix(1.0, vColor.r, a)), 1.0);
    return;
  } else if (vTex >= 10) {
    gGs = 1.0;
    c = vec4(matAtT(float(vTex - 10), uv, max(gFoot.x, gFoot.y)), 1.0);
  }
  if (c.a < 0.5) discard;
  vec3 tex = c.rgb / max(c.a, 1e-3);
  vec3 spillF = uSpillAt.w > 0.0 && uPerPixel > 0.001 ? texture(uSpill, (vPos.xy - uSpillAt.xy) * uSpillAt.z / vec2(textureSize(uSpill, 0))).rgb * 2.0 * uSpillAt.w : vec3(0.0);
  vec3 lamp = uPerPixel > 0.001 ? mix(vLamp, lampsAt(vPos, normalize(vN)) + spillF, uPerPixel) : vLamp;
  // (Toward the turn's flat end the light stops at 1, as the classic picture's light map does, so the hand-off meets it
  // beside a strong lamp too; in the view itself it may run far over.)
  vec3 light = min(vLight + lamp, vec3(mix(1.0, 8.0, uFacet * uFacet)));
  vec3 lit = tex * (vTex == 4 ? vec3(1.0) : vColor) * (vTex == 4 ? 0.55 + 0.6 * light : light);
  // A share of the lamps' light in the air over what they reach, as the classic picture's glow lies on its ground.
  // (Saturating, as that glow does: about the lamp's own light where it is faint, never a white-out beside a strong one.)
  // (Not on the hero model: light added without its colours picks out whatever of it faces a lamp, the hollows of
  // its hair as two white eyes on the back of its head.)
  if (vTex != 7) lit += (1.0 - exp(-lamp * 1.2)) / 1.2 * uAir;
  if ((vFlags & 2) != 0) lit = max(lit, tex * vColor);
  // Neon in the classic art shines by itself: the lamps do not light it, it is as bright as it was painted.
  float hi = max(tex.r, max(tex.g, tex.b));
  float lo = min(tex.r, min(tex.g, tex.b));
  if (vTex != 1 && vTex != 4 && hi > 0.6 && hi - lo > 0.5 * hi) neon = tex;
  if ((vFlags & 2) != 0) neon = max(neon, tex * vColor);
  lit = max(lit, neon);
  // The hero model's face and clothes read under every light: never darker than about half their own colours
  // (a painted figure's floor, as the sprites' outlines and the classic art carry their own light).
  if (vTex == 7) {
    lit = max(lit, tex * 0.5);
    // And a rim of light round it, from the sky and the lamps about it, so even a black jacket stands out from dark
    // ground: strongest where the model turns away from the eye.
    float rim = 1.0 - clamp(dot(normalize(vN), normalize(uEye - vPos)), 0.0, 1.0);
    // (The back of the crown, flagged by the mesh (8): lit flat and without the rim, so its pockets read as hair.)
    if ((vFlags & 8) != 0) { lit = tex * (uAmbient * 1.2 + 0.25); rim = 0.0; }
    if (gInside) { lit = tex * (uAmbient * 0.8 + 0.1); rim = 0.0; }
    lit += rim * rim * (uAmbient * 0.9 + lamp * 0.7 + 0.06);
  }
  lit += glow;
  // The soft look's shoulder: light over 0.75 rolls off toward white instead of clipping (pale sand by a bonfire).
  vec3 over = max(lit - 0.75, 0.0);
  lit = mix(lit, min(lit, vec3(0.75)) + 0.25 * (1.0 - exp(-over * 4.0)), uFilter);
  float b = bayer(gl_FragCoord.xy);
  // A room: what lies outside it is dark.
  if (uRoomOn == 1) {
    vec2 d = max(uRoom.xy - vWorld, vWorld - (uRoom.xy + uRoom.zw));
    if (max(d.x, d.y) > 0.001) discard;
  }
  // The distance: hazed, then gone in dithered steps.
  float fd = clamp((vDist - uFar.x) / max(uFar.y - uFar.x, 1e-3), 0.0, 1.0);
  float fogged = 0.0;
  if (uFog < 0.5) {
    // The 32-bit machine: the distance dissolves in dithered steps.
    fd = floor(fd * 5.0) / 5.0;
    if (fd > 0.0 && fd >= b) discard;
    lit = mix(lit, uHaze, fd * uHazeK);
  } else {
    // The 64-bit machine: thick fog in the hour's colour swallows the distance; beyond it nothing is drawn.
    if (vDist > uFar.y) discard;
    fogged = mix(fd * uHazeK, fd * fd * (3.0 - 2.0 * fd), uFog);
    // Toward the fog's colour, and then gone into what lies behind (the sky, the ridges): the fog is the picture's own.
    // And the air between: from a few tiles off, each layer further away a little more in the hour's colour, so a wood
    // steps back row by row instead of standing as one dark wall.
    float air = (1.0 - exp(-max(0.0, vDist - 4.0) / 12.0)) * 0.5 * (uFog - 0.5) * 2.0;
    lit = mix(lit, uHaze, max(fogged * 0.55, air));
  }
  // 32 768 colours, the dither between them.
  if (uBits < 7.5) {
    float lv = exp2(uBits) - 1.0;
    lit = floor(clamp(lit, 0.0, 1.0) * lv + b) / lv;
  }
  // (The bloom's own pass: only what shines by itself.)
  if (uGlowOnly == 1) { o = vec4(clamp(max(neon, glow) * (1.0 - fogged), 0.0, 1.0), 1.0); return; }
  float alpha = (uFog >= 0.5 ? 1.0 - fogged * fogged : 1.0) * fade;
  o = vec4(clamp(lit, 0.0, 1.0) * alpha, alpha);
}`

export interface Engine {
  canvas: HTMLCanvasElement
  ready(block?: boolean): 'yes' | 'wait' | 'failed'
  lost(): boolean
  /** A static stretch of geometry, kept on the GPU until it is let go. */
  keep(data: Float32Array, count: number): { buf: WebGLBuffer; count: number }
  drop(c: { buf: WebGLBuffer }): void
  materials(data: Uint8Array, w: number, h: number): void
  /** The painted page (128 texels a material, 32 a tile), drawn in place of the materials when a frame asks for it. */
  painted(data: Uint8Array, w: number, h: number): void
  /** What lit windows, neon signs and a fountain spill round them (RGB, 2 texels a tile, x2 in the shader): read like a lamp. */
  spill(data: Uint8Array, w: number, h: number): void
  /** The heightfield the sun's shadows are marched through: per cell, the land (R) and what stands on it (G), in 1/32 tiles. */
  heights(data: Uint8Array, w: number, h: number): void
  /** The hero model's texture (RGBA, straight). */
  heroTexture(data: Uint8Array | Uint8ClampedArray, w: number, h: number): void
  /** A hero mesh, once (`HSTRIDE` floats a corner: the engine's own and two bones and a weight): kept under its key. */
  heroMesh(key: string, data: Float32Array, count: number): void
  objs(c: HTMLCanvasElement, w: number, h: number): void
  base(c: HTMLCanvasElement, w: number, h: number): void
  atlas(c: HTMLCanvasElement, rows: number): void
  kinds(data: Uint8Array, w: number, h: number): void
  shoreField(data: Uint8Array, w: number, h: number): void
  /** `glowTo`: a canvas that gets what shines by itself, for the bloom (a pass of its own before the picture). */
  draw(f: Frame, vw: number, vh: number, glowTo?: CanvasRenderingContext2D): void
  /** For the lab: GPU time by pass and draw calls and vertices, summed since it was turned on (`profileOut`). */
  profile(on: boolean): void
  profileOut(): { passes: Record<string, number>; calls: number; verts: number; frames: number }
  /** For the lab: time the GPU's work of each frame (`EXT_disjoint_timer_query_webgl2`); the last result, ms (null: none yet). */
  timeGpu(on: boolean): void
  gpuMs(): number | null
  dispose(): void
}

const ONES = new Float32Array(16).fill(1)
/** How long a painted page that arrives while the view is up takes to fade in over the plain one. */
const PAINT_FADE_MS = 600

export function createEngine(): Engine {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, depth: true, preserveDrawingBuffer: false }) as GL | null
  if (!gl) throw new Error('no WebGL2')
  const prog: Program = program(gl, VS, FS)
  const tex = {
    mats: texture(gl, 1, 1),
    painted: texture(gl, 1, 1),
    hero: texture(gl, 1, 1, { linear: true }),
    heights: texture(gl, 1, 1),
    spill: texture(gl, 1, 1, { linear: true }),
    objs: texture(gl, 1, 1),
    base: texture(gl, 1, 1),
    atlas: texture(gl, 1, 1),
    kind: texture(gl, 1, 1),
    shore: texture(gl, 1, 1, { linear: true }),
  }
  /** A multisampled framebuffer for smooth edges, made when first asked for and kept at the picture's size. */
  const maxSamples = (gl.getParameter(gl.MAX_SAMPLES) as number) || 0
  let msFb: WebGLFramebuffer | null = null
  let msColor: WebGLRenderbuffer | null = null
  let msDepth: WebGLRenderbuffer | null = null
  let msKey = ''
  function multisampled(w: number, h: number, samples: number): WebGLFramebuffer {
    const key = `${w}x${h}x${samples}`
    if (msFb && msKey === key) return msFb
    const g = gl!
    if (!msFb) { msFb = g.createFramebuffer(); msColor = g.createRenderbuffer(); msDepth = g.createRenderbuffer() }
    g.bindRenderbuffer(g.RENDERBUFFER, msColor)
    g.renderbufferStorageMultisample(g.RENDERBUFFER, samples, g.RGBA8, w, h)
    g.bindRenderbuffer(g.RENDERBUFFER, msDepth)
    g.renderbufferStorageMultisample(g.RENDERBUFFER, samples, g.DEPTH_COMPONENT24, w, h)
    g.bindFramebuffer(g.FRAMEBUFFER, msFb)
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, msColor)
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, msDepth)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    msKey = key
    return msFb!
  }
  let hasPainted = false
  /** The painted page as layers (`painted`), for the GPU's anisotropic filter where the device has it. */
  const matArr = gl.createTexture()!
  // (A texel of nothing until the page is here: a sampler never points at an empty texture.)
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, matArr)
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  const anisoExt = gl.getExtension('EXT_texture_filter_anisotropic') as { TEXTURE_MAX_ANISOTROPY_EXT: number; MAX_TEXTURE_MAX_ANISOTROPY_EXT: number } | null
  let hasArr = false
  /** The lab's GPU timer (`timeGpu`). */
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null
  let timing = false
  /** The lab's profile: one timer query a pass (in turn: queries cannot nest), read back when ready. */
  const prof = { on: false, passes: {} as Record<string, number>, calls: 0, verts: 0, frames: 0, pending: [] as Array<{ q: WebGLQuery; name: string }>, open: false }
  const passBegin = (name: string) => {
    if (!prof.on || !tq) return
    if (prof.open) gl.endQuery(tq.TIME_ELAPSED_EXT)
    const q = gl.createQuery()!
    gl.beginQuery(tq.TIME_ELAPSED_EXT, q)
    prof.pending.push({ q, name })
    prof.open = true
  }
  const passEnd = () => { if (prof.open && tq) { gl.endQuery(tq.TIME_ELAPSED_EXT); prof.open = false } }
  const passRead = () => {
    while (prof.pending.length && gl.getQueryParameter(prof.pending[0]!.q, gl.QUERY_RESULT_AVAILABLE)) {
      const { q, name } = prof.pending.shift()!
      if (tq && !gl.getParameter(tq.GPU_DISJOINT_EXT)) prof.passes[name] = (prof.passes[name] ?? 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6
      gl.deleteQuery(q)
    }
  }
  const da = gl.drawArrays.bind(gl)
  gl.drawArrays = (mode: number, first: number, count: number) => { if (prof.on) { prof.calls++; prof.verts += count } da(mode, first, count) }
  const queries: WebGLQuery[] = []
  let lastGpu: number | null = null
  /** A frame was drawn with the plain page, and when a painted one began to fade in over it. */
  let plainShown = false
  let paintFrom = -1
  const dyn = gl.createBuffer()!
  /** The hero meshes as uploaded, by key: drawn skinned (`uSkin`), never sent again. */
  const heroBufs = new Map<string, { buf: WebGLBuffer; count: number }>()
  const haloBuf = gl.createBuffer()!
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

  function bindLayout(buf: WebGLBuffer, stride = STRIDE) {
    const g = gl!
    g.bindBuffer(g.ARRAY_BUFFER, buf)
    const s = stride * 4
    const attr = (loc: number, size: number, off: number) => { g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, size, g.FLOAT, false, s, off * 4) }
    attr(0, 3, AT.pos); attr(1, 1, AT.ground); attr(2, 3, AT.normal); attr(3, 2, AT.uv); attr(4, 1, AT.tex)
    attr(5, 3, AT.color); attr(6, 1, AT.sun); attr(7, 1, AT.role); attr(8, 1, AT.flags); attr(9, 1, AT.zk); attr(10, 3, AT.snormal)
  }

  return {
    canvas,
    ready: block => programsReady(gl, [prog], block),
    lost: () => gl.isContextLost(),
    timeGpu(on) { timing = on && !!tq },
    profile(on) { if (on !== prof.on) { prof.on = on && !!tq; prof.passes = {}; prof.calls = 0; prof.verts = 0; prof.frames = 0 } },
    profileOut: () => ({ passes: { ...prof.passes }, calls: prof.calls, verts: prof.verts, frames: prof.frames }),
    gpuMs: () => lastGpu,
    keep(data, count) {
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * STRIDE), gl.STATIC_DRAW)
      return { buf, count }
    },
    drop(c) { gl.deleteBuffer(c.buf) },
    materials(data, w, h) { raw(tex.mats, data, w, h) },
    painted(data, w, h) {
      raw(tex.painted, data, w, h)
      // Its smaller levels, box-filtered (each material's 128 texels halve within itself, so none bleeds into the next).
      gl.bindTexture(gl.TEXTURE_2D, tex.painted.t)
      gl.generateMipmap(gl.TEXTURE_2D)
      // The same page as layers, a material a layer, for the GPU's own filter (`uMatArr`): repeat, trilinear, anisotropic.
      const side = h, n = Math.floor(w / side)
      const layered = new Uint8Array(side * side * n * 4)
      for (let k = 0; k < n; k++) for (let y = 0; y < side; y++) layered.set(data.subarray((y * w + k * side) * 4, (y * w + k * side + side) * 4), ((k * side + y) * side) * 4)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, matArr)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, side, side, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, layered)
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT)
      if (anisoExt) gl.texParameterf(gl.TEXTURE_2D_ARRAY, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
      hasArr = true
      hasPainted = true
    },
    spill(data, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, tex.spill.t)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, data)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      tex.spill.w = w; tex.spill.h = h
    },
    heights(data, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, tex.heights.t)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, w, h, 0, gl.RG, gl.UNSIGNED_BYTE, data)
      tex.heights.w = w; tex.heights.h = h
    },
    heroTexture(data, w, h) {
      gl.bindTexture(gl.TEXTURE_2D, tex.hero.t)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
      tex.hero.w = w; tex.hero.h = h
    },
    heroMesh(key, data, count) {
      if (heroBufs.has(key)) return
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * HSTRIDE), gl.STATIC_DRAW)
      heroBufs.set(key, { buf, count })
    },
    objs(c, w, h) { uploadPart(gl, tex.objs, c, w, h) },
    base(c, w, h) { uploadPart(gl, tex.base, c, w, h) },
    atlas(c, rows) { uploadPart(gl, tex.atlas, c, c.width, rows) },
    kinds(data, w, h) { raw(tex.kind, data, w, h) },
    shoreField(data, w, h) { raw(tex.shore, data, w, h, true) },
    draw(f, vw, vh, glowTo) {
      // (The lab's GPU timer: the oldest query whose result is in, read; one begun for this frame.)
      let q: WebGLQuery | null = null
      if (prof.on) { passRead(); prof.frames++; passBegin('setup') }
      if (timing && tq && !prof.on) {
        while (queries.length && gl.getQueryParameter(queries[0]!, gl.QUERY_RESULT_AVAILABLE)) {
          const old = queries.shift()!
          if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) lastGpu = gl.getQueryParameter(old, gl.QUERY_RESULT) / 1e6
          gl.deleteQuery(old)
        }
        if (queries.length < 4) { q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q) }
      }
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh }
      const ms = Math.min(f.msaa ?? 0, maxSamples)
      const fb = ms > 0 ? multisampled(vw, vh, ms) : null
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.viewport(0, 0, vw, vh)
      /** The multisampled picture onto the canvas. */
      const resolve = () => {
        if (!fb) return
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb)
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
        gl.blitFramebuffer(0, 0, vw, vh, 0, 0, vw, vh, gl.COLOR_BUFFER_BIT, gl.NEAREST)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      }
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
      gl.uniform1f(u('uGrid'), Math.max(1, f.grid ?? 1))
      gl.uniform1f(u('uCell'), Math.max(1, f.cell ?? 1))
      gl.uniform3f(u('uEye'), ...f.eye)
      gl.uniform1f(u('uLift'), f.lift)
      gl.uniform2f(u('uBend'), ...f.bend)
      gl.uniform1f(u('uFacet'), f.facet)
      gl.uniform1f(u('uSmooth'), L.smooth)
      gl.uniform1f(u('uFilter'), L.filter)
      gl.uniform1f(u('uMatFilter'), L.matFilter ?? L.filter)
      gl.uniform1f(u('uFog'), L.fog)
      gl.uniform1i(u('uFaces'), L.faces ? 1 : 0)
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
      gl.uniform1i(u('uLampNf'), n)
      gl.uniform4fv(u('uLampPosF'), lp)
      gl.uniform3fv(u('uLampColF'), lc)
      gl.uniform1f(u('uSideF'), L.side)
      gl.uniform1f(u('uPerPixel'), L.perPixel ?? 0)
      gl.uniform1f(u('uAir'), L.air ?? 0)
      const paintedNow = !!L.painted && hasPainted
      // The painted page arriving while the plain one is on the screen fades in over it, never in one frame.
      if (!paintedNow) plainShown = true
      if (paintedNow && plainShown && paintFrom < 0) paintFrom = performance.now()
      const paintMix = paintFrom < 0 ? 1 : Math.min(1, (performance.now() - paintFrom) / PAINT_FADE_MS)
      if (paintMix >= 1 && paintFrom >= 0) { paintFrom = -1; plainShown = false }
      gl.uniform1f(u('uPaintMix'), paintedNow ? paintMix : 1)
      bindTex(gl, 8, tex.mats, u('uMatsLo'))
      bindTex(gl, 0, paintedNow ? tex.painted : tex.mats, u('uMats'))
      gl.activeTexture(gl.TEXTURE9)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, matArr)
      gl.uniform1i(u('uMatArr'), 9)
      gl.uniform1f(u('uAniso'), paintedNow && hasArr ? 1 : 0)
      gl.uniform1f(u('uSharpBias'), L.sharpBias ?? 0)
      gl.uniform1f(u('uMatSide'), paintedNow ? 128 : 64)
      gl.uniform1f(u('uMatTile'), paintedNow ? 32 : 16)
      gl.uniform1fv(u('uMatScale[0]'), paintedNow && f.matScale ? f.matScale : ONES)
      bindTex(gl, 1, tex.objs, u('uObjs'))
      bindTex(gl, 2, tex.base, u('uBase'))
      bindTex(gl, 3, tex.atlas, u('uAtlas'))
      bindTex(gl, 4, tex.kind, u('uKind'))
      bindTex(gl, 5, tex.shore, u('uShore'))
      bindTex(gl, 6, tex.hero, u('uHeroTex'))
      bindTex(gl, 7, tex.heights, u('uHeights'))
      bindTex(gl, 10, tex.spill, u('uSpill'))
      gl.uniform4f(u('uSpillAt'), ...(f.spillAt ?? [0, 0, 1, 0]))
      gl.uniform3f(u('uHairIn'), ...(f.hairIn ?? [0.094, 0.094, 0.345]))
      gl.uniform4f(u('uHeightAt'), ...(f.heightAt ?? [0, 0, 1, 0]))
      gl.uniform3f(u('uSunRay'), ...(f.sunRay ?? [1, 0, 1]))
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
      gl.uniform1f(u('uWater'), L.water)
      if (f.dynamic.count) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dyn)
        gl.bufferData(gl.ARRAY_BUFFER, f.dynamic.data.subarray(0, f.dynamic.count * STRIDE), gl.STREAM_DRAW)
      }
      const solid = (trans = false) => {
        for (const c of trans && f.nearChunks ? f.nearChunks : f.chunks) {
          bindLayout(c.buf)
          gl.drawArrays(gl.TRIANGLES, 0, c.count)
        }
        if (f.dynamic.count) {
          bindLayout(dyn)
          gl.drawArrays(gl.TRIANGLES, 0, f.dynamic.count)
        }
        const hs = f.heroSkin
        const hb = hs ? heroBufs.get(hs.key) : undefined
        // (The hero never fades: not in the translucent pass.)
        if (hs && hb && !trans) {
          // The hero: the mesh as uploaded, posed by its bones in the vertex shader.
          bindLayout(hb.buf, HSTRIDE)
          const st = HSTRIDE * 4
          gl.enableVertexAttribArray(11); gl.vertexAttribPointer(11, 2, gl.FLOAT, false, st, STRIDE * 4)
          gl.enableVertexAttribArray(12); gl.vertexAttribPointer(12, 1, gl.FLOAT, false, st, (STRIDE + 2) * 4)
          gl.uniform1i(u('uSkin'), 1)
          gl.uniform4fv(u('uBones[0]'), hs.bones)
          gl.uniform4f(u('uPlace'), ...hs.place)
          gl.uniform2f(u('uFace'), ...hs.face)
          gl.uniform1f(u('uSkinG'), hs.g)
          gl.drawArrays(gl.TRIANGLES, 0, hb.count)
          gl.uniform1i(u('uSkin'), 0)
          gl.disableVertexAttribArray(11); gl.disableVertexAttribArray(12)
        }
      }
      if (glowTo) {
        // First what shines by itself alone, for the bloom; then the picture.
        passBegin('glow')
        // (Part 9: drawn at the glow canvas's own size, in the corner of the picture, not at the picture's: the bloom
        // only ever sees it that small. What works in screen px is scaled with it.)
        const gw = Math.min(vw, glowTo.canvas.width), gh = Math.min(vh, glowTo.canvas.height)
        const gs = gw / vw
        gl.viewport(0, 0, gw, gh)
        gl.uniform2f(u('uView'), gw, gh)
        gl.uniform1f(u('uGrid'), Math.max(1, (f.grid ?? 1) * gs))
        gl.uniform1f(u('uCell'), Math.max(1, (f.cell ?? 1) * gs))
        gl.uniform4f(u('uHero'), ...(f.hero ? [f.hero[0] * gs, gh - f.hero[1] * gs, f.hero[2] * gs, f.hero[3]] as [number, number, number, number] : [0, 0, 0, 0] as [number, number, number, number]))
        gl.uniform1i(u('uGlowOnly'), 1)
        gl.uniform1i(u('uGlowOnlyV'), 1)
        gl.uniform1i(u('uTrans'), 0)
        solid()
        if (fb) {
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb)
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
          gl.blitFramebuffer(0, 0, gw, gh, 0, 0, gw, gh, gl.COLOR_BUFFER_BIT, gl.NEAREST)
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
        }
        glowTo.clearRect(0, 0, glowTo.canvas.width, glowTo.canvas.height)
        glowTo.drawImage(canvas, 0, canvas.height - gh, gw, gh, 0, 0, glowTo.canvas.width, glowTo.canvas.height)
        gl.uniform1i(u('uGlowOnly'), 0)
        gl.uniform1i(u('uGlowOnlyV'), 0)
        gl.viewport(0, 0, vw, vh)
        gl.uniform2f(u('uView'), vw, vh)
        gl.uniform1f(u('uGrid'), Math.max(1, f.grid ?? 1))
        gl.uniform1f(u('uCell'), Math.max(1, f.cell ?? 1))
        gl.uniform4f(u('uHero'), ...(f.hero ? [f.hero[0], vh - f.hero[1], f.hero[2], f.hero[3]] as [number, number, number, number] : [0, 0, 0, 0] as [number, number, number, number]))
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      }
      passBegin('solid')
      gl.uniform1i(u('uTrans'), 0)
      solid()
      if (L.faces) {
        passBegin('trans')
        // The 64-bit look's translucent pass: only what is partly faded (near the eye, the window round the hero),
        // blended over what is drawn, writing no depth.
        gl.uniform1i(u('uTrans'), 1)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)
        solid(true)
        gl.depthMask(true)
        gl.disable(gl.BLEND)
        gl.uniform1i(u('uTrans'), 0)
      }
      passBegin('blobs+halos')
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
      if (f.halos && f.halos.count) {
        // Halos: added in, behind whatever stands in front of their lamp, writing no depth.
        gl.bindBuffer(gl.ARRAY_BUFFER, haloBuf)
        gl.bufferData(gl.ARRAY_BUFFER, f.halos.data.subarray(0, f.halos.count * STRIDE), gl.STREAM_DRAW)
        bindLayout(haloBuf)
        gl.enable(gl.BLEND)
        // (Light added, coverage kept: over the sky, which is drawn under this picture where it is clear, a halo's
        // alpha would lay a dark disc on it. Premultiplied, light with no alpha is a glow over whatever lies under.)
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE)
        gl.depthMask(false)
        gl.drawArrays(gl.TRIANGLES, 0, f.halos.count)
        gl.depthMask(true)
        gl.disable(gl.BLEND)
      }
      passBegin('resolve')
      resolve()
      passEnd()
      if (q && tq) { gl.endQuery(tq.TIME_ELAPSED_EXT); queries.push(q) }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindVertexArray(null)
    },
    dispose() {
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    },
  }
}

export { rgb }
