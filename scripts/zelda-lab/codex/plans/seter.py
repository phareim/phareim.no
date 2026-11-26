# Seter Fell's kit (frontierArt/seter.ts -> seterData.ts): the sheets Codex draws, and what each piece is.
# sheet: size (an image_gen size), pitch (sheet px to an art px), key, ids (guides, left to right), and the words.
from head import HEAD  # noqa: F401  (sheet.py reads HEAD from here)

REFS = {'concept.png': 'docs/worlds/img/concept-seterfell.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}

GRASS = """Grass and moss: warm summer greens (#2f5a1e deep, #4f8a2a, #7fb03a, #b8d050 sunlit tips, dry straw #c8a850), never pure green."""
LOGS = """Logs: weathered brown-grey pine logs (#3a2418 seams, #5a3a26, #7a5434, #9a7048 lit), each course rounded, the laft corners' cut ends pale (#c89a68)."""
STONE = """Fell stone: rounded grey-violet stones (#3a3450 dark, #5a5470, #7e7890, #a8a2b8 lit tops) with moss and yellow lichen patches."""

SHEETS = {
 'hut': dict(size=(1024, 1536), pitch=10, key='magenta', ids=['seter_hut_0'], n='one object', every='the hut',
   what='a turf-roofed log hut on a Norwegian mountain summer farm (seter)', names={'seter_hut_0': 'hut with its smoke'},
   desc=f"""A small seter hut, as in concept.png's huts: walls of laid round logs with crossed laft corners, a thick turf roof of grass and moss with tufts of tall grass and a few small wildflowers (pale yellow, pink) on it, sod edges hanging over the eaves. On the long wall facing the viewer's lower left: a plank door with iron straps and a small latch, a stone step before it, and a small four-pane window with a pale wooden frame (the panes dark blue-grey glass with a faint warm reflection: the lamp inside is unlit). In the gable facing the viewer's lower right: boards and a small loft hatch, and a neat stack of split firewood (pale round cut ends) under the eave. A stacked-stone chimney rising through the roof, with a few soft grey puffs of smoke drifting up and to the right above it, drawn as pixel-art puffs (#8a8498, #b0aac0, #d8d2e4).
{LOGS}
{GRASS}"""),
 'byre': dict(size=(1536, 1024), pitch=10, key='magenta', ids=['seter_byre'], n='one object', every='the byre', what='a long turf-roofed log byre (cow barn) on a Norwegian mountain summer farm',
   desc=f"""A long byre: a footing of grey dry-stone masonry, log walls with crossed laft corners above it, a thick turf roof of grass and moss with tufts of tall grass and a few wildflowers. On the long wall facing the viewer's lower left: a pair of wide braced barn doors of dark planks with pale Z-braces in the middle, a bank of earth up to them, and two small square vents with pale frames either side. In the gable facing the viewer's lower right: boards, a hay hatch with straw spilling out, and a short plank sticking out under it.
{LOGS}
{STONE}
{GRASS}"""),
 'walls': dict(size=(1536, 1024), pitch=14, key='magenta', ids=['seter_fence_ew', 'seter_fence_ns'], n='two objects', every='both walls',
   what='two short pieces of a dry-stone wall (one tile long each), one running each way', names={'seter_fence_ew': 'left wall piece', 'seter_fence_ns': 'right wall piece'},
   desc=f"""Two pieces of a Norwegian dry-stone field wall, as the walls in concept.png: two courses of big rounded stones stacked without mortar, gaps of dark shadow between them, moss and grass tufts on top, yellow-green lichen on the stones. Left: running down to the lower right. Right: running down to the lower left. Each piece is one even run, ends cut straight (the next piece continues it).
{STONE}
{GRASS}"""),
 'stand': dict(size=(1536, 1024), pitch=13, key='magenta', ids=['seter_churns', 'seter_fence_end'], n='two objects', every='both objects',
   what='a milk churn stand and the end stack of a dry-stone wall', names={'seter_churns': 'churn stand', 'seter_fence_end': 'wall end'},
   desc=f"""Left: a milk churn stand by a farm road: a weathered wooden plank table at cart height on four legs, a cross-plank between the legs, three tall tin milk churns standing on it (silver-grey tin #5a5868, #8f8ca8, #c8c6dc, white glints, two darker rolled hoops on each, a shoulder, a narrow neck and a lid with a knob, a small handle), and a small tin cup.
Right: the end of a dry-stone wall: a broad stack of three big rounded stones, a flat cap stone on top with moss and two grass tufts.
{STONE}"""),
 'trollsmall': dict(size=(1536, 1024), pitch=10, key='magenta', ids=['seter_troll_small_0'], n='one object', every='the troll hill', what='a small sleeping troll that is a mossy hill',
   desc=f"""A sleeping troll that looks like a mossy hill of big rounded grey boulders, as the troll hills in concept.png: curled up, its body a heap of rounded rocks covered in thick moss and grass on top, heather and a few small flowers. Its big face is grown into the rock on the right side, looking toward the viewer's lower right: heavy rock brows, a huge round bulbous nose (the biggest thing on the face), the eyes peacefully CLOSED as two curved creases, a calm closed mouth as a seam under the nose. A great rock hand with curled fingers resting on the ground in front. A small birch tree grows on its back: a white trunk with black marks and a small golden-yellow autumn crown. It must read clearly as a sleeping troll face in a hill, gentle and a little funny, like Kittelsen's trolls.
{STONE}
{GRASS}"""),
 'trollbig': dict(size=(1536, 1024), pitch=10, key='magenta', ids=['seter_troll_big_0'], n='one object', every='the troll hill', what='a big sleeping troll that is a long mossy hill',
   desc=f"""A big sleeping troll that looks like a long mossy hill of big rounded grey boulders, as the troll hills in concept.png: lying long, its body a heap of rounded rocks covered in thick moss and grass on top, heather and a few small flowers. Its big face is grown into the rock at the right end, looking toward the viewer's lower right: heavy rock brows, a huge round bulbous nose (the biggest thing on the face), the eyes peacefully CLOSED as two curved creases, a calm closed mouth as a seam under the nose. A great rock hand with curled fingers resting on the ground in front. Two small birch trees (white trunks with black marks, golden-yellow autumn crowns) and a small dark spruce grow on its back. It must read clearly as a sleeping troll face in a hill, gentle and a little funny, like Kittelsen's trolls.
{STONE}
{GRASS}"""),
 # Round 4 (2026-11-26): the varde on Cairn Ridge, the land's far landmark.
 'varde': dict(size=(1024, 1536), pitch=10, key='magenta', ids=['seter_varde'], n='one object', every='the cairn',
   what='a tall stone cairn (a Norwegian varde) on a mountain ridge', names={'seter_varde': 'cairn'},
   desc=f"""A tall Norwegian VARDE, the stone cairn hikers build on a mountain ridge, exactly the guide's tall narrow shape: a tapering tower of FLAT grey slabs of fell stone stacked one on another, each slab a little smaller and a little off-centre from the one under it, their edges uneven and chipped, dark shadow seams between the courses, so it reads as dry-stacked flat stones and not as a smooth cone. Its foot a ring of half-sunk stones. Pale grey-green and mustard-yellow LICHEN crusting the stones in patches, a little moss where they face up. A flat capstone on top, and wedged in it a thin weathered stick with a long narrow strip of cloth tied to it, fluttering to the right in the wind, faded red, then ochre, then teal toward its frayed tip, like a prayer flag.
Stone: cool grey-violet fell stone (#2e2a40 seams, #4a4560, #6e6884, #9490a8, #c0bccc lit edges), the lichen #8a9a6a, #b8b070, #d8c878.""" ),
}
