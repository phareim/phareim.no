// Neon Shrine's iso art packs hold exactly the px the TS tables painted (ART-PLAN phase 3): for every stall, machine
// and realm-kit piece (its `like` frames, its realm's gate arches, its `src`), the decoded pack equals what
// things.ts `paintThing` writes from the table it was made from, per piece, albedo and normal map, and its anchor.
// - the TS tables against packs built here, in memory (no network);
// - the TS tables against the packs pinned when the TS was deleted (MIGRATION, from the .art-cache);
// - the game's loader (artPack.ts, the pinned packs now) against `paintThing` of the same packs unpacked, atlas byte for
//   byte, and artIndex.ts against each pack's own index.
// The TS tables come from the worktree while they are there, else from git (artgroups.mjs LEGACY_REV); without either
// the first two parts are skipped.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packFiles, packTable, readPack } from '../scripts/zelda-lab/lib/artpack.mjs'
import { pinnedBytes } from '../scripts/zelda-lab/lib/artcache.mjs'
import { GROUPS, legacyTable } from '../scripts/zelda-lab/lib/artgroups.mjs'
import { installArtFetch, kitTable, readPins } from './helpers/art.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

/** The packs pinned when the TS tables were deleted (phase 3b): what the TS held, for good. */
const MIGRATION = {
  stalls: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stalls/albedo-9a278988.png", sha256: "9a278988508d4173f3a1aab061529e1d0b77642331daed47a13f845d0f078bc8" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stalls/normal-36ba9927.png", sha256: "36ba992776cd733c026a7b2e424f6dcc6b5dc68abb1c3787390963ac1e5d9ccf" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stalls/index-6f2d33ea.json", sha256: "6f2d33ea1bfb4b943c027239f3e148a7febb745f8ee81eda340ba0e68413edbf" },
  },
  machines: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-machines/albedo-fc94d534.png", sha256: "fc94d53440fbc38f2e51b385ce9b7518ede5d698d980b23a71d6cb2b308af88c" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-machines/normal-596e744a.png", sha256: "596e744a8945b0bc380c489954fb55e6c44b92214d33d1ad76e380ec81ad2e25" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-machines/index-ff839d05.json", sha256: "ff839d053f7e9a49123eba8573c46687c47a3e1e560376cd156b5edeb82d3858" },
  },
  coast: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-coast/albedo-af51f050.png", sha256: "af51f0505ee1088bb60ca4eb5875d4b905902a46ce927ca93e35ce739b99dc67" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-coast/normal-ffe5a8d9.png", sha256: "ffe5a8d9415387c95d3c46355b2b35ae16643dd658dbbf5c932aceb51e803e9b" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-coast/index-53757d16.json", sha256: "53757d1672b22a1814d733f021281cd95e97fe0cfd9eaf123aff83ed5a90880c" },
  },
  fjord: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fjord/albedo-79c676ab.png", sha256: "79c676ab92730cd1ccc54620e90711b8f38e5a6d72e5e17a8129457308f17835" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fjord/normal-98fe606d.png", sha256: "98fe606d1113c15450bf101fceb59a1c95820452f6f123bce376460fbc150276" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fjord/index-26ad5c0f.json", sha256: "26ad5c0f19a20fd5d4f20c73dc89b51536e75adb8fc26e0245e4bcff1e0c1f70" },
  },
  fogstage: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fogstage/albedo-e8ce2996.png", sha256: "e8ce29969acabd282f30e9e31bbb15651c71eef7af627c7dd92538c4482ecf98" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fogstage/normal-2b26b054.png", sha256: "2b26b05486d602beabc37217a296b5dc3547d1a927c0c6499ea44138e7613c3e" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-fogstage/index-247e3c7a.json", sha256: "247e3c7a1fce22c4e5de6a150b7cfd9c29bbe10e232f6c64e17e04934543e42e" },
  },
  landing: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-landing/albedo-1071f1c2.png", sha256: "1071f1c28c041d4fd80bfaa83b90880a30f502d85dcbdcfc05d93c209bd86365" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-landing/normal-f4fcdfe5.png", sha256: "f4fcdfe5f73aacc91d21e9e69ffadbd7a8eb257d24fe89059e1d439f61a190a8" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-landing/index-e3f283e4.json", sha256: "e3f283e42454a0ac91a27fabb59b9fa7ba7a3937e22bed4c8d945a51d145b47e" },
  },
  meadow: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-meadow/albedo-2027547a.png", sha256: "2027547a285ce85080ada67fba34e31c55d3f24d47643d556431561adc37a171" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-meadow/normal-9c3f8aa0.png", sha256: "9c3f8aa0792477b063da4ef430fef4182fb1693c635934ef95af50392bbd08ef" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-meadow/index-ea290a1c.json", sha256: "ea290a1c0cbfd083d9e07d9c62c15b10aa3ddf15f291f2c45668782ede129680" },
  },
  quarry: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-quarry/albedo-b66cab02.png", sha256: "b66cab022c990cbefbdc694619c47cfcafe2657fe300eab390c1c5ce13e2515a" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-quarry/normal-751f072d.png", sha256: "751f072debc770882503e233302bde9f02726bd0bc47cfbf26d2f0bb5a9b69b6" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-quarry/index-e485fa96.json", sha256: "e485fa965148e9681c5313d7b19ecb34b607b9ebc525ad399144d557016caae8" },
  },
  rerun: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-rerun/albedo-6220d62a.png", sha256: "6220d62a93cca0520cf2a99c5bdd31b7721d28485a6c6ea746da4bf4f3fd5e37" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-rerun/normal-d9f56789.png", sha256: "d9f5678990405827e41a5c751c6642d70c4291ce7f7fcfbf870cee073575275f" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-rerun/index-203f701b.json", sha256: "203f701b1e5f6bc9b681f8e2918f010bebf94c6312089e359f7470d6ef2cdccc" },
  },
  seter: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-seter/albedo-920ed91b.png", sha256: "920ed91bb286fb01999642f8e7f09f7c144d5e305dbcab01ae1a5a96c1bdf76b" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-seter/normal-7f7ba91a.png", sha256: "7f7ba91a077398298d9736ca3cd6230b55b05010b99b915ba20745760fab28d1" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-seter/index-54450586.json", sha256: "54450586ff03a468a69ff07d1f3534d607032d2d7e7c96456a4cce5aee7fada8" },
  },
  sporelight: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-sporelight/albedo-c8003481.png", sha256: "c80034818fe888608fdedae992484b78eb88b6ba8ae630448caa7c53ec7b9dd7" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-sporelight/normal-78f45445.png", sha256: "78f4544553850967f2612c80df1d13ef3934ed7ab594e5d6d9dfda388eab9549" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-sporelight/index-ac9b4849.json", sha256: "ac9b48499464382ebe22c2c2c7a8892cab772f81e5068e06d7387754a86c9053" },
  },
  stillsand: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stillsand/albedo-23aa73f2.png", sha256: "23aa73f2d09ea4c46707af97c55b83d89348819fba2bfb9ef60ce1e643d78c09" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stillsand/normal-68cc5736.png", sha256: "68cc573657693ea5dbfdf54df556bfcd2c4b07351c6d28af1a4d0d29dd760158" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-stillsand/index-49b54ce8.json", sha256: "49b54ce81189c171d0b37f570518a3692ba8a7b445adfa45065024dd1ee118df" },
  },
  underglow: {
    albedo: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-underglow/albedo-46ba65e2.png", sha256: "46ba65e2fbb5c0e68a07de8ccca2dcf6c47f958a45f2a2c1d234b1ee286fb125" },
    normal: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-underglow/normal-717b1fb4.png", sha256: "717b1fb402403ca178eb756f04cee0c7a98708918296feb973a74368c46e7bf0" },
    index: { url: "https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-underglow/index-1173c03b.json", sha256: "1173c03bb7f35738efee4fcefbe1331c682c5b684526fa43b8e661ae6d979b66" },
  },
}

