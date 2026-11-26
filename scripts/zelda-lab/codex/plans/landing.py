# The landing's kit (frontierArt/landing.ts -> landingData.ts): Yule Fjord's harbour (pier, bollards, crates, net rack,
# harbour light) and the breakwater's stones.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-yulefjord.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
HARBOUR = """A small Norwegian harbour on a fjord at night under the northern lights, as in concept.png."""
WOOD = """Wood: old tarred and salt-weathered harbour timber (#1e120e seams, #3a2420, #5a3a30, #7a5444, #9a7058 lit edges), iron bolts."""
IRON = """Iron: dark blue-grey iron (#141226, #2a2842, #44425e, #6a6886 lit), a little rust (#7a3a22)."""
STONE = """Stones: big rounded grey-violet sea boulders (#1e1a30 dark, #3a3654, #5a5678, #8a86a6 lit tops), some green-teal with seaweed and moss (#0e3a34, #1a5e52, #2a8a74, #5ab89a lit), a little snow on their tops (#e8e4f8, #c8c0e8)."""

SHEETS = {
 'pier': dict(size=(1536, 1024), pitch=11, ids=['landing_pier'], n='one object', every='the pier', what='a long wooden pier on piles',
   desc=f"""{HARBOUR}
A long wooden pier (jetty) exactly the guide's shape: a deck of heavy weathered planks laid across, dark gaps between them, a thick edge beam along each side, iron bolt heads in rows, short squat mooring posts along its edges where the guide has its brown knobs, a dusting of snow and frost on the planks (#e8e4f8, #c8c0e8), and under it the thick round tarred piles standing down into the water (the piles end where the guide's legs end).
{WOOD}"""),
 'stones': dict(size=(1536, 1024), pitch=14, ids=['landing_breakwater', 'landing_breakwater_end', 'landing_bollard'], n='three objects', every='all three objects',
   what='two lengths of a stone breakwater and an iron bollard',
   names={'landing_breakwater': 'breakwater', 'landing_breakwater_end': 'breakwater end', 'landing_bollard': 'bollard'},
   desc=f"""{HARBOUR} Big chunky pixels.
Left and middle: two lengths of a breakwater: big rounded boulders heaped in a low bank, exactly where the guide has its balls; the middle one ends in one bigger round boulder.
Right: a short squat cast-iron mooring bollard (a round post with a wider cap) on a small stone base, a loop of rope round its neck.
{STONE}
{IRON}"""),
 'harbour': dict(size=(1536, 1024), pitch=16, ids=['landing_crates', 'landing_net_rack', 'landing_harbour_light'], n='three objects', every='all three objects',
   what='a stack of crates, a fishing-net rack and a harbour light',
   names={'landing_crates': 'crates', 'landing_net_rack': 'net rack', 'landing_harbour_light': 'harbour light'},
   desc=f"""{HARBOUR} Big chunky pixels.
Left: a stack of fish crates and a barrel-sized box: slatted wooden crates (#4a2a1a, #7a4a2a, #a87040 lit), a few silver fish and ice showing in the top one, a red-orange stencil mark on one side, snow on the top.
Middle: a fishing-net drying rack: two wooden posts with a cross pole, a dark green-grey fishing net hanging from it (#1e2e2a, #34504a, #50706a mesh), little orange floats (#d0641e, #ff9a3a) along its edge.
Right: a harbour light: a dark iron post on a stone base, a short wooden collar, and on top a lantern with a band of cyan glass (#0a8aa8, #2ff3ff, #c4fbff) round it under a big warm gold light (#c4861c, #ffd23f, #fff1b0, a white centre) under a little iron roof, as in the guide: the lamp glows.
{WOOD}
{IRON}"""),
 # Round 4 (2026-11-26): a small moored fishing boat (frame 1 is this drawing a px lower: the bob).
 'boat': dict(size=(1536, 1024), pitch=16, ids=['harbour_boat_0'], n='one object', every='the boat', what='a small wooden rowing and fishing boat', names={'harbour_boat_0': 'boat'},
   desc=f"""{HARBOUR} Big chunky pixels.
A small Norwegian wooden rowing boat (a faering), moored and empty, exactly the guide's shape and angle: a double-ended clinker-built hull, pointed at both ends, its bow and stern posts rising a little higher than the sides, the overlapping planks (strakes) showing as fine horizontal lines along its side. The hull painted white (#5a5878 shade, #9a98b8, #d0cee4, #f4f2ff lit) with a red stripe (#6a1420, #a82a34, #d84a4a) just under the dark tarred gunwale (#1a1018, #2e1e26); below it the hull's bottom tarred dark (#141226, #22203a) where it meets the water.
Inside, seen from above: the pale wooden floor boards, two plank seats (thwarts) across it, a pair of long oars laid along its right side with their blades at the right end, a coil of orange rope at the left end, a small wooden fish box. A little SNOW lies on the seats and in the bottom (#e8e4f8, #c8c0e8).
{WOOD}"""),
}
