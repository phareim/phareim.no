# The seterfell pair of the realm arches (frontierArt/gates.ts -> the seter art pack: gate_seterfell_<ns|ew>_<off|on>).
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-seterfell.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}

ARCH = """A gate arch over a road into a Norwegian mountain summer farm land: two tall square gateposts of stacked dark weathered logs (#3a2418, #5a3a26, #7a5434, #9a7048 lit) standing on footings of grey-violet stones (#5a5470, #7e7890, #a8a2b8), each post wearing its own little gabled turf roof of grass and moss (#2f5a1e, #4f8a2a, #7fb03a, #b8d050) with a few grass tufts and tiny flowers, a long pale birch pole (white bark #e8e4dc, #c8c2b8, with black marks) slung between the posts near their tops, and two small iron lanterns hanging from the pole on short chains, one either side of the middle. The lanterns are UNLIT: dark iron frames with dark glass panes. Never pure green."""

SHEETS = {
 'gate_ns': dict(size=(1024, 1536), pitch=8.5, key='magenta', ids=['gate_seterfell_ns_off'], n='one object', every='the arch',
   what='a gate arch over a road', names={'gate_seterfell_ns_off': 'arch'},
   desc=ARCH + " The pole runs between the two posts exactly as in the guide."),
 'gate_ew': dict(size=(1024, 1536), pitch=8.5, key='magenta', ids=['gate_seterfell_ew_off'], n='one object', every='the arch',
   what='a gate arch over a road', names={'gate_seterfell_ew_off': 'arch'},
   desc=ARCH + " The pole runs between the two posts exactly as in the guide."),
}

# Round 2 (2026-11-26): the other five realms' arches, both road ways, each drawn UNLIT (its `_off`); `_on` is the same
# drawing with its lamps and tubes lit by kitbuild --glows (each light part drawn in a dull colour of its own, so the
# edit can find it). Each sheet carries its own realm's concept painting.
def _refs(realm):
    return {'concept.png': f'docs/worlds/img/concept-{realm}.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}

ROSE = """an UNLIT neon tube: pale dull rose-grey glass (#7a6070 shade, #a08890, #c8b0b8 highlight), never bright"""
TEAL = """UNLIT glass: dull grey-teal (#3a5a64 shade, #5a7a84, #8aa4ac highlight), never bright"""
SIGN_TEXT = """The ONLY lettering allowed anywhere is the sign's own words exactly as the guide shows them, in chunky pixel letters that read clearly."""
ARCHES2 = {
 'lumenby': ('a timber mine headframe arch over a road into a neon quarry town', f"""A gate arch over the road into Lumenby quarry, as the timber work in concept.png: two heavy legs of sawn weathered timber (#2e1a12 seams, #4a2a1e, #6a4028, #8a5a38, #b07a4c lit tops) with iron straps, each splaying into braces down to a stone footing (#5a4a48, #7e6a60), a thick timber beam across the top, a big iron winding wheel (spoked, dark iron #2e2c44, #4a4866, #6e6c90 lit) standing in two timber cheeks on the middle of the beam, a cable running from the wheel down to the left leg, and a square iron miner's lamp hanging on a short chain under the middle of the beam: its four glass panes are {TEAL} (the lamp is out)."""),
 'sporelight': ('a living fungus arch over a road into a glowing mushroom forest', f"""A gate arch over the road into the Sporelight, as the fungus in concept.png: two pale violet-grey fibrous mushroom stems (#3a2e5a shade, #6a5a8e, #9a8ab8, #c8bce0 lit) rising from mossy bulbs of teal-blue moss (#0e3a40, #16605a, #2a8a7a) and bending in to share one wide domed cap of deep violet (#2a1450, #4a2280, #6e34b0, #9a5ad8 lit top). The cap's round spots are dull grey-teal (#5a7a84, #8aa4ac) and the gills under its rim are dull rose-violet (#6a4a68, #8a6a88): the arch is ASLEEP, nothing glows. A few spore drops hang on threads from the rim, and two small round paper lanterns hang on cords from the cap's rim, one either side of the road, UNLIT: dull ochre paper (#6a5a38, #8a7a50, #a89870) with dark caps. Never pure green."""),
 'stillsand': ('a sandstone and quartz arch over a road into a still desert of floating islands', f"""A gate arch over the road into Stillsand, as the stone and crystal in concept.png: two tall pale quartz pillars (#8a80a8 shade, #b8b0d0, #dcd6ec, #f4f0ff lit edges), faceted, each ending in a crystal point, a small crystal leaning at each foot, standing on plinths of layered warm sandstone (#8a5a48, #b07a5a, #d09a70, #e8bc90 lit layers); a sandstone lintel across the top, and on the middle of the lintel a round sun disc with eight short rays. A thin vein winds up the middle of each pillar's front in dull grey-violet (#5a4a7a, #6a5a8e): it is unlit. The sun disc and its rays are dull dark bronze (#4a3420, #6a4a2c, #8a6a40): unlit, not gold."""),
 'fogstage': ('a theatre proscenium arch over a road into a stage-set town in pink fog', f"""A gate arch over the road into Fogstage, as the stage sets in concept.png: two tall painted stage flats as pillars, each a frame of raw pale timber (#6a4a30, #a07a50, #c8a070) covered with heavy folded crimson velvet curtain (#3a0a1e shade, #6a1030, #9a1a40, #c83a5a lit folds) with a gold tie-back cord, a timber brace behind each flat and a sandbag (#8a7a5a, #b0a078) on its foot; across the top a header of velvet with swagged valance and a pale fringe, and on its front a marquee board: a dark board (#1a1020) with the word FOGSTAGE on it in {ROSE}, and a ring of small round light bulbs all round the board's edge, UNLIT: pale grey-cream glass (#8a8478, #b0aa9c). {SIGN_TEXT}"""),
 'rerun': ('a suburban welcome-sign archway over a road into a 1950s estate', f"""A gate arch over the road into Rerun Estates, as the suburb in concept.png: two square posts of warm red-brown brick (#5a2a20, #8a4030, #b05a40, #d08060 lit, pale mortar lines #c8b8a0) with pale stone caps (#a8a0a8, #d0c8d0), a round globe lamp on a short chrome stem on each cap whose glass is {TEAL}; between the posts a big sign board painted mailbox red (#6a0a14 shade, #a01824, #c8283a, #e85060 lit edge) with a pale cream border, the word WELCOME across it in {ROSE}, and under it EST 1958 in small cream painted letters (#f0e0c0); above the board a stepped rounded crest of the same red with a tube along its edge that is {TEAL}. {SIGN_TEXT}"""),
}
for _realm, (_what, _desc) in ARCHES2.items():
    for _road in ('ns', 'ew'):
        SHEETS[f'{_realm}_{_road}'] = dict(size=(1024, 1536), pitch=8.5, ids=[f'gate_{_realm}_{_road}_off'], n='one object', every='the arch',
            what=_what, names={f'gate_{_realm}_{_road}_off': 'arch'}, refs=_refs(_realm),
            desc=_desc + ' Exactly the shape, angle and parts of the guide.')
