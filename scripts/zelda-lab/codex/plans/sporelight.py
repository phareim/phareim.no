# Sporelight's kit (frontierArt/sporelight.ts -> the sporelight art pack): the giant caps (two colours, three sizes), the
# glow moss, the spore puffs (three frames), the spirits' bathhouse (its night is a lamp edit of the day drawing) and
# the grazer (two walk frames drawn calm; the angry frames are the same drawing with the eyes turned pink).
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-sporelight.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
FOREST = """A forest of giant glowing fungus at eternal dusk, as in concept.png: teal-indigo moss, violet stalks and shadows, caps lit cyan and rose from below."""
STALK = """The stalk: a thick pale violet-grey fungus stalk (#3a2e5a shade, #6a5a8e, #9a8ab8, #c8bce0 lit), slightly fibrous, a little flared at its foot, a frilly ring (annulus) just under the cap."""
TEAL = """Teal cap: a broad domed cap of deep teal (#0e3a48 shade, #16606a, #23907e, #4cc0a0, #8ae8c8 lit top), freckled with small round pale spots that glow cyan (#2ff3ff with a #e0ffff centre); its UNDERSIDE shows a band of fine radial gills glowing bright cyan (#0a8aa8, #2ff3ff, #c4fbff), the brightest light of the whole mushroom, a few drips of light hanging from the rim."""
VIOLET = """Violet cap: a broad domed cap of deep violet (#2a1450 shade, #4a2280, #6e34b0, #9a5ad8, #c890f0 lit top), freckled with small round pale spots that glow rose-pink (#ff5ab4 with a #ffe0f4 centre); its UNDERSIDE shows a band of fine radial gills glowing bright rose-pink (#a01a6a, #ff4aa8, #ffc4e8), the brightest light of the whole mushroom, a few drips of light hanging from the rim."""
NOGREEN = """Never pure green anywhere: moss is teal-blue (#0e3a40, #16605a, #2a8a7a)."""

