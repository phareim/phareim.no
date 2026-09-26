## The Wildwood — Neon Shrine's second act (built 2026-09-24)

West of the town, along the shore, lies the Wildwood: a deeper forest with
Project Horizon's two labs underneath it (Zelda meets Stranger Things). It
sits in the middle of the quest, between the bomb bag and the Shrine: static
vines from the lab's Gate have grown over the Graves road to the Shrine, and
they only wither once the Gate is shut. Story, world and engine rules for the
whole game: `themes/zelda/DESIGN.md`; the rest of the game:
`docs/games/neon-shrine.md`.

**Story.** Project Horizon listened to the static between radio stations,
found that it was a place (the Other Side), and built a Gate to it. The
Static King came through, the lab went dark, and its test subject, a girl
called Luna who moves things with her mind, ran into the brambles. She joins
the hero for a waffle and wants the Gate shut.

**Getting in.** The town's west road (overworld columns 0–3, rows 26–27)
ends in a thicket: cut the bushes with the blade and walk off the edge (a
warp). A little way in, two cracked boulders on the trail need a bomb
(Petter's wish: sword first, then bombs, the classic Zelda gate).

### Maps (`themes/zelda/world/`)

| File | What |
|---|---|
| `wildwood.ts` | The overworld, 84×52, `look: 'wild'` (darker grass, violet crowns, fireflies). Areas: WILDWOOD SHORE (Mossa's cottage, the entry), THE CAMP (Toby, Max, tents, campfire), HORIZON LAB (the fenced compound), RADIO HILL (Dusty's tower), RIDDLE GROVE (the owl and letter stones), THE BRAMBLES (Luna's fort), TROLL BRIDGE, and past the ravine THE DEEP WOODS (the `static` track and mood, hounds, the Deep Lab bunker). Laid out once by a script, then edited by hand |
| `lab1.ts` | HORIZON LAB, floors `lab1` and `lab1b` (3×3 rooms of 16×12 each), `keyring: 'lab1'`, crystal group `lab1` |
| `lab2.ts` | THE DEEP LAB, floors `deep1` and `deep2` (THE OTHER SIDE), `keyring: 'deep'`, crystal group `deep` |
| `interiors.ts` | `mossa` (Mossa's cottage) and `radio` (Dusty's tower) |
| `luna.ts` | What Luna says when you face her and press A (where the quest stands, no tactics; only when no foe is near) |
| `cells.ts` | `joinCells`: dungeons written room by room |

### The route

1. **Mossa** (cottage by the entry) gives a waffle and asks for three glowshrooms.
2. **Boulders** on the trail: bomb them. **Max** at the camp gives five bombs.
3. **Luna**: cut into the bramble ring west of camp, give her the waffle; she follows. Walk her back
   to her fort and she sits down and waits; talk to her there and she comes along again.
4. **Horizon Lab** (north of camp): Luna slides the psi block off the door (it stays moved). Inside:
   security (clear it, key 1) → stairwell switch to cyan (every floor's crystals change) → B1: the pink
   blocks are down, key 1 opens the breaker room → throw the **breaker** (`lab1.power`: dark rooms light,
   the lobby shutter opens) and take Dusty's **tube** → hub → psi room: slide the block east, then north
   onto the plate → **LLAMA** (reflect its spit) → **grappling hook** → drop down the hub's shaft to B1,
   clear it (key 2, the shutter opens back to the breaker room) → key 2 opens the dorms (Toby's
   **walkie-talkie** behind cyan blocks: switch back to pink) → coolant vault: hook to the island post,
   to the pillar, the **big key**, hook back → **MISTRAL** (hook it while it breathes in, then strike) →
   heart container; Luna says the lift in the Deep Woods runs now.
5. **The ravine**: hook from post to post (rows 18 and 37 both ways). The troll's **hat** lies on the far rim.
6. **The Deep Lab** (bunker, gated by `mistral`): **Room Eleven** (Luna's cell; the wall of Christmas
   lights blinks D-U-S-K; key 1) → the hall's letter floor: walk D, U, S, K → the vault: the **Arc Blade**
   → coolant room (hook over, hook down) → **DEEPSEEK** (key 2) → key 1 opens the chute: slide the block
   east, then north into the hole; it lands on a plate one floor down → crystal relay to cyan → cut the
   vines over the stairs → deep2: the block has opened the cage round the **big key** → the static hall's
   pink blocks are down (cyan), key 2, big key → **GEMINI** → heart container, Luna shuts the Gate
   (`gateShut`) → the lift goes straight up to the Deep Woods.
7. Back east: the vines in the Hollow Graves are gone; the Shrine as before.

### Residents: they ask, and they give

| Who | Asks for | Gives |
|---|---|---|
| Mossa | three glowshrooms: beach rock ring (lift a rock), behind Radio Hill's cracked rock (bomb), Deep Woods clearing (hook) | a waffle; a heart piece |
| Toby | his walkie-talkie (Horizon dorms) | 50 bits |
| Max | nothing | five bombs, chatter |
| Dusty | a vacuum tube (Horizon B1) | a heart piece, and the numbers station's hint about the lights |
| The troll | his hat (far rim of the ravine) | the big bomb bag (20) |
| The owl | the answers ECHO and STEPS, walked on the letter stones | two heart pieces (chests appear) |

### Bosses (named after other language models)

| Boss | Where | Rule |
|---|---|---|
| LLAMA | Horizon Lab, miniboss | Wool turns every blade and the hook; its own spit knocked back with the sword hurts it, as do bombs. 10 HP, spits three at a time below half |
| MISTRAL | Horizon Lab, boss | Floats out of reach and blows gusts that shove the hero onto the electric floor; the hook drags it down only while it breathes in or blows, then any blow lands. 12 HP |
| DEEPSEEK | Deep Lab, miniboss | Swims under the floor towards the hero and surfaces to bite; the hook hauls it up (3 s), three blows and it dives again. 8 HP |
| GEMINI | Deep Lab, boss | Twins orbiting the Gate, joined by a tether that burns; a twin brought to zero falls down and gets up with 4 HP after four seconds unless the other falls too. 8 HP each |

Hit rules: `engine/combat.ts` (`bossRules`); brains: `engine/bosses.ts`.

### What the engine gained

- **The hook** (`engine/hook.ts`): B, straight along the facing, 8 tiles; bites `|` posts, pillars,
  lamps and chests and reels the hero over pits and water; stuns what it strikes, drags loot back,
  throws levers, flips crystals; never leaves the camera room.
- **The Arc Blade**: 2 damage (spin 3), longer reach, a beam at full hearts, cuts static vines `l`.
- **Luna** (`engine/luna.ts`): follows on the hero's trail; A at a psi block `B` makes her slide it
  until something stops it (into a hole with a floor below: it drops and lands there for good).
  Back within 2.2 tiles of where she joined (her fort), after the hero has been 3.5 tiles away, she
  sits down there (flag `luna.home`, an NPC again); her talk branch with `clear` ends it. A psi block
  without her says where she waits. `TalkBranch.clear` and `Cond { flags, not }` came with this.
- **Letter stones** `{` and `MapDef.codes`; **levers** `}`; **crystal groups** (`MapDef.crystal`,
  one state in a flag across floors); **holes** (`MapDef.below`); **keyrings** (`MapDef.keyring`,
  each dungeon its own small and big keys); **room events** (`CellDef.events`: boss names, Luna's
  lines, the Gate shutting); **dark rooms lit by a flag** (`CellDef.lit`); **props** (renderer-only
  set dressing); NPCs that leave or join (`hide`, `join`).
- Old saves still load: missing inventory fields get their defaults (`parseSave`).

### Checks (2026-09-24)

`npm run test:zelda` runs `tests/wildwood.test.mjs` next to the engine and audio tests (41 green, 2026-09-24):
the hook, Luna and her blocks, Luna waiting at her fort, the letter stones, crystal groups across floors, holes, keyrings, each
boss's rule, an old save, and a **full scripted run** from the town's thicket to the Gate shutting
(`tests/zelda-walk.mjs` is the shared walker). Boss fights were also played by simple scripted bots
without god mode (all four won). Renders: `node scripts/zelda-lab/shot.mjs ~/zshots/<dir> w-camp,l-psi,d-gemini`
(scenes `w-*`, `l-*`, `d-*`, `i-*`). Headless play in the dev server: into the Wildwood through the
thicket and Mossa's waffle, no page errors. **Not yet:** a person playing it through, on a phone.
