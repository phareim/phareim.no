# The roadside kit (frontierArt/roadside.ts -> roadsideData.ts), always loaded, seen in every land: the road lanterns
# in five tones (drawn once each, UNLIT, the glass a dull tint of its tone; `_on` is the same drawing with the glass lit
# in its tone), the camp boards (a small notice board on two legs with a neon word, or blank), the camp log, tripod,
# shelter and the camp fire's four frames.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-seterfell.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
ROAD = """Roadside things of a neon-lit fantasy world: weathered, hand-made, a little magical, as the world in concept.png."""
IRON = """Iron: dark blue-violet painted iron (#141026 outline, #241e3e, #3a3260, #5a5288, #8a82b4 lit edges), a few rivets and chips."""
WOOD = """Wood: weathered brown planks and posts (#2a160e seams, #4a2a1a, #6a4228, #8e5e38, #b48250 lit edges), grain and nail heads."""
STONES = """Stones: rounded grey-violet field stones (#2a2638 dark, #4a4660, #6e6a86, #9a96ae lit tops)."""

LANTERN = """Each is a road lantern: a small square stone foot, a slim iron post with a little collar halfway up, and on top a square lantern head: four glass panes in an iron frame under a pointed iron cap with a small finial. The lantern is UNLIT: its glass is a dull, dark, smoky tint of its colour, with only a faint highlight, no light inside."""
GLASS = {
    'pink': 'smoky dull pink glass (#3e1a34, #5e2a4e, #7e3e68, #9a5a82 faint highlight)',
    'cyan': 'smoky dull cyan glass (#102e38, #1a4652, #28606c, #448088 faint highlight)',
    'violet': 'smoky dull violet glass (#24183e, #36265a, #4a3878, #665498 faint highlight)',
    'gold': 'smoky dull amber glass (#3a2a12, #56401c, #745a2a, #92763e faint highlight); this one has a band of dark wood as its collar',
    'rose': 'smoky dull rose glass (#3e2028, #5a2e3a, #78424e, #946068 faint highlight)',
}
TONES = ['pink', 'cyan', 'violet', 'gold', 'rose']

BOARD = """Each is a small wooden camp notice board: a plank sign board on two square wooden legs with their feet in small dark stones, the board's face (facing the viewer's lower left) a dark recessed panel framed in planks."""
NEON = {
    'pink': 'the word CAMP in glowing pink neon tube letters (#a01a6a, #ff4aa8, #ffc4e8 hot core)',
    'cyan': 'the word CAMP in glowing cyan neon tube letters (#0a8aa8, #2ff3ff, #c4fbff hot core)',
    'gold': 'the word CAMP in glowing warm gold neon tube letters (#c4861c, #ffd23f, #fff1b0 hot core)',
    'violet': 'the word CAMP in glowing violet neon tube letters (#5a2aa8, #a46aff, #e0ccff hot core)',
    'open': 'the word OPEN in glowing cyan neon tube letters (#0a8aa8, #2ff3ff, #c4fbff hot core)',
    'inn': 'the word INN in glowing warm gold neon tube letters (#c4861c, #ffd23f, #fff1b0 hot core)',
    'blank': 'nothing on it: a blank dark weathered panel, no letters, no light',
}

SHEETS = {
 'lanterns': dict(size=(1536, 1024), pitch=16, ids=[f'road_lantern_{t}_off' for t in TONES], n='five objects', every='all five lanterns',
   what='five road lanterns on slim posts', names={f'road_lantern_{t}_off': f'{t} lantern' for t in TONES},
   desc=f"""{ROAD} Big chunky pixels: these are small objects in the game, keep the details few and bold.
{LANTERN}
Left to right, the same lantern five times, only the glass differs: """ + '; '.join(f'{i + 1}: {GLASS[t]}' for i, t in enumerate(TONES)) + f""".
{IRON}
{STONES}"""),
 'boards1': dict(size=(1536, 1024), pitch=11, ids=['camp_board_pink', 'camp_board_cyan', 'camp_board_gold', 'camp_board_violet'], n='four objects',
   every='all four boards', what='four small wooden camp notice boards with neon words',
   names={f'camp_board_{k}': f'{k} board' for k in ['pink', 'cyan', 'gold', 'violet']},
   desc=f"""{ROAD} {BOARD}
On each board, exactly where the guide has its coloured letters, left to right: """ + '; '.join(f'{i + 1}: {NEON[k]}' for i, k in enumerate(['pink', 'cyan', 'gold', 'violet'])) + f""". The letters are bold, blocky and easy to read, one tube wide, filling the panel as in the guide. These words are part of the boards and must be drawn, spelled exactly so; no other text anywhere.
{WOOD}"""),
 'boards2': dict(size=(1536, 1024), pitch=14, ids=['camp_board_open', 'camp_board_inn', 'camp_board_blank'], n='three objects',
   every='all three boards', what='three small wooden camp notice boards',
   names={f'camp_board_{k}': f'{k} board' for k in ['open', 'inn', 'blank']},
   desc=f"""{ROAD} {BOARD}
On each board, exactly where the guide has its coloured letters, left to right: """ + '; '.join(f'{i + 1}: {NEON[k]}' for i, k in enumerate(['open', 'inn', 'blank'])) + f""". The letters are bold, blocky and easy to read, one tube wide, filling the panel as in the guide. These words are part of the boards and must be drawn, spelled exactly so; no other text anywhere.
{WOOD}"""),
 'camp': dict(size=(1536, 1024), pitch=12, ids=['camp_log', 'camp_tripod', 'camp_shelter'], n='three objects', every='all three objects',
   what='a log seat, a cooking tripod and a lean-to shelter', names={'camp_log': 'log', 'camp_tripod': 'tripod', 'camp_shelter': 'shelter'},
   desc=f"""{ROAD} A travellers' camp.
Left: a log to sit on: a round pine log lying on the ground, bark (#2a1a12, #4a3020, #6a4a30) with a pale cut end showing its rings (#c8a070, #e0c090), a strap of dark wood across it.
Middle: a cooking tripod: three thin wooden poles leaning together, lashed with rope at the top, a dark iron cooking pot (#1c1828, #3a3450, #5a5478 lit rim) hanging from a chain under the lashing, a lid on it, a ladle hooked on its rim.
Right: a lean-to shelter: a sloping roof of weathered planks (higher at the back) on four wooden posts, a plank back wall, a straw-and-sand floor (#c8a050, #e0c070) under it, a rolled blanket (rose-red, #7a2a3a, #a84050) lying on the floor.
{WOOD}"""),
 'fire': dict(size=(1536, 1024), pitch=13, ids=['camp_fire_0', 'camp_fire_1', 'camp_fire_2', 'camp_fire_3'], n='four objects', every='all four frames',
   what='four animation frames of the same camp fire', names={f'camp_fire_{i}': f'fire frame {i + 1}' for i in range(4)},
   desc=f"""{ROAD} Big chunky pixels. Four frames of ONE camp fire burning (the ring of stones and the logs are exactly the same in every frame; only the flames move, as the guide's flames do): a ring of eight rounded grey-violet stones, two split logs crossed in the middle (charred black ends, glowing orange embers), and the flames rising from them: a deep red base (#8a1a1a, #c8321e), orange (#ff7a1e), gold (#ffd23f) and a white-yellow heart (#fff1b0), a flickering tongue at the top and a single spark above it.
{STONES}"""),
}
