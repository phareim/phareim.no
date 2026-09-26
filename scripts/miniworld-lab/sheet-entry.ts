// Mini World avatar/house sheet: every hair style, face, clothing item (on
// its own and worn), pose, furniture model (levels 1 and 3), weapon, and
// the house in normal and edit mode, drawn with the real scene modules.
// Bundled by avatar-sheet.mjs; `window.__sheet(section)` fills the page.
import * as THREE from 'three'
import { createPreviews } from '../../themes/miniworld/scene/preview'
import { buildAvatar } from '../../themes/miniworld/scene/avatar'
import { createHouse } from '../../themes/miniworld/scene/house'
import { buildWeaponModel } from '../../themes/miniworld/scene/weapons'
import { CLOTHES, FURNITURE, HAIR_STYLES, HAIR_COLORS, EYES, MOUTHS, WEAPON_BASES, WEAPON_MAGIC, WEAPON_COLORS, STARTER_OUTFIT, SKINS } from '../../themes/miniworld/catalog'
import type { PersonLook, HouseLayout, OwnedFurniture, Weapon, ClothingDef } from '../../themes/miniworld/types'
import type { AvatarPose } from '../../themes/miniworld/scene/contracts'

const P = createPreviews()
const base: PersonLook = { skin: 's2', hair: 'bob', hairColor: 'brown', eyes: 'dots', mouth: 'smile', cheeks: true, outfit: { ...STARTER_OUTFIT } }

const css = `
body{margin:0;background:#9fd8ff;font:12px monospace;color:#2a2230}
h2{margin:8px 10px 2px;font-size:14px}
.row{display:flex;flex-wrap:wrap;gap:6px;padding:4px 10px}
.cell{display:flex;flex-direction:column;align-items:center;background:#bfe8c0;padding:3px;border:2px solid #2a2230}
.cell img{image-rendering:pixelated;display:block}
.cell span{max-width:140px;overflow:hidden;white-space:nowrap;font-size:10px}
canvas.big{image-rendering:pixelated;display:block;margin:6px 10px;border:2px solid #2a2230}
`

function page(title: string) {
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = `<h2>${title}</h2>`
}
function row(label?: string) {
  if (label) { const h = document.createElement('h2'); h.textContent = label; document.body.appendChild(h) }
  const r = document.createElement('div'); r.className = 'row'; document.body.appendChild(r); return r
}
function cell(r: HTMLElement, url: string, label: string, scale = 2, size = 64) {
  const c = document.createElement('div'); c.className = 'cell'
  const img = document.createElement('img'); img.src = url; img.width = size * scale; img.height = size * scale
  const s = document.createElement('span'); s.textContent = label
  c.append(img, s); r.appendChild(c)
}
const wear = (d: ClothingDef): PersonLook => {
  const o = { ...base.outfit }
  if (d.slot === 'top') o.top = d.id
  else if (d.slot === 'bottom') o.bottom = d.id
  else if (d.slot === 'shoes') o.shoes = d.id
  else (o as Record<string, string | null>)[d.slot] = d.id
  return { ...base, hair: d.slot === 'hat' ? 'long' : base.hair, outfit: o }
}