let M
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { paintThing, withThings, thingKey } from './render/iso/things'; export { buildProps } from './render/iso/props'; export { loadKit, loadPack } from './render/iso/artPack'; export { ART_INDEX, PACKS } from './render/iso/artIndex'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  installArtFetch()
})

/** Each piece of a table painted alone by the game's paintThing: { id: { albedo, normal } }. */
function painted(table) {
  const out = {}
  for (const [id, t] of Object.entries(table)) {
    const albedo = new Uint8ClampedArray(t.w * t.h * 4)
    const normal = new Uint8ClampedArray(t.w * t.h * 4)
    M.paintThing(t, albedo, normal, t.w, 0, 0, table)
    out[id] = { albedo, normal }
  }
  return out
}

/** A piece's rect of a decoded pack, as w*h*4 bytes of each map. */
function rect(pack, p) {
  const albedo = new Uint8Array(p.w * p.h * 4)
  const normal = new Uint8Array(p.w * p.h * 4)
  for (let y = 0; y < p.h; y++) {
    const o = ((p.y + y) * pack.w + p.x) * 4
    albedo.set(pack.albedo.subarray(o, o + p.w * 4), y * p.w * 4)
    normal.set(pack.normal.subarray(o, o + p.w * 4), y * p.w * 4)
  }
  return { albedo, normal }
}

