/**
 * The 16-bit view's shaders (GLSL ES 3.00). The frame is drawn in passes:
 *
 * 1. geometry: the ground, everything standing and every billboard into a
 *    G-buffer (colour, normal + height, material + emissive) with a z-buffer;
 * 2. lights: every lamp as a quad into a top-down light buffer (how much
 *    light of each colour reaches the ground there, and from where), and the
 *    blob shadows of what walks;
 * 3. lit: the G-buffer shaded with the light buffer, the low sun, its
 *    shadows marched through the tile heights, corner shade;
 * 4. composite: water (ripples, the sky and what stands by it mirrored),
 *    haze, the effects layer, the machine's 15-bit colour;
 * 5. bloom and the finish, at the screen's own resolution.
 *
 * Scene px run y-down; in a render target row 0 is the bottom, so a scene
 * px is (gl_FragCoord.x, height - gl_FragCoord.y).
 */

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`

const COMMON = `
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
/** The 4 x 4 ordered dither, 0..1. */
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
float bayer(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  return (BAYER[i.y * 4 + i.x] + 0.5) / 16.0;
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
`

/** Where a world point lands: shared by everything that is drawn in the world. */
const PROJECT = `
uniform vec2 uEx;
uniform vec2 uEy;
uniform float uZs;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec4 uDepth;
uniform float uDepthInv;
vec4 place(vec3 w, vec2 off) {
  vec2 s = uOrigin + w.x * uEx + w.y * uEy - vec2(0.0, w.z * uZs) + off;
  float d = (dot(w, uDepth.xyz) - uDepth.w) * uDepthInv;
  return vec4(s.x / uSize.x * 2.0 - 1.0, 1.0 - s.y / uSize.y * 2.0, 1.0 - 2.0 * d, 1.0);
}
`

/**
 * Pixel art seen at more than one px to the texel. Three things the classic
 * art gets on the way up:
 * - Scale2x: a staircase between two colours gets its missing half-steps;
 * - neighbouring texels of one material (colours close to each other) run
 *   into each other, so a three-shade ramp becomes a gradient, while an
 *   outline stays a hard line;
 * - the slope of its brightness, for the light to catch (`grad`), and the
 *   slope of its outline (`edge`).
 */
const ART = `
bool same(vec4 a, vec4 b) {
  vec4 d = abs(a - b);
  return max(max(d.r, d.g), max(d.b, d.a)) < 0.03;
}
float near(vec4 a, vec4 b) {
  if (a.a < 0.5 || b.a < 0.5) return 0.0;
  vec3 d = a.rgb - b.rgb;
  return 1.0 - smoothstep(0.10, 0.30, sqrt(dot(d, d)));
}
vec4 art(sampler2D t, vec2 uv, float soft, out vec2 grad, out vec2 edge) {
  ivec2 i = ivec2(floor(uv));
  vec2 f = uv - vec2(i);
  vec4 E = texelFetch(t, i, 0);
  vec4 B = texelFetch(t, i + ivec2(0, -1), 0);
  vec4 D = texelFetch(t, i + ivec2(-1, 0), 0);
  vec4 F = texelFetch(t, i + ivec2(1, 0), 0);
  vec4 H = texelFetch(t, i + ivec2(0, 1), 0);
  vec4 c = E;
  bool l = f.x < 0.5;
  bool u = f.y < 0.5;
  vec4 a = u ? B : H;
  vec4 b = l ? D : F;
  if (soft > 0.5) {
    vec4 a2 = u ? H : B;
    vec4 b2 = l ? F : D;
    if (same(a, b) && !same(a, b2) && !same(b, a2)) c = b;
  }
  if (soft > 0.0 && c.a >= 0.5) {
    vec2 g = abs(f - 0.5);
    vec3 base = c.rgb;
    c.rgb = mix(c.rgb, b.rgb, g.x * near(vec4(base, 1.0), b) * soft);
    c.rgb = mix(c.rgb, a.rgb, g.y * near(vec4(base, 1.0), a) * soft);
  }
  float le = luma(E.rgb);
  float lB = B.a < 0.5 ? le : luma(B.rgb);
  float lD = D.a < 0.5 ? le : luma(D.rgb);
  float lF = F.a < 0.5 ? le : luma(F.rgb);
  float lH = H.a < 0.5 ? le : luma(H.rgb);
  grad = vec2(lF - lD, lH - lB);
  edge = vec2(step(0.5, F.a) - step(0.5, D.a), step(0.5, H.a) - step(0.5, B.a));
  return c;
}
`

/** How much a colour is neon: bright and saturated. Neon shines by itself. */
const NEON = `
float neon(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / max(mx, 0.001);
  return smoothstep(0.74, 0.96, mx) * smoothstep(0.30, 0.62, sat);
}
`

// ---------------------------------------------------------------------------
// 1. Geometry
// ---------------------------------------------------------------------------

export const GEOM_ATTRIBS = ['aPos', 'aOff', 'aUV', 'aMeta'] as const

export const GEOM_VS = HEAD + PROJECT + `
in vec3 aPos;
in vec2 aOff;
in vec2 aUV;
in vec4 aMeta;
uniform float uTime;
uniform vec3 uHero;
out vec2 vUV;
out vec4 vMeta;
out vec3 vWorld;
out float vFoot;
void main() {
  vec2 off = aOff;
  vec3 w = aPos;
  int kind = int(aMeta.x + 0.5);
  if (kind == 7 && w.z > 0.05) {
    // A plant: its top leans with the wind, and away from whoever walks through it.
    float ph = w.x * 1.7 + w.y * 2.3;
    float bend = (sin(uTime * 1.6 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.7)) * min(w.z, 1.2) * 2.2 * uHero.z * aMeta.z;
    vec2 away = w.xy - uHero.xy;
    float d = length(away);
    bend += sign(away.x - away.y) * smoothstep(0.9, 0.15, d) * 5.0 * min(1.0, w.z * 2.0) * step(0.5, aMeta.z);
    off.x += floor(bend + 0.5);
  }
  gl_Position = place(w, off);
  vUV = aUV;
  vMeta = aMeta;
  vWorld = w;
  vFoot = dot(vec3(w.xy, 0.0), uDepth.xyz);
}
`

/**
 * aMeta: x = kind, y = which picture, z = shade (0 as painted .. 1 dark), w = how far down a side (0 top .. 1 foot).
 * Kinds: 0 lies flat (a roof, a wall's top), 1 faces south, 2 faces east,
 * 3 a billboard facing the viewer, 4 a thing on a south wall, 7 a plant.
 */
export const GEOM_FS = HEAD + COMMON + ART + NEON + `
in vec2 vUV;
in vec4 vMeta;
in vec3 vWorld;
in float vFoot;
uniform vec4 uVeil;
uniform float uSceneH;
uniform sampler2D uObjs;
uniform sampler2D uAtlas;
uniform sampler2D uFlora;
uniform sampler2D uFloraN;
uniform float uSoft;
uniform float uBump;
uniform float uRound;
uniform float uEmit;
uniform vec3 uViewN;
uniform vec3 uRight;
uniform float uGhost;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  int kind = int(vMeta.x + 0.5);
  int pic = int(vMeta.y + 0.5);
  vec2 grad;
  vec2 edge;
  vec4 c;
  if (pic == 0) c = art(uObjs, vUV, uSoft, grad, edge);
  else if (pic == 1) c = art(uAtlas, vUV, uSoft, grad, edge);
  else { c = texelFetch(uFlora, ivec2(floor(vUV)), 0); grad = vec2(0.0); edge = vec2(0.0); }
  if (kind == 7 && uVeil.w > 0.0 && vFoot > uVeil.z + 0.15) {
    // A crown between the viewer and the hero thins out round them, so nobody is lost in the woods.
    vec2 q = (vec2(gl_FragCoord.x, uSceneH - gl_FragCoord.y) - uVeil.xy) * vec2(1.0, 1.25);
    float open = smoothstep(uVeil.w, uVeil.w * 0.5, length(q)) * 0.82;
    if (open > bayer(gl_FragCoord.xy)) discard;
  }
  // Glass and smoke are a dither; the classic art's own drop shadows go (the light throws real ones).
  if (c.a < 0.999) {
    if (c.a < 0.7 && luma(c.rgb) < 0.12) discard;
    if (c.a < bayer(gl_FragCoord.xy) * 0.9 + 0.05) discard;
  }
  if (kind == 3 && uSoft > 0.0 && luma(c.rgb) < 0.11) {
    // The 8-bit outline is one black for everything. A 16-bit one takes the colour of what it goes
    // round: the darkest shade of the hair, the coat, the leaf.
    ivec2 i = ivec2(floor(vUV));
    vec3 best = vec3(0.0);
    float bl = 0.0;
    for (int j = 0; j < 4; j++) {
      ivec2 o = j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1);
      vec4 q = pic == 0 ? texelFetch(uObjs, i + o, 0) : texelFetch(uAtlas, i + o, 0);
      float l = luma(q.rgb);
      if (q.a > 0.5 && l > bl) { bl = l; best = q.rgb; }
    }
    if (bl > 0.16) c.rgb = mix(c.rgb, best * 0.36 + vec3(0.02, 0.0, 0.05), uSoft);
  }
  vec3 N; vec3 Tu; vec3 Tv;
  float mat = 2.0;
  if (kind == 0) { N = vec3(0, 0, 1); Tu = vec3(1, 0, 0); Tv = vec3(0, 1, 0); }
  else if (kind == 1 || kind == 4) { N = vec3(0, 1, 0); Tu = vec3(1, 0, 0); Tv = vec3(0, 0, -1); }
  else if (kind == 2) { N = vec3(1, 0, 0); Tu = vec3(0, 1, 0); Tv = vec3(0, 0, -1); }
  else { N = uViewN; Tu = uRight; Tv = vec3(0, 0, -1); mat = 3.0; }
  vec3 n;
  if (pic == 2) {
    // A plant brings its own normals, in its own space: right, up, toward the viewer.
    vec3 m = texelFetch(uFloraN, ivec2(floor(vUV)), 0).rgb * 2.0 - 1.0;
    n = normalize(m.x * Tu + m.y * vec3(0, 0, 1) + m.z * N);
    mat = 4.0;
  } else {
    // A figure's colours are its clothes, not its relief: only its outline shapes it.
    vec2 g = clamp(grad, -0.35, 0.35) * uBump * (mat == 3.0 ? 0.12 : 1.0);
    n = N - g.x * Tu - g.y * Tv;
    if (mat == 3.0) {
      // A drawing is flat; its outline says how round the thing was. Look further out for the edge, so the
      // whole figure swells toward the viewer and not just its rim.
      ivec2 i = ivec2(floor(vUV));
      vec2 far = vec2(0.0);
      for (int r = 2; r <= 6; r += 2) {
        float w = r == 2 ? 0.6 : r == 4 ? 0.45 : 0.3;
        if (pic == 0) {
          far.x += w * (step(0.5, texelFetch(uObjs, i + ivec2(r, 0), 0).a) - step(0.5, texelFetch(uObjs, i - ivec2(r, 0), 0).a));
          far.y += w * (step(0.5, texelFetch(uObjs, i + ivec2(0, r), 0).a) - step(0.5, texelFetch(uObjs, i - ivec2(0, r), 0).a));
        } else {
          far.x += w * (step(0.5, texelFetch(uAtlas, i + ivec2(r, 0), 0).a) - step(0.5, texelFetch(uAtlas, i - ivec2(r, 0), 0).a));
          far.y += w * (step(0.5, texelFetch(uAtlas, i + ivec2(0, r), 0).a) - step(0.5, texelFetch(uAtlas, i - ivec2(0, r), 0).a));
        }
      }
      vec2 e = edge * 0.7 + far;
      n -= uRound * (e.x * Tu + e.y * Tv);
    }
    n = normalize(n);
  }
  // People wear neon too, but only signs and screens are lamps.
  float em = neon(c.rgb) * uEmit * (pic == 1 ? 0.55 : 1.0);
  if (uGhost > 0.5) {
    // The hero behind a wall or a crown: every other px of them, the 16-bit way to see through.
    if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
    c.rgb = mix(c.rgb, vec3(0.5, 0.9, 1.0), 0.3);
    em = 0.85;
  }
  // The sides nobody drew are the face again, darker toward the ground in dithered steps.
  float shade = kind == 7 ? 0.0 : vMeta.z;
  if (shade > 0.0) {
    float lv = vMeta.w * 4.0;
    float st = floor(lv) + step(bayer(gl_FragCoord.xy), fract(lv));
    c.rgb *= 1.0 - shade * (0.55 + 0.45 * st / 4.0);
  }
  o0 = vec4(c.rgb, 1.0);
  o1 = vec4(n * 0.5 + 0.5, clamp(vWorld.z / 4.0, 0.0, 1.0));
  o2 = vec4(mat / 255.0, em, 0.0, 1.0);
}
`

export const GROUND_VS = HEAD + PROJECT + `
in vec2 aPos;
out vec2 vW;
void main() {
  gl_Position = place(vec3(aPos, 0.0), vec2(0.0));
  vW = aPos;
}
`

export const GROUND_FS = HEAD + COMMON + ART + NEON + `
in vec2 vW;
uniform sampler2D uFlat;
uniform sampler2D uTiles;
uniform vec4 uRect;
uniform float uSoft;
uniform float uBump;
uniform float uEmit;
uniform vec4 uRooms[2];
uniform int uRoomCount;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  if (uRoomCount > 0) {
    bool inside = false;
    for (int i = 0; i < 2; i++) {
      if (i >= uRoomCount) break;
      vec4 r = uRooms[i];
      if (vW.x >= r.x && vW.y >= r.y && vW.x < r.x + r.z && vW.y < r.y + r.w) inside = true;
    }
    if (!inside) discard;
  }
  vec2 grad;
  vec2 edge;
  vec4 c = art(uFlat, (vW - uRect.xy) * 16.0, uSoft, grad, edge);
  if (c.a < 0.5) discard;
  vec2 g = clamp(grad, -0.35, 0.35) * uBump;
  vec3 n = normalize(vec3(-g.x, -g.y, 1.0));
  vec4 td = texelFetch(uTiles, ivec2(floor(vW)), 0);
  float mat = td.g > 0.5 ? 1.0 : 0.0;
  o0 = vec4(c.rgb, 1.0);
  o1 = vec4(n * 0.5 + 0.5, 0.0);
  // How wet the ground is here: pavement after rain, a polished floor.
  o2 = vec4(mat / 255.0, neon(c.rgb) * uEmit, td.b, 1.0);
}
`

// ---------------------------------------------------------------------------
// 2. Lights and blob shadows, top-down
// ---------------------------------------------------------------------------

export const LIGHT_ATTRIBS = ['aCorner', 'aLight', 'aColor'] as const

export const LIGHT_VS = HEAD + `
in vec2 aCorner;
in vec4 aLight;
in vec3 aColor;
uniform vec4 uRect;
uniform vec2 uScale;
out vec2 vP;
out vec4 vLight;
out vec3 vColor;
void main() {
  gl_Position = vec4((aCorner - uRect.xy) * uScale * 2.0 - 1.0, 0.0, 1.0);
  vP = aCorner;
  vLight = aLight;
  vColor = aColor;
}
`

/**
 * One lamp on the ground: the classic glow's falloff, cut off where a wall
 * or a roof stands between the lamp and the ground. Three outputs: the
 * light itself, and for each colour channel which way it came from.
 */
export const LIGHT_FS = HEAD + `
in vec2 vP;
in vec4 vLight;
in vec3 vColor;
uniform sampler2D uTiles;
uniform vec2 uMap;
uniform float uOcclude;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
float heightAt(vec2 w) {
  if (w.x < 0.0 || w.y < 0.0 || w.x >= uMap.x || w.y >= uMap.y) return 0.0;
  return texelFetch(uTiles, ivec2(floor(w)), 0).r * 4.0;
}
void main() {
  vec2 d = vLight.xy - vP;
  float dist = length(d);
  float t = dist / vLight.w;
  if (t >= 1.0) discard;
  float f = t < 0.35 ? 1.0 - 0.333 * t / 0.35 : 0.667 * (1.0 - (t - 0.35) / 0.65);
  if (uOcclude > 0.0 && dist > 0.9) {
    // Walk toward the lamp; the last stretch is the lamp's own tile.
    float vis = 1.0;
    float reach = dist - 0.7;
    for (int i = 1; i <= 8; i++) {
      float s = float(i) / 8.5;
      vec2 p = vP + d / dist * reach * s;
      float rz = mix(0.05, vLight.z, s * reach / dist);
      if (heightAt(p) > rz + 0.3) { vis = 0.0; break; }
    }
    f *= mix(1.0, vis, uOcclude);
  }
  vec3 c = vColor * f;
  vec3 dir = normalize(vec3(d, vLight.z + 0.45));
  o0 = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)) * dir.z);
  o1 = vec4(c.r * dir.xy, c.g * dir.xy);
  o2 = vec4(c.b * dir.xy, 0.0, 0.0);
}
`

export const BLOB_ATTRIBS = ['aCorner', 'aLocal'] as const

export const BLOB_VS = HEAD + `
in vec2 aCorner;
in vec3 aLocal;
uniform vec4 uRect;
uniform vec2 uScale;
out vec3 vLocal;
void main() {
  gl_Position = vec4((aCorner - uRect.xy) * uScale * 2.0 - 1.0, 0.0, 1.0);
  vLocal = aLocal;
}
`

export const BLOB_FS = HEAD + `
in vec3 vLocal;
out vec4 o0;
void main() {
  float d = length(vLocal.xy);
  float a = smoothstep(1.0, 0.45, d) * vLocal.z;
  o0 = vec4(a, 0.0, 0.0, a);
}
`

// ---------------------------------------------------------------------------
// 3–5. Full-screen passes
// ---------------------------------------------------------------------------

export const QUAD_VS = HEAD + `
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

