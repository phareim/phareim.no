// The controllers of Act Three's fights and hazards (`zelda-act-three.test.mjs`, and the measure script, which times
// them): they read the state to decide what to press, and press only what a player can. `Z` is the bundled engine,
// `P` a side player (`zelda-reel.mjs`) on the same game.
import assert from 'node:assert/strict'

const DT = 1 / 60
const R = 0.34

/** Along the floor or a ledge toward x, one step's stick. */
const toward = (h, x, slack = 0.12) => ({ x: Math.abs(h.x - x) < slack ? 0 : Math.sign(x - h.x), y: 0 })
const jumpKeys = { bPress: true, jumpPress: true, jumpHeld: true }

/**
 * BARD. `glass`: during a hide, stand still until the glass shows the piece, then wait where its blow will not reach
 * and its opening will be near; without it, wait in the middle and read the stencil. `react`: seconds before it acts
 * on a tell or an opening; `until` (a function of BARD) ends the fight early. Returns the seconds taken and the blows
 * that landed on the hero.
 */
export function fightBard(Z, s, P, { glass = false, max = 150, react = 0, until = null } = {}) {
  const e = s.map.enemies.find(v => v.kind === 'bard')
  const h = () => s.hero
  const seen = { pieces: new Set(), openings: 0, hits: 0 }
  let frames = 0
  let was = ''
  let changed = 0
  let hp = h().hp
  let jumping = false
  // Seconds from each opening to the first blow that bit in it.
  const waits = []
  let since = null
  const safeSpot = (boxes) => {
    let best = null
    for (let x = 1.5; x <= 13.5; x += 0.25) {
      // (Both sides of him, so that he is not left on a stencil's edge.)
      if ([x - 0.2, x, x + 0.2].some(at => boxes.some(b => at >= b.x0 && at <= b.x1 && 12 - R >= b.y0 && 12 - R <= b.y1))) continue
      if (best === null || Math.abs(x - h().x) < Math.abs(best - h().x)) best = x
    }
    return best
  }
  while (!e.dead && !until?.(e)) {
    assert.ok(frames++ < max * 60, `BARD stands after ${max} s (hp ${e.hp}, ${e.ai.mode}): ${P.where()}`)
    if (h().hp < hp) seen.hits++
    hp = h().hp
    if (s.mode !== 'play' || s.card) { P.step(s.mode === 'dialog' && frames % 12 === 0 ? { aPress: true } : {}); continue }
    const mode = e.ai.mode
    const piece = Z.bardPiece(e)
    if (mode === 'open' && was !== 'open') { seen.openings++; since = frames }
    if (since !== null && (e.ai.took ?? 0) > 0) { waits.push((frames - since) * DT); since = null }
    if (mode === 'tell') seen.pieces.add(piece)
    if (mode !== was) changed = frames
    was = mode
    const onFloor = !!h().side?.ground && Math.abs(h().y + R - 12) < 0.05
    const onLedge = !!h().side?.ground && Math.abs(h().y + R - 10) < 0.05
    if (h().side?.ground) jumping = false
    // In the air: the stick holds what the jump was for.
    if (jumping) { P.step({ move: toward(h(), jumping), jumpHeld: true }); continue }
    if ((mode === 'tell' || mode === 'open') && frames - changed < react * 60) { P.step(); continue }
    if (mode === 'open') {
      const ledge = e.y + e.r < 10.5
      if (ledge && !onLedge) {
        // Up to the ledge: a held jump from the floor under it.
        if (onFloor && h().x > 9.4 && h().x < 10.6) { jumping = 10; P.step({ ...jumpKeys, move: toward(h(), 10) }) }
        else P.step({ move: toward(h(), 10) })
        continue
      }
      if (!ledge && onLedge) { P.step({ move: { x: e.x < h().x ? -1 : 1, y: 0 } }); continue }
      // To an arm's length of it, on the side with room, facing it; then the chain.
      let side = h().x < e.x ? -1 : 1
      if (e.x + side * 1.7 < 1.4 || e.x + side * 1.7 > 13.8) side = -side
      if (ledge) side = -1
      const spot = e.x + side * 1.7
      if (Math.abs(h().x - spot) > 0.45 && !h().swing) { P.step({ move: toward(h(), spot) }); continue }
      const face = Math.sign(e.x - h().x)
      if (h().dir !== (face < 0 ? 'left' : 'right')) { P.step({ move: { x: 0.4 * face, y: 0 } }); continue }
      P.step(frames % 9 === 0 ? { aPress: true, a: true } : {})
      continue
    }
    if (mode === 'tell' || mode === 'blow') {
      const boxes = Z.bardBoxes(s.map, e)
      if (piece === 'door') {
        // A held jump as the door comes, from wherever he is on the floor.
        const near = mode === 'blow' && Math.abs(e.x - h().x) < 2.2 && boxes.some(b => h().x >= b.x0 - 0.2 && h().x <= b.x1 + 0.2)
        if (near && onFloor) { jumping = h().x; P.step({ ...jumpKeys }); continue }
        P.step()
        continue
      }
      if (onLedge) { P.step({ move: { x: -1, y: 0 } }); continue }
      const to = safeSpot(boxes)
      P.step({ move: toward(h(), to ?? h().x) })
      continue
    }
    // Hidden, or between: to a waiting spot on the floor; with the glass, by what it shows.
    if (onLedge) { P.step({ move: { x: -1, y: 0 } }); continue }
    let wait = 6
    if (glass && mode === 'hide') {
      const known = s.lens?.up ? Z.bardPiece(e) : seen.known
      if (s.lens?.up) seen.known = known
      if (!known) { P.step(); continue }
      // The rope: at the ladder's foot. The door: its far side from where it will run. The chest: aside of its leap.
      wait = known === 'rope' ? 10 : known === 'door' ? 4.5 : 6.5
    }
    if (mode !== 'hide') delete seen.known
    P.step({ move: toward(h(), wait) })
  }
  return { seconds: frames * DT, openings: seen.openings, hits: seen.hits, pieces: [...seen.pieces], waits }
}