function firstDiff(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `px ${i >> 2} byte ${i & 3}: ${a[i]} vs ${b[i]}`
  return a.length === b.length ? '' : 'length'
}

/** The decoded pack has every piece of the table with paintThing's px, its size, its anchor and its src, in its order. */
function assertParity(group, table, pack) {
  assert.deepEqual(Object.keys(pack.pieces), Object.keys(table), `${group}: the pieces, in the table's order`)
  const want = painted(table)
  for (const [id, t] of Object.entries(table)) {
    const p = pack.pieces[id]
    assert.deepEqual([p.w, p.h, p.ax, p.ay], [t.w, t.h, t.ax, t.ay], `${group}/${id}: size and anchor`)
    assert.deepEqual(p.src ?? null, t.src ?? null, `${group}/${id}: src`)
    const got = rect(pack, p)
    const da = firstDiff(got.albedo, want[id].albedo)
    assert.equal(da, '', `${group}/${id}${t.like ? ` (like ${t.like})` : ''}: albedo ${da}`)
    const dn = firstDiff(got.normal, want[id].normal)
    assert.equal(dn, '', `${group}/${id}${t.like ? ` (like ${t.like})` : ''}: normal ${dn}`)
  }
}

describe('zelda art packs: parity with the TS tables', () => {
  it('a pack built from each TS table decodes to paintThing\'s px, piece by piece', t => {
    let n = 0, pieces = 0, likes = 0, gates = 0
    for (const group of GROUPS) {
      const table = legacyTable(group)
      if (!table) continue
      const files = packFiles(group, packTable(table))
      const pack = readPack(files.albedo.bytes, files.normal.bytes, JSON.parse(files.index.bytes))
      assertParity(group, table, pack)
      n++
      pieces += Object.keys(table).length
      likes += Object.values(table).filter(t => t.like).length
      gates += Object.keys(table).filter(id => id.startsWith('gate_')).length
    }
    if (!n) return t.skip('no TS tables in the tree or in git')
    assert.equal(n, GROUPS.length, 'every pack')
    assert.ok(likes >= 19 && gates === 24, `like frames ${likes}, gate arches ${gates}`)
    t.diagnostic(`${n} packs, ${pieces} pieces (${likes} like frames, ${gates} gate arches)`)
  })

  it('the packs pinned at the move hold the TS tables\' px', async t => {
    const groups = Object.keys(MIGRATION)
    if (!groups.length) return t.skip('no migration pins yet')
    let n = 0
    for (const group of groups) {
      const table = legacyTable(group)
      if (!table) continue
      const m = MIGRATION[group]
      const [a, b, i] = await Promise.all([pinnedBytes(m.albedo), pinnedBytes(m.normal), pinnedBytes(m.index)])
      assertParity(group, table, readPack(a, b, JSON.parse(i)))
      n++
    }
    if (!n) return t.skip('no TS tables in the tree or in git')
    assert.equal(n, GROUPS.length)
  })

  it('the game\'s loader paints each pinned pack as paintThing paints it unpacked, and artIndex.ts is each pack\'s index', async t => {
    const pins = readPins()
    const groups = GROUPS.filter(g => pins.PACKS[g])
    if (!groups.length) return t.skip('nothing pinned yet')
    assert.deepEqual(groups, GROUPS, 'every pack is pinned')
    const props = M.buildProps()
    for (const group of groups) {
      const pin = M.PACKS[group]
      const index = JSON.parse(await pinnedBytes(pin.index))
      assert.deepEqual([index.w, index.h], [pin.w, pin.h], group)
      const rects = Object.entries(M.ART_INDEX).filter(([, r]) => r.pack === group)
      assert.deepEqual(rects.map(([id]) => id), Object.keys(index.pieces), `${group}: the same pieces in the same order`)
      for (const [id, r] of rects) {
        const p = index.pieces[id]
        assert.deepEqual([r.x, r.y, r.w, r.h, r.ax, r.ay, r.src ?? null], [p.x, p.y, p.w, p.h, p.ax, p.ay, p.src ?? null], `${group}/${id}`)
      }
      const kit = await M.loadKit(group)
      const table = await kitTable(group)
      const a = M.withThings(props, kit)
      const b = M.withThings(props, table)
      assert.deepEqual([a.w, a.h], [b.w, b.h], group)
      for (const id of Object.keys(table)) assert.deepEqual(a.sprites[M.thingKey(id)], b.sprites[M.thingKey(id)], `${group}/${id}: its place in the atlas`)
      assert.equal(firstDiff(a.albedo, b.albedo), '', `${group}: albedo`)
      assert.equal(firstDiff(a.normal, b.normal), '', `${group}: normal`)
    }
  })
})
