# The seterfell pair of the realm arches (frontierArt/gates.ts -> gatesData.ts: gate_seterfell_<ns|ew>_<off|on>).
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