SHEETS = {
 'capsbig': dict(size=(1536, 1024), pitch=10, ids=['sporelight_mushroom_large_teal', 'sporelight_mushroom_large_violet'], n='two objects',
   every='both mushrooms', what='two giant glowing mushrooms', names={'sporelight_mushroom_large_teal': 'teal mushroom', 'sporelight_mushroom_large_violet': 'violet mushroom'},
   desc=f"""{FOREST} Two giant mushrooms, the same shape: left with a teal cap, right with a violet cap.
{STALK}
{TEAL}
{VIOLET}
{NOGREEN}"""),
 'capsmid': dict(size=(1536, 1024), pitch=16, ids=['sporelight_mushroom_medium_teal', 'sporelight_mushroom_medium_violet'], n='two objects',
   every='both mushrooms', what='two glowing mushrooms', names={'sporelight_mushroom_medium_teal': 'teal mushroom', 'sporelight_mushroom_medium_violet': 'violet mushroom'},
   desc=f"""{FOREST} Two mushrooms, the same shape: left with a teal cap, right with a violet cap. Big chunky pixels: keep the details few and bold.
{STALK}
{TEAL}
{VIOLET}
{NOGREEN}"""),
 'capssmall': dict(size=(1536, 1024), pitch=20, ids=['sporelight_mushroom_small_teal', 'sporelight_mushroom_small_violet', 'sporelight_glow_moss'], n='three objects',
   every='all three objects', what='two small glowing mushrooms and a clump of glowing moss',
   names={'sporelight_mushroom_small_teal': 'teal mushroom', 'sporelight_mushroom_small_violet': 'violet mushroom', 'sporelight_glow_moss': 'moss clump'},
   desc=f"""{FOREST} Very big chunky pixels: these are small objects in the game, keep the details few and bold.
Left and middle: two small mushrooms, the same shape: left with a teal cap, right with a violet cap.
{STALK}
{TEAL}
{VIOLET}
Right: a low clump of glow moss on the forest floor: a few soft rounded cushions of teal-blue moss (#0e3a40, #16605a, #2a8a7a, #4ab0a0 lit), with tiny bright cyan glowing bulbs (#2ff3ff, #e0ffff) on short stems sticking out of it.
{NOGREEN}"""),
 'puffs': dict(size=(1536, 1024), pitch=16, ids=['sporelight_puff_0', 'sporelight_puff_1', 'sporelight_puff_2'], n='three objects',
   every='all three puffs', what='three frames of a drifting puff of glowing spores (left: just burst, right: spreading out)',
   names={'sporelight_puff_0': 'first puff', 'sporelight_puff_1': 'second puff', 'sporelight_puff_2': 'third puff'},
   desc=f"""{FOREST} Three frames of one puff of glowing fungus spores rising and spreading out, left to right: each a loose cluster of small round soft-edged puffs of spore haze where the guide has its balls, in glowing cyan (#0a6a8a edge, #2ab8d8, #6ff0ff, #e0ffff) and rose-pink (#8a1a6a edge, #e04aa0, #ff8ad0, #ffe0f4), each puff with a brighter core and a darker edge, and a few single bright motes of light between them. Pixel-art puffs: clusters of flat colour, no blur, no soft gradient. No outline around the puffs."""),
 'bathhouse': dict(size=(1536, 1024), pitch=8, ids=['sporelight_bathhouse'], n='one object', every='the bathhouse',
   what="a Japanese-style spirits' bathhouse",
   desc=f"""{FOREST} The spirits' bathhouse, as the bathhouse in concept.png: a Japanese-style bathhouse (sento/onsen inn) of dark red-brown timber (#2a1410, #4a2418, #6a3420, #8a4a2c lit) in courses with darker beams, standing on a deck of dark wooden planks raised on short dark stilts (where the guide has its low pale platform), a big heavy curved roof of deep indigo-violet tiles (#1a1438, #2a2258, #3c3478, #5a50a0 lit ridges) in stepped layers with upturned eaves, a gold ridge ornament.
On the wall facing the viewer's lower left: the dark entrance in the middle, hung with a noren curtain (two indigo cloth panels, #22205a, #3a3488, with a white hot-spring symbol on it), a narrow transom above it glowing soft cyan (#2ff3ff, the baths' light), two vermilion-lacquered posts either side of it.
The windows (where the guide has gold panels, either side of the entrance and on the right wall): paper shoji screens in a dark wooden lattice, the paper pale cream-grey (#c8bca0, #a89880) and UNLIT.
Two big round paper lanterns hang from posts at the front corners where the guide has the two gold boxes under the eaves: warm glowing lanterns (#ffd23f, #fff1b0, #c4861c rim) with dark caps.
{NOGREEN}"""),
 'grazer': dict(size=(1536, 1024), pitch=10, ids=['sporelight_grazer_calm_0', 'sporelight_grazer_calm_1'], n='two objects',
   every='both frames', what='two walking frames of a gentle grazing beast', names={'sporelight_grazer_calm_0': 'first frame', 'sporelight_grazer_calm_1': 'second frame'},
   desc=f"""{FOREST} Two frames of the same grazer walking (only the legs differ, exactly as in the guide): a big gentle four-legged beast, calm and a little sleepy. Its body is a broad rounded back like a mossy shell where the guide has its big dome: a hide of blue-violet stone-like skin (#1e1a3a, #2e2858, #4a4280, #6a62a8 lit) overgrown with teal-blue moss (#0e3a40, #16605a, #2a8a7a, #4ab0a0) and a few tiny glowing mushrooms (small cyan and rose caps) growing on it. Four thick stumpy legs. Its head is long and low at the lower left (where the guide has the smaller grey ball and snout), a soft rounded muzzle, two small leaf-like moss ears, and two calm glowing CYAN eyes (#2ff3ff with a #e0ffff glint, where the guide has its cyan eyes). Kind and peaceful, like a big forest spirit cow.
{NOGREEN}"""),
 # Round 4 (2026-11-26): the Root Stair's way down to the Battle Glade, over its stair tile.
 'rootstair': dict(size=(1536, 1024), pitch=11, ids=['sporelight_rootstair'], n='one object', every='the stair', what='a stone stair going down into the ground between big glowing roots', names={'sporelight_rootstair': 'stair'},
   desc=f"""{FOREST}
THE ROOT STAIR, a way down into the earth, exactly the guide's shape and angle, seen from above: a patch of thick teal-blue MOSS (#0e3a40, #16605a, #2a8a7a, #4ab09a lit) with a few flat stones in it, and in its middle a dark rectangular opening in the ground: worn old STONE STEPS going DOWN away from the viewer (toward the upper right) into the earth, each step a pale violet-grey stone tread (#3a3458, #5a5480, #8a84b0 lit edges) with a dark riser, the steps getting darker as they go down, the pit's far walls of dark violet stone blocks (#120c24, #1e1638, #2e2450); at the bottom of the stair, at the far end of the opening, a SOFT CYAN GLOW coming up from below (#0a6a80, #2ff3ff, #c4fbff), lighting the lowest steps cyan.
Around the opening three GREAT ROOTS of the fungus forest: thick knotted brown-violet roots (#2a1420 shade, #4a2a34, #6e4448, #9a6a5a lit) arching out of the moss on the left and the right of the stair and one humped behind it, exactly where the guide has them, with thin glowing VEINS running along them in bright cyan (#2ff3ff, #c4fbff), a little moss on their tops.
{NOGREEN}"""),
}