/** The ground under this scene px, for something `z` tiles up. */
const GROUND_OF = `
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform vec4 uInv;
uniform float uZs;
vec2 scenePx() { return vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); }
vec2 groundOf(vec2 s, float z) {
  vec2 q = s - uOrigin + vec2(0.0, z * uZs);
  return vec2(uInv.x * q.x + uInv.y * q.y, uInv.z * q.x + uInv.w * q.y);
}
`

export const LIT_FS = HEAD + COMMON + GROUND_OF + `
uniform sampler2D uG0;
uniform sampler2D uG1;
uniform sampler2D uG2;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
uniform sampler2D uBlob;
uniform sampler2D uTiles;
uniform sampler2D uTilesLin;
uniform vec2 uMap;
uniform vec4 uRect;
uniform vec2 uLScale;
uniform vec3 uAmbient;
uniform float uDirectional;
uniform vec3 uSun;
uniform float uShadowLen;
uniform float uShadow;
uniform vec3 uShadowTint;
uniform float uShading;
uniform float uRim;
uniform float uAo;
uniform float uGlow;
uniform float uOutdoors;
uniform float uK;
uniform float uTime;
uniform float uClouds;
uniform float uCloudDrift;
out vec4 o0;
float heightAt(vec2 w) {
  if (w.x < 0.0 || w.y < 0.0 || w.x >= uMap.x || w.y >= uMap.y) return 0.0;
  return texelFetch(uTiles, ivec2(floor(w)), 0).r * 4.0;
}
/** 1 where something stands between this point and the low sun. */
float sunShadow(vec2 w, float z, float jit) {
  float far = (2.05 - z) * uShadowLen;
  if (far <= 0.0 || uShadowLen <= 0.0) return 0.0;
  const int N = 22;
  float st = far / float(N);
  for (int i = 0; i < N; i++) {
    float t = (float(i) + jit) * st + 0.01;
    float rz = z + t / uShadowLen;
    if (heightAt(w + uSun.xy * t) > rz + 0.03) return 1.0;
  }
  return 0.0;
}
void main() {
  ivec2 pix = ivec2(gl_FragCoord.xy);
  vec4 g2 = texelFetch(uG2, pix, 0);
  if (g2.a < 0.5) { o0 = vec4(0.0); return; }
  vec4 g0 = texelFetch(uG0, pix, 0);
  vec4 g1 = texelFetch(uG1, pix, 0);
  int mat = int(g2.r * 255.0 + 0.5);
  float z = g1.a * 4.0;
  vec3 n = normalize(g1.rgb * 2.0 - 1.0);
  vec2 s = scenePx();
  vec2 w = groundOf(s, z);
  float dith = bayer(s);

  // The lamps: how much of each colour reaches the ground here, and from which side.
  vec2 luv = (w - uRect.xy) * uLScale;
  vec4 l0 = texture(uL0, luv);
  vec4 l1 = texture(uL1, luv);
  vec4 l2 = texture(uL2, luv);
  vec3 irr = l0.rgb;
  vec3 inv = 1.0 / max(irr, vec3(0.004));
  vec3 side = vec3(dot(n.xy, l1.xy) * inv.r, dot(n.xy, l1.zw) * inv.g, dot(n.xy, l2.xy) * inv.b);
  float lift = mat >= 3 ? 0.42 : 0.16;
  vec3 facing = clamp(n.z + 1.25 * side, lift, 1.6);
  // On a figure the light falls in steps, the way a pixel artist shades: new detail at the new size.
  if (mat == 3) facing = floor(facing * 4.0 + 0.5) / 4.0;
  vec3 lamp = irr * mix(vec3(1.0), facing, uDirectional);

  // The sky's light, the low sun and what is in its shade.
  float shade = 0.0;
  float rim = 0.0;
  if (uOutdoors > 0.5) {
    float sunny = clamp(dot(n, uSun) / max(uSun.z, 0.05), 0.0, 1.6);
    // Leaves let the light through: a crown is never as dark as a wall's shaded side.
    if (mat == 4) sunny = clamp(dot(n, uSun) * 0.6 + 0.62, 0.0, 1.35);
    // A figure is lit from above and from the sun's side, in steps.
    if (mat == 3) sunny = floor(clamp(dot(n, normalize(uSun + vec3(0.0, 0.0, 0.9))) * 0.75 + 0.5, 0.0, 1.25) * 5.0 + 0.5) / 5.0;
    float inShadow = uShadow > 0.0 ? sunShadow(w + n.xy * 0.06, z, dith) : 0.0;
    float lit = min(1.0, sunny) * (1.0 - inShadow);
    shade = max(uShadow * inShadow, uShading * (1.0 - min(1.0, sunny)) * 0.75);
    shade = max(shade, uShadow * inShadow * (1.0 - lit));
    rim = max(0.0, sunny - 1.0) * (1.0 - inShadow);
    // Cloud shadows drift over the coast.
    if (uClouds > 0.0) {
      vec2 cw = w * 0.11 + vec2(uCloudDrift, uCloudDrift * 0.35);
      float cl = vnoise(cw) * 0.6 + vnoise(cw * 2.3 + 7.0) * 0.4;
      float cs = smoothstep(0.56, 0.68, cl + (dith - 0.5) * 0.05);
      shade = max(shade, cs * uClouds * 0.55);
    }
  } else {
    // Indoors the light is the lamps'; what faces away from the room is dimmer.
    shade = uShading * (1.0 - clamp(n.z + 0.75 * max(n.y, n.x), 0.0, 1.0)) * 0.35;
  }
  // What walks throws a blob away from the nearest light.
  if (mat < 3) shade = max(shade, texture(uBlob, luv).r * uShadow * 1.15);
  // Corner shade: darker where a wall meets the floor.
  float occ = 0.0;
  if (uAo > 0.0 && mat <= 2) {
    float hl = texture(uTilesLin, (w + n.xy * 0.2) / uMap).r * 4.0;
    occ = smoothstep(z + 0.05, z + 0.85, hl) * (1.0 - smoothstep(z + 0.9, z + 1.0, heightAt(w)));
    occ *= uAo * 0.6;
  }
  shade = min(1.0, shade);
  vec3 amb = uAmbient * mix(vec3(1.0), uShadowTint, shade) * (1.0 - occ);
  amb += vec3(1.0, 0.72, 0.5) * rim * uRim * 0.5;
  vec3 light = min(amb + lamp, vec3(mix(1.0, 1.35, uK)));
  vec3 c = g0.rgb * light;
  // Light hangs in the air over the ground it falls on: the classic view's glow, lying down.
  c += (1.0 - exp(-irr * 1.2)) * 0.3 * uGlow * (mat >= 3 ? 0.6 : 1.0);
  float em = g2.g;
  c = mix(c, g0.rgb * 1.08, em);
  o0 = vec4(c, em);
}
`

