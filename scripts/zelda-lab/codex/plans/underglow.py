# The Underglow's kit (frontierArt/underglow.ts -> underglowData.ts): the spiral ledges' edges with the rock hanging
# under them, Rut's rope lift (cage, rope, the lift head whose wheel turns: drawn once with its wheel and once bare,
# the frames turned by kitturn.py), the Delvers' Club glowsticks in the five rank colours, the dead arcade cabinet, the
# Upside Grove's tree (roots), the glass-sea shards, the broadcast mast (dead, static, tuned) and the Sun Below (frame
# 0 drawn, frame 1 the same drawing turned half a ray).
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-underglow.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
DEEP = """A deep cave world under the earth, lit from BELOW by a golden underground sun, as in concept.png: dark violet stone, warm gold light catching the undersides, small bright glows of cyan and pink."""
STONE = """Cave stone: dark blue-violet cut stone and rock (#0e0a1c outline, #1e1834, #2e2650, #443a6e, #62588e lit edges), cracks, a little teal moss."""
TIMBER = """Timber: old dark brown mine timber (#1e100c seams, #3a2018, #5a3424, #7a4a30, #9a6640 lit), iron straps."""
IRON = """Iron: dark blue-grey iron (#141226, #2a2842, #44425e, #6a6886 lit), rust spots (#7a3a22)."""

LEDGE = """Each is the edge of a stone ledge in a vast cave shaft, exactly the guide's shape: a big square block of masonry whose TOP is a floor of worn flagstones (#2e2650, #443a6e, #5a5088 lit, dark joints), its sides (the faces open to the shaft) courses of rough cut stone, a row of kerb stones along the open edges, a strip of teal moss; under the block the raw ROCK hangs down in jagged stalactite spikes, exactly where the guide has its spikes, their lowest tips lit warm orange-gold from below (#7a3a1a, #c8641e, #ffb040, #ffe080 at the very tips); a small violet crystal (#3a1a6a, #7a3ac8, #c890ff, a glowing pink-white glint #ffc4f0) breaks out of each open face where the guide has it."""

