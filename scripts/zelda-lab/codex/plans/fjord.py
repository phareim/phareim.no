# Yule Fjord's kit (frontierArt/fjord.ts -> the fjord art pack). The lighthouse's beam frames (fjord_lighthouse_0..3) were
# held back in round 1; round 2 draws their beams over the drawn lens tower (sheets beam0..3 below, kitbeam.py).
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-yulefjord.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
SNOW = """Snow: thick soft pale lavender-white snow (#f4f0ff, #d8d0f0, #a8a0d0 in shade, #7a70b0 deep shade) lying on every roof and ledge, rounded at the edges, a few icicles hanging from the eaves."""
WINTER = """A Norwegian fjord village on a midwinter night under the northern lights, as in concept.png."""

SHEETS = {
 'boathouse': dict(size=(1536, 1024), pitch=10, ids=['fjord_boathouse'], n='one object', every='the boathouse', what='a red boathouse on stilts by a frozen fjord',
   desc=f"""{WINTER} A long boathouse (naust) of vertical red-painted boards (#5a1418 dark, #8a2228, #b83a3a, #d85a50 lit) with white trim, standing on dark wooden stilts over the water's edge, a snow-covered pitched roof, two big boat doors in the gable facing the viewer's lower right with a white X brace, small windows with warm lamplight (#ffd23f, #fff1b0) and a wreath, a wooden deck and steps at the front with a rope coil, a crate and a lifebuoy, as in the guide.
{SNOW}"""),
 'church': dict(size=(1024, 1536), pitch=9.2, ids=['fjord_church'], n='one object', every='the church', what='a small tarred stave church',
   desc=f"""{WINTER} A small Norwegian stave church of dark tarred wood (#1c1210, #2e1e18, #4a3020, #6a4a30 lit), stacked roofs heavy with snow, carved dragon heads at the gable ends, an arcaded gallery round the foot, small arched windows glowing with warm candlelight (#ffd23f, #fff1b0), a bell turret with an open lantern showing a gold bell, a slim snowy spire with a small gold cross on top, as in the guide.
{SNOW}"""),
 'cottage': dict(size=(1536, 1024), pitch=10, ids=['fjord_cottage'], n='one object', every='the cottage', what='an ochre snow-roofed cottage',
   desc=f"""{WINTER} A small cottage of horizontal ochre-yellow painted boards (#6a4818 dark, #a07028, #c89838, #e8b850 lit) with white window frames and corner boards, a snowy pitched roof, a brick chimney, its gable with a red door and a small porch light facing the viewer's lower left, small four-pane windows (draw the panes as dark blue glass with a faint warm reflection: the lamps inside are unlit), a little wreath on the door, snow drifts at its foot, as in the guide.
{SNOW}"""),
 'lighthouse': dict(size=(1024, 1536), pitch=10, ids=['fjord_lighthouse_lens_0', 'fjord_lantern'], n='two objects', every='both objects',
   what='a lighthouse (left) and a small lantern post (right)', names={'fjord_lighthouse_lens_0': 'lighthouse', 'fjord_lantern': 'lantern post'},
   desc=f"""{WINTER}
Left: a round lighthouse tower painted in broad red and white bands (#8a2228, #c83a3a, #e8e4f0, #b8b0d0 shade), a small door and two tiny windows, standing on a snowy rock; at the top a dark iron gallery with a railing round the lamp room, the lamp room's glass panes glowing gold (#ffd23f, #fff1b0, one bright white-gold pane), a red domed cap with a small gold finial. No light beam.
Right: a small dark wooden lantern post with an iron arm and a hanging lantern glowing warm gold, a little snow on top.
{SNOW}"""),
 'ice1': dict(size=(1536, 1024), pitch=14, ids=['fjord_floe_large'], n='one object', every='the ice floe', what='a flat floe of sea ice on dark water',
   desc="""A large flat floe of sea ice floating on a fjord at night, seen from above at the game's angle: a slab of pale blue-cyan ice (#1a6a8a edge shade, #2a9ac0, #6ad0e8, #c4f4ff glints) with patches of snow (#f4f0ff, #c8c0e8) on top, cracks, a thick ice edge showing its side where it meets the water. Only the ice: no water around it."""),
 'ice2': dict(size=(1536, 1024), pitch=14, ids=['fjord_floe_mid', 'fjord_floe_small'], n='two objects', every='both ice floes', what='two flat floes of sea ice',
   desc="""Two flat floes of sea ice floating on a fjord at night, seen from above at the game's angle: slabs of pale blue-cyan ice (#1a6a8a edge shade, #2a9ac0, #6ad0e8, #c4f4ff glints) with patches of snow (#f4f0ff, #c8c0e8) on top, cracks, a thick ice edge showing its side. Only the ice: no water around it."""),
 'mirrors': dict(size=(1536, 1024), pitch=14, ids=['fjord_mirror_a', 'fjord_mirror_b'], n='two objects', every='both blocks', what='two cube blocks of clear ice with a mirror line on top (puzzle blocks)',
   desc="""Two puzzle blocks for a light-beam puzzle: each a cube of clear blue ice (#1a5a8a, #3a8ac8, #8ad0f0, #e0f8ff glints) with pale frosted edges and a thin bright cyan glowing line (#2ff3ff with a white core) set into it EXACTLY where the guide shows it: on the left block from the top's left corner across to its right corner region as in the guide, on the right block the other diagonal, plus the thin glowing lines down the cube's edges as in the guide. The direction of the line on top is the puzzle: keep each block's line where its guide has it."""),
 'edges1': dict(size=(1536, 1024), pitch=11.5, ids=['fjord_edge_n', 'fjord_edge_e'], n='two objects', every='both pieces', what='two pieces of the frozen edge of a fjord, where the ice breaks off toward open water',
   desc="""Two pieces of the edge of the sea ice: each a flat strip of pale blue-cyan ice (#1a6a8a, #2a9ac0, #6ad0e8, #c4f4ff) with snow patches (#f4f0ff, #c8c0e8) and cracks, broken off along one side into a jagged edge with a few loose chunks beside it, exactly the shape of the guide. Only the ice: no water."""),
 'edges2': dict(size=(1536, 1024), pitch=11.5, ids=['fjord_edge_s', 'fjord_edge_w'], n='two objects', every='both pieces', what='two pieces of the frozen edge of a fjord, where the ice breaks off toward open water',
   desc="""Two pieces of the edge of the sea ice: each a flat strip of pale blue-cyan ice (#1a6a8a, #2a9ac0, #6ad0e8, #c4f4ff) with snow patches (#f4f0ff, #c8c0e8) and cracks, broken off along one side into a jagged edge with a few loose chunks beside it, exactly the shape of the guide. Only the ice: no water."""),
}

