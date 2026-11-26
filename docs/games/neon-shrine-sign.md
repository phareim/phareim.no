# Neon Shrine: Relight the Sign

Lumenby's realm system (it replaced dig & build on 2026-11-26). Every neon tube on the coast was dug out of this
hill; the hill sign spelling L U M E N B Y went dark letter by letter. Each letter has its own line of lumen gas from
a tap somewhere in town. Turn the glass tubes so the gas runs from the tap to the letter's socket with no end left
open, and the letter lights on the hill.

Code: `themes/zelda/world/tubes.ts` (the tiles as data), `engine/puzzles/tubes.ts` (the rules),
`engine/puzzles/info.ts` (sockets, boards), `render/puzzleTiles.ts` (the classic tubes, tap and socket, and the gas
in every view: `drawGas`), `render/iso/puzzleProps.ts` (the tap and socket in the round). Tests:
`tests/zelda-sign.test.mjs`. Other ideas weighed for Lumenby: `docs/worlds/mechanic-ideas.md`.

## The tiles

| Tile | What |
|---|---|
| `╵ ╶ ╷ ╴` | A capped end, open one way. Turns. |
| `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼` | Tubes, drawn as the box chars look. Turn a quarter clockwise a hit (a cross never changes). |
| `║ ═ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬` | The same, bolted down: they never turn (steel bracket, four rivets). |
| `Θ` | A lumen tap (stands): gas comes out into any tube that opens onto it. |
| `Λ` | A socket, the line up the hill (stands). Mark `{ t: 'socket', flag, letter? }`; unmarked: `tube:<map>:<tile>`. |

Tubes are walked over (they lie in a groove in the ground); the tap and the socket stand. A tube's arms are a mask
(north 1, east 2, south 4, west 8). A blade, the disc or A turns a tube: A the one in front, the blade only the one
straight ahead (a sweep over a board turns one, not three), the disc the first one past the tube under the hero's
own feet. A and the blade share the mirrors' 0.3 s rest. A on a tap or a socket says what it is.

## The rule

- A **board** is tubes, taps and sockets side by side (`PuzzleInfo.boards`, from the map as authored).
- The gas runs from each tap into any tube that opens onto it, and on along every pair of arms that meet.
- An arm that meets nothing that answers it (ground, a wall, a tube turned away, the map's edge) is an **open
  end**: the gas hisses out there (pink puffs).
- A socket the gas reaches through a line with **no open end anywhere in it** is fed: its flag is set for good
  (`q.lumenby.sign<n>`), the secret rings, and a line says which letter lit and how many are lit. Turning the
  line away again lets the gas fall short; the letter stays lit.
- `stepTubes` traces the gas again whenever the map's version changes. A tube the gas finds anew fills from where
  the gas was, at `GAS_SPEED` tubes a second (`GasState.tubes[].t0`); the picture runs it in.
- Lumenby's tubes turn the puzzle rules on there, but not the physical combat (`PuzzleInfo.physical` ignores
  tubes): no foe falls or drowns for them.

**Authoring.** A map's rows hold each board **solved**, so it reads as it plays. Loading the map
(`loadPuzzleTiles` → `scrambleTubes`) turns every turning tube of a board whose sockets are not all lit by a
quarter, a half or three quarters (a straight one by an odd number), the same way every time; if that left the
board solved it turns tubes on until it is not. A lit board loads as drawn, gas running. Nothing about the tubes is
saved but the sockets' flags: leaving the map puts an unsolved board back out of true.

## Lumenby's seven boards

| Letter | Where | Size | What it adds |
|---|---|---|---|
| L | east of the square, by the union hall | 3 turning | the idea: a bolted line with three tubes to turn |
| U | THE GROVE ROAD, by the prospector | 6 turning | a tee, and a cap to close its third arm |
| M | THE TRUCK YARD, on the sand | 13 turning | a bolted cross, two caps, a long way round |
| E | THE HILL SIGN's terrace, by the apprentice | 9 turning | a loop of two tees round a patch of turf (on raised ground) |
| N | THE PIT's floor | 12 turning | a full 4×3 grid: every tile a tube, every end closed |
| B | THE DEEP DRIFT, by the headframe | 18 turning | a 5×4 grid with two bolted tubes |
| Y | THE TOPS, east of the gully | 22 turning | a 6×4 grid round a bolted cross |

The hill sign's letters (`quarry_letter_<ch>_on`) light by the same flags, in order: L is `q.lumenby.sign1`, Y
`q.lumenby.sign7`. People: the sign at the foot of the hill, the apprentice (a line runs by the bench), NEON NILS in
the hall (lumen will not glow in a leaky line), GUNN (seven letters, seven lines). **All seven lit:** GUNN gives a
heart piece (`q.lumenby.sign.done`), the vending unit its last neon tonics (`lumenby.vended`).

## Looks and sound

- Classic: glass in a dark groove along each arm, a brass collar where it turns, a steel bracket where it is
  bolted, a brass plug on a capped end, laid over the floor beside it. On raised ground the tube stands with the
  terrace (earth under it, earth for its column's sides in the isometric view).
- The gas: a neon pink line with a white core along every arm it fills, a lens low over the ground, drawn with the
  shots in both views (lifted with the terrain in the isometric one); it lights the ground at night. Open ends puff.
- Tap: a squat steel tank, a pink gauge, a brass wheel. Socket: a steel riser with a glass bulb, dark until its
  letter is lit, bright while the gas reaches it.
- Sound: `tube` (a clink in the collar, the gas sighing along) for a turn; the secret jingle for a letter.
- Lab: `sign-town`, `sign-town-lit`, `sign-hill` (four letters lit; `DAY=night` for the glow), `sign-tops` in
  `scripts/zelda-lab/shot.mjs` (`VIEW=iso`).
