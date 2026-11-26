# Fogstage's kit (frontierArt/fogstage.ts -> fogstageData.ts): the spotlight and its eight head directions, the
# painted flat (a stage castle flat on struts), sandbags, eight theatre posters (7 = THE END, lit), the RAINCHECK blimp
# (a striped touring blimp with a gondola stage and a red belly light) and the gangway.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-fogstage.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
STAGE = """An open-air theatre in a sea of fog at dusk, as in concept.png: velvet reds, painted canvas, timber and rope, brass, warm stage light."""
IRON = """Iron and brass: a black-violet iron stand (#100c1e outline, #221c36, #3a3254, #5a5278 lit), brass fittings (#6a4a18, #a87a2a, #e0b048)."""
WOOD = """Timber: weathered brown planks and battens (#2a160e seams, #4a2a1a, #6a4228, #8e5e38, #b48250 lit edges)."""
SPOT = """Each is the same theatre follow-spotlight on its stand: a square iron foot plate, a tall slim iron pole, a yoke at its top holding a round barrel lamp (black-violet iron with brass bands, cooling fins on its back, a little visor over the front) tipped slightly down. The lamp's head points the way the guide's head points: its LENS is at the end where the guide shows gold and white, a round brass-rimmed glass lens lit warm white-gold (#ffd23f rim light, #fff1b0, #ffffff hot centre), the barrel's dark back cap at the other end. Where the guide shows the lens turned away, show only a thin warm glowing rim round the barrel's far end."""

def spots(ids, names):
    return dict(size=(1536, 1024), pitch=11, ids=ids, n=f'{len(ids)} objects', every='all the spotlights',
                what='theatre spotlights on tall stands, their heads turned different ways', names=names,
                desc=f"""{STAGE}
{SPOT}
The foot, the pole and the yoke are exactly the same in every one; only the way the head points differs, exactly as in the guide.
{IRON}""")

POSTER = """Each is a theatre poster on a poster board: a wooden board frame on two dark posts, the poster paper (facing the viewer's lower left) printed with one bold picture in two or three flat ink colours, worn and a little torn at one corner, a strip of paste-wrinkles. Each poster is different; draw the picture where the guide has its coloured shape, as big as it:"""
POSTERS = {
 0: 'a mystery play: a huge hot-pink question mark on deep violet-navy paper, a few small pale stars',
 1: 'a circus: a big gold-and-cream striped circus tent (big top) on maroon paper, a little flag on top',
 2: 'a ballet: a cyan dancer leaping, arms up, on dusty brown-rose paper',
 3: 'a musical: a big hot-pink M made of light bulbs (unlit) on pale grey-lilac paper',
 4: 'a sea opera: a cyan whale breaching on black-navy paper, a few white spray dots',
 5: 'a comedy: a gold laughing theatre mask on hot-magenta paper',
 6: 'a romance: a big hot-pink heart on cream-brown paper, two small birds above it',
 7: 'THE END, LIT: two dark red velvet stage curtains drawn closed on black, the words THE END across them in glowing warm white-gold letters (#ffd23f, #fff1b0, #ffffff), and a frame of small glowing round marquee bulbs (#ffd23f with #fff1b0 centres) all round the poster: the only lit poster',
}

def posters(ks):
    return dict(size=(1536, 1024), pitch=10, ids=[f'fogstage_poster_{k}' for k in ks], n='four objects', every='all four posters',
                what='four theatre posters on wooden poster boards', names={f'fogstage_poster_{k}': f'poster {i + 1}' for i, k in enumerate(ks)},
                desc=f"""{STAGE}
{POSTER} """ + '; '.join(f'{i + 1}: {POSTERS[k]}' for i, k in enumerate(ks)) + f""".
No words on the posters except THE END where it is asked for. Printed paper does not glow.
{WOOD}""")

SHEETS = {
 'spots1': spots(['fogstage_spotlight', 'fogstage_spotlight_0', 'fogstage_spotlight_1', 'fogstage_spotlight_2', 'fogstage_spotlight_3'],
                 {'fogstage_spotlight': 'first spotlight', 'fogstage_spotlight_0': 'second spotlight', 'fogstage_spotlight_1': 'third spotlight',
                  'fogstage_spotlight_2': 'fourth spotlight', 'fogstage_spotlight_3': 'fifth spotlight'}),
 'spots2': spots(['fogstage_spotlight_4', 'fogstage_spotlight_5', 'fogstage_spotlight_6', 'fogstage_spotlight_7'],
                 {'fogstage_spotlight_4': 'first spotlight', 'fogstage_spotlight_5': 'second spotlight', 'fogstage_spotlight_6': 'third spotlight',
                  'fogstage_spotlight_7': 'fourth spotlight'}),
 'set': dict(size=(1536, 1024), pitch=9.5, ids=['fogstage_flat', 'fogstage_gangway', 'fogstage_sandbags'], n='three objects', every='all three objects',
   what='a painted stage flat on struts, a wooden gangway with steps, and a pile of sandbags',
   names={'fogstage_flat': 'stage flat', 'fogstage_gangway': 'gangway', 'fogstage_sandbags': 'sandbags'},
   desc=f"""{STAGE}
Left: a painted stage flat: a thin canvas flat on a timber frame, standing upright, its painted face (facing the viewer's lower left) painted as the front of a little fairy-tale CASTLE: red-violet painted stone courses (#4a1430, #7a2448, #a83a5e, #cc5a7a lit), a painted dark arched gate in the middle, a painted window glowing cyan and one gold (just paint, not light), its top edge cut in a stepped castle gable as in the guide, the edge of the canvas showing pale; behind it, past its right edge, timber struts (diagonal braces) and stage weights holding it up, as in the guide.
Middle: a gangway: a narrow flight of wooden steps (#4a2a1a, #6a4228, #8e5e38, #b48250 lit) rising away from the viewer, with thin posts and a rope handrail (#c8a060, #8a6a3a) along both sides.
Right: a pile of four stage sandbags (counterweights): plump canvas bags (#6a5a40 shade, #9a8a60, #c8b888, #e8dcb0 lit) tied at the neck with string, stencilled with a small dark number, and a coil of red-brown rope beside them on the ground with its loose end.
{WOOD}"""),
 'posters1': posters([0, 1, 2, 3]),
 'posters2': posters([4, 5, 6, 7]),
 'blimp': dict(size=(1536, 1024), pitch=10, ids=['fogstage_raincheck'], n='one object', every='the blimp', what='a touring airship (blimp) with a stage gondola',
   desc=f"""{STAGE}
The RAINCHECK, a touring theatre blimp floating in the air: a long fat cigar-shaped envelope exactly the guide's shape, its fabric in wide stripes running along it, alternating cream (#8a8070 shade, #c8c0a8, #f0e8d0 lit) and raspberry red (#5a1028, #9a1e40, #d0385a, #f06080 lit), a band of hot-pink along its belly as in the guide, the name RAINCHECK painted big along its side in dark violet circus letters (that name is part of the blimp; no other text), its tail fins (at the left) striped too, seams and a few patches on the fabric.
Under it, hung on struts and rigging lines: the GONDOLA, a little travelling stage: a wooden cabin painted dark red with gold trim, an open stage front facing the viewer's lower left with red velvet curtains pulled aside and a row of small warm glowing footlights (#ffd23f, #fff1b0) where the guide has its gold windows, a tiny dark door at its right end.
On the envelope's belly, just in front of (to the right of) the gondola: one RED belly light, a small round red lamp glowing (#ff3a3a, #ffb0a0 core), inside the guide's outline."""),
}