SHEETS = {
 'ledges1': dict(size=(1536, 1024), pitch=10, ids=['underglow_ledge_s', 'underglow_ledge_e'], n='two objects', every='both ledges',
   what='two stone ledge edges with rock spikes hanging under them', names={'underglow_ledge_s': 'left ledge', 'underglow_ledge_e': 'right ledge'},
   desc=f"""{DEEP}
{LEDGE}
{STONE}"""),
 'ledges2': dict(size=(1536, 1024), pitch=9.5, ids=['underglow_ledge_se', 'underglow_lift_cage', 'underglow_lift_rope'], n='three objects', every='all three objects',
   what='a stone ledge edge with rock spikes under it, a lift cage, and a short length of rope',
   names={'underglow_ledge_se': 'ledge', 'underglow_lift_cage': 'lift cage', 'underglow_lift_rope': 'rope'},
   desc=f"""{DEEP}
Left: {LEDGE[8:]}
Middle: a miner's lift cage: a square cage of dark iron bars and corner posts on a floor of worn planks, iron rails round its middle and top, a flat iron roof with a bail of two straps up to a ring at the top, and inside, seen between the bars, a small gold lamp hanging from the roof on a chain, glowing warm (#ffd23f, #fff1b0).
Right: a short straight length of thick hemp rope hanging straight down (#5a3a1a, #8a6a3a, #c8a060, #e8c888 lit), its twisted lay showing.
{IRON}
{STONE}"""),
 'wheel': dict(size=(1536, 1024), pitch=9, ids=['underglow_lift_wheel_0', 'underglow_lift_bare'], n='two objects', every='both objects',
   what='the head of a rope lift (a timber jib with a hoist wheel), and the same head without its wheel',
   names={'underglow_lift_wheel_0': 'lift head', 'underglow_lift_bare': 'lift head without its wheel'},
   desc=f"""{DEEP}
Left: the head of a rope lift standing on a cave ledge: two timber posts braced from behind on a stone footing, two heavy timber jib beams reaching out over the shaft (towards the viewer's lower left), struts under them, and at the jib's tip a big iron HOIST WHEEL standing upright (a rim of dark iron, #2a2842, #44425e, #8a88a8 lit edge, four iron spokes, ONE spoke tipped with gold #ffd23f), its axle in two timber bearings; a hemp rope running from the wheel's far side straight down past the bottom of the picture, and another from its near side down to a winch drum of rope between the posts with an iron crank; a small gold lamp hanging under the jib's tip, glowing warm (#ffd23f, #fff1b0).
Right: EXACTLY the same lift head, the same drawing px for px, but with NO WHEEL (no rim and no spokes: the jib's tip, the axle and its bearings, the ropes and everything else as in the left one), as in the guide.
{TIMBER}
{IRON}"""),
 'sticks': dict(size=(1536, 1024), pitch=20, ids=[f'underglow_glowstick_{t}' for t in ['rose', 'pink', 'cyan', 'violet', 'gold']], n='five objects', every='all five glowsticks',
   what='five glowstick markers on stakes in little cairns of stones',
   names={f'underglow_glowstick_{t}': f'{t} glowstick' for t in ['rose', 'pink', 'cyan', 'violet', 'gold']},
   desc=f"""{DEEP} Very big chunky pixels: these are small objects in the game, keep the details few and bold.
Each is a glowstick marker: a little cairn of three dark stones, a thin dark iron stake standing in it, and on top of the stake a fat chemical GLOWSTICK in a dark plastic cap at each end, glowing brightly in its colour with a hot white-ish line down its middle. Left to right: rose (#a03050, #e8708a, #ffb4c4, #ffe4ec), hot pink (#a01a6a, #ff4aa8, #ff9ad0, #ffe0f4), cyan (#0a8aa8, #2ff3ff, #a0faff, #e8ffff), violet (#5a2aa8, #a46aff, #d0b0ff, #f0e8ff), gold (#c4861c, #ffd23f, #ffe88a, #fffbe0).
{STONE}"""),
 'cabinetroots': dict(size=(1536, 1024), pitch=12, ids=['underglow_cabinet', 'underglow_roots'], n='two objects', every='both objects',
   what='an old arcade cabinet grown into rock, and an upside-down tree', names={'underglow_cabinet': 'arcade cabinet', 'underglow_roots': 'tree'},
   desc=f"""{DEEP}
Left: a DEAD, DUSTY fossil arcade cabinet half grown into a dark rock behind it, a fossil spine of pale rose bone arching over it with ribs hanging down: an upright arcade cabinet facing the viewer's lower left, its paint faded (dull violet with a faded rose stripe on its side), a thick grey dust on every top surface, cobwebs, cracks; its screen DARK and dead (a black-green glass with a dusty grey film and one crack), its marquee dark and unlit (faded gold with dull rose letter blocks), two dull coin slots, the control deck's joystick and two buttons dusty; small violet crystals at its foot. Nothing on it glows.
Right: the Upside Grove's tree, as the guide: a bank of soft teal-cyan moss lying on the ground (#0e3a40, #16605a, #2a9a8a, #5ad8c0 lit) with small glowing pink and cyan blossoms in it; out of the moss a thick dark brown trunk stands up (#2a160e, #4a2a1a, #6a4228, #8e5e38 lit, bark lines), and at its top its ROOTS spread up and out into the air like branches, thinning to their tips, each tip carrying a tiny glowing mushroom cap (pink #ff4aa8 or cyan #2ff3ff); a chip of bark and a leaf floating up above the roots.
{STONE}"""),
 'shards': dict(size=(1536, 1024), pitch=16, ids=['underglow_shards_0', 'underglow_shards_1'], n='two objects', every='both objects',
   what='two clusters of tall glass shards', names={'underglow_shards_0': 'big shards', 'underglow_shards_1': 'small shards'},
   desc=f"""{DEEP} Big chunky pixels.
Two clusters of shards of sea-glass standing up out of a scatter of pale grit, exactly the guide's shapes: tall slabs of translucent cyan-teal glass (#0a3a4a outline, #0e5a6a, #1a8a9a, #3ac8d0, #9af0f0 lit edges, a bright white glint on one edge) tapering and leaning as they rise, a band of violet-pink aurora colour (#7a2a9a, #c84ab0) running across each face; small dark grey pebbles of grit round their feet. Left: three tall shards. Right: two small ones."""),
 'masts': dict(size=(1536, 1024), pitch=9.5, ids=['underglow_mast_0', 'underglow_mast_1', 'underglow_mast_2'], n='three objects', every='all three masts',
   what='three states of the same lattice broadcast mast', names={'underglow_mast_0': 'dead mast', 'underglow_mast_1': 'static mast', 'underglow_mast_2': 'tuned mast'},
   desc=f"""{DEEP}
Three states of ONE broadcast mast (the same mast in each, exactly the guide's shape): a two-stage lattice tower of dark iron girders with zigzag cross-bracing on a square stone plinth, a small iron tuning box with a round dial at its foot, two small dish antennas on arms near the top, an aviation lamp at the top of the first stage, a thin pole at the very top, and a CRYSTAL cluster on the top.
Left, DEAD: the crystal a dull dark grey stone, the dial and the lamp dark. Nothing glows.
Middle, STATIC: the crystal glowing hot pink (#a01a6a, #ff4aa8, #ffc4e8), crackling pink sparks and a little zigzag of pink lightning jumping off it down the mast, the dial pink, the lamp pink.
Right, TUNED: the crystal glowing cyan (#0a8aa8, #2ff3ff, #e0ffff), a ring of small cyan lights round its foot, a white glint on each dish, the dial cyan, the lamp pink-red.
{IRON}
{STONE}"""),
 'sun': dict(size=(1536, 1024), pitch=12, ids=['underglow_sun_0'], n='one object', every='the sun disc',
   what='a glowing disc of golden light lying on the cave floor',
   desc=f"""{DEEP}
The Sun Below: a low, wide stepped dome of pure golden LIGHT lying in the cave floor, seen from above at the game's angle, exactly the guide's shape: a blinding white heart in the middle (#ffffff, #fffbe8), rings of warm gold light round it (#fff1b0, #ffe080, #ffd23f, #f0b030, #d08a1e), twelve thin rays of white-gold light running out from the heart to the rim, the stepped edge of each ring a slightly darker gold, and a thin rose-pink rim at the very edge (#e05a8a, #ff8ab0). It is all light: no outline darker than #c06a20, no stone."""),
}
