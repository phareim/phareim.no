## Night of the Dead Battery (built 2026-09-25/26)

A point-and-click adventure in the manner of LucasArts' *Day of the Tentacle*:
three friends in worn white rabbit suits (a costume party that turned out to
be a quiz night) break down in a storm outside Villa Voltvik. The house
splits them up — Kjell on the ground floor, Dag in the cellar, Espen in the
attic — and they have to work together, passing things by dumbwaiter, to
charge a car battery with lightning at midnight. Theme id `battery`, reached
from the ninth cabinet in the town's arcade. Petter asked for it on
2026-09-25 ("ridiculously ambitious… heavily inspired by the classic Day of
the Tentacle"); the bunny suits were his addition.

Story, cast, rooms, the full puzzle chart and the interface: 
`themes/battery/DESIGN.md`. How the parts fit (for anyone changing it):
`themes/battery/BUILD.md`.

**Playing.** The SCUMM panel under the scene: a sentence line, nine verbs,
the inventory and the three heroes' faces. Click a verb, then a thing (or
an item, then a thing: "Use oil with rusty socket"). A click with no verb
walks; a right-click (on touch: hold) does the thing's default verb. Click a
face to switch hero; GIVE an item to a face to send it by dumbwaiter; TALK
TO a face for a hint. Keys: G P U O L S C T Y for the verbs, 1 2 3 switch,
`.` skips a line, Space or P pauses, an Escape tap pauses and a 3 s hold
saves and quits to the title. A phone held upright zooms in (since
2026-09-26): the view is about 160 pixels wide, so the scene fills the
screen's width at a bigger scale and the camera scrolls more, over a thumb
panel anchored to the bottom and under the room's name. The dollhouse
cross-section that used to fill the top is parked in `render/header.ts`.

**Code.** `themes/battery/`: `engine/` is pure TypeScript (the sentence,
scripts as generators yielding commands, walking with A*, the layouts,
saves); `content/` is the game (heroes, items, shared flags, one file per
room, the story, hints, the list of sound names); `render/` paints on the
site's pixel stage (`themes/base/pixel/stage.ts`) — one painter per room,
one per NPC, the hero rig, item icons, the panel; `audio.ts` synthesises
the score (one theme, an arrangement per floor that crossfades on the bar
when you switch hero), the storm, every sound effect and the speech blips.
`Landing.vue` loads `Game.vue` as its own client-only chunk.

**Saves.** localStorage `phareim.battery` after every finished action, and
the player's profile slot (`/api/save`, game `battery`, at most every 20 s
and when the tab hides). The newest wins when the title screen loads. The
Hangar shows puzzles solved (n/22) and play time. Winning clears the slot
and records the best time.

**Checks.** `npm run test:battery` (in CI): the engine with a made-up house
(walking round furniture, sentences, doors, choices, the dumbwaiter,
layouts, saves); each floor's puzzles; the story (intro, every failed
midnight, the finale, hints); the audio against a fake Web Audio; and a
walkthrough that plays the whole game from a new game to the credits.
`scripts/battery-lab/shot.mjs` screenshots any room in any state in one
headless Chromium (run it under `flock /tmp/claude-1000/chrome.lock`).

**What would make it redundant.** Petter retiring it from the arcade: then
drop the cabinet in `themes/zelda/world/town.ts` (and its art in
`themes/zelda/render/exits.ts`), the registry entry, `SAVE_GAMES`, the
Hangar line and the CI step.