function scene3d(w: number, h: number, scale: number) {
  const canvas = document.createElement('canvas')
  canvas.className = 'big'
  canvas.width = w; canvas.height = h
  canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`
  document.body.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setPixelRatio(1)
  renderer.setSize(w, h, false)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#9fd8ff')
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8d8a0', 2.0))
  const sun = new THREE.DirectionalLight('#fff4e0', 2.0)
  sun.position.set(-4, 10, 6)
  scene.add(sun)
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 200)
  return { renderer, scene, cam, canvas }
}

const sections: Record<string, () => void> = {
  people() {
    page('Hair styles (brown, then every colour on bob/long)')
    let r = row()
    for (const s of HAIR_STYLES) cell(r, P.person({ ...base, hair: s.id }), s.id)
    r = row('Hair colours')
    for (const c of HAIR_COLORS) cell(r, P.person({ ...base, hair: c.id === 'rainbow' ? 'long' : 'ponytail', hairColor: c.id }), c.id)
    r = row('Hair from behind-ish (full)')
    for (const s of HAIR_STYLES) cell(r, P.person({ ...base, hair: s.id, hairColor: 'ginger' }, { full: true, size: 96 }), s.id, 1.5, 96)
    r = row('Faces: eyes × mouths (cheeks on)')
    for (const e of EYES) for (const m of MOUTHS) cell(r, P.person({ ...base, eyes: e.id, mouth: m.id, hair: 'short' }), `${e.id}/${m.id}`, 1.5)
    r = row('Skins, no cheeks')
    for (const s of SKINS) cell(r, P.person({ ...base, skin: s.id, cheeks: false, hair: 'afro', hairColor: 'black' }), s.id)
    r = row('Poses')
    const poses: AvatarPose[] = ['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'sleep', 'wave', 'swing', 'dance', 'cheer']
    for (const p of poses) cell(r, P.person({ ...base, outfit: { ...base.outfit, back: 'cape-red' } }, { full: true, size: 96, pose: p }), p, 1.5, 96)
  },
  clothes() {
    page('Clothes: on their own, then worn')
    for (const slot of ['top', 'bottom', 'shoes', 'hat', 'face', 'back'] as const) {
      const list = CLOTHES.filter(c => c.slot === slot)
      let r = row(slot)
      for (const d of list) cell(r, P.clothing(d, 64), d.id)
      r = row()
      for (const d of list) cell(r, slot === 'hat' || slot === 'face' ? P.person(wear(d), { size: 64 }) : P.person(wear(d), { full: true, size: 96 }), d.id, slot === 'hat' || slot === 'face' ? 2 : 1.34, slot === 'hat' || slot === 'face' ? 64 : 96)
    }
  },
  backs() {
    page('Back items from behind, and hats with every hair')
    const r = row()
    const s = scene3d(420, 120, 3)
    s.cam.position.set(0, 3.2, -9)
    s.cam.lookAt(0, 1.3, 0)
    const backs = CLOTHES.filter(c => c.slot === 'back')
    backs.forEach((d, i) => {
      const a = buildAvatar(wear(d))
      a.group.position.x = (i - (backs.length - 1) / 2) * 2.2
      a.animate(i % 2 ? 'walk' : 'jump', 0)
      for (let k = 0; k < 6; k++) a.animate(i % 2 ? 'walk' : 'jump', 1 / 30, 1)
      s.scene.add(a.group)
    })
    s.renderer.render(s.scene, s.cam)
    void r
    const r2 = row('Hats over hair')
    for (const h of ['cap-red', 'beanie', 'space-helmet', 'wizard-hat', 'crown-king', 'sun-hat', 'bunny-ears']) for (const hair of ['afro', 'long', 'bun'] as const) {
      cell(r2, P.person({ ...base, hair, hairColor: 'blond', outfit: { ...base.outfit, hat: h } }), `${h}/${hair}`, 1.5)
    }
  },
  furniture() {
    page('Furniture: level 1 and level 3 (and 2 for a few)')
    const r = row()
    for (const f of FURNITURE) {
      cell(r, P.furniture(f.id, 1, 80), `${f.id} 1`, 1.5, 80)
      cell(r, P.furniture(f.id, 3, 80), `${f.id} 3`, 1.5, 80)
    }
    const r2 = row('Level 2')
    for (const id of ['sofa', 'bed', 'painting-sun', 'rug-round', 'teddy', 'table-long']) cell(r2, P.furniture(id, 2, 80), `${id} 2`, 1.5, 80)
  },
  weapons() {
    page('Weapons: every base × magics, levels 1–3')
    for (const b of WEAPON_BASES) {
      const r = row(b.id)
      WEAPON_MAGIC.forEach((m, i) => {
        const w: Weapon = { uid: `w${i}`, base: b.id, magic: m.id, color: WEAPON_COLORS[i % WEAPON_COLORS.length]!, level: 1, name: '' }
        cell(r, P.weapon(w, 64), m.id)
      })
      for (const level of [2, 3] as const) cell(r, P.weapon({ uid: 'x', base: b.id, magic: 'stars', color: '#ff8ae0', level, name: '' }, 64), `stars L${level}`)
    }
    const r = row('Held')
    for (const b of WEAPON_BASES) {
      const s = scene3d(90, 110, 2)
      s.cam.position.set(3.2, 2.6, 5)
      s.cam.lookAt(0, 1.4, 0)
      const a = buildAvatar(base)
      a.setHeld({ uid: 'h', base: b.id, magic: 'hearts', color: '#4fb8ff', level: 2, name: '' })
      a.animate('idle', 0)
      s.scene.add(a.group)
      s.renderer.render(s.scene, s.cam)
      r.appendChild(s.canvas)
    }
    void buildWeaponModel
  },
  house() {
    page('House: normal, then edit mode with a selection and an invalid drag')
    const owned: OwnedFurniture[] = []
    const items: HouseLayout['items'] = []
    const put = (id: string, x: number, z: number, rot: 0 | 1 | 2 | 3 = 0, level: 1 | 2 | 3 = 1, on?: string) => {
      const uid = `u${owned.length}`
      owned.push({ uid, id, level })
      const it: HouseLayout['items'][number] = { uid, x, z, rot }
      if (on) it.on = on
      items.push(it)
      return uid
    }
    put('bed', 0, 0)
    put('lamp-floor', 1, 0)
    put('rug-rainbow', 3, 3)
    const sofa = put('sofa', 3, 0, 0, 2)
    void sofa
    const table = put('table-round', 4, 3, 0, 1)
    put('cake', 4, 3, 0, 1, table)
    put('tv', 4, 5, 2)
    put('aquarium', 6, 0, 0, 3)
    put('bookshelf', 8, 0)
    put('plant-small', 8, 0, 0, 1, 'u8')
    put('trampoline', 7, 4, 0, 1)
    put('cat-bed', 0, 5)
    put('disco', 2, 6)
    put('painting-sun', 1, 0, 0)
    put('clock', 3, 0, 0, 3)
    put('fairy-lights', 5, 0, 0)
    put('mirror', 0, 3, 3)
    put('window', 7, 0, 1)
    put('fireplace', 0, 2, 1, 2)
    const layout: HouseLayout = { floor: 'floor-wood', wall: 'wall-hearts', items }
    for (const edit of [false, true]) {
      const s = scene3d(360, 240, 3)
      const house = createHouse({ editable: true })
      house.setLayout(layout, owned)
      s.scene.add(house.group)
      s.cam.position.set(7.5, 13, 23)
      s.cam.lookAt(7.5, 0.5, 5.5)
      s.cam.updateMatrixWorld(true)
      ;(house as unknown as { setView(v: THREE.Vector3): void }).setView(s.cam.position)
      const a = buildAvatar({ ...base, hair: 'pigtails', hairColor: 'pink', outfit: { ...base.outfit, top: 'dress-flower', hat: 'bow-pink' } })
      a.group.position.copy(house.spawn)
      a.group.rotation.y = Math.PI
      a.setTag('Ulrikke', 'princess')
      s.scene.add(a.group)
      a.animate('wave', 0)
      house.update(0.016, 1.3)
      if (edit) {
        house.setEdit(true)
        house.select('u10')
        const rc = new THREE.Raycaster()
        const at = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(s.cam); rc.setFromCamera(new THREE.Vector2(v.x, v.y), s.cam); return rc.ray.clone() }
        const d = house.pointer('down', at(7 * 1.5 + 1.5, 0.3, 4 * 1.5 + 1.5))
        const m = house.pointer('move', at(6 * 1.5 + 1.2, 0.3, 1.0))
        ;(window as unknown as { __edit: unknown }).__edit = { down: d, move: m }
      }
      s.renderer.render(s.scene, s.cam)
      if (edit) {
        // A second picture: the drag let go (refused), then a tap on the sofa.
        const s2 = scene3d(360, 240, 3)
        const rc = new THREE.Raycaster()
        const at = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(s.cam); rc.setFromCamera(new THREE.Vector2(v.x, v.y), s.cam); return rc.ray.clone() }
        const up = house.pointer('up', at(6 * 1.5 + 1.2, 0.3, 1.0))
        const d2 = house.pointer('down', at(4.5 + 1.5, 0.6, 0.8))
        const up2 = house.pointer('up', at(4.5 + 1.5, 0.6, 0.8))
        const rot = house.rotate()
        const added = house.add('u2')
        ;(window as unknown as { __edit2: unknown }).__edit2 = { up, d2, up2, rot: !!rot, added: !!added }
        s2.renderer.render(s.scene, s.cam)
      }
    }
  },
  lineup() {
    page('At game size: people in town light (320×180, ×3)')
    const s = scene3d(320, 180, 3)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: '#8fe0a0' }))
    ground.rotation.x = -Math.PI / 2
    s.scene.add(ground)
    const looks: PersonLook[] = [
      { ...base },
      { skin: 's4', hair: 'afro', hairColor: 'black', eyes: 'big', mouth: 'grin', cheeks: true, outfit: { top: 'hoodie-pink', bottom: 'shorts-denim', shoes: 'sneakers-pink', hat: null, face: 'sunglasses', back: null } },
      { skin: 's1', hair: 'pigtails', hairColor: 'rainbow', eyes: 'lashes', mouth: 'tongue', cheeks: true, outfit: { top: 'princess-gown', bottom: 'jeans', shoes: 'shoes-gold', hat: 'tiara', face: null, back: 'fairy-wings' } },
      { skin: 's3', hair: 'spiky', hairColor: 'blue', eyes: 'happy', mouth: 'open', cheeks: false, outfit: { top: 'space-suit', bottom: 'pants-space', shoes: 'boots-winter', hat: 'space-helmet', face: null, back: 'jetpack' } },
      { skin: 's5', hair: 'braids', hairColor: 'purple', eyes: 'wink', mouth: 'cat', cheeks: true, outfit: { top: 'tiger-top', bottom: 'skirt-tutu', shoes: 'skates', hat: 'cat-ears', face: null, back: 'cat-tail' } },
      { skin: 's6', hair: 'bun', hairColor: 'white', eyes: 'dots', mouth: 'smile', cheeks: true, outfit: { top: 'jacket-denim', bottom: 'pants-cargo', shoes: 'boots-rain', hat: 'wizard-hat', face: 'glasses-round', back: 'cape-red' } },
    ]
    const names = ['Ulrikke', 'Øyvind', 'Åse', 'Bjørn', 'Mia', 'Æsa']
    looks.forEach((l, i) => {
      const a = buildAvatar(l)
      a.group.position.set((i - 2.5) * 2.1, 0, (i % 2) * -1.2)
      a.group.rotation.y = -0.3 + i * 0.12
      a.setTag(names[i]!, i === 0 ? 'queen' : i === 3 ? 'prince' : null)
      const pose = (['idle', 'walk', 'wave', 'jump', 'dance', 'cheer'] as AvatarPose[])[i]!
      a.animate(pose, 0)
      for (let k = 0; k < 7; k++) a.animate(pose, 1 / 30, 0.8)
      if (i === 5) a.setHeld({ uid: 'w', base: 'wand', magic: 'stars', color: '#9a4ff0', level: 3, name: '' })
      s.scene.add(a.group)
    })
    s.cam.position.set(0, 5.5, 13)
    s.cam.lookAt(0, 1.3, 0)
    s.renderer.render(s.scene, s.cam)
  },
}

;(window as unknown as { __sheet: (s: string) => void }).__sheet = (name: string) => {
  try { sections[name]!() } catch (e) { console.error(String((e as Error)?.stack ?? e)) }
}