export const COMPOSITE_FS = HEAD + COMMON + NEON + GROUND_OF + `
uniform sampler2D uLit;
uniform sampler2D uG1;
uniform sampler2D uG2;
uniform sampler2D uL0;
uniform sampler2D uTilesLin;
uniform sampler2D uFx;
uniform sampler2D uSky;
uniform vec2 uMap;
uniform vec4 uRect;
uniform vec2 uLScale;
uniform float uTime;
uniform float uK;
uniform float uMirror;
uniform float uHaze;
uniform vec3 uHazeColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uSkyOn;
uniform vec3 uVoid;
uniform float uColorBits;
uniform float uWater;
uniform vec3 uCast;
uniform float uMist;
uniform vec3 uMistColor;
uniform float uRays;
uniform float uWet;
out vec4 o0;

vec3 skyColor(vec2 s) {
  if (uSkyOn < 0.5) return uVoid;
  vec4 k = texture(uSky, vec2(s.x / uSize.x, s.y / uSize.y));
  return mix(uVoid, k.rgb, uK);
}

void main() {
  ivec2 pix = ivec2(gl_FragCoord.xy);
  vec2 s = scenePx();
  vec4 g2 = texelFetch(uG2, pix, 0);
  vec4 lit = texelFetch(uLit, pix, 0);
  vec3 c = lit.rgb;
  float em = lit.a;
  int mat = int(g2.r * 255.0 + 0.5);
  if (g2.a < 0.5) {
    c = skyColor(s);
    // The sun and the far lights shine.
    em = neon(c) * 0.55 * uK;
  } else if (mat == 1 && uWater > 0.0) {
    vec2 w = groundOf(s, 0.0);
    float t = uTime;
    // Across the screen and into it: the crests run across, as water seen from the side does.
    float u = (w.x - w.y) * 0.7071;
    float v = (w.x + w.y) * 0.7071;
    float wob = vnoise(vec2(u * 0.9 + t * 0.15, v * 2.1 - t * 0.1));
    float line = sin(v * 9.0 + wob * 5.0 + t * 0.9);
    float gate = vnoise(vec2(u * 2.3 - t * 0.25, v * 6.0 + 3.0));
    float crest = smoothstep(0.86, 0.95, line) * smoothstep(0.48, 0.6, gate);
    float trough = smoothstep(-0.8, -0.97, line);
    // The shore: how far in from the land we are.
    float wet = texture(uTilesLin, w / uMap).g;
    float deep = smoothstep(0.5, 1.0, wet);
    // The dusk lies on the water: its horizon in the shallows, its top out where it is deep.
    vec3 skyc = mix(uSkyHorizon, uSkyTop, 0.35 + 0.65 * deep);
    vec3 wcol = c * (1.0 - 0.16 * trough * uWater);
    wcol = mix(wcol, wcol * 0.72 + skyc * 0.26, uWater * (0.35 + 0.45 * deep));
    // What stands by the water, upside down in it.
    if (uMirror > 0.0) {
      float sway = floor((wob - 0.5) * 5.0 + line * 0.8);
      for (int i = 1; i <= 28; i++) {
        float up = float(i) * 2.0;
        ivec2 p2 = ivec2(vec2(gl_FragCoord.x + sway, gl_FragCoord.y + up));
        if (p2.y >= int(uSize.y) || p2.x < 0 || p2.x >= int(uSize.x)) break;
        vec4 h2 = texelFetch(uG2, p2, 0);
        if (h2.a < 0.5 || int(h2.r * 255.0 + 0.5) == 1) continue;
        float hz = texelFetch(uG1, p2, 0).a * 4.0 * uZs;
        // A point that high shows in the water twice its height below itself.
        if (hz > 1.5 && abs(hz * 2.0 - up) <= 2.5 + hz * 0.12) {
          vec3 rc = texelFetch(uLit, p2, 0).rgb;
          float fade = 1.0 - float(i) / 30.0;
          wcol = mix(wcol, rc * 0.85 + skyc * 0.08, uMirror * 0.8 * fade);
          break;
        }
      }
    }
    // Crests catch the sky, and every lamp glitters on them.
    vec3 irr = texture(uL0, (w - uRect.xy) * uLScale).rgb;
    wcol += (skyc * 0.35 + vec3(0.16, 0.3, 0.4)) * crest * 0.6 * uWater;
    wcol += irr * crest * 1.1 * uWater;
    // Foam where it meets the land, coming and going.
    float lap = 0.56 + 0.035 * sin(t * 1.3 + u * 3.0) + 0.03 * (gate - 0.5);
    float foam = smoothstep(lap + 0.03, lap, wet) * smoothstep(lap - 0.07, lap - 0.03, wet) * step(0.32, gate);
    wcol = mix(wcol, vec3(0.62, 0.86, 0.98) * (0.55 + luma(skyc) * 0.6) + irr * 0.5, foam * 0.7 * uWater);
    c = wcol;
    em = max(em, crest * luma(irr) * 0.8 * uWater);
  }
  if (g2.a >= 0.5 && mat == 0 && uWet > 0.0 && g2.b > 0.02) {
    // Wet pavement and polished floors: the lamps and signs above them show in them, pulled out into a streak.
    vec3 acc = vec3(0.0);
    for (int i = 1; i <= 20; i++) {
      float up = float(i) * 3.0;
      ivec2 p2 = pix + ivec2(0, int(up));
      if (p2.y >= int(uSize.y)) break;
      vec4 l = texelFetch(uLit, p2, 0);
      if (l.a < 0.6) continue;
      float hz = texelFetch(uG1, p2, 0).a * 4.0 * uZs;
      float fit = 1.0 - abs(hz * 2.0 - up) / (9.0 + hz * 0.25);
      if (hz > 2.0 && fit > 0.0) acc += l.rgb * fit * (1.0 - float(i) / 21.0);
    }
    c += acc * g2.b * uWet * 0.11;
  }
  // Haze: what is far away takes the colour of the dusk, in bands.
  if (uHaze > 0.0 && g2.a >= 0.5) {
    float far = 1.0 - s.y / (uSize.y * 0.62);
    if (far > 0.0) {
      float band = floor(far * 9.0 + bayer(s) * 0.9) / 9.0;
      float a = uHaze * 0.5 * pow(band, 1.6);
      c = 1.0 - (1.0 - c) * (1.0 - uHazeColor * a);
    }
  }
  if (g2.a >= 0.5 && (uMist > 0.0 || uRays > 0.0)) {
    float z = texelFetch(uG1, pix, 0).a * 4.0;
    vec2 w = groundOf(s, z);
    if (uMist > 0.0) {
      // Mist lies low over the ground and drifts: colour laid over colour, in dithered steps.
      vec2 mw = w * 0.17 + vec2(uTime * 0.03, uTime * 0.011);
      float m = vnoise(mw) * 0.62 + vnoise(mw * 2.7 + 5.0) * 0.38;
      m = smoothstep(0.42, 0.78, m) * (1.0 - smoothstep(0.15, 1.5, z));
      float band = floor(m * 4.0 + bayer(s) * 0.99) / 4.0;
      c = mix(c, c * 0.55 + uMistColor, band * uMist * 0.55);
    }
    if (uRays > 0.0) {
      // The low sun comes through in shafts, slanting down from the west.
      float axis = s.x * 0.82 + s.y * 0.57;
      float r = vnoise(vec2(axis * 0.011 + uTime * 0.012, 3.0)) * 0.7 + vnoise(vec2(axis * 0.04 - uTime * 0.02, 9.0)) * 0.3;
      float shaft = smoothstep(0.52, 0.74, r);
      shaft = floor(shaft * 3.0 + bayer(s) * 0.99) / 3.0;
      c += vec3(1.0, 0.72, 0.5) * shaft * uRays * 0.11 * (0.5 + 0.5 * smoothstep(0.0, 1.5, z + 0.6));
    }
  }
  // A mood's colour cast over the whole picture (the Other Side's red-violet).
  c *= uCast;
  // Shots, sparks and the screen's flash lie over everything, at full brightness.
  vec4 fx = texelFetch(uFx, ivec2(s), 0);
  c = mix(c, fx.rgb, fx.a);
  em = max(em * (1.0 - fx.a), fx.a * step(0.25, luma(fx.rgb)) * 0.8);
  // The machine's colours: five bits a channel, the rest is a dither.
  if (uColorBits > 0.0) {
    float lv = exp2(uColorBits) - 1.0;
    c = floor(c * lv + 0.5 + (bayer(s) - 0.5) * 0.55) / lv;
  }
  o0 = vec4(c, em);
}
`

