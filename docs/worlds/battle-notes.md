# Field battles: notes

Turn-based battles where the party stands (FOGSTAGE first, then RERUN ESTATES), distilled from FFVI/IX's Active
Time Battle, Chrono Trigger's map battles, EarthBound's swirls and rolling HP, and Secret of Mana's ring menu.

## What makes them fun (and what we keep)

- **A decision every few seconds under a gentle clock** (ATB), with Wait mode so reading never costs you.
- **No seam** (Chrono): the fight is on the map; shapes (line, circle) matter because foes move between turns.
- **Two are more than two** (Chrono's double techs): a duo lit only when both gauges are full is a regular "now!".
- **Fights you choose and skip** (EarthBound): visible foes, a back touch moves first, outclassed groups flee.
- **Drama at low health** (EarthBound's odometer HP): damage rolls off over time, so a fast finish saves you.
- **The menu sits on the character** (Mana's ring): no box, no screen change.

## Pacing (ATB)

- Ticks are the engine's 1/120 s. Gauges run 0–1000, filling `1000 / (fill_s × 120)` per tick; seeded, testable.
- Fill times: hero 2.8 s, Luna 3.4, guest 3.0; blob 4.0, knight 3.6, Mower 3.6, hound 2.6, moth 2.2, bosses 2.4–3.
- **Wait** (default): every gauge pauses while a ring is open. **Active** (option): nothing pauses.
- An action plays 0.4–0.8 s (no filling meanwhile); foe actions queue by full gauge, never two in one frame.
- Only the hero's ring opens by itself. Luna acts on her own 3 s after her gauge fills (lift the foe nearest the
  hero, else shield him) unless you tap her first.

## Four commands, no more

| Petal | Does |
|---|---|
| STRIKE | the sword at a foe: step in, hit, step back (1, Arc Blade 2) |
| SKILL | what he carries: bomb (burst r 1.5), disc (line, stuns), hook (pull 2 tiles), waffle (+1 heart). Luna's: lift, fling, shield |
| DUO | lit only when both gauges are full and a duo is possible; 1–3 duo icons |
| STEP | move 1 tile (0.3 s, half a gauge); a step off the arena edge leaves the fight |

The petals sit on the iso diagonals round the ready fighter. Leaving always works (bosses have no edge); the
foes are then winded for 4 s.

## Duos (hero + Luna; a realm guest adds one triple)

| Duo | Shape | Rule |
|---|---|---|
| CATCH | single | Luna lifts the foe 2 tiles, the hero strikes as it falls: 3×, it lands Dazed |
| FLING | line, 5 | Luna throws a thing on the field (rock, pot, bush, sign, sandbag) along an axis; one within 3 tiles |
| RELAY | circle r 2 round a foe | the disc thrown, Luna bends it round: all in it stunned and hit for 1 |
| REEL | line → cluster | hook one foe, Luna drags its row after it: they bunch into one burst |
| LOB | burst r 2 | Luna carries a bomb over cover to the far group: 2, ignores shield fronts |

Learned from story beats, one at a time (four by FOGSTAGE's end); a realm guest brings one triple, there only.

## The field matters

- **Arena**: a diamond of radius 4 (41 tiles) round the first touch, snapped to walkable ground, edged with dim
  pink pips. Foes inside or within 6 tiles at the start join; later wanderers wait outside.
- **Shapes**: single, line (one iso axis, 5 tiles), burst (circle round a tile). Foe brains: clusterers (blobs walk
  together), spreaders (moths keep 2 apart), liners (knights, dishes align on the hero's axis). One tile per cue.
- **Facing**: from behind ×1.5 (flamingos ×2); a knight's front takes 0. STRIKE knocks a Dazed foe 1 tile.
- **Terrain**: tall grass +25 % evade; deep water takes a foe knocked in; zappers in water shock all in water; a
  cliff step +1 tile on lines; a lamp pool cures Fogged; rocks and pots are FLING's ammo; fences block lines.

## Status effects (five)

| Status | Effect | Lasts |
|---|---|---|
| Dazed | gauge frozen; hits on it count as from behind | 3 s (bosses 2 s) |
| Fogged | its actions miss half the time | 3 turns, or a lamp pool |
| Static | loses a quarter heart (foes 1 HP) each of its turns | 3 turns |
| Quick / Slow | fill time ×0.67 / ×1.5 | 12 s |
| Lifted (Luna) | aloft: cannot act, only discs and duos reach it, drops for 1 | 4 s |

## Tiny, touch-friendly chrome

- New on screen: a 12×2 px gauge under each party member's shadow (cyan, blinks when full), a pink diamond under
  the target, the ring, and a one-line banner (≤ 12 chars, the 5×7 font) for duos and boss moves. No foe HP bars:
  a foe under a quarter wobbles. Hearts stay in the HUD and roll: a quarter heart per 0.4 s, stopped by a win.
- Petals 16 logical px (≥ 44 CSS px at ×3), 20 px from the feet, the ring turning to stay on screen. Touch: tap a
  petal, then a foe (or a tile for STEP); tap empty ground to go back. Pad: arrows pick, A confirms, B backs out.

## Start and end without a screen change

- **Start**: a group and the hero touch. Back touch: a cyan ring wipe, his gauge full, foes at 0. Caught from
  behind: a pink wipe, foes at 50 %, the party at 0. Else everyone 0–30 % (seeded). The wipe (0.4 s) runs on the
  ground only, the camera eases to the arena, the party walks to free tiles, the battle stem joins on the next bar.
- **End**: last foe down → 0.25 s hit-stop, bits pop as usual, "+12" floats, the ring opens out, the stem drops on
  the next bar, control returns where the hero stands. No results screen, no XP: growth stays items, hearts, duos.
- **Loss**: hearts at zero once the roll ends → the usual death. **Skip**: a group below the realm's tier flees;
  touching one is an instant win. Beaten groups stay gone until the area is re-entered.

## 20–60 seconds

- Groups of 2–4 foes, 8–14 HP in all. The hero acts every ~3.2 s, Luna every ~4 s: in 30 s about 9 + 7 actions;
  strikes of 1–2 and duos of 3–6 clear a group in 6–9: 20–35 s. Elites (a knight + support, 18–22 HP): 40–60 s.
- Bosses are the exception (90–150 s, a gimmick). Leaving is one STEP: no fight holds you longer than you choose.
