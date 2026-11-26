# Codex-drawn art for Neon Shrine's iso view

Petter's rule (2026-11-25): «Alt vi legger ut skal ha en håndtegnet piksel-art følelse, og det får vi så lenge det
tegnes med codex. Vi tåler veldig godt å bruke mange farger.» Everything that ships is drawn by Codex (`image_gen`). A
3D render or a solids guide is only a guide for angle, form and size. Keep what makes a thing recognisable, and never
limit the number of colours.

This folder holds the tools that turn a realm kit's solids (`themes/zelda/render/iso/frontierArt/<kit>.ts`) into
Codex-drawn pixel art, packed into the kit's data file (`<kit>Data.ts`). Each drawn pixel gets the normal and depth
of the guide pixel at the same place, so the engine lights and sorts the drawing as it did the solids.
`things/` holds the Part 23 tools for `render/iso/thingArt.ts` (how they were used: `git log` of thingArt.ts, 2026-11-25).

Everything is relative to the repo. The work goes to `tmp/codex-kits/<kit>/` (git-ignored; `CODEX_WORK` moves the
root): `guides/`, `sheets/<sheet>/{guide.png,cells.json,prompt.txt,refs.json,raw/,cut/}`, `build/`.

Requirements: `npm ci` (esbuild), Python 3 with numpy, pillow and scipy (a venv anywhere, e.g. `tmp/world-art/venv`),
the `codex` CLI (logged in).

## The steps

```sh
K=seter                                   # the kit's module name in frontierArt/ (seter, meadow, fjord, gates, ...)
node scripts/zelda-lab/codex/kit-guides.mjs $K               # 1. guides from the kit's own solids
python scripts/zelda-lab/codex/sheet.py $K                   # 2. sheets + prompts from plans/$K.py
bash scripts/zelda-lab/codex/drawall.sh $K 1 hut byre ...    # 3. Codex draws (try 1), at most 4 at once
S=tmp/codex-kits/$K/sheets/hut
python scripts/zelda-lab/codex/cut2.py $S/raw/out-1.png $S/cells.json $S/cut [pitch]   # 4. cut at the drawing's grid
python scripts/zelda-lab/codex/parity.py $S/cut/*.png                                  #    and check it
python scripts/zelda-lab/codex/kitbuild.py $K seter_hut_0 hut [--cut $S/cut] [--edit ...]  # 5. one piece, fitted
python scripts/zelda-lab/codex/kitlineup.py $K tmp/world-art/lineup.png                # 6. guide above drawing
node scripts/zelda-lab/codex/kit-bake.mjs $K [--drop id,...]  # 7. pack into frontierArt/${K}Data.ts
node scripts/zelda-lab/codex/kit-check.mjs [before-data-dir]  # 8. the kits whole, boxes kept, pairs right
```

### 1. Guides: `kit-guides.mjs <kit> [--only prefix,...] [--part id=name:from-to]`
The script imports the kit's `<KIT>_THINGS` builders the way `../frontier-art.mjs` does and rasterises each piece
with `rasterThing` (`render/iso/props.ts`). It then crops each piece exactly as the bake does, so every guide has the
piece's own `w, h, ax, ay`. Per piece it writes:
- `<id>.png`: the solids' flat stepped colours, hard alpha. This is the picture Codex draws over.
- `<id>.json`: per px, base64-encoded. `normal` is the atlas's rgb encoding: (right, up, toward the viewer) × 0.5 +
  0.5. `deep` is the depth byte (`depthCode`: 128 + 4 × how many px nearer than the anchor). `glow` is the solids'
  own glow. `mat` is the material name. `solid` is which solid call drew the px, in build order. The tool learns
  `mat` and `solid` by wrapping every pick: a pick is only asked about a nearer point, so the last ask at a px is
  what shows.
- `--part`: a guide of a piece built from only some of its solid calls, in the piece's box. The mill's tower without
  its sails is `meadow_mill_0=meadow_mill_tower:0-6`.

