# Neon Shrine — field battles

Chrono Trigger–style fights where they are switched on: a map with `MapDef.battle` fights its foe groups
turn by turn, in place, with no screen change. Everywhere else the action combat is unchanged. Design
notes behind it: `docs/worlds/battle-notes.md`. Demo: the battle glade (`world/arena.ts`, map `arena`,
entry `start`; not linked from the world yet).

## Turning it on

```ts
battle: {
  track: 'boss',                       // the music of a fight here (default 'boss')
  groups: [
    { id: 'glade.goo', x: 8.5, y: 16, foes: ['goo', 'goo'] },
    { id: 'glade.pond', x: 18.5, y: 6.2, foes: ['zapper', 'drone', 'drone'], sight: 2.6 },
    { id: 'glade.knight', x: 6.5, y: 4.5, foes: ['knight', 'skull'], once: true, prize: 'bits50' },
  ],
}
```

A group (1–4 foes from `FOES`) stands as ordinary enemies (`Enemy.group`, drawn with the look of the
EnemyKind each foe borrows) in a loose cluster round (x, y), milling about. They never fight in real
time. `sight`: the group starts the fight when it sees the hero that close. `once`: beaten for good (flag
`battle:<id>`); otherwise it stands again whenever the map is entered. `prize`: an item given (item-get)
the first time it is beaten. A group with the knight cannot be fled.

## The fight (`engine/battle/`)

- **Start**: touching a foe (contact), being seen (`sight`: the foes start with half-full gauges, "AMBUSH"),
  or striking one with the blade, a bomb, the disc… (`hitEnemy` → "FIRST STRIKE": the party's gauges full,
  the foes' empty). Mode `battle`, `GameState.battle`. The party walks to a stance facing the foes where
  they stand (0.55 s), the camera eases to frame everyone (`battleFocus`, used by `cameraFor` and the iso view).
- **Time** (ATB, Wait mode): every gauge fills over its `wait` (hero 2.1 s, Luna 2.1 s, foes 4.2–5.6 s); nothing fills while a menu is open or an action plays. Full gauges queue
  in the order they filled; a party member at the head gets the menu, a foe plays the next move of its
  `pattern`.
- **Commands** (four, always the same place): STRIKE (Luna: PSI) · TECH · ITEM · FLEE. Techs cost tech
  points (dots; up to 3, one to start, one per blow that lands). A **combo tech** (STORM, LANCE) needs every
  member it names in the party, each with a full gauge and the points, and spends all their turns.
  ITEM: a neon tonic (two hearts to one member; chest item `tonic3`, `Inventory.tonics`) or a bomb (hits
  all, dazes). FLEE always works except from a guardian: the party runs back the way it came and the foes
  stand winded for 4 s.
- **Positions**: SWEEP hits the target and every foe within 1.6 tiles of it; LANCE every foe on the line
  from the hero through the target; static on a foe on or beside water hits twice as hard and dazes it.
- **Statuses**: dazed (`stun`: the gauge stands still), static (foes: 2 a second, 4 when wet; the party:
  the gauge fills at 0.7), slow (half speed, and more misses), break (half again the damage; a raised guard
  is gone). Weak ×1.5, resist ×0.5; the knight's SHIELD quarters blades and psi until CRACK breaks it;
  a zapper shocks a blade that strikes it undazed; flitters and skulls dodge blades unless slowed.
- **End**: the last foe falls → bits (`FOES[].bits`), a drop rolled where it stood, the prize, the camera
  eases back and control returns where the hero stands. The hero at zero hearts → the usual death and
  respawn (`enterMap` clears the battle). Luna knocked out stays down until the fight ends; she starts each
  fight whole (8 half-hearts).
- Pure and deterministic like the rest: chance through `state.rng`. Escape and P pause mid-fight; the
  Escape hold still quits.

Tables (`engine/battle/data.ts`): `PARTY` (members: wait, strike, techs; a new companion is a row here and
in `TECHS`), `TECHS` (area one/near/line/all/ally, power, element, cost, status), `FOES` (eight: goo,
flitter, hound, zapper, drone, skull, spitter, knight; hp, wait, moves and pattern, weak/resist, evade,
bits). Types: `battleTypes.ts` (re-exported by `types.ts`).

## On screen (`render/battle.ts`)

Drawn on the HUD layer by `hudPaint` (renderer.ts) in every view; the iso view hands it its own projection
(`hudLayer`'s `screenOf`). A 12×2 gauge and tech dots under each party member (Luna's hit points as pips
over hers), hit-point pips over each foe, status glyphs by each fighter, and numbers and words rising.
While a member chooses, a marker hovers over its head and a strip of at most four commands sits beside it,
on the side away from the foes and off the other fighters. A linked pair of rings marks combo techs.
Picking a target: a bouncing arrow with the foe's name, and a diamond
under everything the command would hit. Keyboard: arrows move, A picks, B backs out. Touch: tap a line,
then a foe (a foe tapped straight away is STRIKE); a tap on nothing backs out (`Input.tap` → the
renderer's `battlePick` → `Input.pick`). Sound: the existing SFX, `battle` events for the music and the
win's jingle.

Tests: `tests/zelda-battle.test.mjs`. Lab: `node scripts/zelda-lab/shot.mjs <out> b-field,b-menu,b-target,b-tech,b-hit,b-solo,b-marks`
(with `VIEW=iso` for the isometric view).
