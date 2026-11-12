#!/usr/bin/env node
// Neon Shrine HUD lab: the HUD alone over a dusk backdrop, through the real
// renderer's hudLayer(), in every state, at three screens, in three skins.
// Snap Chromium: outDir must be a non-hidden path under $HOME.
//
//   node scripts/zelda-lab/hud-sheet.mjs <outDir> [skins] [states] [screens]
//
// Each filter is a comma list (or `all`): skins neon,window,hires; screens
// 1280, 390, 667 (and 300, only when asked for); states
//   play, dialog, name, top, ask, banner, pause, reset, strip, label
//   low      two rows of hearts, the last half one blinking, a talk at the top
//   typing   a named line half typed
//   heading  a line that opens with a word that is no name ("TODAY: …")
//   norsk    Æ Ø Å, the ellipsis and the long dashes
//   errands  the pause screen with everything carried
//   notch    a talk at the top on a screen with safe-area insets
//   mix      the skin three quarters in from the neon one (at half strength)
//   studio   the full heart and the bit as the studio might redraw them
// Screens:
// 1280 (1280×800, dpr 1, scale 4), 390 (390×844, dpr 3, scale 5: odd, so the
// hires skin takes a scale of its own), 667 (667×375, dpr 2), 300 (300×220,
// dpr 1, scale 1: no room for finer pixels, so the hires skin gives way to the
// window one). PNGs are named
// <state>-<screen>-<skin>.png. With no world behind it, a letter that is hard
// to read on the dusk colours here is hard to read in the game.
//
// HUD_T=<seconds> draws that much longer first, for the blinks' other phases
// (the "more" arrow, the pointing hand, a low heart); the PNGs then end in
// -t<seconds>.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, skinArg, stateArg, screenArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: hud-sheet.mjs <outDir> [skins] [states] [screens]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/zelda/render/renderer.ts'))}
import { NEON_SKIN, WINDOW_SKIN, HIRES_WINDOW_SKIN } from ${JSON.stringify(join(repo, 'themes/zelda/render/hud.ts'))}
import { createGame, stepGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world/index.ts'))}
import { NO_INPUT, TILE } from ${JSON.stringify(join(repo, 'themes/zelda/types.ts'))}
import { setSpriteOverrides } from ${JSON.stringify(join(repo, 'themes/zelda/render/sheet.ts'))}
import { SPRITES } from ${JSON.stringify(join(repo, 'themes/zelda/render/sprites.ts'))}

const q = new URLSearchParams(location.hash.slice(1))
const W = +q.get('w'), H = +q.get('h'), dpr = +(q.get('dpr') || 1)
const state = q.get('state')
const touch = q.get('touch') === '1'
const skin = { neon: NEON_SKIN, window: WINDOW_SKIN, hires: HIRES_WINDOW_SKIN }[q.get('skin')]
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
document.body.style.cssText = 'margin:0;background:#0b0616;overflow:hidden'
document.body.appendChild(canvas)
const s = createGame(WORLD, { seed: 7, at: { map: 'overworld', entry: 'hut' } })
s.dialog = null; s.mode = 'play'; s.hero.auto = null
const r = createRenderer(canvas, WORLD)

// The dusk the HUD has to be read against: the sky's bands, the striped sun, the sea, sand and grass in tile-sized blocks.
function backdrop(g, w, h, px) {
  const sky = ['#1a0f3a', '#2a1454', '#45186a', '#6a1c78', '#96237c', '#c43a78', '#ee5f6c', '#ff8f5a', '#ffc070']
  const horizon = Math.round(h * 0.42)
  sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.floor(horizon * i / sky.length), w, Math.ceil(horizon / sky.length) + 1) })
  const sr = Math.round(Math.min(w, h) * 0.16)
  for (let y = -sr; y < 0; y += px) {
    if (y > -sr * 0.55 && Math.floor(y / px) % 3 === 0) continue
    const half = Math.sqrt(sr * sr - y * y)
    g.fillStyle = y > -sr * 0.5 ? '#ff5fa2' : '#ffd23f'
    g.fillRect(Math.round(w * 0.68 - half), horizon + y, Math.round(half * 2), px)
  }
  const T = 16 * px
  const ground = ['#23408c', '#2b53a6', '#3466b8', '#c98a5a', '#dba066', '#3c7a4a', '#2f6440', '#4a3a78', '#5a4690', '#28204e']
  for (let y = horizon, row = 0; y < h; y += T, row++) {
    for (let x = 0, col = 0; x < w; x += T, col++) {
      const band = Math.min(4, Math.floor(row / 2))
      g.fillStyle = ground[band * 2 + ((col + row) % 2)]
      g.fillRect(x, y, T, T)
      g.fillStyle = 'rgba(255,244,255,0.06)'
      g.fillRect(x, y, T, px)
    }
  }
}

