# The Portal — design

phareim.no opens on a small neon town you walk around in, drawn with the
Neon Shrine engine and art. Petter's name is painted into the world. The
buildings lead to everything else on the site: an arcade hall with a cabinet
per game, the Keeper's hut that drops you into Neon Shrine, Petter's own
house (who he is, where to find him), and a kiosk and signs for the public
projects. It replaces the Player One theme (retired) and the random
first-visit theme.

Theme id `portal`. Engine, renderer and audio are Neon Shrine's
(`themes/zelda/`); the portal brings its own world data and Vue shell.

## Site behaviour

- `/` always shows the portal. `/?theme=<id>` shows a theme (deep link,
  parked themes included). The URL is the source of truth: the `theme`
  cookie and the random first pick are gone.
- The portal is not in the swipe rotation and has no pager. Inside a game,
  swiping/arrows walk the games as before, with `router.replace` so history
  does not fill up.
- Leaving the portal for a game is a `router.push` to `/?theme=<id>`, so the
  browser's back button returns to the portal.
- Back to the portal from a game: a home chip (⌂) in the pager, Escape when
  the game is idle (a game's own Escape use wins), or the back button.
- Coming back, the hero stands where they left: in front of the cabinet or
  outside the door they used (sessionStorage `portal.return`).
- Neon Shrine entered from the portal skips its title: it continues the save
  if there is one, otherwise it starts a new game with the hero stepping out
  of the Keeper's hut door. The arcade games open on their own title
  screens (that screen is the insert-coin moment and shows the controls).

### Contract between the pieces (`composables/useTheme.ts`)

```ts
const {
  activeTheme,      // 'portal' on '/', else the ?theme id
  isHome,           // computed: activeTheme === 'portal'
  launch,           // (id: string) => void — router.push('/?theme=id'); ignores the navigation lock; records portalLaunch
  goHome,           // () => void — router.push('/'); ignores the lock
  portalLaunch,     // useState<{ theme: string; at: number } | null>('portalLaunch') — set by launch(), read (and cleared) by the target
} = useTheme()
```

`ThemeDefinition` gains `home?: true` (the portal's entry). A home theme is
never in `themes` (the rotation), never picked by `setTheme`, and hides the
pager.

## World (`themes/portal/world/`)

Three maps, same format as Neon Shrine's (`themes/zelda/types.ts`), with
`peaceful: true` on the World: no HUD hearts/bits/items, no enemies, the hero
cannot be hurt and has no sword (A only talks, reads and uses exits).

### `plaza` — overworld, about 40×30, area name PHAREIM.NO

A night town square on the neon coast, one screen and a bit in each
direction, so a phone sees the name and at least two buildings at start.

- **Start**: centre of the plaza, facing up at the name.
- **The name**: `PETTER HAREIM` as a scale-3 decal on a billboard/arch
  across the north, with `PHAREIM.NO` smaller under it. The most visible
  thing on the first screen.
- **North**: Petter's house under the billboard (door → `home` interior).
- **West**: THE ARCADE, a big building with a neon marquee decal (door →
  `arcade` interior).
- **East**: a copy of the Keeper's hut, with a sign NEON SHRINE — AN
  ADVENTURE. Its door is an exit to `{ theme: 'zelda' }`.
- **South**: the coast path: a newsstand kiosk for PHAREIM.MD (exit
  `{ url: 'https://phareim.md' }`, lines saying it is Petter's writing) and a
  signpost for GAMES.PHAREIM.NO (exit `{ url: 'https://games.phareim.no' }`).
- Life: lamps, flowers, a fountain, the cat, a kid who explains the
  controls ("WALK UP TO A CABINET AND PRESS A"). No enemies.
- Signs with arrows where paths branch.

### `arcade` — interior, about 20×14

- Two rows of cabinets (solid `M` tiles with an `exit` of look `cabinet`,
  `art` = theme id, `side: 'down'`), one per game: Another Shore
  (`anotherworld`), Galaga, Breakout, R-Type, Space Invaders, Star Fox,
  OutRun, Tetris. Each has a label and two or three short lines: the game's
  pitch and "INSERT COIN? PRESS A." The lines are the only confirmation.
- The Hall of Fame board on the back wall: exit look `board` →
  `{ theme: 'leaderboard' }`.
- A door at the back labelled HANGAR: walkable exit → `{ theme: 'hangar' }`.
- The robot NPC from Neon Shrine's arcade, with portal lines.
- Door at the bottom → back to the plaza.

### `home` — interior, Petter's house, about 14×10

- An NPC `petter` (new look) who says the profile blurbs:
  "FATHER, HUSBAND, GEEK, ASPIRING GOOD GUY." / "HELP FOLKS. WRITE CODE.
  BUILD THINGS." and where he is.
- Three terminals (exit look `terminal`) for LINKEDIN
  (https://www.linkedin.com/in/phareim), GITHUB
  (https://github.com/phareim), BLUESKY (https://bsky.app/profile/phareim.no).
  No email address, on purpose (decided 2026-09-07).

## Engine additions (Neon Shrine's `engine/`)

The types are fixed in `themes/zelda/types.ts` (`ExitDef`, `ExitTarget`,
`ExitSpot`, `Decal`, `World.peaceful`, `Spot.out`, mode `exit`, event `exit`,
look `petter`). Behaviour as documented there. Neon Shrine gets two things
from it: the Keeper's hut has a door and an interior; a new game starts with
the hero stepping out of that door; inside the hut a back door is an exit
`{ home: true }` labelled THE WAY HOME.

## Render additions (Neon Shrine's `render/`)

- Cabinets per `art`: a marquee with a tiny logo in the game's colours,
  a glowing screen that flickers, a light pool on the floor.
- Board, kiosk, terminal looks.
- Decals: neon lettering with bloom and a faint flicker.
- The `petter` NPC.
- An exit's `label` floats over it while the hero is next to it, with the A
  key hint.
- `peaceful` worlds draw no hearts/bits/items HUD.

## Page (`themes/portal/Landing.vue`)

The canvas fills the viewport. A short hint fades in at the start and goes
after the first move ("ARROWS TO WALK · SPACE TO TALK" / "DRAG TO WALK · A TO
TALK"). A visually hidden block carries the same content as real HTML for
search engines and screen readers: the h1 name, the blurbs, links to every
game (`/?theme=<id>`), the projects and the contact links.

## What would make it redundant

A different front door for phareim.no. If the portal is replaced, delete
`themes/portal/` and point `/` at the new landing in `useTheme`.
