/**
 * The model lab's world: the game's lights, a biome sky and ground, the
 * ridges and the striped sun, built the way Flight.vue builds them so
 * models are judged against what the game shows.
 */
import * as THREE from 'three'
import { BIOMES, createGroundMaterial, createSkyMaterial, setBiome, tickBiome, type BiomeId } from '../pixel'

export interface Backdrop {
  ground: THREE.ShaderMaterial
  sky: THREE.ShaderMaterial
  setBiome(id: BiomeId): void
  tick(t: number, offset: number): void
  sun: THREE.Mesh
  ridges: THREE.InstancedMesh
}

export function buildBackdrop(scene: THREE.Scene): Backdrop {
  scene.fog = new THREE.Fog('#6a2a7c', 60, 340)
  scene.background = new THREE.Color('#0b0616')
  // The game's three lights, as in Flight.vue buildScene.
  scene.add(new THREE.HemisphereLight(0x9a7bff, 0x0b0616, 1.0))
  const key = new THREE.DirectionalLight(0xff2fa0, 1.4)
  key.position.set(-6, 10, -20)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x2ff3ff, 0.9)
  fill.position.set(6, -2, 8)
  scene.add(fill)

  const sky = createSkyMaterial()
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), sky)
  skyMesh.renderOrder = -5
  scene.add(skyMesh)

  const sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#fff1b0') }, bottom: { value: new THREE.Color('#ff2fa0') } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 top; uniform vec3 bottom;
      void main() {
        vec2 p = vUv - 0.5;
        if (length(p) > 0.5) discard;
        float y = vUv.y;
        if (fract(y * 11.0) < (1.0 - y) * 0.42) discard;
        gl_FragColor = vec4(mix(bottom, top, pow(y, 1.1)), 1.0);
      }`,
  })
  const sun = new THREE.Mesh(new THREE.CircleGeometry(55, 48), sunMat)
  sun.position.set(300, 30, -460)
  sun.lookAt(0, 3.8, 11.5)
  sun.renderOrder = -2
  scene.add(sun)

  const groundMat = createGroundMaterial()
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 800, 1, 1), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -5, -260)
  ground.renderOrder = -1
  scene.add(ground)

  const ridges = buildRidges()
  scene.add(ridges)

  return {
    ground: groundMat,
    sky,
    sun,
    ridges,
    setBiome(id) {
      const b = BIOMES[id]
      setBiome(groundMat, id, sky)
      ;(scene.fog as THREE.Fog).color.set(b.fog)
      ;(ridges.material as THREE.MeshLambertMaterial).color.set(b.ridge)
      ridges.visible = b.ridges
      sun.visible = b.sun
      ground.visible = b.mode !== 5
    },
    tick(t, offset) {
      tickBiome(groundMat, sky, t)
      groundMat.uniforms.uOffset!.value = offset
      groundMat.uniforms.uPulse!.value = 0.5 + 0.5 * Math.sin(t * 4)
    },
  }
}

/** Flight.vue's ridged height field, 44 instances, static. */
function buildRidges(): THREE.InstancedMesh {
  const columns = 24
  const rows = 18
  const positions: number[] = []
  const indices: number[] = []
  for (let z = 0; z <= rows; z++) {
    for (let x = 0; x <= columns; x++) {
      const px = x / columns * 2 - 1
      const pz = z / rows * 2 - 1
      const envelope = Math.pow(Math.max(0, 1 - px * px), 1.2) * Math.pow(Math.max(0, 1 - pz * pz), 1.5)
      const spine = pz + 0.19 * Math.sin(px * 5.7) - 0.1 * px
      const ridge = Math.exp(-Math.abs(spine) * 3.4)
      const peaks = 0.62 + 0.2 * Math.sin(px * 5.1 + 0.7) + 0.11 * Math.sin(px * 11.3 - 1.2)
      const gullies = 0.07 * Math.sin(px * 27 + pz * 9) + 0.035 * Math.sin(px * 43 - pz * 17)
      positions.push(px, envelope * Math.max(0.04, 0.16 + ridge * peaks + gullies), pz)
      if (x < columns && z < rows) {
        const a = z * (columns + 1) + x
        const b = a + columns + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setIndex(indices)
  const geo = indexed.toNonIndexed()
  geo.computeVertexNormals()
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x2c2058, emissive: 0x140b26, flatShading: true }), 44)
  const d = new THREE.Object3D()
  let seed = 7
  const rnd = (lo: number, hi: number) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo) }
  for (let i = 0; i < 44; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const w = rnd(14, 34)
    d.position.set(side * rnd(26, 110), -5, rnd(-410, -90))
    d.scale.set(w, rnd(10, 42), w * 0.8)
    d.rotation.set(0, rnd(-0.6, 0.6), 0)
    d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix)
  }
  mesh.frustumCulled = false
  return mesh
}
