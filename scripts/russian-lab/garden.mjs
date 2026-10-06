// Dev-only visual/play check: a nearly complete row lets us capture its bloom.
// heavy -x chrome -- node scripts/russian-lab/garden.mjs [url] [output]
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { launch } from '../zelda-lab/cdp.mjs'
const [url = 'http://localhost:3030', out = join(homedir(), 'zshots/russian-garden')] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
for (const [width, height, mobile, reduced] of [[1280, 800, false, false], [375, 667, true, false], [667, 375, true, false], [375, 667, true, true]]) {
  const b = await launch({ width, height, mobile, dpr: mobile ? 2 : 1 })
  const label = `${width}-${height}${reduced ? '-reduced' : ''}`
  try {
    if (reduced) await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await b.goto(`${url}/?theme=russian`)
    await b.eval(`window.gardenGame = document.querySelector('.tetris-game').__vueParentComponent.setupState`)
    await b.shot(`${out}/${label}-idle.png`)
    if (mobile) {
      const point = await b.eval(`(() => { const r=document.querySelector('.play-button').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`)
      await b.tap(point.x, point.y)
    } else await b.key('Enter')
    assert.equal(await b.eval('gardenGame.getState().phase'), 'playing')
    // Arrange real engine data; let its normal hard-drop/clear path run.
    await b.eval(`(() => {
      const s=gardenGame, e=s.engine;
      e.board.forEach(row => row.fill(null));
      for (let r=17;r<20;r++) for (let c=0;c<10;c++) {
        if (r===19 ? c<3 || c>6 : c===0 || c===9) e.board[r][c]=['S','T','J','L'][Math.floor(c/3)%4];
      }
      e.active={type:'I',rot:0,x:3,y:0};
      s.syncHud(); s.hardDrop();
    })()`)
    if (!reduced) {
      await b.sleep(80)
      assert.equal(await b.eval('gardenGame.engine.pendingClear.length'), 1)
      await b.shot(`${out}/${label}-bloom.png`)
    }
    await b.sleep(400)
    assert.equal(await b.eval('gardenGame.engine.pendingClear.length'), 0)
    assert.equal(await b.eval('gardenGame.getState().lines'), 1)
    await b.shot(`${out}/${label}-garden.png`)
    const x = await b.eval('gardenGame.engine.active.x')
    await b.key('ArrowLeft')
    assert.equal(await b.eval('gardenGame.engine.active.x'), x - 1)
    await b.eval('gardenGame.hold()')
    assert.ok(await b.eval('gardenGame.getState().hold'))
    await b.key('Escape')
    assert.equal(await b.eval('gardenGame.getState().phase'), 'paused')
    await b.key('Escape')
    assert.equal(await b.eval('gardenGame.getState().phase'), 'playing')
    const layout = await b.eval(`(() => {
      const selectors=['.tetris-game','.action-row','.control-hint','.pause-button'];
      return selectors.map(sel => {const r=document.querySelector(sel).getBoundingClientRect(); return {sel,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    })()`)
    if (mobile && height > width) {
      assert.ok(await b.eval(`(() => { const a=document.querySelector('.pause-button').getBoundingClientRect(), r=document.querySelector('.radio-widget')?.getBoundingClientRect(); return !r || a.y >= r.bottom || a.right <= r.x; })()`), `${label}: pause overlaps radio`)
    }
    for (const r of layout) {
      assert.ok(r.x >= -1 && r.y >= -1 && r.right <= width + 1 && r.bottom <= height, `${label}: ${r.sel} outside viewport`)
    }
    await b.keyDown('Escape')
    for (let i = 0; i < 20 && await b.eval('gardenGame.getState().phase') !== 'over'; i++) await b.sleep(250)
    await b.keyUp('Escape')
    assert.equal(await b.eval('gardenGame.getState().phase'), 'over')
    await b.key('Escape')
    assert.equal(await b.eval('gardenGame.getState().phase'), 'idle')
    assert.deepEqual(b.errors, [])
    console.log(`${label}: bloom, harvest, hold, movement, Escape, viewport OK`)
  } finally { await b.close() }
}