# Round 2 (2026-11-26): the beam frames fjord_lighthouse_0..3. The guide is the lens tower Codex already drew (baked
# fjord_lighthouse_lens_<k>, placed in frame k's box) with the solids' beam as a flat cream cone; Codex draws the beam.
# kitbeam.py keeps the baked tower's own px and takes only the beam from this drawing.
_BEAM_WAY = {0: 'out to the lower right', 1: 'out to the lower left', 2: 'away to the upper left', 3: 'away to the upper right'}
for _k in range(4):
    SHEETS[f'beam{_k}'] = dict(size=(1024, 1024) if _k < 2 else (1024, 1536), pitch=9.5, ids=[f'fjord_lighthouse_{_k}'],
        guide={f'fjord_lighthouse_{_k}': f'fjord_lighthouse_beam_{_k}'}, n='one object', every='the lighthouse and its beam',
        what='a red and white lighthouse already drawn as pixel art, and a flat cream placeholder where its light beam goes',
        names={f'fjord_lighthouse_{_k}': 'lighthouse with its beam'},
        desc=f"""{WINTER} The lighthouse tower in guide.png is ALREADY finished pixel art: copy it exactly as it is, pixel for pixel, same colours. Your job is the BEAM: where the guide has the flat cream placeholder shape, draw the lighthouse's beam of light shining {_BEAM_WAY[_k]} from the lamp room: one long straight cone of warm cream light, narrow and brightest at the lamp (#fffbe8 white-cream core, #fff1c0), widening and fading toward its far end (#f4dc98, #e0c078 at the edges), with a few dithered checkerboard pixels where it fades out at the far end and along its edges. It fills the placeholder's shape and stays inside it. Pixel art light: flat bands of colour along the cone, hand-placed dither, NO blur, NO soft glow, NO outline around the beam.""")