### 2. Sheets and prompts: `sheet.py <kit> [sheet ...]`
`plans/<kit>.py` lists the kit's sheets. Each sheet entry gives the image size, which must be one `image_gen` makes
(1536×1024, 1024×1536 or 1024×1024), the pitch, the key colour, the ids (left to right) and the words.
`plans/head.py` is the prompt they all share. Each guide is scaled up by the pitch (sheet px to an art px) and laid on
the key, bottoms aligned. The prompt gives each piece's size in art px and in sheet px. `REFS` are attached after
the guide: the realm's concept painting (`docs/worlds/img/concept-<realm>.jpg`, the identity and the mood) and
`style.png` (the target pixel style: figures already redrawn). A sheet may name its own `refs` (the gates: each
realm's concept), and a `guide` map (id → another guide png of the same box, e.g. the lighthouse beam guides).

- **The key.** The key is the flat colour around the objects. Pure green `#00FF00` is the default. Kits full of
  grass and moss use pure magenta `#FF00FF` (`key='magenta'`): a green key also takes summer greens such as #3a8a2a.
  `kitlib.keyed` finds the key and `keyish` finds its fringe. The prompt forbids the key colour inside the objects.
- **The pitch.** Codex draws at about 10 sheet px per art px. Guide small pieces larger: at pitch 10 a 12-px
  haystack gets too few art px, so the small sheets here use pitch 13–20. A sheet cannot exceed the image size, so
  a big piece may need a pitch under 10: the 114×122 arch went on a 1024×1536 sheet at 8.5.

### 3. Drawing: `draw.sh <kit> <sheet> [try]` · `drawall.sh <kit> <try> <sheet>...`
Each call runs in a fresh temp dir outside any repo, so Codex never reads the repo's AGENTS.md or wanders into it:

```sh
cd "$(mktemp -d)" && codex exec --skip-git-repo-check --sandbox workspace-write \
  -i guide.png -i concept.png -i style.png - < prompt.txt      # -> out.png (codex.sh)
```

Run at most 4 at once (`drawall.sh` uses `xargs -P 4`). A call takes 60–120 s. The result goes to
`raw/out-<try>.png` and the log to `raw/codex-<try>.log`. `PROMPT=<file>` overrides the sheet's prompt.

### 4. The cut: `cut2.py <png> <cells.json> <outdir> [pitch]`
Without a pitch, the cut searches 0.8–1.25 × the nominal pitch for the sheet's own grid: the pitch whose 3×3
block-centre samples are flattest on the biggest cell. It then picks a grid phase per cell and takes each block's
median colour, with hard alpha. `cut.json` records the pitch and, per cell, where its art-px grid starts (`gx, gy`,
in guide px from the cell's corner).

- **The pitch search and "drawn too small".** Codex nearly always keeps the guide's size on the sheet but often draws
  on a grid of its own. On this job: the hut at 9.75 against 10, the big troll 10.65, the arch 10.55 against 8.5, the
  haystacks 19.8 against 16. At the found pitch, a drawing on a coarser grid comes out with fewer art px than the
  guide: smaller in the game. Take the found pitch and the cell's w×h. If w × found ÷ guide w is near the nominal
  pitch (as it was every time here), Codex drew the right size on a coarser grid. Cut again at the nominal pitch
  (`cut2.py … <nominal>`) and the piece comes out at the guide's size, with a px doubled now and then. If that ratio
  is itself off the nominal pitch, Codex drew the thing too small or too large: redraw.
- **Parity** (`parity.py`): for each cut it gives the share of colour edges on one parity of x and of y. Read 0.50
  as single-scale px. 0.50–0.61 is what shipped (Part 23 and here: every shipped cut 0.50–0.59). 0.7 or above means
  2×2 blocks: the cut pitch is half the drawing's grid. Re-cut at the found pitch, or redraw.

### 5. One piece: `kitbuild.py <kit> <id> <sheet> [options]`
The build first takes off the key's fringe (twice) and drops lone px. It places the drawing in the piece's box where
the sheet's grid puts it (`--nudge dx,dy` moves it), and crops or pads it to the guide's exact `w, h, ax, ay`.
`<id>.fit.json` reports the fit: `cover` (the share of the guide's silhouette the drawing covers), `outside` and
`cropped`.

- **The per-px normal/depth rule.** Every drawn px gets the guide's normal and depth byte at the same px. Where the
  drawing reaches past the guide's silhouette, it gets the nearest guide px's normal, and that px's depth carried
  along the row difference: q + (y − y_nearest), the same height one row nearer. `--geo <id>` takes the normals and
  depth from another guide of the same box (a breath frame keeps the sleeper's own).
- **Colours.** A colour within 15/255 of a more common one becomes that one: that is image noise, not artistic
  intent (`--tol`). Colours are never capped (16–295 a piece here).
- **Glow.** Glow goes only on px that are light: a lit window, a lantern, a rune. It never goes on paint. A lit px
  gets a palette letter of its own.
- **Frame variants** (`--from <cell>` builds another id from a cell's drawing; `--edit` takes several joined by `+`):
  - `lamp:<mats> --within <mats>`: the drawing's glass px (blue above red) in the box around each cluster of the
    guide's `<mats>` become lamplight, gold to white by their own lightness, and glow. This makes night windows
    (`--within glassRose`, the night guide's rim) and lit lanterns (`--within core,gold --minlum 60`).
    Filters on the drawn px: `--blue n` (blue above red + n), `--glass warm` (warm px: glass Codex drew already
    lit), `--minlum`/`--maxlum` (0–255; the fjord cottage's night needed `--blue 25 --maxlum 120`, or the snow lit
    up). `--hot <mats>` burns the px over the guide's `<mats>` white-gold (a lighthouse lens frame's lit side).
  - `glow:<mats> --within <mats> --minsat s`: the same mask, but the px keep their drawn colours and only glow (a rune,
    a mirror block's line).
  - `dark:<mats> --within <mats>`: the same mask put out: glass darkened, nothing glows (a lantern out). When the
    target's own guide has no lamp, the drawing's guide gives the boxes.
  - `drift:dx,dy`: the drawn smoke (px nearest the cell guide's `rock` puffs; `--smoke-mat`) moves a few px (a smoke
    frame).
  - `breath:<row>`: everything above `<row>` sinks one px (a sleeping troll's breath).
- **More light by colour: `--glows "<spec>;<spec>..."`** (round 2). Each spec is one mask, unioned into the light;
  keys joined by `,`, material lists by `/`:
  - where: `within=<mats>` (the box round each cluster of the target guide's mats, grown by `grow=n`; the cell
    guide's if the target has none), or `within=<mats>,near=n` (those px themselves grown n px: a winding vein,
    not its bounding box); no `within`: the whole box.
  - which drawn px: `glass=any|warm|cyan|pink|rose|teal|ochre|violet|red|blue` (cyan/pink: a glowing gill or spot;
    rose/teal/ochre: an unlit rose-grey tube, grey-teal glass, ochre paper lantern, drawn so on purpose; violet: a
    vein; red: a red lamp), `minlum`/`maxlum` (0–255), `minsat`/`maxsat` (0–1), `minarea=n` (lit clusters under n
    px are specks and stay unlit).
  - what happens: they glow as drawn; `lamp=1` turns them to lamplight; `tint=pink|cyan|neon|violet` gives them that
    light's ramp by their own lightness (a calm grazer's eyes turned angry, a tube lit); `halo=1` (with a ramp)
    lights the px beside them at 60 % (a neon tube's halo); `dark=1` puts them out instead.
  - The pattern for off/on and day/night pairs: draw the piece ONCE, unlit, with each light part in a dull colour of
    its own named in the prompt (`plans/quarry.py` LETTER, `plans/gates.py` ROSE/TEAL), and build `_on` with
    `--from <off> --glows ...`. The pair is the same drawing, so nothing jumps at dusk. Round 2's commands:
    `tmp/art2/build-{sporelight,quarry,gates,beam}.sh` (Mac job, git-ignored; the specs are copied in the report).
- **The lighthouse beam: `kitbeam.py guide|build`.** The beam frames' guide is the baked, drawn lens tower placed in
  each frame's box with the solids' beam as one flat cream cone (`guide` writes `guides/fjord_lighthouse_beam_<k>.png`;
  `plans/fjord.py` `beam0..3` use them through a sheet's `guide` map). Codex draws the beam over it; `kitbuild.py`
  places the drawing; `kitbeam.py build` keeps the baked tower's own px (colours, glow, normals, depth) and takes
  only Codex's beam px around it (inside the cone grown 3 px), every beam px glowing.
- **Turning parts:** `kitturn.py <kit> <base> <bare> <frames> <from-to:hub> <deg>`. The mill is ONE drawing: the mill
  with its sails, plus the same mill drawn bare (from a `--part` guide) on the same sheet. The tool finds the sails
  where the two drawings differ near the guide's sails. It turns them about the hub in their own plane (a south-
  facing plane: x = sx + c, z = (x + c)/2 − sy) by `<deg>` per frame, over the bare drawing, with the hub on top.
  All frames share one normal and depth map: the sail plane wherever any frame has sail. The kit data stores that
  map in every frame rather than as `like`. The kit's `withThings` and `tests/zelda-things.test.mjs` read each kit
  record's own `nrows` and `deep`, and `paintThing` resolves `like` only in `THING_ART`.

### Round 3 (2026-11-26): roadside, rerun, fogstage, underglow, coast, landing, stillsand and the gold pyramid
Build commands: `tmp/art3/build-<kit>.sh` (Mac job, git-ignored; copied in its report). New here:
- `--glows box=x0/y0/x1/y1`: a mask by an explicit rectangle of the target's px, for a lamp Codex added that no guide
  material marks (the RAINCHECK blimp's red belly lamp, the lift head's lamp). New ramps `rose` and `red`; the ramps now
  live in `kitlib.RAMPS`.
- `kit-guides.mjs --part id=name:a-b+c-d`: a part from several ranges of solid calls (the lift head without its wheel).
- `kitturn.py`: PLANE=east (a part in a plane facing the viewer's lower right), PLANE=screen (a part Codex drew facing
  the viewer), HUB=x,y, NEAR/DIFF; the drawings' glow travels into the frames. The Underglow lift's turn was tried and
  held back: the two drawings differ round the jib and the turned frames smeared.
- `kitspin.py <kit> <from> <to> <deg|mirror>`: a flat round thing's second frame from one drawing: turned in the
  ground plane ring by ring, or mirrored about its anchor (the Sun Below: turning mixed the drawn shading, the mirror
  moves the rays and keeps the light).
- `kitscale.py <kit> <sheet> <f>`: a piece too big for one image at the game's px (the gold pyramid, 416x305) is drawn on
  its guide shrunk by f (`guide` map in the plan: `stillsand_pyramid_half`, f = 2), cut, then made ready for kitbuild.py
  at full size (`<sheet>x<f>`, every art px f x f game px).
- `kittext.py <kit> <id> <mats> <ramp>`: if Codex misspells a sign, lay the guide's letters again as neon on the drawn
  board. Not needed in round 3: every word came out right (CAMP, OPEN, INN, PHONE, THE END, RAINCHECK, the six land
  names, BORDER).
- `kit-check.mjs`: boxes of all 13 kits against before-data (new ids allowed: `stillsand_pyramid`), the road lanterns'
  off/on, Rerun's houses by night, the waymarks' blink frames.
- Lab scenes: `kit-roadside`, `kit-rerun`, `kit-fogstage`, `kit-underglow`, `kit-coast`, `kit-landing` (seterfell stub,
  the kit named in the map's `kits`).

### 7. The bake: `kit-bake.mjs <kit> [--build dir] [--only ids] [--drop ids] [--check]`
Every `build/<id>.json` whose id the kit has replaces that id's record. Every other record stays as it is. The data
file is packed as `frontier-art.mjs` packs it: gzip + base64 of the JSON of ThingArt records (`rows/pal/glow/nrows/
npal/deep/w/h/ax/ay`), read by `packed.ts` `unpackArt`, with the same export name. The bake refuses a drawing whose
box is not the solids' box: night/day and off/on pairs are boxed by their solids, so the pairs keep one box.
`--drop` puts a held-back piece back to its solids. A drawn record carries `drawn` (where it came from), and
`../frontier-art.mjs` keeps drawn records when it re-bakes a kit's solids (`--solids` forces a full re-bake). The
kit's source `.ts` (the solids) stays: it is the guide. For `gates` only the ids in `build/` change (the seterfell
pair here).

### 8. Checks
- `kit-check.mjs [tmp/world-art/before-data]` runs the realm-kit checks of `tests/zelda-things.test.mjs` without the
  generated world. It checks that every record is whole, that each kit's atlas is at most 2048 px tall, that every id
  keeps its box against the data files as they were (seter, meadow, gates, fjord, sporelight, quarry, stillsand), that night/day and off/on pairs keep one box with glow only
  when lit, that the mill's frames differ, that the lighthouse's four beam frames each glow and differ, that the bathhouse
  is brighter at night than by day, that each angry grazer frame differs from its calm one in the same box, and that
  each hill letter's on frame glows more than its off (a drawn off letter not at all).
- In the game: `scripts/zelda-lab/shot.mjs` scenes `kit-seterfell` and `kit-meadow` stand every piece in rows on the
  `seterfell` stub with the hero by them; `kit-yulefjord` on `yulefjord`; `kit-sporelight` on the `sporelight` land,
  `kit-lumenby` (the quarry kit, letters lit after dusk) and `kit-gates` (the five other realms' arches, lit after
  dusk; the scene names their kits in the map's `kits`, since a land only fetches its own realm's arch) on `lumenby`. Run with `VIEW=iso`, with and without `DAY=noon`, `-1280`/`-390`.
- `node scripts/zelda-lab/frontier-art.mjs <kit> sheet.html` is the contact sheet (drawn pieces as drawn).

## Holding back
A piece that reads as something else does not ship. Leave it out of `build/` (or `kit-bake.mjs --drop <id>`): it
keeps its solids. Look at it at 1×, in the game, too. On this job the first haystacks' rope bands read as mouths at
game scale. They were redrawn without the band and shipped.

## Files
| File | What it does |
|---|---|
| `kitlib.py` | paths (repo root from this folder), work dirs, plans, guides, the key, `record()` (palette, glow, normals → a ThingArt record) |
| `kit-guides.mjs` | guides from a kit's solids (1) |
| `plans/head.py`, `plans/<kit>.py` (seter, meadow, fjord, gates, sporelight, quarry, roadside, rerun, fogstage, underglow, coast, landing, stillsand) | the shared prompt; each kit's sheets and words |
| `sheet.py` | sheets, prompts, references (2) |
| `codex.sh`, `draw.sh`, `drawall.sh` | one Codex call; a sheet's drawing in a temp dir; ≤ 4 at once (3) |
| `cut2.py`, `parity.py` | the cut at the drawing's grid; edge parity (4) |
| `kitbuild.py`, `kitturn.py`, `kitlineup.py` | a piece fitted, frame variants (`--edit`, `--glows`); turning parts; guide-over-drawing sheet (5, 6) |
| `kitbeam.py` | the lighthouse's beam frames over the drawn lens tower |
| `kitspin.py`, `kitscale.py`, `kittext.py` | a flat thing's turned/mirrored frame; a sheet drawn on a shrunk guide; a sign's words laid again (round 3) |
| `kit-bake.mjs`, `kit-check.mjs` | into `<kit>Data.ts`; the kit checks (7, 8) |
| `style.png` | the target pixel style (figures from Part 22) |
| `things/` | Part 23's tools for `thingArt.ts`: `things.py`+`solids.py` (ray-cast guides), `sheet_things.py`, `prompts_things.py`, `build.py`, `composite.py`, `align.py`, `emit.py`, `archive.py`, `lineup.py`, `classic.py`, `dump.mjs`, `dumpsolids.py`; work dir `tmp/codex-kits/things` |
| `shots.sh`, `webkit.mjs`, `same.py` | Part 23's stills, WebKit check (`PLAYWRIGHT_DIR`), still-for-still diff |
