// A short keyboard run through the real shell: title → prologue → card →
// the pool → the bank, then pause and leave; checks the save and errors.
import { launch } from '../zelda-lab/cdp.mjs'

const [out = `${process.env.HOME}/zshots/shore`, base = 'http://127.0.0.1:3001'] = process.argv.slice(2)
const b = await launch({ width: 1280, height: 800 })
await b.goto(`${base}/?theme=anotherworld`)
await b.sleep(1200)
await b.key('Enter')
await b.sleep(1500)
const cut1 = await b.eval('window.__shore.game()?.cut?.id')
await b.key('Enter') // skip the prologue
await b.sleep(300)
const cut2 = await b.eval('window.__shore.game()?.cut?.id')
await b.key('Enter') // skip the card
await b.sleep(300)
for (let i = 0; i < 6; i++) { await b.key('ArrowUp', 80); await b.sleep(260) }
await b.hold('ArrowRight', 2600)
await b.shot(`${out}/play-bank.png`)
const st = await b.eval('(() => { const g = window.__shore.game(); const p = g.world.player; return { mode: g.mode, ch: g.world.chapter, x: Math.round(p.x), y: Math.round(p.y), swim: p.swimming, deaths: g.deaths } })()')
await b.key('KeyP')
await b.sleep(300)
await b.shot(`${out}/play-paused.png`)
const save = await b.eval('localStorage.getItem("phareim.shore")')
await b.hold('Escape', 3300)
await b.sleep(500)
const title = await b.eval('!!document.querySelector(".as-title")')
const cont = await b.eval('document.querySelector(".as-start")?.textContent?.trim()')
console.log(JSON.stringify({ cut1, cut2, st, save, title, cont, errors: b.errors }, null, 1))
await b.close()
