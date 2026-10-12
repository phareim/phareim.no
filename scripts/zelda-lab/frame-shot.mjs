#!/usr/bin/env node
// The frame for games on another address (docs/games/frame.md), headless
// against the dev server, with the page told it is an installed app and given
// a phone's safe edges:
//   walk   the hero at the Pizza Rescue cabinet says YES: the page stays, on
//          /?frame=pizzarescue, and the frame's own house leads back to the
//          cabinet (the live game is an older build that says nothing)
//   --fighter <url>  a Pizza Rescue dev server in the frame: ready, the
//          insets it was told, ARCADE back to the town
//   --eventyr <url>  an Eventyrland dev server in the frame: hello and the
//          insets before the world is up, ready after, the settings' way back
//
//   --live  against the live site (<devUrl> is https://phareim.no/): both
//          games as the frame loads them, no dev servers; the town's state
//          is not read there (a build has no window.__portal)
//
//   CHROME_BIN=… node scripts/zelda-lab/frame-shot.mjs <devUrl> <outDir> [--fighter <url>] [--eventyr <url>] [--live]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const argv = process.argv.slice(2)
const flag = name => { const i = argv.indexOf(name); return i < 0 ? null : argv.splice(i, 2)[1] }
const fighter = flag('--fighter')
const eventyr = flag('--eventyr')
const live = argv.includes('--live') && argv.splice(argv.indexOf('--live'), 1).length > 0
const [base = 'http://127.0.0.1:3030/', outArg] = argv
if (!outArg) { console.error('usage: frame-shot.mjs <devUrl> <outDir> [--fighter <url>] [--eventyr <url>]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 }

async function open() {
  const b = await launch({ width: 1280, height: 800, dpr: 1, mobile: false })
  // Installed, as iOS says it (Chrome takes no display-mode over the protocol).
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true })` })
  let insetsFaked = true
  try { await b.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS }) } catch { insetsFaked = false }
  /** Runs `expr` in the framed game's page (an isolated world: its DOM, not its script globals). */
  b.inGame = async expr => {
    const tree = await b.send('Page.getFrameTree')
    const child = tree.frameTree.childFrames?.[0]?.frame
    if (!child) return null
    const world = await b.send('Page.createIsolatedWorld', { frameId: child.id, worldName: 'frame-lab' })
    const r = await b.send('Runtime.evaluate', { expression: expr, contextId: world.executionContextId, returnByValue: true, awaitPromise: true })
    return r.result.value
  }
  b.until = async (fn, ms = 20000) => {
    for (const end = Date.now() + ms; Date.now() < end;) { const v = await fn().catch(() => null); if (v) return v; await b.sleep(400) }
    return null
  }
  b.page = () => b.eval(`(() => { const s = window.__portal?.state; const f = document.querySelector('.game-frame__view'); const home = document.querySelector('.game-frame__home')
    return { search: location.search, installed: navigator.standalone === true, frame: f ? f.src : null,
      house: home ? getComputedStyle(home).visibility : 'none',
      town: s ? [s.map.id, Math.floor(s.hero.x), Math.floor(s.hero.y), s.hero.dir, s.mode].join(' ') : null } })()`)
  return { b, insetsFaked }
}

/** The cabinet's YES: the installed page stays and frames the game; the frame's house leads back. */
async function walk() {
  const { b } = await open()
  const report = {}
  try {
    await b.goto(base)
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'arcade', entry: 'pizzarescue' }))`)
    await b.goto(base)
    await b.sleep(900)
    report.before = await b.page()
    for (let k = 0; k < 8; k++) {
      if ((await b.eval('location.search')).includes('frame=')) break
      await b.key('Space')
      await b.sleep(1600)
    }
    await b.sleep(600)
    report.entered = await b.page()
    await b.sleep(3200)
    report.houseAfter3s = (await b.page()).house
    await b.shot(join(out, 'walk-frame.png'))
    await b.eval(`document.querySelector('.game-frame__home')?.click()`)
    await b.sleep(1800)
    report.back = await b.page()
    await b.shot(join(out, 'walk-back.png'))
    report.errors = b.errors.slice(0, 5)
  } finally { await b.close() }
  return report
}

/** A dev server's game in the frame: what it was told, and its own way home. */
async function framed(id, url, { profile, home }) {
  const { b, insetsFaked } = await open()
  const report = { insetsFaked }
  try {
    if (profile && url) { await b.goto(url); await b.eval(profile); }
    // The town first, so the way home has somewhere to stand the hero.
    await b.goto(base)
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: ${JSON.stringify(id === 'eventyrland' ? 'vip' : 'arcade')}, entry: ${JSON.stringify(id)} }))`)
    await b.goto(url ? `${base}?frame=${id}&src=${encodeURIComponent(url)}` : `${base}?frame=${id}`)
    report.opened = await b.page()
    const told = () => b.inGame(`(() => { const s = getComputedStyle(document.documentElement); const v = n => s.getPropertyValue(n).trim()
      const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
      document.body.append(probe); const own = [getComputedStyle(probe).paddingTop, getComputedStyle(probe).paddingBottom]; probe.remove()
      const set = n => document.documentElement.style.getPropertyValue(n).trim()
      return { frameTop: set('--inset-top') || v('--frame-t'), frameBottom: set('--inset-bottom') || v('--frame-b'), ownEnv: own, app: document.documentElement.className, edges: document.documentElement.dataset.edges ?? null } })()`)
    report.toldEarly = await b.until(async () => { const t = await told(); return t && t.frameTop ? t : null }, 15000)
    // Ready: the frame's house is gone from the page.
    report.ready = await b.until(async () => ((await b.page()).house === 'none' ? 'house gone' : null), 120000)
    report.toldReady = await told()
    await b.shot(join(out, `${id}-framed.png`))
    report.home = await home(b)
    await b.sleep(2000)
    report.back = await b.page()
    await b.shot(join(out, `${id}-back.png`))
    report.errors = b.errors.slice(0, 5)
  } finally { await b.close() }
  return report
}

const click = (b, sel, text) => b.inGame(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => !${JSON.stringify(text ?? '')} || e.textContent.includes(${JSON.stringify(text ?? '')})); if (!el) return null; el.click(); return el.textContent.trim().slice(0, 40) })()`)

const result = { walk: await walk() }
if (fighter) {
  result.fighter = await framed('pizzarescue', fighter, {
    home: async b => click(b, '#back'),
  })
}
const eventyrHome = async b => {
  const steps = []
  steps.push(await click(b, '[aria-label^="Ryggsekken"]'))
  await b.sleep(900)
  steps.push(await click(b, '[role=tab][aria-label="Innstillinger"]'))
  await b.sleep(900)
  await b.shot(join(out, 'adventure-settings.png'))
  steps.push(await click(b, 'button', 'Tilbake til spillehallen'))
  await b.sleep(500)
  steps.push(await click(b, 'button', 'Ja, ut av Eventyrland'))
  return steps
}
if (eventyr) {
  result.eventyr = await framed('adventure', eventyr, {
    profile: `localStorage.setItem('eventyrland.profile', JSON.stringify({ id: 'frame0lab000001', name: 'Sølvi', variant: 'vanlig', pack: true }))`,
    home: eventyrHome,
  })
}
if (live) {
  result.liveFighter = await framed('pizzarescue', null, { home: async b => click(b, '#back') })
  result.liveEventyr = await framed('adventure', null, { home: eventyrHome })
}
console.log(JSON.stringify(result, null, 2))