let frame = { cx: 0, cy: 0, heroY: 0 }
// The skin this one is fading in from, for the "mix" state.
let from
r.addView('hudlab', kit => ({
  turn: 0,
  draw(st, ui, dt) {
    const { g, W, H, scale } = kit.screen()
    backdrop(g, W, H, scale)
    kit.hudLayer(st, ui, dt, frame.cx, frame.cy, frame.heroY, skin, from)
    window.__space = kit.hudSpace(skin)
  },
}))
r.setView('hudlab', true)
// A phone's notch and home bar, on the side they are on when it is held this way.
const NOTCH = W < H ? { top: 47, right: 0, bottom: 34, left: 0 } : { top: 0, right: 47, bottom: 21, left: 47 }
r.resize(W, H, dpr, state === 'notch' ? NOTCH : { top: 0, right: 0, bottom: 0, left: 0 })
const ui = { paused: false, confirmReset: false, muted: false, reducedMotion: false, touch, stick: null, attract: false, cam: null, banner: null, view: 'ISOMETRIC', strip: null, keys: touch ? { a: 'THE SWORD BUTTON', b: 'THE ITEM BUTTON', cycle: 'THE SWAP BUTTON', touch: true } : { a: 'SPACE', b: 'K', cycle: 'Q' } }
const give = () => { s.inv.sword = true; s.inv.bombBag = true; s.inv.bombs = 8; s.inv.disc = true; s.inv.hook = true; s.inv.selected = 'disc'; s.inv.bits = 123; s.inv.keys = 1; s.inv.pieces = 3; s.hero.maxHp = 12; s.hero.hp = 7; s.flags['item:waffle'] = true }
const say = (lines, who, more = {}) => { s.dialog = { lines, line: 0, chars: 999, who, after: null, choice: 0, ...more }; s.mode = 'dialog' }
const LONG = 'KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE. TAKE THE BLADE BY THE DOOR, AND MIND THE CRABS ON THE COAST ROAD!'
give()
// The hero in the middle of the view, the camera where the classic view would put it.
const size = r.viewTiles()
const aim = () => { frame = { cx: s.hero.x * TILE - size.w * TILE / 2, cy: s.hero.y * TILE - size.h * TILE / 2, heroY: size.h * TILE / 2 } }
aim()
switch (state) {
  case 'play': break
  case 'dialog': say(['A HEAVY BLOCK WITH A MOON CARVED IN IT. IT WON\\'T BUDGE. SOMEONE WITH A STRONGER MIND MIGHT MOVE IT, OR SOMEONE WITH A BIGGER HAMMER: 50% OF THE TOWN HAS TRIED.', 'NEXT'], null); break
  case 'name': say([LONG, 'NEXT'], 'keeper'); break
  case 'top': say([LONG], 'keeper'); frame.heroY = size.h * TILE * 0.8; break
  case 'ask': say(['THE ARCADE. PIZZA RESCUE, NOVA AND THE REST ARE INSIDE. GO IN?'], null, { ask: { options: ['YES', 'NO'], replies: [['OK'], ['OK']] } }); break
  case 'banner': ui.banner = { text: 'THE NEON COAST', t: 1 }; break
  case 'pause': ui.paused = true; break
  case 'reset': ui.paused = true; ui.confirmReset = true; break
  case 'strip': ui.strip = { views: [{ name: 'CLASSIC', tag: '8-BIT' }, { name: 'ISOMETRIC', tag: '16-BIT' }, { name: 'PENCIL', tag: 'SKETCH' }], at: 1, t: 0.5 }; break
  // At the newsstand's counter on the coast road: its label is up.
  case 'low': s.hero.maxHp = 26; s.hero.hp = 1; say([LONG, 'NEXT'], 'keeper'); frame.heroY = size.h * TILE * 0.8; break
  case 'typing': say([LONG, 'NEXT'], 'keeper', { chars: 60 }); break
  case 'heading': say(['BARTENDER: WHAT WILL IT BE?', 'TODAY: THE LASER SUNSET, THE GLITCHY MOJITO, THE LAG SPIKE (IT ARRIVES LATE), AND THE EXTRA LIFE.'], 'barmaid', { line: 1 }); break
  case 'norsk': say(['MOSSA: BLÅBÆRSYLTETØY PÅ CAFÉ… ZZZ… PROJECT HORIZON — RESTRICTED AREA. 10–20 BITS, 50% & MER! ÅLESUND, ÆRØ, ÅÆØ.', 'NEXT'], 'mossa'); break
  case 'errands': ui.paused = true; s.inv.pieces = 1; s.inv.shrooms = 3; for (const k of ['item:tube', 'item:walkie', 'item:hat']) s.flags[k] = true; break
  case 'notch': say([LONG, 'NEXT'], 'keeper'); frame.heroY = size.h * TILE * 0.8; break
  case 'mix': from = { skin: NEON_SKIN, mix: 0.75 }; say([LONG, 'NEXT'], 'keeper'); break
  // Mirrored, so they are told from the drawn ones: a skin with art of its own for these must show the studio's instead.
  case 'studio': setSpriteOverrides(Object.fromEntries(['hud_heart_full', 'hud_bit'].map(n => [n, SPRITES[n].rows.map(row => [...row].reverse().join(''))]))); break
  case 'label': s.hero.x = 15.5; s.hero.y = 26.5; s.hero.dir = 'up'; for (let k = 0; k < 5; k++) r.onEvents(stepGame(WORLD, s, 1 / 60, NO_INPUT)); aim(); break
}
// Several frames so the label's fade settles, and as many more as were asked for.
for (let k = 0; k < 40 + Math.round(+(q.get('t') || 0) * 60); k++) r.draw(s, ui, 1 / 60)
document.title = 'ready ' + JSON.stringify(window.__space)
`
const entryFile = join(out, '_hud_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_hud_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_hud.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const SCREENS = { 1280: [1280, 800, 1], 390: [390, 844, 3], 667: [667, 375, 2], 300: [300, 220, 1] }
const SKINS = ['neon', 'window', 'hires']
const STATES = ['play', 'dialog', 'name', 'top', 'ask', 'banner', 'pause', 'reset', 'strip', 'label', 'low', 'typing', 'heading', 'norsk', 'errands', 'notch', 'mix', 'studio']
const extra = +(process.env.HUD_T || 0)
const pick = (arg, all) => !arg || arg === 'all' ? all : arg.split(',').filter(a => all.includes(a))
for (const screen of pick(screenArg, Object.keys(SCREENS)).filter(k => k !== '300' || screenArg?.includes('300'))) {
  const [w, h, dpr] = SCREENS[screen]
  for (const skin of pick(skinArg, SKINS)) {
    for (const state of pick(stateArg, STATES)) {
      const png = join(out, `${state}-${screen}-${skin}${extra ? `-t${extra}` : ''}.png`)
      try {
        execFileSync('chromium-browser', [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
          `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
          '--virtual-time-budget=3000', `--screenshot=${png}`,
          `file://${html}#state=${state}&skin=${skin}&w=${w}&h=${h}&dpr=${dpr}&touch=${w < 1000 ? 1 : 0}&t=${extra}`,
        ], { stdio: 'ignore', timeout: 60000 })
        console.log(png)
      } catch (e) {
        console.error(`failed: ${state}-${screen}-${skin}: ${e.message}`)
      }
    }
  }
}