/**
 * THE UNDERSTUDY, from the floor, with the blade: kept at a distance while it stalks, jumped when its charge comes,
 * cut while it stands spent.
 */
export function fightUnderstudy(Z, s, P, { max = 120 } = {}) {
  const e = s.map.enemies.find(v => v.tough)
  const h = () => s.hero
  let frames = 0
  let hp = h().hp
  let hits = 0
  let openings = 0
  let was = ''
  let jumping = null
  const ends = []
  while (!e.dead) {
    assert.ok(frames++ < max * 60, `the understudy stands after ${max} s (hp ${e.hp}, ${e.ai.mode}): ${P.where()}`)
    if (h().hp < hp) hits++
    hp = h().hp
    if (s.mode !== 'play') { P.step(); continue }
    const mode = e.ai.mode
    if (mode === 'spent' && was !== 'spent') { openings++; ends.push({ x: +e.x.toFixed(2), feet: +(e.y + e.r).toFixed(2) }) }
    was = mode
    const dx = e.x - h().x
    if (h().side?.ground) jumping = null
    if (jumping !== null) { P.step(jumping === 'hop' ? {} : { jumpHeld: true, move: toward(h(), jumping) }); continue }
    // Landed on a shelf: down through it.
    if (h().side?.ground && h().y + R < 9.5) { P.step({ move: { x: 0, y: 1 } }); continue }
    if (mode === 'spent' && (e.ai.took ?? 0) < Z.TOUGH.take) {
      const face = Math.sign(dx) || 1
      if (Math.abs(dx) > 1.6 && !h().swing) { P.step({ move: { x: face, y: 0 } }); continue }
      if (h().dir !== (face < 0 ? 'left' : 'right')) { P.step({ move: { x: 0.4 * face, y: 0 } }); continue }
      P.step(frames % 9 === 0 ? { aPress: true, a: true } : {})
      continue
    }
    if (mode === 'charge' && Math.abs(dx) < 2.6 && Math.sign(e.ai.vx) === -Math.sign(dx) && h().side?.ground) {
      // A tapped jump: high enough for the charge, too low for a shelf, and soon down again.
      jumping = 'hop'
      P.step({ bPress: true, jumpPress: true, jumpHeld: true })
      continue
    }
    if (mode === 'tell' || mode === 'charge') { P.step(); continue }
    // Stalking: about four tiles off; against a wall, over it and past.
    const away = -Math.sign(dx) || -1
    const spot = e.x + away * 3.8
    if (spot < 1.6 || spot > 14.4) {
      if (Math.abs(dx) < 2.2 && h().side?.ground) { jumping = e.x - away * 3.2; P.step({ ...jumpKeys, move: toward(h(), jumping) }); continue }
      P.step()
      continue
    }
    P.step({ move: toward(h(), spot, 0.4) })
  }
  return { seconds: frames * DT, openings, hits, ends }
}

