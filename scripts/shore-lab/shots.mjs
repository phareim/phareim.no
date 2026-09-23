// Headless screenshots of Another Shore in the dev server, through the
// dev-only window.__shore hook. Usage:
//   node scripts/shore-lab/shots.mjs <outDir> [baseUrl] [WxH] [scene ...]
// Scenes: title, prologue@<t>, capture@<t>, ending@<t>, ch<n>[:<checkpoint>][+<seconds holding right>]
import { launch } from '../zelda-lab/cdp.mjs'

const [outDir = `${process.env.HOME}/zshots/shore`, base = 'http://127.0.0.1:3041', size = '1440x900', ...scenes] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const b = await launch({ width, height, mobile: width < height })
await b.goto(`${base}/?theme=anotherworld`)
await b.sleep(1500)
const list = scenes.length ? scenes : ['title']
for (const sc of list) {
  const name = sc.replace(/[^a-z0-9@.+:_-]/gi, '_')
  if (sc === 'title') {
    await b.sleep(800)
  } else if (/^(prologue|capture|ending)@/.test(sc)) {
    const [id, t] = sc.split('@')
    if (id === 'prologue') await b.eval('window.__shore.prologue()')
    else if (id === 'capture') await b.eval('window.__shore.start(2, 0); window.__shore.skip(); (()=>{const g=window.__shore.game(); g.world.player.x=4240; g.world.exit=true; g.world.exitCut="capture"})()')
    else await b.eval('window.__shore.start(5, 1, true); window.__shore.skip(); (()=>{const g=window.__shore.game(); const w=g.world; w.lamps.forEach(l=>l.lit=true); w.dawn=true; w.palette="dawn"; w.exit=true; w.exitCut="ending"})()')
    await b.sleep(300)
    await b.eval(`window.__shore.seek(${Number(t)})`)
    await b.sleep(250)
  } else {
    const m = sc.match(/^ch(\d)(?::(-?\d+))?(?:\+([\d.]+))?(?:~(\w+))?$/)
    if (!m) continue
    await b.eval(`window.__shore.start(${m[1]}, ${m[2] ?? -1}, ${Number(m[1]) >= 3}); window.__shore.skip()`)
    await b.sleep(400)
    if (m[3]) await b.hold('ArrowRight', Number(m[3]) * 1000)
    if (m[4] === 'aim') { await b.keyDown('Space'); await b.sleep(700) }
  }
  await b.shot(`${outDir}/${size}-${name}.png`)
  if (sc.startsWith('ch') && sc.endsWith('~aim')) await b.keyUp('Space')
}
console.log(JSON.stringify(b.errors.slice(0, 5)))
await b.close()
