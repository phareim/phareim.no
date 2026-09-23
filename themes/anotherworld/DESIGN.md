# Another Shore — design

A homage to Éric Chahi's *Another World* (1991), set in the phareim.no
arcade. Rebuilt 2026-09-23 from the one-screen coastal walk into a
cinematic platformer in five chapters with a prologue and an ending, about
ten minutes long. Status and checks: `docs/games/another-shore.md`.

## Story

The pilot on your Hall of Fame profile flies the last run of the night over
the neon grid, in the ship you picked in the Hangar. A storm cell, a
reading off the sun, lightning. The sun tears open like a door and the
ship falls through it, into a pool on the far side.

| Chapter | Place | What happens |
|---|---|---|
| I · The pool | dusk shore | Surface before the tentacles wake; the wreck on the bottom; kick a leech; run under two hanging leeches; the beast watches from a far ridge and turns its head; a shelf to climb; the tide |
| II · The beast | night causeway | Arches, the tide, then a roar behind you: the chase over gaps, a leech, a step, a last wide gap. The beast leaps; a pink bolt takes it out of the air; two guards |
| III · The cage | the hall | Hanging in a cage with a tall stranger. Swing it until the chain snaps onto the guard below; take his gun; the stranger points and goes into a vent; a guard comes in for the first duel |
| IV · The hall | the hall, two floors | Shield duels, a blast door only a charged beam opens, a dead end until the stranger lowers the lift from the floor above |
| V · The lamp | storm, a stepped tower | Leeches, a rock out of the storm, two guards on the ledges, the lamp at the top. Lighting it turns the palette to dawn |

Ending: the sun comes up behind the lamp; the last guard's shot takes the
pilot down; the stranger drops on the guard, carries the pilot to a
winged thing that has settled at the edge, and they fly into the sun. Hard
cut to the neon grid: the ship comes out of the sun. *Signal found.
Welcome back, <pilot>.*

What is taken from the original: the pool and the tentacles, the leeches
and the kick, the beast first seen far away and then running you down,
the guards' shot that ends the chase, the swinging cage, the friend, the
one-button gun (tap, shield, charged beam), the wordless ending on a
winged creature. What is not: any of its screens, music or text.

## Look (`render/`)

Another World's discipline: flat polygons, no outlines, no gradients, a
gradient is two or three flat bands, sixteen colours per scene — indices
0–7 base hues, 8–15 the same hues turned to the light. A face toward the
light is base + 8; that is the lighting model. Palettes turn on hard cuts:
**dusk** (chapter I), **night** (II), **hall** (III–IV), **storm** (V, one
all-lit frame per lightning strike, none under reduced motion), **dawn**
(when the lamp is lit). Pausing draws the palette a step darker.

Over the matte world sit the Neon Dreams inks, and only the living glow:
cyan for the pilot and the friend's eyes, pink for what kills (leech tips,
the beast's eyes, guards' eyes, bolts, shields, the blast door, the hall's
emitter lines), gold for what helps (lamps, the gun on the floor, the lamp
at the top). A glowing thing is drawn twice. The pilot's suit, shots,
charge and shield take the Hangar ship's hull colour. The sun is the same
striped sun as every other game in the arcade, flattened into bands.

The camera follows with a lead toward where the figure faces, holds the
ground line at 84 % (80 % portrait), follows dives and climbs with a dead
zone, and does not follow a fall. The horizon keeps a small vertical
parallax and never leaves the frame. Portrait phones see 620 world px
across; landscape at least 700.

## Play (`engine/`)

Pure and deterministic (fixed 1/120 s substeps, no randomness).

- **Figure** (`player.ts`): run 250 px/s; a standing jump is a hop, a
  running jump clears ~200 px; hold to jump full height. Crouch stops the
  figure. Pressing into a ledge within reach pulls the figure up onto it
  (the mantle), also out of water. Swimming: up strokes and rises, the
  surface floats, deeper water sinks. A hard landing costs 0.25 s.
- **Action**: without the gun, a kick that kills leeches. With it, as in
  the original: a tap fires, a hold (0.22 s) raises a shield of three
  hits, a longer hold (0.9 s) fires a beam that breaks shields and blast
  doors. The figure stands still while the gun is in use; crouched, it
  fires low (leeches). Every threat kills in one hit.
- **Threats** (`actors.ts`): tentacles rise 3.2 s after the figure first
  swims and take it at the waist; leeches crawl or hang and drop; the tide
  covers a low slab on a 4 s cycle; a rock drops ahead where grit
  trickles; the beast gains slowly on a clean run and fast on a stop;
  guards notice a figure standing on their floor within 380 px (never one
  mid-jump), raise shields, fire every 1.05–1.6 s, crouch to meet a
  crouching figure.
- **Deaths** are 0.9 s vignettes, then a hard cut back to the last lamp:
  the chapter is rebuilt as it was, minus what lay behind that lamp.
- **Chapters** (`levels.ts`) are data plus a small script each (the chase,
  the cage, the lift, the storm and dawn). `game.ts` strings them together
  with the cuts, the play clock and the save.

## Sound (`audio.ts`)

Silence by default; music is an event. Ambience beds per place (sea, night,
hall, storm, dawn), one-shots for every engine event, and four cues:
the prologue's arpeggio (cut off by the lightning), the chase, the
capture stab, the ending theme. The site radio is parked while the run's
own sound plays.

## Saves (`progress.ts`)

`{ chapter, checkpoint, hasGun, deaths, elapsed, savedAt }`, written on
every chapter, lamp and the gun, on pause, leave and a hidden tab: to
`localStorage['phareim.shore']` and to the pilot's profile slot
(`/api/save`, game `anotherworld`); newest write wins. A finished
crossing clears the slot and records the time; the best time is kept.
The Hangar shows CHAPTER n/5 and the play time, or the best finish.
