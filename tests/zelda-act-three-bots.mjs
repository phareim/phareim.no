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
 * on a tell or an opening. Returns the seconds taken and the blows that landed on the hero.
 */
export function fightBard(Z, s, P, { glass = false, max = 150, react = 0 } = {}) {
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
  while (!e.dead) {
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
