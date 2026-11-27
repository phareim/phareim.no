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

  const aimNow = () => Z.stompAim(Z.ctx(W, s, []), h().x, feet())
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
    // The bat comes to whoever stands still up here: wait for it with the blade, so that nothing after is harried.
    const bat = live('bat', 16)
    for (let i = 0; i < 900 && bat && !bat.dead; i++) { if (s.mode !== 'play') settle(); else if (!cut(bat)) step() }
    walk(29.3)
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
      if (standing()) swat()
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
  /** A tapped jump over the cracks and A on the way up: through, and into the nook, whose floor is the row `under`. */
  function stompTheFloorFrom(x, under = 23) {
    walk(x)
    const from = events.length
    step({ bPress: true, jumpPress: true, jumpHeld: true })
    idle(2)
    step({ aPress: true, a: true })
    for (let i = 0; i < 120 && !(standing() && feet() > under - 1); i++) step()
    assert.ok(events.slice(from).some(e => e.type === 'stomp' && e.on === 'crack'), `the floor gives way: ${where()}`)
    assert.ok(standing() && Math.abs(feet() - under) < 0.01, `on the nook's floor: ${where()}`)
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

  // -- reel two ---------------------------------------------------------------

  /**
   * The thumb's stomp on a pad: B tapped and let go, A a moment later, no thought for the aim. Then the bounce,
   * steered toward `x` once the feet are over the row it should come down on. (A bat under him may take the dive
   * instead of the pad: then back to the spot, and again.)
   */
  function bounce(x, row, what) {
    const spot = h().x
    let thrown = false
    for (let go = 0; go < 3 && !thrown; go++) {
      if (go) walk(spot)
      swat()
      idle(2)
      assert.ok(standing(), `not standing before ${what}: ${where()}`)
      const from = events.length
      const struck = () => events.slice(from).some(e => e.type === 'stomp' && e.on === 'spring')
      step({ bPress: true, jumpPress: true, jumpHeld: true })
      step()
      step({ aPress: true, a: true })
      for (let i = 0; i < 90 && !struck(); i++) step()
      thrown = struck()
      for (let i = 0; i < 90 && !thrown && !standing(); i++) step()
    }
    assert.ok(thrown, `the pad throws: ${what}, ${where()}`)
    for (let i = 0; i < 200 && !standing(); i++) {
      const d = x - h().x
      step({ move: { x: feet() < row - 0.05 && Math.abs(d) > 0.25 ? Math.sign(d) : 0, y: 0 } })
    }
    idle(6)
    assert.ok(standing() && Math.abs(feet() - row) < 0.01, `${what}: came down ${where()}, wanted ${x} on ${row}`)
  }
  /** The Video Store: over the sign, the first pad onto the shelves, the heart piece under them, the second pad, the way up. */
  function videoStore() {
    walk(1.55)
    jump(3.45, 21, 'over the sign')
    walk(3.6)
    bounce(7.5, 17, 'the first pad onto the shelves')
    // Through the cracked top of the shelves, to the chest in the nook, and out again.
    stompTheFloorFrom(6.5, 19)
    walk(6.5)
    open('lateshow.piece')
    walk(6.5)
    jump(7.7, 17, 'out of the nook')
    walk(8.5)
    bounce(12.2, 13, 'the second pad onto the balcony')
    warpBy({ x: 1, y: 0 }, 'chase1986')
  }

  /** COPILOT, and whether it may be cut. */
  const car = () => s.map.enemies.find(e => e.kind === 'copilot')

  /**
   * The Road: keep ahead of the screen's edge, jump what is in the way, jump the wagon as it passes, and cut it while
   * it stands (with `stomp`, come down on it once a stall first, which is all a stall takes); then the chest, and the door.
   */
  function theRoad({ stomp = false, log = null, watch = null } = {}) {
    const e = car()
    const m = s.map
    const top = (tx, ty) => Z.solidTile(W, m, tx, ty, 'hero')
    let t = 0
    let air = false
    let wonAt = 0
    for (let i = 0; i < 4000 && !(e.dead && s.mode === 'play' && standing() && Math.abs(h().x - 57.4) < 0.25 && Z.tileAt(m, 58, 20) === '$'); i++, t += 1 / 60) {
      if (e.dead) wonAt ||= t
      if (s.mode !== 'play') { settle(); continue }
      if (h().act === 'fall' || h().knock) { step(); continue }
      const left = m.chase.left
      const mode = e.dead ? 'gone' : e.ai.mode
      const dx = e.x - h().x
      const down = stomp && !e.ai.stomped
      // Where to be on the screen: a third in, so that there is road to see; in front of the wagon while it stands.
      let want = left + 6
      if (e.dead) want = 57.4
      else if (mode === 'stall') want = e.x - (down ? 1.2 : 1.1)
      let mx = Math.abs(want - h().x) < 0.25 ? 0 : Math.sign(want - h().x)
      let b = false
      let a = false
      let hold = air
      if (standing()) {
        air = false
        hold = false
        const f = Math.round(feet())
        // A pit or a wagon (or the key's chest) just ahead.
        const ahead = d => { const tx = Math.floor(h().x + d); return (f === 21 && !top(tx, 21)) || top(tx, f - 1) }
        const blocked = mx > 0 && (ahead(0.75) || ahead(0.45))
        // The wagon coming through: jump as it is about to meet him.
        const meets = mode === 'pass' && dx < 0 && (h().x - e.x - 0.95) / (11 + 3.4 - Math.max(0, h().vx)) < 0.13 && feet() > 20.05
        if (blocked || meets) { b = true; air = true; hold = true }
        if (down && mode === 'stall' && Math.abs(dx) < 1.7 && e.ai.t > 0.5 && !blocked) { b = true; air = true; hold = false }
      } else if (down && mode === 'stall' && h().side.vy > -8 && Math.abs(dx) < 2) { a = !h().side.dive && i % 6 === 0; mx = Math.sign(dx) }
      // The blade, on foot or in the air, while it takes it.
      if (!down && mode === 'stall' && Z.bossOpen(e) && Math.abs(dx) < 2.1 && e.invuln <= 0.08 && (!h().swing || h().swing.t > 0.12) && i % 3 === 0) a = true
      // (A cut goes where the stick points.)
      if (a && !down) mx = Math.sign(dx) || 1
      const before = e.hp
      const hp = h().hp
      step({ move: { x: mx, y: 0 }, ...(b ? { bPress: true, jumpPress: true } : {}), ...(hold ? { jumpHeld: true } : {}), ...(a ? { aPress: true, a: true } : {}) })
      watch?.(e, i)
      if (log && (e.hp !== before || h().hp !== hp || (e.ai.mode !== mode && !e.dead))) log({ t, mode: e.dead ? 'gone' : e.ai.mode, car: e.hp, hero: h().hp, r: h().x - m.chase.left, left: m.chase.left })
    }
    assert.ok(e.dead, `COPILOT stands (hp ${e.hp}, ${e.ai.mode}): ${where()}`)
    // The chest that came up down the road, then over it, and out.
    walk(57.4)
    open('lateshow.key2')
    walk(57.4)
    jump(60, 21, 'over the key\'s chest')
    warpBy({ x: 1, y: 0 }, 'showbooth')
    return wonAt
  }

  // -- the Snack Bar ------------------------------------------------------------

  /** The Usher, by the blade alone: stand off, step out of its lane as it comes, cut it while it is spent. */
  function usher() {
    const e = s.map.enemies.find(k => k.kind === 'sentry' && k.tough)
    let side = 1
    for (let i = 0; i < 3600 && !e.dead; i++) {
      if (s.mode !== 'play') { settle(); continue }
      const dx = e.x - h().x
      const dy = e.y - h().y
      const d = Math.hypot(dx, dy)
      const to = { x: dx / (d || 1), y: dy / (d || 1) }
      let move = { x: 0, y: 0 }
      let a = false
      if (Z.toughOpen(e)) {
        move = d > 1.25 ? to : { x: to.x * 0.2, y: to.y * 0.2 }
        a = d < 1.6 && e.invuln <= 0.05 && i % 5 === 0
        if (a) move = to
      } else if (e.ai.mode === 'charge') {
        // Across the line it runs, to the side with the room.
        const v = Math.hypot(e.ai.vx, e.ai.vy) || 1
        move = { x: (-e.ai.vy / v) * side, y: (e.ai.vx / v) * side }
      } else {
        side = (-to.y * (40 - h().x) + to.x * (6 - h().y)) >= 0 ? 1 : -1
        if (d < 2.6) move = { x: -to.x, y: -to.y }
        else if (d > 3.6) move = to
        // Along the wall rather than into it.
        if ((h().x < 34 && move.x < 0) || (h().x > 45.5 && move.x > 0) || (h().y < 4 && move.y < 0) || (h().y > 7.5 && move.y > 0)) move = { x: (40 - h().x) / 6, y: (6 - h().y) / 3 }
      }
      step({ move, ...(a ? { aPress: true, a: true } : {}) })
    }
    assert.ok(e.dead, `the Usher stands (hp ${e.hp}, ${e.ai.mode}): ${where()}`)
    idle(30)
  }

  // -- reel three ---------------------------------------------------------------

  /** The Overgrown Lot: the two pads again, the key on the high slab, and on east over its chest. */
  function overgrownLot() {
    idle(10)
    walk(3.6)
    bounce(6.6, 17, 'the Lot\'s first pad')
    walk(7.5)
    bounce(11, 13, 'the Lot\'s second pad onto the slab')
    walk(11.4)
    open('lateshow.key3')
    walk(11.4)
    jump(13.8, 13, 'over the third key\'s chest')
    until(() => s.mode === 'scroll', { x: 1, y: 0 })
    idle(60)
  }
  /** The Last Reel: down off the high slab, a pad over the block, the lock, the Big Key, and back over to the door. */
  function lastReel() {
    assert.equal(s.zoneIndex, 1, where())
    // Off the ledge's end.
    until(() => !h().side.ground, { x: 1, y: 0 })
    for (let i = 0; i < 120 && !standing(); i++) step({ move: { x: h().x < 21.5 ? 1 : 0, y: 0 } })
    swat()
    walk(21.4)
    bounce(24.2, 17, 'the pad onto the block')
    // The blob below: stomped from the block's edge, or cut once down.
    const blob = live('blob', 16)
    walk(24.5)
    until(() => !h().side.ground, { x: 1, y: 0 })
    for (let i = 0; i < 120 && !standing(); i++) step({ move: { x: Math.sign(blob.x - h().x), y: 0 }, ...(i % 6 === 0 && aimNow()?.on === 'foe' ? { aPress: true, a: true } : {}) })
    idle(20)
    if (!blob.dead) fell(blob, blob.x - 1.2)
    // The inner door, and the Big Key behind it.
    until(() => Z.tileAt(s.map, 28, 20) === '.', { x: 1, y: 0 })
    walk(29.4)
    open('lateshow.bigkey')
    // Back: through the door, the far pad over the block, and out.
    walk(26.4)
    bounce(23.8, 17, 'the far pad, back up onto the block')
    until(() => standing() && feet() > 20.9, { x: -1, y: 0 })
    warpBy({ x: -1, y: 0 }, 'showbooth')
  }

  // -- the Screen ---------------------------------------------------------------

  const weaver = () => s.map.enemies.find(e => e.kind === 'weaver')

  /**
   * The Weaver. A scribble aimed at the hero is walked or jumped out from under; a ripple is jumped; a resting hand is
   * come down on (a tapped B, A once the feet are in the finger's ring); then, up on the top ledge, the face is cut in
   * its yawns from the ledge's left end and stepped away from for each bite. It stops after `secs`, or when `until`
   * says so; `react` is how long a hand or a yawn has been open before it moves (s); without `stomps` it never comes
   * down on a hand, and cuts at it instead. `log` hears what happens.
   */
  function theWeaver({ log = null, watch = null, secs = 180, react = 0, stomps = true, until = null } = {}) {
    const e = weaver()
    /** Where to wait for each hand: the floor's west end, then the east end of the step before. */
    const stands = [{ x: 2.5, row: 21 }, { x: 4.5, row: 20 }, { x: 7.5, row: 19 }]
    let t = 0
    let air = null
    let was = ''
    let hp = h().hp
    let since = 0
    for (let i = 0; i < 60 * secs && !e.dead && !until?.(e); i++, t += 1 / 60) {
      if (s.mode !== 'play') { settle(); continue }
      const mode = e.ai.mode
      const n = e.ai.n ?? 0
      const lane = Z.weaverLane(e)
      let mx = 0
      let b = false
      let a = false
      let hold = false
      const face = n >= 3
      // Where to be: below the step a hand will come to; on the top ledge for the face, off it for the bite.
      let want = face ? (mode === 'bite' || mode === 'snap' || mode === 'rise' ? 6.6 : 8.2) : stands[n].x
      const row = face ? (mode === 'bite' || mode === 'snap' || mode === 'rise' ? 19 : 18) : stands[n].row
      // Out from under a lane: a step to the side that is clear of it, on the same footing.
      if (lane && mode !== 'yawn') {
        const clear = x => !Z.inStencil({ ...lane, w: lane.w + 0.2 }, x, h().y)
        // (The footing the plan stands on, from end to end.)
        const [lo, hi] = face ? [8, 10.7] : [[2.4, 6.5], [2.4, 4.8], [5.3, 7.8]][n]
        if (!clear(want)) want = [1.3, -1.3, 2, -2, 3].map(d => want + d).find(x => x >= lo && x <= hi && clear(x)) ?? want
      }
      const near = Math.abs(h().x - want) < 0.12
      mx = near ? 0 : Math.sign(want - h().x)
      const wave = Z.weaverWaves(e).find(w => (h().x - w.x) * w.way > 0 && Math.abs(h().x - w.x) < 1.6)
      if (standing()) {
        air = null
        // Climbing back to the footing the plan wants: a held jump up onto the step.
        if (feet() > row + 0.1 && h().x < want + 1.6) {
          // Run at the step's edge and jump.
          const edge = row === 20 ? 2 : row === 19 ? 5 : 8
          if (h().x > edge - 1.2 && h().x < edge + 2.6) { b = true; hold = true; air = 'climb'; mx = Math.sign(want - h().x) || 1 }
          else mx = Math.sign(edge - 0.6 - h().x)
        } else if (wave) { b = true; air = 'wave' }
        else if (stomps && mode === 'rest' && near && Math.abs(h().x - stands[n].x) < 0.45 && since >= react && e.ai.t > 0.5) { b = true; air = 'stomp' }
        // Who never stomps cuts at the hand where it lies.
        else if (!stomps && mode === 'rest' && near) { a = i % 20 === 0; if (a) mx = 1 }
        else if (face && mode === 'yawn' && near && since >= react) { a = i % 5 === 0; if (a) mx = -1 }
      } else {
        const f = Z.weaverFinger(Z.mapInfo(W, s.map.id), e)
        if (air === 'climb') { hold = true; mx = Math.abs(h().x - want) < 0.2 ? 0 : Math.sign(want - h().x) }
        // A thumb's stomp: B was only tapped; A when the feet are at the finger.
        if (f) {
          mx = Math.sign(f.x - h().x) * (air === 'stomp' ? 1 : 0)
          if (Math.hypot(h().x - f.x, feet() - f.y) <= Z.STOMP.wide - 0.05) a = i % 3 === 0
          if (air === 'stomp') mx = 0
        }
      }
      // A pellet about to arrive is cut.
      const p = Z.weaverPellet(e)
      if (p && !a && Math.hypot(p.x - h().x, p.y - h().y) < 1.6 && !h().swing) { a = true; const dy = p.y - h().y; mx = Math.abs(dy) > Math.abs(p.x - h().x) && dy < 0 ? 0 : Math.sign(p.x - h().x) || 1; if (!mx) { step({ move: { x: 0, y: -1 }, aPress: true, a: true }); continue } }
      step({ move: { x: mx, y: 0 }, ...(b ? { bPress: true, jumpPress: true, jumpHeld: true } : {}), ...(hold ? { jumpHeld: true } : {}), ...(a ? { aPress: true, a: true } : {}) })
      watch?.(e, i)
      since = e.ai.mode === mode ? since + 1 / 60 : 0
      if (log && (e.ai.mode !== was || h().hp !== hp)) log({ t, mode: e.ai.mode, boss: e.hp, hero: h().hp, x: h().x, feet: feet() })
      was = e.ai.mode
      hp = h().hp
    }
    return t
  }

  /** The Weight on the top ledge, where the Weaver's fall left it. */
  function takeTheWeight() {
    settle()
    walk(9.5)
    settle()
  }

  return {
    s, heard, events, step, idle, settle, card, until, warpBy, walkTo, walk, jump, climb, fell, where, standing, feet,
    mainStreetEast, backlotToStomp, stompTheBlob, stompTheFloor, stompTheFloorFrom, backlotWest, mainStreetWest,
    bounce, videoStore, theRoad, usher, overgrownLot, lastReel, weaver, theWeaver, takeTheWeight,
  }
}
