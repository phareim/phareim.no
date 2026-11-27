// A scripted player for THE LATE SHOW (`zelda-lateshow.test.mjs`): it reads the state to decide what to press, and
// presses only what a player can: the stick, A, B. Nobody is healed, made safe or moved: a room is crossed by walking
// and jumping it. `Z` is the bundled engine (zelda-load.mjs).
import assert from 'node:assert/strict'
import { walker } from './zelda-walk.mjs'

export function reelPlayer(Z, s, W = Z.WORLD) {
  const heard = []
  const events = []
  const inp = (o = {}) => ({ ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o })
  const path = walker(Z, W).path
  const R = Z.HERO_R
  const h = () => s.hero
  const feet = () => h().y + R
  const standing = () => s.mode === 'play' && !s.card && !!h().side?.ground && h().act !== 'fall'
  const where = () => `in ${s.map.id} at ${h().x.toFixed(2)}, feet ${feet().toFixed(2)} (${s.mode}, ${h().act}, ${h().hp} hp)`
  const step = (o) => {
    assert.notEqual(s.mode, 'dying', `the hero fell: ${where()}`)
    events.push(...Z.stepGame(W, s, 1 / 60, inp(o)))
    if (s.dialog) for (const l of s.dialog.lines) if (!heard.includes(l)) heard.push(l)
  }
  const idle = (n) => { for (let i = 0; i < n; i++) step() }

  /** Through a find's pose and any words. */
  function settle() {
    for (let i = 0; i < 900 && s.mode !== 'play'; i++) step(i % 12 === 0 && s.mode === 'dialog' ? { aPress: true } : {})
    assert.equal(s.mode, 'play', `the words never closed ${where()}`)
    idle(30)
  }
  /** An intertitle card, passed with A once it may be. */
  function card() {
    if (!s.card) return
    const at = { x: h().x, y: h().y, hp: h().hp }
    while (s.card && s.card.t < Z.CARD.pass) step({ move: { x: 1, y: 0 }, aPress: s.card.t < Z.CARD.pass - 0.1 })
    assert.ok(s.card, 'the card waited to be passed')
    assert.deepEqual({ x: h().x, y: h().y, hp: h().hp }, at, 'nothing moved under the card, and an early press did not pass it')
    step({ aPress: true, a: true })
    assert.ok(!s.card, 'A passes it')
    assert.ok(!h().swing, 'the press that passed it cut nothing')
    idle(30)
  }
  /** Hold the stick until `done`. */
  function until(done, move, max = 600) {
    for (let i = 0; i < max && !done(); i++) { if (s.mode === 'dialog' || s.mode === 'get') settle(); else step({ move }) }
    assert.ok(done(), `never got there ${where()}`)
  }
  /** Onto a door or stairs that lie `move` ahead, and through the fade into `map`. */
  function warpBy(move, map) {
    until(() => s.mode === 'warp', move)
    for (let i = 0; i < 90 && s.mode === 'warp' && !s.card; i++) step()
    assert.equal(s.map.id, map, `through the door ${where()}`)
    if (!s.card) idle(10)
  }
  /** The booth, from above: along the shortest way to a tile. */
  function walkTo(tx, ty) {
    let p = path(s, tx, ty)
    let i = 0
    for (let n = 0; n < 1500; n++) {
      if (s.mode === 'dialog' || s.mode === 'get') { settle(); continue }
      if (s.mode !== 'play') { step(); continue }
      if (Math.hypot(h().x - tx - 0.5, h().y - ty - 0.5) < 0.12) return
      assert.ok(p, `no way to ${tx},${ty} ${where()}`)
      while (i < p.length - 1 && Math.hypot(h().x - p[i][0] - 0.5, h().y - p[i][1] - 0.5) < 0.25) i++
      const [gx, gy] = p[i]
      const d = Math.hypot(gx + 0.5 - h().x, gy + 0.5 - h().y) || 1
      step({ move: { x: (gx + 0.5 - h().x) / d, y: (gy + 0.5 - h().y) / d } })
      if (n % 60 === 59) { p = path(s, tx, ty) ?? p; i = 0 }
    }
    assert.fail(`never reached ${tx},${ty} ${where()}`)
  }

  // -- from the side ---------------------------------------------------------

  const aimNow = () => Z.stompAim(Z.ctx(W, s, []), h().x, feet(), true)
  const live = (kind, from = 0, to = 99) => s.map.enemies.find(e => e.kind === kind && !e.dead && e.home.x >= from && e.home.x < to)

  /** Along the ground to x. */
  function walk(x) {
    for (let i = 0; i < 600; i++) {
      if (s.mode !== 'play') return
      swat()
      if (Math.abs(h().x - x) < 0.07 && standing()) { idle(1); return }
      step({ move: { x: Math.abs(h().x - x) < 0.07 ? 0 : Math.sign(x - h().x), y: 0 } })
    }
    assert.fail(`never walked to ${x}: ${where()}`)
  }
  /** A held jump from here, steered to come down at x with the feet on row `row`. */
  function jump(x, row, what) {
    for (let i = 0; i < 90 && !standing(); i++) step()
    assert.ok(standing(), `not standing before ${what}: ${where()}`)
    const toward = () => {
      const v = h().side.vx
      const d = x - (h().x + (v * Math.abs(v)) / (2 * Z.SIDE.airAccel))
      return Math.abs(d) < 0.08 ? 0 : Math.sign(d)
    }
    step({ move: { x: toward(), y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
    assert.ok(h().side.vy < 0 && !h().side.ground, `no jump: ${what}, ${where()}`)
    for (let i = 0; i < 150 && !standing(); i++) step({ move: { x: toward(), y: 0 }, jumpHeld: true })
    assert.ok(standing() && Math.abs(feet() - row) < 0.01 && Math.abs(h().x - x) < 0.75, `${what}: came down ${where()}, wanted ${x} on ${row}`)
  }
  /** Up or down a ladder until it ends underfoot at `row`. */
  function climb(way, row) {
    for (let i = 0; i < 400 && !(standing() && Math.abs(feet() - row) < 0.01); i++) { swat(); step({ move: { x: 0, y: way } }) }
    assert.ok(standing() && Math.abs(feet() - row) < 0.01, `the ladder to ${row}: ${where()}`)
  }
  /** One cut at `e` if it is within the blade, ahead or overhead; true when A was pressed. */
  function cut(e) {
    const dx = e.x - h().x
    const dy = e.y - h().y
    if (h().swing && h().swing.t < 0.1) return false
    const up = dy < -0.5 && dy > -1.5 && Math.abs(dx) < 0.6
    const ahead = Math.abs(dx) < 1.4 && Math.abs(dy) < Math.max(0.65, Math.abs(dx) * 1.2)
    if (!up && !ahead) return false
    step({ move: up ? { x: 0, y: -1 } : { x: 0.5 * Math.sign(dx), y: 0 }, aPress: true, a: true })
    idle(4)
    return true
  }
  /** A flyer that has come close is cut before anything else is done. */
  function swat() {
    for (let i = 0; i < 300; i++) {
      const bat = s.map.enemies.find(e => e.kind === 'bat' && !e.dead && e.cell === s.zoneIndex && Math.hypot(e.x - h().x, e.y - h().y) < 1.7)
      if (!bat || s.mode !== 'play') return
      if (!cut(bat)) step()
    }
  }
  /** Stand at x and cut at a foe until it falls; after a while, go to it. */
  function fell(e, x) {
    for (let i = 0; i < 2400 && !e.dead; i++) {
      if (s.mode !== 'play') { settle(); continue }
      if (cut(e)) continue
      const to = i < 700 ? x : e.x - Math.sign(e.x - h().x) * 1.2
      step({ move: { x: Math.abs(h().x - to) < 0.15 ? 0 : Math.sign(to - h().x), y: 0 } })
    }
    assert.ok(e.dead, `the ${e.kind} stands (hp ${e.hp} at ${e.x.toFixed(2)},${e.y.toFixed(2)}): ${where()}`)
    idle(40)
  }
  /** Face the chest to the right and open it. */
  function open(id) {
    step({ move: { x: 0.4, y: 0 } })
    step({ aPress: true, a: true })
    assert.ok(Z.has(s, `chest:${id}`), `${id} opens: ${where()}`)
    settle()
  }

  // -- reel one ---------------------------------------------------------------

  /** Main Street from its door to the Backlot's seam, with the key off the roof on the way. */
  function mainStreetEast() {
    idle(20)
    const blob = live('blob', 0, 16)
    // The blob in its pen below the porch, cut from the step.
    fell(blob, 1.8)
    walk(3.3)
    jump(4.9, 20, 'the curb')
    // The sentry in the gutter below, cut from the curb.
    walk(5.4)
    fell(live('sentry'), 5.45)
    walk(5.5)
    jump(8.45, 20, 'the stoop')
    walk(8.7)
    jump(12.45, 21, 'the manhole')
    walk(12.5)
    climb(-1, 16)
    open('lateshow.key1')
    walk(12.4)
    jump(14.5, 16, 'over the chest')
    walk(15.5)
    climb(1, 21)
    until(() => s.mode === 'scroll', { x: 1, y: 0 })
    idle(60)
  }
  function backlotToStomp() {
    assert.equal(s.zoneIndex, 1, where())
    walk(23.4)
    jump(25, 19, 'the platform')
    walk(26.4)
    jump(29, 17, 'the alcove ledge')
    walk(29.3)
    open('lateshow.stomp')
  }
  /** Down on the blob from above, B let go before A is pressed. */
  function stompTheBlob() {
    const blob = live('blob', 16)
    let hit = false
    // Off the ledge's west end once the blob is near it; failing that, a hop at it from the floor.
    for (let i = 0; i < 600 && blob.x > 29; i++) step()
    const from = events.length
    for (let i = 0; i < 1500 && !hit; i++) {
      if (s.mode !== 'play') { settle(); continue }
      const dx = blob.x - h().x
      if (!standing()) {
        const take = h().side.vy >= -Z.STOMP.rise && aimNow()?.on === 'foe'
        step({ move: { x: Math.sign(dx), y: 0 }, ...(take ? { aPress: true, a: true } : {}) })
      } else if (feet() < 18) step({ move: { x: -1, y: 0 } })
      else if (Math.abs(dx) < 1.8) step({ move: { x: Math.sign(dx), y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
      else step({ move: { x: Math.sign(dx), y: 0 } })
      hit = events.slice(from).some(e => e.type === 'stomp' && e.on === 'foe')
    }
    assert.ok(hit && blob.dead, `the blob is stomped flat: ${where()}`)
    for (let i = 0; i < 120 && !standing(); i++) step()
    idle(40)
  }
  /** A tapped jump over the cracks and A on the way up: through, and into the nook. */
  function stompTheFloorFrom(x) {
    walk(x)
    const from = events.length
    step({ bPress: true, jumpPress: true, jumpHeld: true })
    idle(2)
    step({ aPress: true, a: true })
    for (let i = 0; i < 120 && !(standing() && feet() > 22); i++) step()
    assert.ok(events.slice(from).some(e => e.type === 'stomp' && e.on === 'crack'), `the floor gives way: ${where()}`)
    assert.ok(standing() && Math.abs(feet() - 23) < 0.01, `on the nook's floor: ${where()}`)
    idle(30)
  }
  function stompTheFloor() {
    // Back out from under the ledge, over the crate.
    if (h().x > 28) { walk(28.6); jump(27.5, 20, 'up on the crate') }
    stompTheFloorFrom(22.5)
    walk(22.6)
    open('lateshow.nook')
    walk(22.5)
    jump(24.4, 21, 'out of the nook')
  }
  /** Back to Main Street: over the hole, and on past the seam. */
  function backlotWest() {
    walk(23.4)
    jump(20.4, 21, 'over the broken floor')
    until(() => s.mode === 'scroll', { x: -1, y: 0 })
    idle(60)
  }
  function mainStreetWest() {
    walk(15.5)
    climb(-1, 16)
    walk(14.5)
    jump(12.5, 16, 'back over the chest')
    walk(12.5)
    climb(1, 21)
    walk(12.15)
    jump(9.5, 21, 'back over the manhole')
    walk(9.4)
    jump(8.5, 20, 'up on the stoop')
    walk(8.2)
    jump(5.2, 20, 'up on the curb')
    walk(3.1)
    jump(1.6, 20, 'up on the porch')
    warpBy({ x: -1, y: 0 }, 'showbooth')
  }

  return {
    s, heard, events, step, idle, settle, card, until, warpBy, walkTo, walk, jump, climb, fell, where, standing, feet,
    mainStreetEast, backlotToStomp, stompTheBlob, stompTheFloor, stompTheFloorFrom, backlotWest, mainStreetWest,
  }
}
