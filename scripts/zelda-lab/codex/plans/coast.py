# The coast's kit (frontierArt/coast.ts -> the coast art pack): the hand-made maps' neon waymarks by the gates (six, each a
# sign naming a land with a neon arrow; frame _0 drawn with the arrow lit, frame _1 the same drawing with the arrow
# out: the blink) and the BORDER arms, down and up.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-lumenby.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
NEONWORLD = """Road signs of a neon-lit fantasy world at dusk, as in concept.png."""
SIGN = """Each is a big roadside waymark sign: a long black-violet sign panel (#0c0818 face, #1c1630 frame, #2e2650, #4a4278 lit edges, a few rivets) held up by two slim dark iron posts with small square stone feet, facing the way the guide's panel faces. On the panel's face, exactly where the guide has its letters, the land's NAME in glowing cyan neon tube letters (#0a8aa8 edge, #2ff3ff, #c4fbff hot core), bold and blocky, easy to read; under the name, exactly where the guide has its pink arrow, a long glowing hot-pink neon ARROW (#a01a6a edge, #ff4aa8, #ffc4e8 hot core) pointing the way the guide's arrow points. The names are part of the signs and must be drawn, spelled exactly as given; no other text anywhere."""
IRON = """Iron: dark blue-violet iron (#100c1e outline, #221c36, #3a3254, #5a5278 lit edges)."""
NAMES = {
    'waymark_lumenby_n_0': 'LUMENBY', 'waymark_seterfell_n_0': 'SETER FELL', 'waymark_sporelight_n_0': 'SPORELIGHT',
    'waymark_stillsand_e_0': 'STILLSAND', 'waymark_fogstage_w_0': 'FOGSTAGE', 'waymark_rerun_e_0': 'RERUN ESTATES (on two lines: RERUN above, ESTATES below)',
}

def signs(ids):
    return dict(size=(1536, 1024), pitch=10, ids=ids, n='two objects', every='both signs', what='two big neon waymark signs naming lands',
                names={i: f'{"left" if k == 0 else "right"} sign' for k, i in enumerate(ids)},
                desc=f"""{NEONWORLD}
{SIGN}
Left sign: {NAMES[ids[0]]}. Right sign: {NAMES[ids[1]]}.
{IRON}""")

BORDER = """Each is a BORDER boom barrier: a heavy iron post box (a square pillar of dark blue-violet riveted iron, #1c1630, #2e2650, #4a4278, #6e66a0 lit, with a hinge drum and a counterweight) holding a long boom arm, and a short rest post at the far end. The arm is painted in diagonal stripes of red and white (#8a1a2a, #d0304a, #f0e8f0, #c8c0d8), and in its middle it carries a black sign plate with the word BORDER in glowing hot-pink neon letters (#a01a6a edge, #ff4aa8, #ffc4e8 hot core), bold and easy to read (that word is part of the barrier and must be drawn; no other text)."""

SHEETS = {
 'signs1': signs(['waymark_lumenby_n_0', 'waymark_seterfell_n_0']),
 'signs2': signs(['waymark_sporelight_n_0', 'waymark_stillsand_e_0']),
 'signs3': signs(['waymark_fogstage_w_0', 'waymark_rerun_e_0']),
 'borderdown': dict(size=(1536, 1024), pitch=8, ids=['border_ns_down', 'border_ew_down'], n='two objects', every='both barriers',
   what='two boom barriers with their arms down (closed)', names={'border_ns_down': 'left barrier', 'border_ew_down': 'right barrier'},
   desc=f"""{NEONWORLD}
{BORDER}
Both arms are DOWN (closed), lying level across the road from the post box to the rest post, exactly as in the guide (the left one runs from the post box at its left down to the right; the right one from its post box at the lower left up to its rest post at the upper right)."""),
 'borderup': dict(size=(1536, 1024), pitch=7.8, ids=['border_ns_up', 'border_ew_up'], n='two objects', every='both barriers',
   what='two boom barriers with their arms raised (open)', names={'border_ns_up': 'left barrier', 'border_ew_up': 'right barrier'},
   desc=f"""{NEONWORLD}
{BORDER}
Both arms are UP (open), standing straight up from the post box, the BORDER letters reading from bottom to top along the raised arm, exactly as in the guide; the rest post stands alone where the guide has it."""),
}
