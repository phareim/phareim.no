# Stillsand's kit (frontierArt/stillsand.ts -> stillsandData.ts): the gold pyramid (new in round 3; too big for one
# sheet at the game's px, so drawn on a half-size guide and built at 2 x 2 game px per art px), the quartz islands that
# hang over the dunes (the lowered one is the medium island's drawing, its box anchored 13 px lower), and the
# sunstone's lens turning on its post (four frames).
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-stillsand.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
DESERT = """A pastel desert held just after sunrise, as in concept.png: soft peach, rose and lilac light, pale sandstone, gold."""
SANDSTONE = """Sandstone: warm pastel sandstone in layered courses (#5a3a4a darkest, #8a5a5a, #b8806a, #e0a880, #f8d0a8 lit tops), with lilac shade on the faces turned away (#6a5a8a, #8a7aa8)."""

SHEETS = {
 'pyramid': dict(size=(1536, 1024), pitch=6.4, ids=['stillsand_pyramid'], guide={'stillsand_pyramid': 'stillsand_pyramid_half'},
   n='one object', every='the pyramid', what='a huge stepped gold pyramid in the desert',
   desc=f"""{DESERT}
THE GOLD PYRAMID, the stepped gold mass in the middle of the sands, exactly the guide's shape: five broad tiers of great sandstone blocks, each stepping in on every side, so each tier's flat top is a ledge of pale sand-dusted stone; along each tier's top edge a course of GOLD-clad blocks (#6a4a18, #a87a2a, #e0b048, #fff0a0 sunlit) catching the sunrise; the tiers' faces laid in big blocks with fine dark joints, weathered, a few blocks chipped, faint carved glyph bands (sun discs, birds) on the lowest tier.
In the middle of the lowest tier's front face (facing the viewer's lower left, where the guide has it): a DARK DOORWAY (#0b0616, #1a1030 deep shadow inside), framed by gold jambs and a heavy gold lintel.
On the top: a gold capstone platform carrying a cluster of QUARTZ crystals: tall pale rose-white and lilac crystals (#6a4a8a, #b090d0, #f0d0f0, #ffffff) catching the light, one bright white glint on the biggest.
{SANDSTONE}"""),
 'islands': dict(size=(1536, 1024), pitch=9.5, ids=['stillsand_island_large', 'stillsand_island_medium'], n='two objects', every='both islands',
   what='two floating stone islands with a little tree on each', names={'stillsand_island_large': 'large island', 'stillsand_island_medium': 'medium island'},
   desc=f"""{DESERT}
Two quartz islands hanging in the air over the dunes, exactly the guide's shapes: each a flat-topped plateau of layered sandstone (a pale sand top with soft ripples, its sides in stepped strata), tapering underneath into smaller broken rock fragments with a dark shadow gap between them; on its top a small round tree with a short dark trunk and a puffy crown of soft teal-green leaves (#0e3a40, #1a6a5a, #2a9a7a, #5ac8a0, #9ae8c0 lit), three twisted roots lying over the top, and a nugget of GOLD hum-quartz in the roots glowing softly (#c4861c, #ffd23f, #fff1b0 core) where the guide has its gold.
{SANDSTONE}"""),
 'small': dict(size=(1536, 1024), pitch=14, ids=['stillsand_island_small'], n='one object', every='the island',
   what='a small floating stone island with a little tree',
   desc=f"""{DESERT} Big chunky pixels.
A small quartz island hanging in the air over the dunes, exactly the guide's shape: a flat-topped plateau of layered sandstone (a pale sand top, its sides in stepped strata), tapering underneath into smaller broken rock fragments with a dark shadow gap between them; on its top a small round tree with a short dark trunk and a puffy crown of soft teal-green leaves (#0e3a40, #1a6a5a, #2a9a7a, #5ac8a0, #9ae8c0 lit), three twisted roots lying over the top, and a nugget of GOLD hum-quartz in the roots glowing softly (#c4861c, #ffd23f, #fff1b0 core) where the guide has its gold.
{SANDSTONE}"""),
 'lens': dict(size=(1536, 1024), pitch=10, ids=['stillsand_lens_0', 'stillsand_lens_1', 'stillsand_lens_2', 'stillsand_lens_3'], n='four objects', every='all four frames',
   what='four frames of a big round lens turning on its post', names={f'stillsand_lens_{i}': f'frame {i + 1}' for i in range(4)},
   desc=f"""{DESERT}
Four frames of ONE sunstone lens turning on its post (the foot and the post are exactly the same in every frame; only the lens turns, exactly as in the guide): a square stepped sandstone foot, a pale stone collar, a dark bronze post, and on top a big round disc lens in a thick pale-silver rim (#5a5878, #8e8ca8, #c4c2d8, #f0eef8 lit edge). Where the guide shows the gold face (frames 1 and 2), the lens's glass faces the viewer: gold glass (#a87a2a, #e0b048, #ffd23f) with a hot white-gold sun glint lit in it (#fff1b0, #ffffff). Where the guide shows only the grey back (frames 3 and 4), the lens is turned away: its rim and its dull dark-bronze back (#2e2230, #4a3a40, #6a5250), only a thin gold edge of glass showing at its side.
{SANDSTONE}"""),
 # Round 4 (2026-11-26): THE RIBS, the stone bird's ribcage over the Bone Road: a big pair (8 tiles foot to foot) and a
 # small one (6), each drawn on its half-size guide and built at 2 x 2 game px an art px (kitscale.py).
 'ribs': dict(size=(1536, 1024), pitch=8.5, ids=['stillsand_ribs'], guide={'stillsand_ribs': 'stillsand_ribs_half'}, n='one object', every='the rib pair', what='one huge arched rib pair of a giant stone bird skeleton', names={'stillsand_ribs': 'rib pair'},
   desc=f"""{DESERT}
ONE RIB PAIR of a GIANT STONE BIRD's ribcage, half buried in the desert, exactly the guide's shape and angle: two long curved RIB BONES rising from the sand at the two ends (lower left and upper right) and arching up and over, meeting at the top in a short length of the bird's BACKBONE (a row of knobbly vertebrae with short blunt spines on top) that runs across the top of the arch. The bones are flattened blades, thick at the foot and a little thinner toward the top, with a small hooked spur on the back of each rib.
The bone is ancient, BLEACHED and SAND-SCOURED, turned to stone: chalky ivory and bone white (#5a4a5a darkest, #9a8a8a, #c8b8a8, #e8dcc8, #fff4e4 sunlit edge), with fine sand-blasted grooves running along the bone, a few cracks and chips, warm pastel sand settled in the grooves and on the top edges, lilac-grey shade on the undersides (#6a5a8a, #8a7aa8). A small drift of pale sand banked against each foot.
It must read clearly as a huge bone of a bird skeleton, not as a pipe or a metal arch."""),
 'ribssmall': dict(size=(1536, 1024), pitch=10, ids=['stillsand_ribs_small'], guide={'stillsand_ribs_small': 'stillsand_ribs_small_half'}, n='one object', every='the rib pair', what='one huge arched rib pair of a giant stone bird skeleton', names={'stillsand_ribs_small': 'rib pair'},
   desc=f"""{DESERT}
ONE RIB PAIR of a GIANT STONE BIRD's ribcage, half buried in the desert, exactly the guide's shape and angle: two long curved RIB BONES rising from the sand at the two ends (lower left and upper right) and arching up and over, meeting at the top in a short length of the bird's BACKBONE (a row of knobbly vertebrae with short blunt spines on top) that runs across the top of the arch. The bones are flattened blades, thick at the foot and a little thinner toward the top, with a small hooked spur on the back of each rib.
The bone is ancient, BLEACHED and SAND-SCOURED, turned to stone: chalky ivory and bone white (#5a4a5a darkest, #9a8a8a, #c8b8a8, #e8dcc8, #fff4e4 sunlit edge), with fine sand-blasted grooves running along the bone, a few cracks and chips, warm pastel sand settled in the grooves and on the top edges, lilac-grey shade on the undersides (#6a5a8a, #8a7aa8). A small drift of pale sand banked against each foot.
It must read clearly as a huge bone of a bird skeleton, not as a pipe or a metal arch."""),
}
