# The Portal — design

phareim.no opens on a small neon town you walk around in, drawn with the
Neon Shrine engine and art. Petter's name is painted into the world. The
buildings lead to everything else on the site: an arcade hall with a cabinet
per game, Petter's own house (who he is, where to find him), and a kiosk and
signs for the public projects. It replaces the Player One theme (retired)
and the random first-visit theme.

One world (Petter, 2026-09-24): the town is the west end of Neon Shrine's
overworld, and a road east along the coast leads to the Keeper's hut, where
the adventure starts. Sword, items, pause menu and saves are the same
everywhere. Theme id `portal`; the page is `themes/portal/Landing.vue`, and
everything else (world data, engine, renderer, audio, the shell `Zelda.vue`)
is in `themes/zelda/`.

## Site behaviour

- `/` always shows the portal. `/?theme=<id>` shows a theme (deep link,
  parked themes included). The URL is the source of truth: the `theme`
  cookie and the random first pick are gone.
- There is no way from one game straight to another (2026-09-24): no
  arrows, swipes, chevrons or dots. You walk out and into the next cabinet.
- Leaving the portal for a game is a `router.push` to `/?theme=<id>`, so the
  browser's back button returns to the portal.
- Back to the portal from a game: a home chip (⌂) bottom-right, Escape when
  the game is idle (a game's own Escape use wins), or the back button.
- Coming back, the hero stands where they left: in front of the cabinet or
  outside the door they used (sessionStorage `portal.return`).
- A reload or a new visit starts on the plaza, facing the name, carrying
  whatever the save holds. The arcade games open on their own title
  screens (that screen is the insert-coin moment and shows the controls).

### Contract between the pieces (`composables/useTheme.ts`)

```ts
const {
  activeTheme,      // 'portal' on '/', else the ?theme id
  isHome,           // computed: activeTheme === 'portal'
  launch,           // (id: string) => void — router.push('/?theme=id'); ignores the navigation lock
  goHome,           // () => void — router.push('/'); ignores the lock
} = useTheme()
```

`ThemeDefinition` gains `home?: true` (the portal's entry). A home theme is
never in `liveThemes` and shows no home chip.

## World (`themes/zelda/world/`)

The town is columns 0–39 of the overworld (`overworld.ts`, area
PHAREIM.NO) plus two rooms in `town.ts`. It has no enemies or hazards. A
visitor starts with nothing: no HUD, no swing (A only talks, reads and uses
exits), and nothing is saved until the Keeper's blade.

### The town — overworld columns 0–39, area PHAREIM.NO

A night town square on the neon coast, one screen and a bit in each
direction. At the start a phone (≈15×28 tiles) sees the name, the house and
the newsstand; a desktop (≈18×11) sees the name, the house and the end of
the arcade. `tests/portal-world.test.mjs` checks both.

- **Start**: just below Petter's door, facing up at the name. (A desktop
  view is only about 11 tiles tall, so the name has to sit within five rows
  of the hero; the plaza and fountain open out below.)
- **The name**: `PETTER HAREIM` as a scale-3 decal painted across the roof
  of Petter's house, with `PHAREIM.NO` smaller under it. The most visible
  thing on the first screen. Two rows of trees above keep it clear of the
  radio widget on phones.
- **North**: Petter's house, 15 wide, under the name (door → `home` interior).
- **West**: THE ARCADE, a big building with a neon marquee decal (door →
  `arcade` interior).
- **East**: a small grove where the Keeper's hut copy used to stand, with a
  sign pointing down to the coast road.
- **South**: the coast path: a small newsstand building (PHAREIM.MD decal)
  with the kiosk counter in front (exit `{ url: 'https://phareim.md' }`,
  lines saying it is Petter's writing), a signpost for GAMES.PHAREIM.NO
  (exit `{ url: 'https://games.phareim.no' }`), and a pier into the sea.
  East of the path, facing the newsstand across it (2026-09-25): the radio
  station, a 4×3 studio at columns 23–26, rows 23–25, with RADIO on the
  roof, a lit ON AIR box over a steel door and a lattice mast whose red
  light blinks slowly (look `studio`). The door (exit `radio`,
  `{ theme: 'radio' }`) says "RADIO PHAREIM. TEN PLACES ON ONE DIAL, AND
  THE MUSIC IS MADE UP AS IT PLAYS. / TUNE IN? PRESS {A}." A phone sees it
  from the start; a desktop finds it walking south, where the plaza sign
  and the coast-road sign point to it (`docs/games/radio.md`).
  The coast path runs on east out of town as the coast road: into Home
  Glade, down beside the Keeper's hut and into its front yard, where the
  Keeper tells the story to anyone arriving without the blade.
- Life: lamps, flowers, a fountain, the cat, a kid who explains the
  controls ("WALK UP TO A CABINET AND PRESS A"). No enemies.
- Signs with arrows where paths branch.

### `arcade` — interior, 17×11 (the whole hall fits one desktop screen)

- Cabinets side by side: four along the back wall beside the board, four
  on an island between two pillars, a carpet loop around them, a prize
  counter with a vendor, a snack table, plants and a house-rules sign.
  Each is a solid `M` tile with an `exit` of look `cabinet`, `art` = theme
  id, `side: 'down'`, one per game: Another Shore
  (`anotherworld`), Galaga, Breakout, R-Type, Space Invaders, Star Fox,
  OutRun, Tetris. Each has a label and two or three short lines: the game's
  pitch and "INSERT COIN? PRESS A." The lines are the only confirmation.
- The Hall of Fame board on the back wall: exit look `board` →
  `{ theme: 'leaderboard' }`.
- A door at the back labelled HANGAR: walkable exit → `{ theme: 'hangar' }`.
- The robot: welcome lines, then Neon Shrine hints as the quest goes on.
- The HIGH SCORES sign (a live top three) and a chest, both from the Night
  Market arcade, which was removed when the worlds joined.
- Door at the bottom → back to the plaza.

### `home` — interior, Petter's house, 15×10

- Half home, half workshop: a desk, shelves, a sofa facing the rug, an
  aquarium, plants, a framed print and a toy chest.
- An NPC `petter` (new look) who says the profile blurbs:
  "FATHER, HUSBAND, GEEK, ASPIRING GOOD GUY." / "HELP FOLKS. WRITE CODE.
  BUILD THINGS." and where he is.
- Three terminals (exit look `terminal`) for LINKEDIN
  (https://www.linkedin.com/in/phareim), GITHUB
  (https://github.com/phareim), BLUESKY (https://bsky.app/profile/phareim.no).
  No email address, on purpose (decided 2026-09-07).

## Engine additions (Neon Shrine's `engine/`)

The types are fixed in `themes/zelda/types.ts` (`ExitDef`, `ExitTarget`,
`ExitSpot`, `Decal`, `Spot.out`, `AreaIntro`, mode `exit`, event `exit`,
look `petter`, `createGame`'s `at`). Behaviour as documented there.
`World.peaceful` and the hut's THE WAY HOME door existed while the portal
was its own world; both went with the merge.

## Render additions (Neon Shrine's `render/`)

- Cabinets per `art`: a marquee with a tiny logo in the game's colours,
  a glowing screen that flickers, a light pool on the floor.
- Board, kiosk, terminal and studio looks (the studio: door, ON AIR box,
  mast with a slow red light).
- Decals: neon lettering with bloom and a faint flicker.
- The `petter` NPC.
- An exit's `label` floats over it while the hero is next to it, with the A
  key hint.
- No hearts/bits/items HUD until the hero has the blade.

## Page (`themes/portal/Landing.vue`)

The canvas fills the viewport. The ending panel (THE SUN SETS AT LAST) shows
over the world after the Sun Prism. A short hint fades in at the start and goes
after the first move ("ARROWS TO WALK · SPACE TO TALK" / "DRAG TO WALK · A TO
TALK"); it is skipped when the visitor comes back from an exit. A visually
hidden block carries the same content as real HTML for search engines and
screen readers: the h1 name, the blurbs, links to every live game
(`/?theme=<id>`), the projects and the contact links (their addresses read
from the world's exits). Tab reaches it (the shell leaves Tab alone until
the hero has an item to swap), and
it shows as a panel while a link has focus.

## What would make it redundant

A different front door for phareim.no. If the portal is replaced, point `/`
at the new landing in `useTheme`, and decide whether Neon Shrine gets its
own theme page back or the town's maps go.