/** What glows, gathered at a quarter of the size. */
export const BRIGHT_FS = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 o0;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel * 4.0;
  vec3 sum = vec3(0.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec4 c = texture(uSrc, uv + (vec2(x, y) - 0.5) * 2.0 * uTexel);
    float mx = max(c.r, max(c.g, c.b));
    sum += c.rgb * (c.a * 1.0 + smoothstep(0.85, 1.0, mx) * 0.25);
  }
  o0 = vec4(sum * 0.25, 1.0);
}
`

export const BLUR_FS = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uStep;
out vec4 o0;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSrc, 0));
  vec3 c = texture(uSrc, uv).rgb * 0.227;
  c += (texture(uSrc, uv + uStep * 1.385).rgb + texture(uSrc, uv - uStep * 1.385).rgb) * 0.316;
  c += (texture(uSrc, uv + uStep * 3.231).rgb + texture(uSrc, uv - uStep * 3.231).rgb) * 0.070;
  o0 = vec4(c, 1.0);
}
`

/** The finished scene on the glass: whole-number upscale, the glow over it, vignette, scanlines, the fade. */
export const FINISH_FS = HEAD + `
uniform sampler2D uScene;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform vec2 uScreen;
uniform vec2 uSize;
uniform float uHs;
uniform vec2 uOff;
uniform float uBloom;
uniform float uVignette;
uniform float uScan;
uniform float uScanStep;
uniform float uFade;
uniform vec3 uFadeTo;
uniform float uMosaic;
uniform float uWave;
uniform float uTime;
uniform vec3 uIris;
out vec4 o0;
void main() {
  vec2 d = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y);
  vec2 sp = (d - uOff) / uHs;
  // The machine's own tricks: a wave down the scanlines, and the picture breaking into mosaic.
  if (uWave > 0.0) sp.x += floor(sin(floor(sp.y) * 0.11 + uTime * 2.6) * uWave + 0.5);
  if (uMosaic > 1.0) sp = (floor(sp / uMosaic) + 0.5) * uMosaic;
  ivec2 pix = ivec2(int(floor(sp.x)), int(uSize.y) - 1 - int(floor(sp.y)));
  vec3 c = texelFetch(uScene, clamp(pix, ivec2(0), ivec2(uSize) - 1), 0).rgb;
  vec2 uv = vec2(sp.x / uSize.x, 1.0 - sp.y / uSize.y);
  vec3 glow = texture(uBloomA, uv).rgb * 0.6 + texture(uBloomB, uv).rgb * 0.8;
  c += glow * uBloom;
  if (uScan > 0.0) {
    float row = mod(d.y, uScanStep);
    if (row < max(1.0, floor(uScanStep / 3.0))) c *= 1.0 - 0.13 * uScan;
  }
  if (uVignette > 0.0) {
    vec2 q = (d - uScreen * 0.5) / max(uScreen.x, uScreen.y);
    float v = smoothstep(0.35 * min(uScreen.x, uScreen.y) / max(uScreen.x, uScreen.y), 0.75, length(q));
    c = mix(c, vec3(0.043, 0.024, 0.086), min(1.0, v * 0.55 * uVignette));
  }
  c = mix(c, uFadeTo, uFade);
  // The iris: the picture closes to a circle round the hero.
  if (uIris.z >= 0.0) {
    float q = length(floor((d - uIris.xy) / uHs));
    if (q * uHs > uIris.z) c = uFadeTo;
  }
  o0 = vec4(c, 1.0);
}
`