/** Waits until no bag will fall in the next `dur` s anywhere the hero's way from here to `x` (feet on `row`) lies. */
export function awaitBags(Z, s, P, x, dur, row) {
  const h = s.hero
  const [a, b] = [Math.min(h.x, x) - R, Math.max(h.x, x) + R]
  const feet = row ?? h.y + R
  const mine = Z.bagsOf(Z.mapInfo(Z.WORLD, s.map.id)).filter(bag => {
    if (bag.x + Z.BAG.w <= a || bag.x >= b) return false
    // A bag whose column reaches the rows the way crosses.
    return Z.column(s.map, bag.x, bag.x + Z.BAG.w, bag.y).some(box => box.y1 > Math.min(feet, h.y + R) - 3.3 && box.y0 < Math.max(feet, h.y + R))
  })
  const safe = () => mine.every(bag => {
    for (let t = 0; t <= dur; t += DT) if (Z.bagAt(bag, (s.map.bagT ?? 0) + t).mode === 'fall') return false
    return true
  })
  for (let i = 0; i < 600 && !safe(); i++) P.step()
  assert.ok(safe(), `the bags never leave a way to ${x}: ${P.where()}`)
}

/** The west end of the gondola's floor a player means to use: further on is the stair, which leaves the fight. */
const WEST = 2.35

/**
 * THE HALLUCINATOR, from the floor, with the blade. It reads what a player sees: where the bodies are, which one the
 * arrow is over, which have popped, the stencils and the rail; and, only while the glass is up, which one stays solid.
 * `way`: 'blade' guesses (never the claimed body; then one of the two; after a pop, the other), 'glass' stands still
 * through the claim until the glass is up, 'plate' walks onto the plate. It steps out of every stencil and cuts while
 * the rail is lit. `react`: seconds before it acts on a stencil or the rail. `guess` (a function giving 0 or 1, west
 * to east) settles the blind guess; left out, it takes the nearer one. Returns the seconds, the openings and how many
 * bit, the false bodies popped, the half hearts lost, how far off each cut that bit stood (tiles) and what the bar
 * quoted at each shuffle. `until` (a function of the real body) ends the fight early, wherever it has got to.
 */
