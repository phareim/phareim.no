// The scripted walk from the Keeper's hut to the Sun Prism (god mode, bosses killed directly), played by
// zelda-engine.test.mjs's full run and by zelda-action-button.test.mjs. The caller brings the player's hands:
// `Z` the engine, `OX` the overworld's x offset, and `inp`, `step`, `settle`, `walkTo`, `face`, `pressA`,
// `killCell`. `s` is a new game out of the hut door.
import assert from 'node:assert/strict'

export function prismRun(s, { Z, OX, inp, step, settle, walkTo, face, pressA, killCell }) {
  const got = item => assert.ok(s.flags[`item:${item}`], `expected ${item}`)
  // Blade
  walkTo(s, OX + 6, 30)
  face(s, 'up'); pressA(s); got('sword')
  // Bomb bag in Whisper Woods (chest at OX+5,4 — stand below it)
  walkTo(s, OX + 5, 5)
  face(s, 'up'); pressA(s); got('bombBag')
  // Heart piece behind the woods boulder (OX+24,5): bomb from below
  walkTo(s, OX + 24, 6)
  face(s, 'up')
  step(s, inp({ bPress: true }))
  for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
  walkTo(s, OX + 24, 5)
  walkTo(s, OX + 24, 3)
  settle(s)
  assert.equal(s.inv.pieces, 1)
  // Rubble at the shrine (the static vines in front of it died with the Gate, in the Wildwood run): bomb it
  s.flags.gateShut = true
  step(s)
  walkTo(s, OX + 57, 5)
  face(s, 'up')
  step(s, inp({ bPress: true }))
  for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
  assert.equal(s.map.tiles[4 * s.map.w + OX + 57], '.')
  walkTo(s, OX + 57, 3)
  walkTo(s, OX + 57, 2, { map: 'overworld' })
  for (let k = 0; k < 80; k++) step(s)
  assert.equal(s.map.id, 'shrine')
  // East room: clear it, key chest appears
  walkTo(s, 33, 41)
  for (let k = 0; k < 60; k++) step(s)
  killCell(s)
  walkTo(s, 39, 44)
  face(s, 'up'); pressA(s)
  assert.equal(s.inv.keys, 1)
  // Push room (2,2): block (38,28) → right ×4, down ×3, right ×1 onto the plate (43,31)
  walkTo(s, 36, 34)
  const push = (fromX, fromY, dir, n) => {
    for (let k = 0; k < n; k++) {
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
      walkTo(s, fromX + v[0] * k, fromY + v[1] * k)
      for (let f = 0; f < 40; f++) step(s, inp({ move: { x: v[0], y: v[1] } }))
      for (let f = 0; f < 20; f++) step(s)
    }
  }
  push(37, 28, 'right', 4)
  push(42, 27, 'down', 3)
  push(41, 31, 'right', 1)
  for (let k = 0; k < 10; k++) step(s)
  assert.ok(s.map.plates.includes('push'), 'plate pressed')
  assert.equal(s.map.tiles[24 * s.map.w + 39], '.', 'gate open')
  // Dark room (2,1): clear, key 2
  walkTo(s, 39, 21)
  for (let k = 0; k < 60; k++) step(s)
  killCell(s)
  walkTo(s, 39, 18)
  face(s, 'up'); pressA(s)
  assert.equal(s.inv.keys, 2)
  // Hub west door → crystal room
  walkTo(s, 17, 29)
  for (let k = 0; k < 60; k++) step(s, inp({ move: { x: -1, y: 0 } }))
  assert.equal(s.inv.keys, 1)
  walkTo(s, 12, 30)
  face(s, 'left'); pressA(s)
  for (let k = 0; k < 30; k++) step(s)
  assert.equal(s.map.crystal[s.zoneIndex], 'cyan')
  walkTo(s, 3, 29)
  face(s, 'down'); pressA(s)
  got('disc')
  // Back to pink so the north blocks drop, then the locked door north.
  walkTo(s, 12, 30)
  face(s, 'left'); pressA(s)
  for (let k = 0; k < 30; k++) step(s)
  walkTo(s, 7, 25)
  for (let k = 0; k < 60; k++) step(s, inp({ move: { x: 0, y: -1 } }))
  assert.equal(s.inv.keys, 0)
  // Miniboss room (0,1)
  walkTo(s, 7, 21)
  for (let k = 0; k < 60; k++) step(s)
  killCell(s)
  assert.ok(s.flags.miniboss)
  for (let k = 0; k < 30; k++) step(s)
  walkTo(s, 8, 20)
  face(s, 'up'); pressA(s)
  got('bigKey')
  // Ante (1,1): disc the switch across the water from the corridor
  walkTo(s, 7, 29)
  walkTo(s, 23, 26)
  walkTo(s, 23, 16)
  face(s, 'left')
  s.inv.selected = 'disc'
  step(s, inp({ bPress: true }))
  for (let k = 0; k < 120; k++) step(s)
  assert.equal(s.map.crystal[s.zoneIndex], 'cyan', 'switch flipped by the disc')
  walkTo(s, 23, 13)
  for (let k = 0; k < 60; k++) step(s, inp({ move: { x: 0, y: -1 } }))
  // Boss
  walkTo(s, 23, 9)
  for (let k = 0; k < 60; k++) step(s)
  killCell(s)
  assert.ok(s.flags.boss)
  for (let k = 0; k < 20; k++) step(s)
  walkTo(s, 22, 8)
  settle(s)
  assert.equal(s.hero.maxHp, 8)
  walkTo(s, 25, 8)
  settle(s)
  assert.equal(s.mode, 'won')
  // The sun can set at last: the day starts at the dusk the world was stuck in.
  assert.equal(s.daytime, 0)
  // The run goes on after the ending, with the prism, and survives a save.
  Z.resumeAfterWin(s)
  assert.equal(s.mode, 'play')
  for (let k = 0; k < 30; k++) step(s, inp({ move: { x: 0, y: 1 } }))
  assert.equal(s.mode, 'play')
  const back = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))) })
  assert.equal(back.mode, 'play')
  assert.ok(s.daytime > 0, 'the clock runs after the ending')
  assert.equal(back.daytime, Math.round(s.daytime * 10) / 10, 'and the hour survives the save')
  assert.equal(back.inv.prism, true)
  assert.ok(back.flags.won)
  return s
}
