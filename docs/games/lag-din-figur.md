## Lag Din Figur — Ulrikke's figure maker (2026-09-26)

`?theme=figur`, cabinet eleven in the portal's arcade (the back corner,
beside Mini World). Ulrikke (7) asked for it: make a figure for any game,
free, no ads; draw how it looks and ask for help; figures for Minecraft,
Roblox, Toca Boca and Avatar World; make your own clothes and delete them
if you don't like them; some clothes to choose from at the start. Petter
added: the figure made here is the hero in Neon Shrine. The design, the
garment layouts and the code map are in `themes/figur/DESIGN.md`; this
file is how it works and how to check it. Norwegian throughout.

**One figure, four looks.** A figure is data (`Figure` in
`themes/figur/types.ts`): body, hair, face, and an outfit of six slots.
Four renderers (`render/minecraft.ts`, `roblox.ts`, `toca.ts`,
`avatar.ts`, listed in `render/styles.ts`) draw it in their own pixel
size and backdrop; the tabs above the stage switch instantly (or keys
1–4). A fifth game is one more renderer in `STYLES`. The art is our own:
no logos, no copied assets.

**Clothes are small pixel pictures.** Every garment, built-in or drawn,
is a texture in a fixed layout per kind (a front view with the arms
down; `LAYOUTS` in `types.ts`). The catalog generates the 44 built-in
pieces from a shape, two colours and a pattern (`core/garments.ts`,
`core/accessories.ts`); the child can recolour any of them. The drawing
board (TEGN, `ui/DrawBoard.vue`) edits a texture: pencil, eraser, fill,
mirror (on by default), undo, clear, 24 colours, a live preview; "TEGN PÅ
DENNE" starts from the worn piece. Drawn pieces sit first in their slot's
list with a trash can (JA/NEI first); deleting one takes it off every
figure. At most 40 drawn pieces of at most 16 colours each, so the save
fits its 32 KB slot.

**Pip helps.** The blue bird (the PIP tab, or the bird on the stage):
LAG EN FIGUR TIL MEG (a random figure whose colours go together), GI
MEG EN IDÉ (one of 19 themes: prinsesse, ninja, havfrue, astronaut, …),
HVORDAN TEGNER JEG KLÆR (three lines), and SKRIV HVA DU VIL HA: a text
field read by `core/helper.ts` (words in `core/words.ts`, the parser in
`core/reader.ts`) — "lilla hår og gul kjole og kattører" gives exactly
that, and Pip says what it did. ANGRE undoes Pip's last change. Nothing
leaves the device; there is no language model behind Pip.

**Minecraft for real.** On the Minecraft tab the save sheet also gives
MINECRAFT-SKIN: a 64 × 64 PNG in the 1.8+ skin layout
(`core/mcskin.ts`), with two lines on how to upload it. The Minecraft
look on screen is drawn from the same skin. Tall hats squash into the
skin's hat layer (a skin cannot reach above the head); capes and wings
show on screen but are not in the skin.

**Saves.** `composables/useFigur.ts` keeps `FigurSave` in localStorage
`figur.save` at once and in the profile slot `figur` (`SAVE_GAMES`,
32 KB) two seconds later; newest `savedAt` wins, the studio waits for the
profile's first answer (3 s, then plays on the local save and pushes
nothing until it answers), other tabs sync through the `storage` event,
and the first change makes the Hall of Fame player. Up to 8 figures; the
last one cannot be deleted. The Hangar shows N FIGURER · M KLÆR.

**Into Neon Shrine.** Once the child has changed anything, the active
figure's colours (`core/hero.ts`) go to localStorage `figur.heroColors`,
and Neon Shrine's hero wears them (skin, hair, the hat on the headband
row, the top's two most used colours, the trousers or the dress's skirt,
the shoes). They win over Mini World's `miniworld.heroColors`.

**Layout.** Phone portrait: title and three buttons (figures, save,
sound), style tabs, the stage, the tool panel, the tool tabs at the
bottom above the bottom band; bottom-right stays clear for the ⌂ chip.
From 800 px wide the stage is on the left and the tools on the right.
Nothing scrolls but lists inside panels. The theme is `ownRadio`: a
quiet studio with small Web Audio blips (`ui/sfx.ts`, a mute toggle).
Escape closes the open panel or board; with nothing open it goes to the
portal.

**Checks.** `npm run test:figur` (in CI): every garment's texture and
mask, packing, the drawing ops, figures and the save with its limits and
the 32 KB bound, Pip on ~20 real kid sentences, hero colours, every
style × hair × eyes × mouth × skin, every garment visible in every style,
the Minecraft skin's regions, the board's undo and layout math. Labs, run
as `flock /tmp/claude-1000/chrome.lock node …`:
`scripts/figur-lab/sheet.mjs` (lineup, themes, hair, faces, clothes,
skins, drawn pieces → `~/zshots/figur/`) and `scripts/figur-lab/studio.mjs
<url> mobile|desktop` (a whole flow through the real UI against a dev
server). In the dev server `window.__figur` exposes the state.

**Verified 2026-09-26** in headless Chromium at 375×667 and 1280×800:
all four styles, hair and body, a dress and its colours, drawing with
mirror, fill and undo, save and delete, Pip reading a sentence and
ANGRE, both downloads, Escape, a second figure; and Neon Shrine's hero in
the town wearing a figure Pip made. **Not yet:** a real iPad or phone
(touch drawing, the keyboard over Pip's text field), a downloaded skin
loaded into Minecraft itself, Ulrikke's verdict.
