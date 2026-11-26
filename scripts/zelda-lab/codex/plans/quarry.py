# Lumenby quarry's kit (frontierArt/quarry.ts -> the quarry art pack): the seven hill letters L U M E N B Y (drawn unlit;
# the lit letters are the same drawings with their neon tubes lit), the mine carts, the haul ramps, the headframe,
# the lumen vein and the crate of glass tubes.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-lumenby.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
QUARRY = """A quarry town at sunset, as in concept.png: warm orange-brown cut stone, weathered timber, cyan lumen crystals, the big sign letters on the hill."""
TIMBER = """Timber: weathered brown planks and beams (#2e1a12 seams, #4a2a1e, #6a4028, #8a5a38, #b07a4c lit edges), nails, a little wear."""
IRON = """Iron: dark blue-grey riveted iron plates (#1c1a2a, #2e2c44, #4a4866, #6e6c90 lit), rust patches (#7a3a22, #a0522d) low down."""
LETTER = """Each letter is a huge hill-sign letter, as the LUMENBY letters in concept.png: a thick block letter built of weathered grey-violet painted planks (#24203a shade, #3a3458, #545078, #76709c lit edges; peeling paint showing a little brown wood) with a darker side showing its depth, held up from behind by a frame of brown timber posts and cross braces with their feet on the ground (where the guide has its posts). Along the middle of every stroke on the letter's front face runs a neon tube, UNLIT: a rounded glass tube of dull rose-grey glass (#5a3450 shade, #8a5a78, #b08aa0, #d4b4c4 highlight), held to the planks by small dark metal clips. The tube is the only rose-grey thing on the letter."""

SHEETS = {
 'letters1': dict(size=(1536, 1024), pitch=10, ids=['quarry_letter_l_off', 'quarry_letter_u_off', 'quarry_letter_m_off', 'quarry_letter_e_off'], n='four objects',
   every='all four letters', what='four big wooden sign letters, L, U, M and E',
   names={'quarry_letter_l_off': 'letter L', 'quarry_letter_u_off': 'letter U', 'quarry_letter_m_off': 'letter M', 'quarry_letter_e_off': 'letter E'},
   desc=f"""{QUARRY} The letters L, U, M, E (left to right), each exactly the letter shape of its guide, facing the viewer's lower left as in the guide.
{LETTER}
{TIMBER}"""),
 'letters2': dict(size=(1536, 1024), pitch=12, ids=['quarry_letter_n_off', 'quarry_letter_b_off', 'quarry_letter_y_off'], n='three objects',
   every='all three letters', what='three big wooden sign letters, N, B and Y',
   names={'quarry_letter_n_off': 'letter N', 'quarry_letter_b_off': 'letter B', 'quarry_letter_y_off': 'letter Y'},
   desc=f"""{QUARRY} The letters N, B, Y (left to right), each exactly the letter shape of its guide, facing the viewer's lower left as in the guide.
{LETTER}
{TIMBER}"""),
 'carts': dict(size=(1536, 1024), pitch=14, ids=['quarry_cart_empty', 'quarry_cart_full'], n='two objects', every='both carts',
   what='two mine carts on short pieces of track, one empty and one full of glowing ore',
   names={'quarry_cart_empty': 'empty cart', 'quarry_cart_full': 'full cart'},
   desc=f"""{QUARRY} Two identical mine carts (tubs), each standing on its own short piece of narrow-gauge track (dark wooden sleepers, two iron rails), as the carts in concept.png: a riveted iron tub, wider at the top, with a pale rolled rim, ribs down its sides, four small iron wheels, a small gold number plate on its side.
Left: EMPTY, the dark inside of the tub showing.
Right: FULL, heaped above the rim with lumps of dark rock and glowing cyan lumen crystals (#0a6a8a, #2ff3ff, #c4fbff, white cores) as in concept.png.
{IRON}
{TIMBER}"""),
 'ramps': dict(size=(1536, 1024), pitch=11, ids=['quarry_ramp_n', 'quarry_ramp_w'], n='two objects', every='both ramps',
   what='two wooden haul ramps with a rail track, one rising each way',
   names={'quarry_ramp_n': 'left ramp', 'quarry_ramp_w': 'right ramp'},
   desc=f"""{QUARRY} Two wooden haul ramps like the ramp in concept.png's upper left: a sloping deck of weathered planks laid across, on a trestle of timber posts and braces underneath, two iron rails running up the middle of the deck, exactly the shape and slope of each guide.
{TIMBER}"""),
 'headframe': dict(size=(1024, 1536), pitch=13, ids=['quarry_headframe'], n='one object', every='the headframe',
   what='a timber mine headframe',
   desc=f"""{QUARRY} A timber mine headframe over a shaft: a tall two-stage tower of heavy weathered timber legs with cross braces (X braces on the two sides that show) and girts, stepping in at the middle, standing on a stone kerb round the dark shaft mouth; on its top deck a railing and a big iron sheave wheel (a spoked hoist wheel with a gold hub) on two timber bearing posts, a hoist rope running from the wheel down into the shaft, and a small iron lamp with a glowing RED light (#ff3a3a, #ffb0a0 core) on a post at the deck's front corner.
{TIMBER}
{IRON}"""),
 'veincrate': dict(size=(1536, 1024), pitch=16, ids=['quarry_vein', 'quarry_crate'], n='two objects', every='both objects',
   what='a rock with a vein of glowing crystal, and a crate of glass tubes',
   names={'quarry_vein': 'crystal vein', 'quarry_crate': 'crate'},
   desc=f"""{QUARRY} Big chunky pixels.
Left: a big rounded boulder of warm grey-brown quarry stone (#3a2a2a shade, #5a4440, #7e6458, #a88a74 lit), cracked, with a seam of glowing cyan lumen crystals breaking out along it (sharp faceted crystals, #0a5a7a, #1aa8d0, #2ff3ff, #c4fbff, white cores), as the crystals in concept.png's walls.
Right: a slatted wooden crate from a glassworks, straw (#c8a050, #e8c870) inside, glass tubes standing in it: one bent pink neon hairpin tube glowing (#ff4aa8, #ffc4e8 core), one straight cyan tube glowing (#2ff3ff), a few unlit clear-grey tubes, two tubes laid across the straw.
{TIMBER}"""),
}
