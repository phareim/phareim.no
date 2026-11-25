#!/usr/bin/env node
// Neon Shrine look lab: render the real engine + renderer + world into PNGs
// in headless Chromium, without Nuxt. Snap Chromium: outDir must be a
// non-hidden path under $HOME.
//
//   node scripts/zelda-lab/shot.mjs <outDir> [scene,scene…]
//
// Scenes place the hero somewhere and simulate a moment; see SCENES below.
// Scenes named p-* use the fixture world in fixture.ts (the town's looks:
// cabinets, board, kiosk, terminals, decals, the petter NPC); r-* are the
// real town in the one world.
//
// VIEW=iso renders the isometric view (PNGs end in -iso); with FRAMES=<n> (under 42) the shot stops n frames
// into the turn from the classic view. CHROME_BIN=<path> draws with another
// browser (the Mac's Chrome, where the GPU draws) instead of chromium-browser.
//
// HERO_COLORS='<HeroColors JSON>' dresses the hero in Mini World's colours
// (render/heroColors.ts); the PNGs then end in -dressed.
//
// HERO_LOOK=<look> gives the hero a look from the NEW LOOK stall
// (render/heroLook.ts): `girl`, `drawn`, a shape as hair/head/bottom
// (`pigtails/bow/dress`) or a HeroLook as JSON; the PNGs then end in -look.
// hero-sheet.mjs draws every frame of a look without a browser.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, only] = process.argv.slice(2)
if (!outArg) { console.error('usage: shot.mjs <outDir> [scenes]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/zelda/render/renderer.ts'))}
import { createGame, stepGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { enterMap } from ${JSON.stringify(join(repo, 'themes/zelda/engine/game.ts'))}
import { reveal } from ${JSON.stringify(join(repo, 'themes/zelda/engine/explore.ts'))}
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world/index.ts'))}
import { sceneryAt } from ${JSON.stringify(join(repo, 'themes/zelda/world/gen/frontierScenery.ts'))}
import { NO_INPUT, WARP_TIME } from ${JSON.stringify(join(repo, 'themes/zelda/types.ts'))}
import { spawnEnemy } from ${JSON.stringify(join(repo, 'themes/zelda/engine/spawn.ts'))}
import { LAB } from ${JSON.stringify(join(repo, 'scripts/zelda-lab/fixture.ts'))}
import { parseHeroColors } from ${JSON.stringify(join(repo, 'themes/zelda/render/heroColors.ts'))}
import { DRAWN_LOOK, GIRL_LOOK, parseHeroLook } from ${JSON.stringify(join(repo, 'themes/zelda/render/heroLook.ts'))}
import isoView, { pinQuality } from ${JSON.stringify(join(repo, 'themes/zelda/render/iso/view.ts'))}
import { kitFor, loadRealmArt } from ${JSON.stringify(join(repo, 'themes/zelda/render/iso/frontierArt/index.ts'))}
import { mapDef } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { setTreeCounts } from ${JSON.stringify(join(repo, 'themes/zelda/render/tree.ts'))}
import { setSpriteOverrides } from ${JSON.stringify(join(repo, 'themes/zelda/render/sheet.ts'))}
// LIFE_FILE=<render/life/<id>.ts>: show that one critter (its default export) in place of the registry.
${process.env.LIFE_FILE ? `import __critter from ${JSON.stringify(resolve(process.env.LIFE_FILE))}\nimport { setLifeCritters } from ${JSON.stringify(join(repo, 'themes/zelda/render/life/index.ts'))}\nsetLifeCritters([__critter])` : ''}
// LIVE=<pack.json> applies the studio's live sprites (render/live.ts) as the site does, before anything is drawn.
${process.env.LIVE ? `setSpriteOverrides(${JSON.stringify(JSON.parse(readFileSync(process.env.LIVE, 'utf8')).sprites)})` : ''}

const q = new URLSearchParams(location.hash.slice(1))
// TREE=<deploys>,<visitors> sets the beach tree's counts (its stage and its fruit; part 17).
if (q.get('tree')) { const [d, v] = q.get('tree').split(',').map(Number); setTreeCounts({ deploys: d, visitors: v }) }
const W = +q.get("w"), H = +q.get("h"), dpr = +(q.get("dpr") || 1), top = +(q.get("top") || 0)
const scene = q.get('scene')
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
document.body.style.cssText = 'margin:0;background:#0b0616;overflow:hidden'
document.body.appendChild(canvas)
// The lab draws as fast as it can on a software GPU: the 16-bit view must not take that for a slow phone.
pinQuality(q.get('quality') === null ? 2 : +q.get('quality'))
// look-<look>[-2] (render/looks.ts): a frontier region drawn in a realm's look, whatever its realm says (-2: another
// region, by its north edge, where the land beyond and the sky show). The
// region is a copy of a generated one under the id 'look-<look>:<region>', in a copy of the world.
const forced = new Map()
const lookWorld = { ...WORLD, generate: id => {
  const m = /^look-([a-z]+):(.+)$/.exec(id)
  if (!m) return WORLD.generate(id)
  if (!forced.has(id)) { const base = WORLD.generate(m[2]); forced.set(id, base && { ...base, look: m[1] }) }
  return forced.get(id)
} }
// Paint the two sides of a planned gate on temporary copies of the real maps.
const gateMap = scene === 'f-gate-seter' ? WORLD.generate('fr:4,1') : scene === 'f-gate-waymark' ? WORLD.maps.overworld : null
const gateArt = scene === 'f-gate-seter' ? sceneryAt('seterfell', 'gate', 44, 36) : [
  { art: 'waymark_seterfell_n', x: 30, y: 10, motion: { frames: 2, fps: 0.75 } },
  { art: 'border_ns_down', x: 27.5, y: 10 },
]
const gateWorld = gateMap && { ...WORLD, maps: { ...WORLD.maps, [gateMap.id]: { ...gateMap, isoLandmarks: [...gateMap.isoLandmarks ?? [], ...gateArt] } } }
const world = gateWorld ?? (scene.startsWith('p-') ? LAB : scene.startsWith('look-') ? lookWorld : WORLD)
const s = createGame(world, { seed: 7, at: ['start', 'intro', 'swing', 'pause', 'hutout'].includes(scene) ? { map: 'overworld', entry: 'hut' } : null })
if (scene !== 'hutout') { s.dialog = null; s.mode = 'play'; s.hero.auto = null }
const r = createRenderer(canvas, world)
if (q.get('hero')) r.setHeroColors(parseHeroColors(q.get('hero')))
if (q.get('look')) {
  const a = q.get('look')
  const [hair, head, bottom] = a.split('/')
  r.setHeroLook(a === 'girl' ? GIRL_LOOK : a === 'drawn' ? DRAWN_LOOK : a.startsWith('{') ? parseHeroLook({ ...DRAWN_LOOK, ...JSON.parse(a) }) : parseHeroLook({ ...DRAWN_LOOK, hair, head: head ?? 'band', bottom: bottom ?? 'trousers' }))
}
// VIEW=iso shows the isometric view; FRAMES below 36 stops in the middle of the turn into it.
if (q.get('view') === 'iso') { r.addView('iso', isoView); r.setView('iso', q.get('frames') === null) }
// views=all (transit.mjs): every engine added, the classic one shown; the lab turns between them as the shell does.
if (q.get('views') === 'all') r.addView('iso', isoView)
// PARAMS='{"bloom":0.5}' sets an engine's values (viewParams.ts).
if (q.get('params')) r.setParams(q.get('view') || 'classic', JSON.parse(q.get('params')))
r.resize(W, H, dpr, { top, right: 0, bottom: top ? 34 : 0, left: 0 })
const inp = (o) => ({ ...NO_INPUT, ...o })
/** What the steps said (the fight scenes keep a blow's events, to lay its effects on the last frames again). */
const said = []
const run = (n, i = inp({})) => { for (let k = 0; k < n; k++) { const e = stepGame(world, s, 1 / 60, i); said.push(...e); r.onEvents(e) } }
/** Run just before the last frames are drawn (the lab draws 40 frames without stepping: short effects are gone by then). */
let late = null
/** The game steps on through this many of the last frames, with this input (a roll's afterimages need it moving). */
let lateSteps = 0
let lateInput = null
/**
 * The fight lab (real-time combat, the chain, the roll): the hero on the square facing east with a blob in front,
 * and the moment \`moment\` sets up; the blow's effects are laid on again for the last frames.
 */
function fight(moment) {
  give(); go('overworld', 20.5, 17.5, 'right'); run(5)
  const blob = spawnEnemy('lab-blob', 'blob', 21.75, 17.5, 'left', -1)
  blob.hp = 99; blob.maxHp = 99; blob.ai.t = 99
  s.map.enemies.push(blob)
  const A = () => run(1, inp({ aPress: true, a: true }))
  moment(A, blob)
  const blows = said.filter(e => ['hit', 'kill', 'swing', 'roll'].includes(e.type)).slice(-4)
  late = () => r.onEvents(blows)
}
const ev = []
const give = () => { s.inv.sword = true; s.inv.bombBag = true; s.inv.bombs = 8; s.inv.disc = true; s.inv.selected = 'disc'; s.inv.bits = 123; s.inv.keys = 1; s.hero.maxHp = 10; s.hero.hp = 7 }
const at = (map, x, y, dir = 'down') => { enterMap(WORLD, s, map, Object.keys({}).length ? '' : 'x', ev); s.hero.x = x; s.hero.y = y; s.hero.dir = dir }
function place(map, entryId, dx = 0, dy = 0) { enterMap(world, s, map, entryId, ev); s.hero.x += dx; s.hero.y += dy; s.hero.auto = null }
/** A frontier map's tile with the NPC of that id, and the hero put a little south of it. */
function near(map, id, dy = 2) {
  place(map, 'camp')
  const d = WORLD.generate(map)
  d.rows.forEach((row, y) => { const x = [...row].findIndex(ch => d.marks[ch]?.ent.id === id); if (x >= 0) { s.hero.x = x + 0.5; s.hero.y = y + dy + 0.5; s.hero.dir = 'up' } })
}
/** Stand by the first thing in a frontier map that pick takes and show one page of what it says (an NPC: its last, unconditioned branch). */
function say(map, pick, page = 0) {
  place(map, 'camp')
  const d = WORLD.generate(map)
  let ent = null
  d.rows.forEach((row, y) => { const x = [...row].findIndex(ch => d.marks[ch] && pick(d.marks[ch].ent)); if (x >= 0 && !ent) { ent = d.marks[row[x]].ent; s.hero.x = x + 0.5; s.hero.y = y + 2.5; s.hero.dir = 'up' } })
  s.map.enemies.length = 0
  run(30)
  const lines = ent.t === 'npc' ? ent.talk[ent.talk.length - 1].lines : ent.lines
  s.dialog = { lines, line: page, chars: lines[page].length, who: ent.t === 'npc' ? ent.look : null, after: null }
  s.mode = 'dialog'
}
function nearArt(map, id, dx, dy) {
  place(map, 'camp')
  const art = WORLD.generate(map).isoLandmarks.find(lm => lm.art === id)
  s.hero.x = art.x + dx
  s.hero.y = art.y + dy
  s.hero.dir = 'up'
}
const put = (map, x, y, dir) => { enterMap(world, s, map, Object.keys({}).length ? '' : 'door', ev); s.hero.x = x; s.hero.y = y; s.hero.dir = dir; s.hero.auto = null }
const ui = { paused: false, reducedMotion: false, touch: q.get('touch') === '1', stick: null, attract: false, cam: null, banner: null, keys: q.get('touch') === '1' ? { a: 'THE SWORD BUTTON', b: 'THE ITEM BUTTON', cycle: 'THE SWAP BUTTON', touch: true } : { a: 'SPACE', b: 'K', cycle: 'Q' } }
// Part 22: a boss room's scene + '-hit' is the same moment with every boss in it flashing (the hurt frame and the
// flash, as a hit leaves them).
const bossHit = /^(boss|l-llama|l-mistral|d-deepseek|d-gemini)-hit$/.test(scene)
// Part 24: 'l-mistral-down' is the lab with the mistral blown out (its down heap and the dizzy stars).
const bossDown = scene === 'l-mistral-down'
switch (bossHit ? scene.slice(0, -4) : bossDown ? 'l-mistral' : scene) {
  case 'start': run(30); break
  // The frontier (world/gen/): the Landing, the crossroads camp north of it, a cave, and one place in each realm
  // (beside a quest site's or a landmark's people, so the realm's own places are in the picture).
  // The systems in the frontier: a puzzle realm's walled puzzle, a battle realm's group, a dig realm's stone columns.
  case 'f-puzzle': case 'f-battle': case 'f-dig': {
    give()
    const want = { 'f-puzzle': 'stillsand', 'f-battle': 'sporelight', 'f-dig': 'lumenby' }[scene]
    let id = null
    for (let ry = 0; ry < 9 && !id; ry++) for (let rx = 0; rx < 12 && !id; rx++) { const d = WORLD.generate('fr:' + rx + ',' + ry); if (d?.realm === want && !(want === 'lumenby' && !d.rows.join('').includes('а'))) id = d.id }
    const d = WORLD.generate(id)
    let spot = d.entries.camp
    if (scene === 'f-puzzle') { const ch = Object.keys(d.marks).find(c => d.marks[c].ent.t === 'chest' && d.marks[c].ent.appear); const y = d.rows.findIndex(r => r.includes(ch)); spot = { x: d.rows[y].indexOf(ch) - 1.5, y: y + 1.5 } }
    if (scene === 'f-battle') { const g = d.battle.groups[0]; spot = { x: g.x, y: g.y + 3.5 } }
    if (scene === 'f-dig') { const y = d.rows.findIndex(r => r.includes('а')); spot = { x: d.rows[y].indexOf('а') + 0.5, y: y + 2.5 }; for (const t of ['pickaxe', 'shovel', 'axe', 'hammer']) s.flags['item:' + t] = true; s.inv.selected = 'dig' }
    go(id, spot.x, spot.y, 'up'); run(20)
    break
  }
  case 'f-landing': give(); place('fr:6,8', 'camp', 0, -1); run(30); break
  // The gates (world/gen/gates.ts): each one's hand-made side, a short way down its road (the wardens' without a
  // blade, so they stand in the gate), the region's side, and the MAP page on the coast with the frontier beside it.
  case 'g-fell': give(); place('overworld', 'gate-fell', 0, 3); s.hero.dir = 'up'; run(30); break
  case 'g-spore': place('overworld', 'gate-spore', 0, 4); s.hero.dir = 'up'; run(30); break
  case 'g-sand': give(); place('overworld', 'gate-sand', -4, 0); s.hero.dir = 'right'; run(30); break
  case 'g-lawns': place('overworld', 'gate-lawns', -1, 4); s.hero.dir = 'up'; run(30); break
  case 'g-quarry': give(); place('wildwood', 'gate-quarry', 0, 2); s.hero.dir = 'up'; run(30); break
  case 'g-fog': give(); place('wildwood', 'gate-fog', 4, 0); s.hero.dir = 'left'; run(30); break
  case 'g-in-fell': give(); place('fr:4,1', 'gate-fell', 0, -3); s.hero.dir = 'down'; run(30); break
  case 'g-in-sand': give(); place('fr:9,4', 'gate-sand', 3, 0); s.hero.dir = 'left'; run(30); break
  case 'g-map': {
    give()
    place('overworld', 'gate-spore', 0, 2)
    reveal(s, 'overworld', 104, 48, { x: 0, y: 0, w: 104, h: 48 })
    for (const id of ['fr:6,8', 'fr:6,7', 'fr:7,2', 'fr:4,1']) s.flags['seen:' + id] = true
    run(5)
    ui.paused = true
    ui.page = 'map'
    break
  }
  // Ambient life (render/life/): LIFE=<map>,<x>,<y> puts the hero there with no foes about; LIFE_T=<s> moves the clock.
  case 'life': { give(); const parts = (q.get('at') || 'overworld,30,20').split(','); const ly = parts.pop(), lx = parts.pop(), mp = parts.join(','); go(mp, +lx, +ly, 'down'); s.map.enemies.length = 0; run(10); break }
  case 'f-ferry-town': give(); place('overworld', 'ferry', 0, -1); run(30); break
  case 'f-ferry-landing': give(); place('fr:6,8', 'camp', 0, 2); run(30); break
  case 'f-meadow': give(); near('fr:6,7', 'q.seed.tender'); run(30); break
  case 'f-roadlight': {
    give()
    const map = 'fr:6,7'
    const lamp = WORLD.generate(map).isoLandmarks.find(lm => lm.art.startsWith('road_lantern_'))
    nearArt(map, lamp.art, 0.25, 1.75)
    run(30)
    break
  }
  case 'f-quarry': give(); near('fr:2,3', 'q.gunn'); run(30); break
  case 'f-lumenby': {
    give()
    nearArt('fr:2,3', 'quarry_letter_e_off', -0.5, 3)
    for (const n of [1, 3, 5, 7]) s.flags['q.lumenby.lot' + n] = true
    run(30)
    break
  }
  case 'f-underglow': give(); place('fr:0,3:deep1', 'up', 0.75, 0); run(30); break
  case 'f-seterfell': give(); near('fr:4,1', 'q.bell.tail'); run(30); break
  case 'f-yulefjord': give(); nearArt('fr:5,0', 'fjord_church', 0.05, 2.95); run(30); break
  case 'f-fjord-cottage': give(); nearArt('fr:3,0', 'fjord_cottage', 0, 2); run(30); break
  case 'f-fjord-lens': give(); nearArt('fr:3,0', 'fjord_lighthouse', 0.5, 3); run(30); break
  case 'f-seter-windows': give(); nearArt('fr:4,1', 'seter_hut', 0.5, 2.5); run(30); break
  case 'f-stage-light': give(); nearArt('fr:1,6', 'fogstage_spotlight_3', -0.5, 1.75); run(30); break
  case 'f-gate-seter':
    give()
    put('fr:4,1', 45.5, 39.3, 'up')
    s.map.enemies.length = 0
    run(25, inp({ move: { x: 0, y: -1 } }))
    break
  case 'f-gate-waymark': give(); put('overworld', 29, 11.5, 'up'); s.map.enemies.length = 0; run(30); break
  case 'f-stillsand': give(); near('fr:10,4', 'l.caravan.cook'); run(30); break
  case 'f-sporelight': give(); near('fr:9,2', 'l.steam.clerk'); s.map.enemies.length = 0; run(30); break
  case 'f-fogstage': give(); near('fr:1,6', 'q.act.director'); run(30); break
  case 'f-rerun': give(); nearArt('fr:8,7', 'rerun_house_0', 2, 3); s.map.enemies.length = 0; run(30); break
  case 'f-cave': { give(); const id = ['fr:6,7', 'fr:5,7', 'fr:6,6', 'fr:5,6', 'fr:4,6', 'fr:6,5', 'fr:5,5', 'fr:4,5', 'fr:3,4'].find(i => WORLD.generate(i)?.entries.cave0); place(id + ':cave0', 'in'); run(30); break }
  // The frontier's words in the box (the narrowest is the phone's): a quest-giver, a realm's folk, a camp's sign with
  // its roads, the crossroads sign, a realm's first-visit words.
  case 'f-say-gunn': give(); say('fr:2,3', e => e.id === 'q.gunn'); break
  case 'f-say-folk': give(); say('fr:4,2', e => e.t === 'npc' && e.id.includes('.npc')); break
  case 'f-say-roads': give(); say('fr:6,2', e => e.t === 'sign' && e.lines.length > 1, 1); break
  case 'f-say-cross': give(); say('fr:6,7', e => e.t === 'sign' && e.lines[0].startsWith('CROSSROADS')); break
  case 'f-say-intro': { give(); place('fr:4,1', 'camp'); run(30); const a = WORLD.generate('fr:4,1').areas[0]; s.dialog = { lines: a.intro.lines, line: 0, chars: a.intro.lines[0].length, who: null, after: null }; s.mode = 'dialog'; break }
  case 'look-snow': give(); place('look-snow:fr:4,6', 'camp', 0, -1); run(30); break
  case 'look-snow-2': give(); place('look-snow:fr:4,4', 'camp'); s.hero.y = 3.5; run(30); break
  case 'look-dune': give(); place('look-dune:fr:1,1', 'camp'); run(30); break
  case 'look-dune-2': give(); place('look-dune:fr:4,4', 'camp'); s.hero.y = 3.5; run(30); break
  case 'look-spore': give(); place('look-spore:fr:4,4', 'camp'); run(30); break
  case 'look-spore-2': give(); place('look-spore:fr:3,4', 'camp'); s.hero.y = 3.5; run(30); break
  case 'look-fog': give(); place('look-fog:fr:4,4', 'camp'); run(30); break
  case 'look-fog-2': give(); place('look-fog:fr:4,6', 'camp', 0, -1); s.hero.y = 3.5; run(30); break
  case 'look-quarry': give(); place('look-quarry:fr:1,1', 'camp'); run(30); break
  case 'look-quarry-2': give(); place('look-quarry:fr:4,4', 'camp'); s.hero.y = 3.5; run(30); break
  case 'look-suburb': give(); place('look-suburb:fr:4,6', 'camp', 0, -1); run(30); break
  case 'look-suburb-2': give(); place('look-suburb:fr:4,4', 'camp'); s.hero.y = 3.5; run(30); break
  case 'intro': s.dialog = { lines: ['KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE.'], line: 0, chars: 80, who: 'keeper', after: null }; s.mode = 'dialog'; break
  case 'swing': give(); run(10); r.onEvents(stepGame(WORLD, s, 1/60, inp({ aPress: true, a: true }))); run(5, inp({ a: true })); break
  // Real-time combat: hit 1 of the chain mid-sweep, hit 2 (the backhand), hit 3 (the finisher), the roll, a blow landing.
  case 'swing1': fight(A => { A(); run(5) }); break
  case 'swing2': fight(A => { A(); run(11); A(); run(5) }); break
  case 'swing3': fight(A => { A(); run(11); A(); run(11); A(); run(8) }); break
  case 'roll': fight(() => { s.map.enemies.length = 0; run(1, inp({ rollPress: true, move: { x: 1, y: 0.25 } })); run(3, inp({ move: { x: 1, y: 0.25 } })) }); lateSteps = 6; lateInput = inp({ move: { x: 1, y: 0.25 } }); break
  case 'hit': fight((A, blob) => { A(); for (let k = 0; k < 20 && !said.some(e => e.type === 'hit'); k++) run(1); blob.flash = 0.14 }); break
  case 'kill': fight((A, blob) => { blob.hp = 1; A(); for (let k = 0; k < 20 && !said.some(e => e.type === 'kill'); k++) run(1); run(4) }); break
  case 'market': give(); place('overworld', 'shop', 4, 4); run(20); break
  case 'woods': give(); s.hero.x = 48; s.hero.y = 9; run(40); break
  case 'lake': give(); place('overworld', 'cave', -4, -6); run(30); break
  case 'graves': give(); place('overworld', 'shrine', 0, 7); run(30); break
  case 'shop': give(); place('shop', 'door', 0, -2); run(20); break
  case 'arcade': give(); place('arcade', 'door', 0, -1); run(20); break
  case 'entry': give(); place('shrine', 'start', 0, -2); run(40); break
  case 'hub': give(); place('shrine', 'start', 0, -12); run(5); enterMap; s.zoneIndex = 7; s.zone = { x: 16, y: 24, w: 16, h: 12 }; run(40); break
  case 'crystal': give(); place('shrine', 'start', -14, -13); s.zoneIndex = 6; s.zone = { x: 0, y: 24, w: 16, h: 12 }; run(30); break
  case 'boss': give(); place('shrine', 'start', 0, -37); s.zoneIndex = 1; s.zone = { x: 16, y: 0, w: 16, h: 12 }; run(150); break
  case 'dark': give(); place('shrine', 'start', 16, -30); s.zoneIndex = 5; s.zone = { x: 32, y: 12, w: 16, h: 12 }; run(30); break
  case 'pause': give(); run(10); ui.paused = true; break
  case 'f-pause': give(); for (const id of ['fr:6,8', 'fr:6,7', 'fr:6,6', 'fr:5,6']) place(id, 'camp'); run(10); ui.paused = true; break
  case 'hut': give(); place('hut', 'door', 0, -5.5); s.hero.dir = 'up'; run(5); break
  case 'hutout': run(12); break
  case 'hutfront': give(); place('overworld', 'hut', 0, 1.5); run(10); break
  case 'p-plaza': run(20); break
  case 'p-kiosk': s.hero.x = 8.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-sign': s.hero.x = 23.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-term': s.hero.x = 12.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-door': s.hero.x = 24.5; s.hero.y = 5.6; s.hero.dir = 'up'; run(5); break
  case 'p-arcade': put('parcade', 7.5, 5.5, 'up'); run(5); break
  case 'p-back': put('parcade', 12.5, 3.6, 'right'); run(5); break
  case 'p-board': put('parcade', 9.5, 2.5, 'up'); run(5); break
  case 'p-hangar': put('parcade', 15.5, 1.6, 'up'); run(5); break
  case 'p-home': put('home', 7.5, 2.5, 'up'); run(5); break
  case 'p-exit': put('parcade', 7.5, 5.5, 'up'); s.mode = 'exit'; s.warp = { t: WARP_TIME, to: '', entry: '', swapped: false }; break
  case 'p-reduced': ui.reducedMotion = true; run(20); break
  case 'r-plaza': run(20); break
  // Part 9's light stills, in the open square (r-plaza stays where the reference stills are pinned).
  case 'r-square': go('overworld', 20.5, 17.5, 'up'); run(20); break
  case 'r-lamp': go('overworld', 18.5, 12.6, 'up'); run(20); break
  case 'r-wall': go('overworld', 14.5, 10.2, 'up'); run(20); break
  case 'r-stall': go('overworld', 31.5, 16.5, 'up'); run(20); break
  // A blob and a spitter beside the hero (part 19: the figures in isometric pixel art). r-foehit: the blob mid-hit and
  // the spitter hurt (both flashing white on the frame drawn), the spitter walking east.
  // The pilot cast of part 19 in two rows on the square, the front row facing as drawn, the back row mirrored,
  // a blob and spitters walking the four ways at the end of the rows: the figures side by side in the view's light.
  case 'r-cast': {
    go('overworld', 20.5, 19.5, 'up'); run(2)
    const looks = ['keeper', 'vendor', 'kid', 'barmaid', 'guard', 'petter', 'robot', 'cat', 'hippie', 'smoker', 'guitar', 'sleeper', 'twirler']
    s.map.npcs.length = 0
    looks.forEach((look, i) => {
      for (const row of [0, 1]) s.map.npcs.push({ id: 'cast' + i + row, look, x: 14.5 + i * 1.1, y: 16.2 + row * 1.6, dir: row ? 'left' : 'down', home: { x: 0, y: 0 }, wander: false, t: 0, vx: 0, vy: 0 })
    })
    const foes = s.map.enemies.filter(e => e.kind === 'spitter').slice(0, 4)
    const b = s.map.enemies.find(e => e.kind === 'blob')
    for (const e of s.map.enemies) if (e !== b && !foes.includes(e)) { e.x = -50; e.y = -50 }
    if (b) { b.x = 13.2; b.y = 16.4 }
    ;['down', 'right', 'up', 'left'].forEach((d, i) => { const e = foes[i]; if (e) { e.x = 13.2 + (i % 2) * 1.2; e.y = 17.8 + Math.floor(i / 2) * 1.3; e.dir = d; e.ai.tell = 0 } })
    s.hero.x = 20.5; s.hero.y = 20.2
    break
  }
  case 'r-foes': case 'r-foehit': {
    give(); go('overworld', 20.5, 17.5, 'up'); run(2)
    const hx = s.hero.x, hy = s.hero.y
    const b = s.map.enemies.find(e => e.kind === 'blob'), sp = s.map.enemies.find(e => e.kind === 'spitter')
    const sp2 = s.map.enemies.filter(e => e.kind === 'spitter')[1]
    if (b) { b.x = hx - 1.6; b.y = hy + 0.4; b.ai.mode = 'wait'; b.ai.t = 9 }
    if (sp) { sp.x = hx + 1.7; sp.y = hy + 0.2; sp.dir = 'right'; sp.ai.mode = 'walk'; sp.ai.t = 9; sp.ai.tell = 0 }
    if (sp2) { sp2.x = hx + 0.2; sp2.y = hy - 1.6; sp2.dir = 'up'; sp2.ai.mode = 'walk'; sp2.ai.t = 9; sp2.ai.tell = 0 }
    for (const e of s.map.enemies) if (e !== b && e !== sp && e !== sp2) { e.x = -50; e.y = -50 }
    if (scene === 'r-foehit') { if (b) b.flash = 0.3; if (sp) { sp.flash = 0.3 } }
    break
  }
  // Part 20's foe groups beside the hero, the rest of each room's foes sent away; -hit: every one flashing white on
  // the frame drawn. The town's (sentry, dasher, zapper, bat), the shrine's (skull, eye, knight, bat; the skull
  // mid-hop), the labs' (hound, drone, the hound's tell). The ghost and the Wildwood's people in two rows on the
  // square (f-cast), as r-cast does the pilot's.
  case 'f-town': case 'f-townhit': case 'f-shrine': case 'f-shrinehit': case 'f-lab': case 'f-labhit': {
    const grp = scene.replace('hit', '')
    if (grp === 'f-town') { give(); go('overworld', 20.5, 17.5, 'up') }
    else if (grp === 'f-shrine') { give(); place('shrine', 'start', 0, -2); s.hero.dir = 'up' }
    else { wild(true); go('lab1', 23.5, 31.5, 'up') }
    run(2)
    // (The blade stands in no room of the world; the shrine's group borrows one so its drawing is seen.)
    const kinds = { 'f-town': ['sentry', 'dasher', 'zapper', 'bat'], 'f-shrine': ['skull', 'eye', 'knight', 'bat', 'blade'], 'f-lab': ['hound', 'drone', 'hound', 'bat'] }[grp]
    const spots = [[-1.7, 0.3, 'right'], [1.7, 0.2, 'down'], [-0.6, -1.9, 'up'], [1.3, -1.6, 'left'], [-2.2, -1.3, 'down']]
    const hx = s.hero.x, hy = s.hero.y
    const picked = []
    kinds.forEach((k, i) => {
      let e = s.map.enemies.find(o => o.kind === k && !picked.includes(o))
      if (!e) {
        e = { id: 'lab.' + k + i, kind: k, x: 0, y: 0, r: 0.4, hp: 2, maxHp: 2, dir: 'down', cell: 0, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 9, tell: 0 }, home: { x: hx, y: hy }, dead: false, flash: 0 }
        s.map.enemies.push(e)
      }
      e.dead = false; e.cell = s.zoneIndex
      picked.push(e)
      const [dx, dy, d] = spots[i]
      e.x = hx + dx; e.y = hy + dy; e.dir = d; e.ai.t = 9; e.ai.tell = 0; e.stun = 0
      if (k === 'skull') { e.ai.mode = 'hop'; e.ai.t = 0.17 }
      if (k === 'hound' && i === 2) { e.ai.mode = 'tell' }
      else if (k !== 'skull' && k !== 'bat' && k !== 'eye') e.ai.mode = 'walk'
    })
    for (const e of s.map.enemies) if (!picked.includes(e)) { e.x = -50; e.y = -50 }
    if (scene.endsWith('hit')) for (const e of picked) e.flash = 0.3
    break
  }
  case 'f-cast': {
    go('overworld', 20.5, 19.5, 'up'); run(2)
    const looks = ['ghost', 'luna', 'mossa', 'dusty', 'toby', 'max', 'owl']
    s.map.npcs.length = 0
    looks.forEach((look, i) => {
      for (const row of [0, 1]) s.map.npcs.push({ id: 'cast' + i + row, look, x: 16.5 + i * 1.3, y: 16.2 + row * 1.6, dir: row ? 'left' : 'down', home: { x: 0, y: 0 }, wander: false, t: 0, vx: 0, vy: 0 })
    })
    for (const e of s.map.enemies) { e.x = -50; e.y = -50 }
    s.hero.x = 20.5; s.hero.y = 20.2
    break
  }
  case 'r-fountain': go('overworld', 20.5, 16.2, 'up'); run(20); break
  // The NEW LOOK stall east of the fountain: at its counter, and walking up to it from the square.
  case 'r-look': s.hero.x = 31.5; s.hero.y = 14.5; s.hero.dir = 'up'; run(5); break
  case 'r-lookwalk': s.hero.x = 27.5; s.hero.y = 15.5; s.hero.dir = 'right'; run(8, inp({ move: { x: 1, y: 0 } })); break
  // The newsstand on the coast road: from beside it (the roof's neon in the clear) and at its counter (the label up).
  case 'r-kiosk': s.hero.x = 18.5; s.hero.y = 26.5; s.hero.dir = 'left'; run(20); break
  case 'r-kioskat': s.hero.x = 15.5; s.hero.y = 26.5; s.hero.dir = 'up'; run(5); break
  case 'r-kata': s.hero.x = 33.5; s.hero.y = 7.5; s.hero.dir = 'up'; run(5); break
  case 'r-road': s.hero.x = 39.5; s.hero.y = 26.5; s.hero.dir = 'right'; run(20); break
  case 'r-beach': s.hero.x = 29.5; s.hero.y = 28.5; s.hero.dir = 'down'; run(40); break
  // By the beach tree on the coast road (part 17).
  case 'r-tree': s.hero.x = 25.8; s.hero.y = 27.2; s.hero.dir = 'up'; run(40); break
  case 'r-jam': s.hero.x = 25.5; s.hero.y = 31.5; s.hero.dir = 'up'; run(40); break
  case 'r-sword': give(); run(20); break
  // Part 21: the hero mid-swing on the square (the blade's art), and the hero hurt (the flash and the hurt frame).
  case 'r-swing': give(); go('overworld', 20.5, 17.5, 'down'); run(20); r.onEvents(stepGame(world, s, 1 / 60, inp({ aPress: true, a: true }))); run(5, inp({ a: true })); break
  case 'r-hurt': give(); go('overworld', 20.5, 17.5, 'down'); run(20); s.hero.act = 'hurt'; s.hero.actT = 0.05; s.hero.invuln = 0.9; s.hero.vx = 0; s.hero.vy = 0; break
  case 'r-rich': give(); s.inv.bits = 4321; run(20); break
  case 'r-arcade': place('arcade', 'door'); run(20); break
  // The VIP room: a counter that turns a corner, the back bar, the velvet floor.
  case 'r-vip': place('vip', 'door', 0, -3); run(20); break
  // The fence round Horizon Lab, where it turns a corner.
  case 'w-fence': wild(true); go('wildwood', 47.5, 25.5, 'up'); run(30); break
  case 'r-fighter': place('arcade', 'pizzarescue'); run(5); break
  case 'r-nova': place('arcade', 'nova'); run(5); break
  case 'r-horizon': place('arcade', 'horizon'); run(5); break
  case 'r-home': place('home', 'door'); run(20); break
  case 'r-desk': place('home', 'door', -2, -4); s.hero.dir = 'left'; run(5); break
  case 'r-console': place('home', 'login'); run(5); break
  // The Wildwood and Project Horizon's labs (w-* outdoors, l-* Horizon Lab, d-* the Deep Lab, i-* rooms)
  case 'w-shore': wild(); go('wildwood', 76.5, 38.5, 'left'); run(30); break
  case 'w-camp': wild(true); go('wildwood', 50.5, 38.5, 'up'); run(60, inp({ move: { x: 0.01, y: 0 } })); run(30); break
  case 'w-lab': wild(true); go('wildwood', 52.5, 24.5, 'up'); run(30); break
  // Part 23's sorting stills: the hero behind and in front of the drawn van, a DJ booth and a lab tank.
  case 'w-van-back': wild(); go('wildwood', 50.2, 22.55, 'down'); run(4); break
  case 'w-van-front': wild(); go('wildwood', 50.2, 24.45, 'up'); run(4); break
  case 'r-sofa-back': place('home', 'door'); s.hero.x = 7.5; s.hero.y = 2.62; s.hero.dir = 'down'; run(4); break
  case 'r-sofa-front': place('home', 'door'); s.hero.x = 7.5; s.hero.y = 4.3; s.hero.dir = 'up'; run(4); break
  case 'r-booth-back': s.hero.x = 25.4; s.hero.y = 29.45; s.hero.dir = 'down'; run(4); break
  case 'r-booth-front': s.hero.x = 25.4; s.hero.y = 31.25; s.hero.dir = 'up'; run(4); break
  case 'l-tank-back': case 'l-tank-front': {
    // The lab tank nearest the llama room's door, from the map's own tiles: the hero just north of it, or just south.
    wild(true); go('lab1', 40.5, 9.5, 'up'); run(2)
    const m = s.map; let best = null
    for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === 'I') { const x = i % m.w, y = Math.floor(i / m.w); const d = Math.hypot(x - 40, y - 9); if (!best || d < best.d) best = { x, y, d } }
    s.hero.x = best.x + 0.5; s.hero.y = scene === 'l-tank-back' ? best.y - 0.05 : best.y + 1.25; s.hero.dir = scene === 'l-tank-back' ? 'down' : 'up'; run(4); break
  }
  case 'w-grove': wild(true); go('wildwood', 39.5, 9.5, 'up'); run(30); break
  case 'w-brambles': wild(); go('wildwood', 37.5, 36.5, 'up'); run(30); break
  case 'w-ravine': wild(true); s.inv.hook = true; s.inv.selected = 'hook'; go('wildwood', 32.5, 37.5, 'left'); run(10); r.onEvents(stepGame(world, s, 1 / 60, inp({ bPress: true }))); run(12); break
  case 'w-radio': wild(true); go('wildwood', 56.5, 9.5, 'right'); run(30); break
  case 'w-deep': wild(true); go('wildwood', 12.5, 20.5, 'up'); run(30); break
  case 'i-mossa': wild(); go('mossa', 5.5, 5.5, 'up'); run(20); break
  case 'i-radio': wild(); go('radio', 4.5, 5.5, 'up'); run(20); break
  case 'l-lobby': wild(true); go('lab1', 23.5, 31.5, 'up'); run(30); break
  case 'l-dark': wild(true); go('lab1', 7.5, 30.5, 'up'); run(30); break
  case 'l-psi': wild(true); go('lab1', 34.5, 20.5, 'right'); run(10); r.onEvents(stepGame(world, s, 1 / 60, inp({ aPress: true, a: true }))); run(8); break
  case 'l-llama': wild(true); go('lab1', 40.5, 9.5, 'up'); run(100); break
  case 'l-mistral': wild(true); s.inv.hook = true; go('lab1', 23.5, 9.5, 'up'); run(160); break
  case 'l-vault': wild(true); s.inv.hook = true; s.inv.selected = 'hook'; go('lab1', 7.5, 8.5, 'up'); run(5); r.onEvents(stepGame(world, s, 1 / 60, inp({ bPress: true }))); run(9); break
  case 'l-b1': wild(true); s.flags['crystal:lab1'] = true; go('lab1b', 30.5, 29.5, 'left'); run(30); break
  case 'd-room11': wild(true); go('deep1', 7.5, 4.5, 'up'); run(90); break
  case 'd-hall': wild(true); go('deep1', 23.5, 21.5, 'up'); run(30); break
  case 'd-deepseek': wild(true); s.inv.hook = true; go('deep1', 39.5, 19.5, 'up'); run(150); break
  case 'd-vines': wild(true); s.inv.arc = true; go('deep1', 7.5, 28.5, 'left'); run(10); r.onEvents(stepGame(world, s, 1 / 60, inp({ aPress: true, a: true }))); run(4); break
  case 'd-gemini': wild(true); s.inv.arc = true; go('deep2', 23.5, 10.5, 'up'); run(140); break
  // Part 22: the troll by the broken bridge (the hero just south of him).
  case 'w-troll': wild(); go('wildwood', 35.5, 38.5, 'up'); run(30); break
  // The physical puzzles' lab (world/puzzlelab.ts, docs/games/neon-shrine-puzzles.md), one room per mechanic.
  case 'pz-weights': give(); go('puzzlelab', 6.5, 17.5, 'up'); run(2); r.onEvents(stepGame(world, s, 1 / 60, inp({ aPress: true, a: true }))); run(20); s.hero.x = 11.5; s.hero.y = 17.5; s.hero.dir = 'down'; run(20); break
  case 'pz-ice': give(); go('puzzlelab', 20.5, 20.5, 'up'); run(2); run(14, inp({ move: { x: 0, y: -1 } })); break
  case 'pz-beam': give(); go('puzzlelab', 40.5, 19.5, 'up'); s.map.tiles[16 * s.map.w + 33] = 'ν'; run(30); break
  case 'pz-boulder': give(); go('puzzlelab', 42.5, 9.5, 'up'); s.flags['lab.d.roll'] = true; run(40); break
  case 'pz-sluice': give(); s.flags['lab.e.tide'] = true; go('puzzlelab', 24.5, 7.5, 'left'); run(30); break
  case 'pz-final': give(); s.flags['lab.f.roll'] = true; go('puzzlelab', 7.5, 6.5, 'right'); run(90); s.map.tiles[5 * s.map.w + 10] = 'α'; s.map.tiles[3 * s.map.w + 10] = 'ν'; run(10); break
  case 'd-gate': wild(true); s.inv.arc = true; s.flags.gemini = true; s.flags.gateShut = true; go('deep2', 23.5, 8.5, 'up'); run(20); break
  // Field battles (docs/games/neon-shrine-battle.md) in the demo glade: b-field before a fight; the others in one,
  // the menu open (b-menu), a target being picked (b-target), the tech list (b-tech), a blow landing (b-hit),
  // the hero alone (b-solo).
  case 'b-field': wild(true); s.inv.tonics = 3; go('arena', 15.5, 18.5, 'up'); run(30); break
  case 'b-menu': case 'b-target': case 'b-tech': case 'b-hit': case 'b-solo': case 'b-marks': {
    wild(scene !== 'b-solo'); s.inv.tonics = 3
    const g = scene === 'b-hit' ? [18.5, 9.4] : scene === 'b-solo' ? [23.5, 14.6] : [8.5, 18.4]
    go('arena', g[0], g[1], 'up'); run(2)
    if (s.luna) { s.luna.x = s.hero.x + 0.6; s.luna.y = s.hero.y + 0.9 }
    for (let k = 0; k < 400 && s.mode === 'play'; k++) run(1, inp({ move: { x: 0, y: -1 } }))
    for (let k = 0; k < 900 && !(s.battle && s.battle.menu && s.battle.menu.who === 'hero'); k++) { run(1); if (s.battle && s.battle.menu && s.battle.menu.who !== 'hero') run(1, inp({ aPress: true })) }
    if (scene === 'b-target') run(1, inp({ aPress: true }))
    if (scene === 'b-tech') run(1, inp({ pick: { cmd: 1 } }))
    if (scene === 'b-hit') { run(1, inp({ aPress: true })); run(1, inp({ aPress: true })); run(21) }
    if (scene === 'b-marks') {
      const [first, second] = s.battle.fighters.filter(f => f.side === 'foe')
      first.status = { stun: 2, static: 2 }
      second.status = { slow: 2, break: 2 }
      run(1, inp({ aPress: true }))
    }
    break
  }
  // Dig & build (docs/games/neon-shrine-dig.md): Lumenby Quarry with every tool, a ramp up the plateau, a block, a
  // hole, planks over the lake and a lamp already built. q-quarry: on the ground, the hammer out (the target
  // outlined); q-ledge: up on the plateau by the ramp; q-hole: down in a hole, the shovel out.
  case 'q-quarry': case 'q-ledge': case 'q-hole': {
    give()
    for (const t of ['pickaxe', 'shovel', 'axe', 'hammer']) s.flags['item:' + t] = true
    s.inv.mats = { dirt: 4, stone: 6, wood: 3, lumen: 2 }
    const W = 32, e = (x, y, v) => [y * W + x, v]
    s.digEdits = { quarry: Object.fromEntries([e(16, 8, 'ж2'), e(19, 11, 'б2'), e(20, 11, 'а2'), e(20, 10, 'а3'), e(12, 9, 'к0'), e(13, 9, 'к0'), e(22, 4, '=1'), e(23, 4, '=1'), e(21, 6, 't1'), e(16, 10, 't1'), e(5, 13, 'д1'), e(13, 8, 'ж2')]) }
    if (scene === 'q-quarry') { s.inv.selected = 'build'; s.inv.build = 'stone'; go('quarry', 17.5, 10.5, 'up') }
    else if (scene === 'q-ledge') { s.inv.selected = 'dig'; go('quarry', 16.5, 5.6, 'left') }
    else { s.inv.selected = 'dig'; go('quarry', 12.5, 9.5, 'right') }
    for (const f of s.map.enemies) if (f.kind === 'hound') { f.x = 18.5; f.y = 14.5 }
    run(20)
    break
  }
}
if (bossHit) for (const e of s.map.enemies) if (['king', 'llama', 'mistral', 'deepseek', 'gemini'].includes(e.kind)) e.flash = 0.3
if (bossDown) for (const e of s.map.enemies) if (e.kind === 'mistral') { e.ai.mode = 'down'; e.ai.t = 9 }
// DAY=sun|noon|night|dawn: a solved save's running hour, as steady.mjs --day (without it the eternal dusk).
if (q.get('day')) { s.inv.prism = true; s.daytime = { sun: 500, noon: 580, night: 230, dawn: 400 }[q.get('day')] }
function wild(luna = false) {
  give(); s.inv.hook = true; s.hero.hp = s.hero.maxHp
  for (const f of ['intro', 'llama.met', 'mistral.met', 'deepseek.met', 'gemini.met', 'room11', 'mistral.told']) s.flags[f] = true
  if (luna) s.flags.luna = true
}
function go(map, x, y, dir) { enterMap(world, s, map, '', ev, { x, y }); s.hero.dir = dir; s.hero.auto = null; s.mode = 'play'; s.dialog = null }
// Several frames so fades (exit labels) settle and the clock moves.
;(async () => {
  // (A realm's scenery is a chunk of its own, fetched when the view first needs it: the lab waits for it.)
  await loadRealmArt(kitFor(mapDef(world, s.map.id)))
  if (q.get('t')) r.draw(s, ui, +q.get('t'))
  const frames = +(q.get('frames') || 40)
  for (let k = 0; k < frames; k++) {
    if (k === frames - 2 && late) late()
    if (k >= frames - lateSteps) run(1, lateInput ?? inp({}))
    r.draw(s, ui, 1 / 60)
  }
  // For a lab page that wants to go on drawing (timing a view, filming a turn).
  window.__lab = { r, s, ui, world, step: (n = 1, i = inp({})) => run(n, i), inp }
  document.title = 'ready'
})()
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_shot.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const SHOTS = [
  ['start-1440', 'start', 1440, 900, 1, 0],
  ['start-390', 'start', 390, 844, 3, 0],
  ['swing-1440', 'swing', 1440, 900, 1, 0],
  // Real-time combat (VIEW=iso is the one that matters).
  ['swing1-1280', 'swing1', 1280, 800, 1, 0],
  ['swing2-1280', 'swing2', 1280, 800, 1, 0],
  ['swing3-1280', 'swing3', 1280, 800, 1, 0],
  ['roll-1280', 'roll', 1280, 800, 1, 0],
  ['hit-1280', 'hit', 1280, 800, 1, 0],
  ['kill-1280', 'kill', 1280, 800, 1, 0],
  ['hit-375', 'hit', 375, 667, 2, 0],
  ['intro-390', 'intro', 390, 844, 3, 0],
  ['market-1440', 'market', 1440, 900, 1, 0],
  ['woods-1440', 'woods', 1440, 900, 1, 0],
  ['lake-1440', 'lake', 1440, 900, 1, 0],
  ['graves-1440', 'graves', 1440, 900, 1, 0],
  ['shop-1440', 'shop', 1440, 900, 1, 0],
  ['arcade-667', 'arcade', 667, 375, 2, 0],
  ['entry-1440', 'entry', 1440, 900, 1, 0],
  ['hub-1440', 'hub', 1440, 900, 1, 0],
  ['crystal-1440', 'crystal', 1440, 900, 1, 0],
  ['boss-1440', 'boss', 1440, 900, 1, 0],
  ['dark-667', 'dark', 667, 375, 2, 0],
  ['pause-1440', 'pause', 1440, 900, 1, 0],
  ['hut-1280', 'hut', 1280, 800, 1, 0],
  ['hutout-1280', 'hutout', 1280, 800, 1, 0],
  ['hutfront-390', 'hutfront', 390, 844, 3, 0],
  ['p-plaza-1280', 'p-plaza', 1280, 800, 1, 0],
  ['p-plaza-390', 'p-plaza', 390, 844, 3, 0],
  ['p-kiosk-1280', 'p-kiosk', 1280, 800, 1, 0],
  ['p-sign-390', 'p-sign', 390, 844, 3, 0],
  ['p-term-1280', 'p-term', 1280, 800, 1, 0],
  ['p-door-1280', 'p-door', 1280, 800, 1, 0],
  ['p-arcade-1280', 'p-arcade', 1280, 800, 1, 0],
  ['p-arcade-390', 'p-arcade', 390, 844, 3, 0],
  ['p-back-1280', 'p-back', 1280, 800, 1, 0],
  ['p-board-1280', 'p-board', 1280, 800, 1, 0],
  ['p-hangar-390', 'p-hangar', 390, 844, 3, 0],
  ['p-home-1280', 'p-home', 1280, 800, 1, 0],
  ['p-exit-1280', 'p-exit', 1280, 800, 1, 0],
  ['p-reduced-1280', 'p-reduced', 1280, 800, 1, 0],
  ['shop-390', 'shop', 390, 844, 3, 0],
  ['r-plaza-1280', 'r-plaza', 1280, 800, 1, 0],
  ['r-square-1280', 'r-square', 1280, 800, 1, 0],
  ['r-lamp-1280', 'r-lamp', 1280, 800, 1, 0],
  ['r-wall-1280', 'r-wall', 1280, 800, 1, 0],
  ['r-stall-1280', 'r-stall', 1280, 800, 1, 0],
  ['r-foes-1280', 'r-foes', 1280, 800, 1, 0],
  ['r-cast-1280', 'r-cast', 1280, 800, 1, 0],
  ['r-foehit-1280', 'r-foehit', 1280, 800, 1, 0],
  ['f-cast-1280', 'f-cast', 1280, 800, 1, 0],
  ['f-town-1280', 'f-town', 1280, 800, 1, 0],
  ['f-townhit-1280', 'f-townhit', 1280, 800, 1, 0],
  ['f-shrine-1280', 'f-shrine', 1280, 800, 1, 0],
  ['f-shrinehit-1280', 'f-shrinehit', 1280, 800, 1, 0],
  ['f-lab-1280', 'f-lab', 1280, 800, 1, 0],
  ['f-labhit-1280', 'f-labhit', 1280, 800, 1, 0],
  ['r-fountain-1280', 'r-fountain', 1280, 800, 1, 0],
  ['r-plaza-390', 'r-plaza', 390, 844, 3, 0],
  ['r-plaza-412', 'r-plaza', 412, 915, 2.625, 0],
  ['r-look-1280', 'r-look', 1280, 800, 1, 0],
  ['r-look-390', 'r-look', 390, 844, 3, 0],
  ['r-lookwalk-1280', 'r-lookwalk', 1280, 800, 1, 0],
  ['r-kiosk-1280', 'r-kiosk', 1280, 800, 1, 0],
  ['r-kiosk-390', 'r-kiosk', 390, 844, 3, 0],
  ['r-kioskat-1280', 'r-kioskat', 1280, 800, 1, 0],
  ['r-kata-1280', 'r-kata', 1280, 800, 1, 0],
  ['r-kata-390', 'r-kata', 390, 844, 3, 0],
  ['r-road-1280', 'r-road', 1280, 800, 1, 0],
  ['r-road-390', 'r-road', 390, 844, 3, 0],
  ['r-beach-1280', 'r-beach', 1280, 800, 1, 0],
  ['r-beach-390', 'r-beach', 390, 844, 3, 0],
  ['r-tree-1280', 'r-tree', 1280, 800, 1, 0],
  ['r-tree-390', 'r-tree', 390, 844, 3, 0],
  ['r-jam-1280', 'r-jam', 1280, 800, 1, 0],
  ['r-sword-1280', 'r-sword', 1280, 800, 1, 0],
  ['r-swing-1280', 'r-swing', 1280, 800, 1, 0],
  ['r-hurt-1280', 'r-hurt', 1280, 800, 1, 0],
  ['r-sword-390', 'r-sword', 390, 844, 3, 0],
  ['r-rich-390', 'r-rich', 390, 844, 3, 0],
  ['r-rich-1280', 'r-rich', 1280, 800, 1, 0],
  // Installed web app on an iPhone: the status bar over the top, the home bar under the bottom.
  ['r-sword-app-390', 'r-sword', 390, 844, 3, 47],
  ['intro-app-390', 'intro', 390, 844, 3, 47],
  ['r-arcade-1280', 'r-arcade', 1280, 800, 1, 0],
  ['r-vip-1280', 'r-vip', 1280, 800, 1, 0],
  ['w-fence-1280', 'w-fence', 1280, 800, 1, 0],
  ['r-arcade-390', 'r-arcade', 390, 844, 3, 0],
  ['r-fighter-1280', 'r-fighter', 1280, 800, 1, 0],
  ['r-fighter-390', 'r-fighter', 390, 844, 3, 0],
  ['r-nova-1280', 'r-nova', 1280, 800, 1, 0],
  ['r-nova-390', 'r-nova', 390, 844, 3, 0],
  ['r-horizon-1280', 'r-horizon', 1280, 800, 1, 0],
  ['r-horizon-390', 'r-horizon', 390, 844, 3, 0],
  ['r-home-1280', 'r-home', 1280, 800, 1, 0],
  ['r-home-390', 'r-home', 390, 844, 3, 0],
  ['r-console-1280', 'r-console', 1280, 800, 1, 0],
  ['r-console-375', 'r-console', 375, 667, 2, 0],
  ['w-shore-1280', 'w-shore', 1280, 800, 1, 0],
  ['w-camp-1280', 'w-camp', 1280, 800, 1, 0],
  ['w-lab-1280', 'w-lab', 1280, 800, 1, 0],
  ['w-van-back-1280', 'w-van-back', 1280, 800, 1, 0],
  ['w-van-front-1280', 'w-van-front', 1280, 800, 1, 0],
  ['r-sofa-back-1280', 'r-sofa-back', 1280, 800, 1, 0],
  ['r-sofa-front-1280', 'r-sofa-front', 1280, 800, 1, 0],
  ['r-booth-back-1280', 'r-booth-back', 1280, 800, 1, 0],
  ['r-booth-front-1280', 'r-booth-front', 1280, 800, 1, 0],
  ['l-tank-back-1280', 'l-tank-back', 1280, 800, 1, 0],
  ['l-tank-front-1280', 'l-tank-front', 1280, 800, 1, 0],
  ['w-radio-1280', 'w-radio', 1280, 800, 1, 0],
  ['w-grove-1280', 'w-grove', 1280, 800, 1, 0],
  ['w-brambles-1280', 'w-brambles', 1280, 800, 1, 0],
  ['w-ravine-1280', 'w-ravine', 1280, 800, 1, 0],
  ['w-deep-1280', 'w-deep', 1280, 800, 1, 0],
  ['i-mossa-1280', 'i-mossa', 1280, 800, 1, 0],
  ['i-radio-1280', 'i-radio', 1280, 800, 1, 0],
  ['l-lobby-1280', 'l-lobby', 1280, 800, 1, 0],
  ['l-dark-1280', 'l-dark', 1280, 800, 1, 0],
  ['l-psi-1280', 'l-psi', 1280, 800, 1, 0],
  ['l-llama-1280', 'l-llama', 1280, 800, 1, 0],
  ['l-mistral-1280', 'l-mistral', 1280, 800, 1, 0],
  ['l-vault-1280', 'l-vault', 1280, 800, 1, 0],
  ['l-b1-1280', 'l-b1', 1280, 800, 1, 0],
  ['d-room11-1280', 'd-room11', 1280, 800, 1, 0],
  ['d-hall-1280', 'd-hall', 1280, 800, 1, 0],
  ['d-deepseek-1280', 'd-deepseek', 1280, 800, 1, 0],
  ['d-vines-1280', 'd-vines', 1280, 800, 1, 0],
  ['d-gemini-1280', 'd-gemini', 1280, 800, 1, 0],
  ['d-gate-1280', 'd-gate', 1280, 800, 1, 0],
  ['w-camp-390', 'w-camp', 390, 844, 3, 0],
  // Part 22: the bosses hurt, and the troll.
  ['boss-hit-1440', 'boss-hit', 1440, 900, 1, 0],
  ['l-llama-hit-1280', 'l-llama-hit', 1280, 800, 1, 0],
  ['l-mistral-hit-1280', 'l-mistral-hit', 1280, 800, 1, 0],
  ['l-mistral-down-1280', 'l-mistral-down', 1280, 800, 1, 0],
  ['d-deepseek-hit-1280', 'd-deepseek-hit', 1280, 800, 1, 0],
  ['d-gemini-hit-1280', 'd-gemini-hit', 1280, 800, 1, 0],
  ['w-troll-1280', 'w-troll', 1280, 800, 1, 0],
  // Field battles: a phone (375×667) and a laptop.
  ['b-field-375', 'b-field', 375, 667, 2, 0],
  ['b-menu-375', 'b-menu', 375, 667, 2, 0],
  ['b-target-375', 'b-target', 375, 667, 2, 0],
  ['b-tech-375', 'b-tech', 375, 667, 2, 0],
  ['b-hit-375', 'b-hit', 375, 667, 2, 0],
  ['b-solo-375', 'b-solo', 375, 667, 2, 0],
  ['b-menu-1280', 'b-menu', 1280, 800, 1, 0],
  ['b-marks-390', 'b-marks', 390, 844, 2, 0],
  ['b-marks-1280', 'b-marks', 1280, 800, 1, 0],
  ['b-hit-1280', 'b-hit', 1280, 800, 1, 0],
  ['pz-weights-1280', 'pz-weights', 1280, 800, 1, 0],
  ['pz-ice-1280', 'pz-ice', 1280, 800, 1, 0],
  ['pz-beam-1280', 'pz-beam', 1280, 800, 1, 0],
  ['pz-boulder-1280', 'pz-boulder', 1280, 800, 1, 0],
  ['pz-sluice-1280', 'pz-sluice', 1280, 800, 1, 0],
  ['pz-final-1280', 'pz-final', 1280, 800, 1, 0],
  ['pz-final-390', 'pz-final', 390, 844, 3, 0],
  // The same places at the size the views are judged at.
  ['shop-1280', 'shop', 1280, 800, 1, 0],
  ['shop-390', 'shop', 390, 844, 3, 0],
  // A retina monitor.
  ['r-plaza-1280x2', 'r-plaza', 1280, 800, 2, 0],
  ['d-room11-1280x2', 'd-room11', 1280, 800, 2, 0],
  ['r-beach-1280x2', 'r-beach', 1280, 800, 2, 0],
  // (An upright phone.)
  ['r-square-390', 'r-square', 390, 844, 3, 0],
  ['w-grove-390', 'w-grove', 390, 844, 3, 0],
  ['entry-390', 'entry', 390, 844, 3, 0],
  ['graves-1280', 'graves', 1280, 800, 1, 0],
  ['lake-1280', 'lake', 1280, 800, 1, 0],
  ['d-room11-390', 'd-room11', 390, 844, 3, 0],
  ['f-puzzle', 'f-puzzle', 1280, 800, 1, 0],
  ['f-battle', 'f-battle', 1280, 800, 1, 0],
  ['f-dig', 'f-dig', 1280, 800, 1, 0],
  ['life', 'life', 1280, 800, 1, 0],
  ['life-390', 'life', 390, 844, 2, 0],
  ['f-landing', 'f-landing', 1280, 800, 1, 0],
  ['f-landing-390', 'f-landing', 390, 844, 2, 0],
  ['f-ferry-town', 'f-ferry-town', 1280, 800, 1, 0],
  ['f-ferry-town-390', 'f-ferry-town', 390, 844, 2, 0],
  ['f-ferry-landing', 'f-ferry-landing', 1280, 800, 1, 0],
  ['f-ferry-landing-390', 'f-ferry-landing', 390, 844, 2, 0],
  ['f-meadow', 'f-meadow', 1280, 800, 1, 0],
  ['f-meadow-390', 'f-meadow', 390, 844, 2, 0],
  ['f-roadlight', 'f-roadlight', 1280, 800, 1, 0],
  ['f-quarry', 'f-quarry', 1280, 800, 1, 0],
  ['f-cave', 'f-cave', 1280, 800, 1, 0],
  ['f-pause-390', 'f-pause', 390, 844, 2, 0],
  ...['fell', 'spore', 'sand', 'lawns', 'quarry', 'fog', 'in-fell', 'in-sand'].map(g => [`g-${g}`, `g-${g}`, 1280, 800, 1, 0]),
  ['g-map', 'g-map', 1280, 800, 1, 0],
  ['g-map-390', 'g-map', 390, 844, 2, 0],
  // Dig & build's quarry (VIEW=iso is the one that matters).
  ['q-quarry-1280', 'q-quarry', 1280, 800, 1, 0],
  ['q-quarry-390', 'q-quarry', 390, 844, 3, 0],
  ['q-ledge-1280', 'q-ledge', 1280, 800, 1, 0],
  ['q-hole-1280', 'q-hole', 1280, 800, 1, 0],
  ['f-lumenby', 'f-lumenby', 1280, 800, 1, 0],
  ['f-lumenby-390', 'f-lumenby', 390, 844, 2, 0],
  ['f-underglow', 'f-underglow', 1280, 800, 1, 0],
  ['f-underglow-390', 'f-underglow', 390, 844, 2, 0],
  ['f-seterfell', 'f-seterfell', 1280, 800, 1, 0],
  ['f-seterfell-390', 'f-seterfell', 390, 844, 2, 0],
  ['f-yulefjord', 'f-yulefjord', 1280, 800, 1, 0],
  ['f-yulefjord-390', 'f-yulefjord', 390, 844, 2, 0],
  ['f-stillsand', 'f-stillsand', 1280, 800, 1, 0],
  ['f-stillsand-390', 'f-stillsand', 390, 844, 2, 0],
  ['f-sporelight', 'f-sporelight', 1280, 800, 1, 0],
  ['f-sporelight-390', 'f-sporelight', 390, 844, 2, 0],
  ['f-fogstage', 'f-fogstage', 1280, 800, 1, 0],
  ['f-fogstage-390', 'f-fogstage', 390, 844, 2, 0],
  ['f-rerun', 'f-rerun', 1280, 800, 1, 0],
  ['f-rerun-390', 'f-rerun', 390, 844, 2, 0],
  ...['gunn', 'folk', 'roads', 'cross', 'intro'].map(k => [`f-say-${k}-390`, `f-say-${k}`, 390, 844, 2, 0]),
  ...['f-fjord-cottage', 'f-fjord-lens', 'f-seter-windows', 'f-stage-light', 'f-gate-waymark', 'f-gate-seter'].map(scene => [scene, scene, 1280, 800, 1, 0]),
  ['f-gate-seter-390', 'f-gate-seter', 390, 844, 2, 0],
  ...['snow', 'dune', 'spore', 'fog', 'quarry', 'suburb'].flatMap(l => [
    [`look-${l}`, `look-${l}`, 1280, 800, 1, 0], [`look-${l}-390`, `look-${l}`, 390, 844, 2, 0],
    [`look-${l}-2`, `look-${l}-2`, 1280, 800, 1, 0],
  ]),
]
const want = only ? new Set(only.split(',')) : null
const hero = (process.env.HERO_COLORS ? `&hero=${encodeURIComponent(process.env.HERO_COLORS)}` : '') + (process.env.HERO_LOOK ? `&look=${encodeURIComponent(process.env.HERO_LOOK)}` : '')
const view = (process.env.DAY ? `&day=${process.env.DAY}` : '') + (process.env.TREE ? `&tree=${process.env.TREE}` : '') + (process.env.VIEW ? `&view=${process.env.VIEW}` : '') + (process.env.FRAMES ? `&frames=${process.env.FRAMES}` : '') + (process.env.PARAMS ? `&params=${encodeURIComponent(process.env.PARAMS)}` : '') + (process.env.LIFE ? `&at=${process.env.LIFE}` : '') + (process.env.LIFE_T ? `&t=${process.env.LIFE_T}` : '')
const tag = (process.env.VIEW ? `-${process.env.VIEW}` : '') + (process.env.DAY ? `-${process.env.DAY}` : '') + (process.env.FRAMES ? `-f${process.env.FRAMES}` : '') + (process.env.TAG ? `-${process.env.TAG}` : '')
for (const [name, scene, w, h, dpr, top] of SHOTS) {
  if (want && !want.has(name) && !want.has(scene)) continue
  const png = join(out, `${name}${tag}${process.env.HERO_COLORS ? '-dressed' : ''}${process.env.HERO_LOOK ? '-look' : ''}.png`)
  try {
    execFileSync(process.env.CHROME_BIN || 'chromium-browser', [
      '--headless=new', '--no-sandbox', ...(process.env.CHROME_BIN ? [] : ['--disable-gpu']), '--enable-unsafe-swiftshader', '--hide-scrollbars', '--allow-file-access-from-files',
      `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
      '--virtual-time-budget=3000', `--screenshot=${png}`,
      `file://${html}#scene=${scene}&w=${w}&h=${h}&dpr=${dpr}&top=${top}&touch=${w < 1000 ? 1 : 0}${hero}${view}`,
    ], { stdio: 'ignore', timeout: 60000 })
    console.log(png)
  } catch (e) {
    console.error(`failed: ${name}: ${e.message}`)
  }
}