export function fightHallucinator(Z, s, P, { way = 'blade', max = 400, react = 0, watch = null, guess = null, until = null } = {}) {
  const lead = () => s.map.enemies.find(v => v.kind === 'hallucinator')
  const h = () => s.hero
  const out = { seconds: 0, openings: 0, bit: 0, pops: 0, lost: 0, far: [], quoted: [] }
  let frames = 0
  let was = ''
  let changed = 0
  let hp = h().hp
  let known = null
  let target = null
  let bitThis = false
  const e0 = lead()
  const popped = new Set()
  const safe = (boxes, want) => {
    let best = null
    for (let x = WEST; x <= 12.6; x += 0.2) {
      if ([x - 0.25, x, x + 0.25].some(at => boxes.some(b => at >= b.x0 && at <= b.x1))) continue
      if (best === null || Math.abs(x - want) + Math.abs(x - h().x) < Math.abs(best - want) + Math.abs(best - h().x)) best = x
    }
    return best ?? want
  }
  while (!e0.dead && !until?.(e0)) {
    assert.ok(frames++ < max * 60, `the Hallucinator stands after ${max} s (hp ${e0.hp}, ${e0.ai.mode}): ${P.where()}`)
    if (h().hp < hp) out.lost += hp - h().hp
    hp = h().hp
    if (s.mode !== 'play') { P.step(s.mode === 'dialog' && frames % 12 === 0 ? { aPress: true } : {}); continue }
    const bodies = Z.halluBodies(s.map)
    const mode = e0.ai.mode
    watch?.(bodies, frames * DT)
    if (mode !== was) {
      changed = frames
      if (mode === 'shuffle') { known = null; target = null; popped.clear(); out.quoted.push(Z.halluShown(e0)) }
      if (mode === 'open') { out.openings++; bitThis = false }
      was = mode
    }
    const claimed = mode === 'claim' || mode === 'blows' || mode === 'bow' || mode === 'open' ? bodies[e0.ai.claimed] : null
    // What the glass shows: only one body stays solid.
    const seeing = (way === 'glass' && s.lens?.up && s.lens.k === 1) || (way === 'plate' && e0.ai.glass === 1)
    if (seeing && claimed) known = bodies[0]
    // A cut that showed a hurt found it; one that popped a body did not.
    for (const b of bodies) if (Z.halluPopped(b) && !popped.has(b)) { popped.add(b); out.pops++; if (target === b) target = null }
    if (claimed && (mode === 'blows' || mode === 'bow' || mode === 'open') && !target) {
      const left = bodies.filter(b => b !== claimed && !popped.has(b))
      const at = b => Z.HALLU.slots[b.ai.slot]
      if (known) target = known
      else if (left.length) {
        // (By where they stand, never by which they are.)
        const by = [...left].sort((a, b) => at(a) - at(b))
        target = guess ? by[Math.min(by.length - 1, guess())] : by.sort((a, b) => Math.abs(at(a) - h().x) - Math.abs(at(b) - h().x))[0]
      }
    }
    if (known && target !== known) target = known
    const onFloor = !!h().side?.ground
    if (mode === 'open' && target && frames - changed >= react * 60) {
      const x = target.x
      const near = h().x < x ? -1 : 1
      let spot = x + near * 1.3
      if (spot < WEST || spot > 12.6) spot = x - near * 1.3
      if (Math.abs(h().x - spot) > 0.55 && !h().swing) { P.step({ move: toward(h(), spot) }); continue }
      const face = Math.sign(x - h().x) || 1
      const off = Math.abs(h().x - x)
      const before = e0.hp
      // (The cut goes where the stick points as it starts.)
      P.step(frames % 9 === 0 ? { move: { x: 0.4 * face, y: 0 }, aPress: true, a: true } : {})
      if (e0.hp < before) { out.far.push(off); if (!bitThis) { bitThis = true; out.bit++ } }
      continue
    }
    if (mode === 'blows' && e0.ai.wt < Z.HALLU.tell + Z.HALLU.fall && e0.ai.wt >= react) {
      const want = target ? Z.HALLU.slots[target.ai.slot] : h().x
      const to = safe(Z.halluBoxes(e0), want)
      P.step({ move: toward(h(), to) })
      continue
    }
    if (way === 'plate' && (mode === 'shuffle' || mode === 'claim') && onFloor && !known) { P.step({ move: toward(h(), 7.5) }); continue }
    // Standing still for the glass: through the claim.
    if (way === 'glass' && !known && (mode === 'shuffle' || mode === 'claim')) { P.step(); continue }
    if (target && mode !== 'blows') { P.step({ move: toward(h(), Z.HALLU.slots[target.ai.slot], 1.3) }); continue }
    if (mode === 'blows' && target) { P.step({ move: toward(h(), Z.HALLU.slots[target.ai.slot], 1.3) }); continue }
    P.step()
  }
  out.seconds = frames * DT
  return out
}
