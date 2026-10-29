/**
 * Space Voyagers II: how a model is coloured and outlined. A face takes one
 * of its material's four tones by how much it faces the sun (no smooth
 * shading, no blending), and the scene's silhouettes get a one-pixel ink line
 * from the depth buffer (DESIGN.md, "The picture").
 *
 * The scene is drawn into a target (colour and depth). The post pass puts
 * it on the canvas over the sky: an object's pixel where there is depth, a
 * bolt or a spark (drawn without depth) where its colour has alpha, ink
 * where a background pixel touches an object, and nothing else (the sky
 * shows through).
 */
import * as THREE from 'three'
import { hexRgb, INK, RAMPS } from './palette'

const RAMP_COUNT = RAMPS.length * 4

/** The ramps as one uniform array, shared by every ship's material. */
export const rampUniform = {
  value: RAMPS.flatMap(r => r.map(h => new THREE.Color(...hexRgb(h)))),
}
/** The sun, a world direction (towards the light). Light from the upper left, a little in front. */
export const sunUniform = { value: new THREE.Vector3(-0.55, 0.7, -0.45).normalize() }

const VERT = /* glsl */ `
  attribute float mat;
  varying vec3 vN;
  varying float vMat;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vMat = mat;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const FRAG = /* glsl */ `
  uniform vec3 uRamp[${RAMP_COUNT}];
  uniform vec3 uSun;
  uniform float uFlash;
  varying vec3 vN;
  varying float vMat;
  void main() {
    float l = dot(normalize(vN), uSun);
    int band = l > 0.5 ? 3 : (l > 0.1 ? 2 : (l > -0.4 ? 1 : 0));
    int m = int(vMat + 0.5);
    // A hit: the whole ship one band lighter for a moment.
    if (uFlash > 0.5) band = min(3, band + 1);
    // Self-lit things (the fire) ignore the sun: their two lightest tones.
    if (m == 5) band = 2 + int(mod(gl_FragCoord.x + gl_FragCoord.y, 2.0));
    gl_FragColor = vec4(uRamp[m * 4 + band], 1.0);
  }`

/** A material for one ship (each its own, so a hit can flash it alone). */
export function toonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uRamp: rampUniform, uSun: sunUniform, uFlash: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.FrontSide,
  })
}

const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const POST_FRAG = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform vec3 uInk;
  varying vec2 vUv;
  float d(vec2 o) { return texture2D(tDepth, vUv + o * uTexel).x; }
  void main() {
    vec4 c = texture2D(tColor, vUv);
    float here = d(vec2(0.0));
    if (here < 0.9999) { gl_FragColor = vec4(c.rgb, 1.0); return; }
    if (c.a > 0.0) { gl_FragColor = vec4(c.rgb, 1.0); return; }
    float n = min(min(d(vec2(1.0, 0.0)), d(vec2(-1.0, 0.0))), min(d(vec2(0.0, 1.0)), d(vec2(0.0, -1.0))));
    if (n < 0.9999) { gl_FragColor = vec4(uInk, 1.0); return; }
    gl_FragColor = vec4(0.0);
  }`

export interface PostPass {
  target: THREE.WebGLRenderTarget
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  resize(w: number, h: number): void
  dispose(): void
}

export function createPost(): PostPass {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  })
  target.depthTexture = new THREE.DepthTexture(4, 4)
  target.depthTexture.minFilter = THREE.NearestFilter
  target.depthTexture.magFilter = THREE.NearestFilter
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      uTexel: { value: new THREE.Vector2(0.25, 0.25) },
      uInk: { value: new THREE.Color(...hexRgb(INK)) },
    },
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  return {
    target, scene, camera,
    resize(w, h) {
      target.setSize(w, h)
      ;(mat.uniforms.uTexel!.value as THREE.Vector2).set(1 / w, 1 / h)
    },
    dispose() {
      target.dispose()
      mat.dispose()
      quad.geometry.dispose()
    },
  }
}
