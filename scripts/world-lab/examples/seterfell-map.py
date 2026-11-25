"""Writes themes/zelda/world/seterfell.ts from the layout (seterfell.py) and the places below."""
import json, subprocess, sys

OUT = sys.argv[1]
rows = [list(r) for r in json.loads(subprocess.check_output(['python3', '-I', sys.argv[2]]))]
W, H = len(rows[0]), len(rows)
ROAD = {','}
VERGE = set('.:;')


def at(x, y):
    return rows[y][x]


marks = {}      # char -> TS expression
placed = []     # (char, x, y)


def mark(ch, x, y, expr, under_ok=None):
    t = at(x, y)
    if under_ok is None:
        assert t not in '#TH~FO|', f'{ch} at {x},{y} on {t}'
    assert ch not in marks or marks[ch] == expr, ch
    marks[ch] = expr
    placed.append((ch, x, y))


def q(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def lines(*ls):
    return '[' + ', '.join(q(l) for l in ls) + ']'


def npc(id, look, talk, extra=''):
    return f"npc({q(id)}, {q(look)}, [{talk}]{', ' + extra if extra else ''})"


def br(*ls, when=None, give=None, set_=None):
    parts = []
    if when: parts.append(f'when: {when}')
    parts.append(f'lines: {lines(*ls)}')
    if give: parts.append(f"give: '{give}'")
    if set_: parts.append(f"set: '{set_}'")
    return '{ ' + ', '.join(parts) + ' }'


# ---- the way in from Whisper Woods ------------------------------------------------------------------------
mark('A', 45, 51, "gateHome('fell')", under_ok=True)
# ---- signs ----------------------------------------------------------------------------------------------
mark('B', 43, 48, "sign('SETER FELL. SUMMER PASTURE.\\nCLOSE EVERY GATE BEHIND YOU.')")
mark('E', 39, 32, "sign('THE BIG SETER\\nMILK, CHEESE, BUTTER.\\nNO BUTTER FOR THE NISSE.')")
mark('J', 39, 35, "sign('↑ THE BIG SETER.\\n← LOWER PASTURE.\\n↓ WHISPER WOODS.')")
mark('K', 52, 9, "sign('THE LOOKOUT.\\n↓ THE BIG SETER.\\n→ TROLL HUMPS.')")
mark('L', 4, 16, "sign('← LUMENBY QUARRY.\\n→ THE BIG SETER.')")
mark('M', 66, 21, "sign('→ THE SPORELIGHT.\\n← THE BIG SETER.')")
mark('N', 25, 4, "sign('↑ YULE FJORD, OVER THE TOPS.\\n↓ THE BIG SETER.')")
mark('P', 32, 48, "sign('THE FELL\\'S EDGE.\\nBELOW: PHAREIM.NO.')")
mark('Q', 29, 9, "sign('CAIRN. ADD A STONE. TAKE NONE.')")
# ---- people ---------------------------------------------------------------------------------------------
mark('a', 35, 21, npc('q.bell.home', 'dairymaid', br("SIGRID: THE BELL RANG, AND THERE I WAS. HOME, WITH HAY IN MY HAIR.", "SIGRID: THE COWS DIDN'T EVEN NOTICE I WAS GONE. HERE. FOR YOUR WALK.", give='bits50'), "{ hide: { notFlag: 'q.bell.rung' } }"))
mark('d', 42, 24, npc('q.bell.tail', 'huldra',
    br('SOLVEIG: A BELL THAT RINGS! NOW I CAN BE WED UNDER IT.', '(SOMETHING SWISHES BEHIND HER SKIRT. NOBODY MENTIONS IT.)', when="{ flag: 'q.bell.rung' }") + ', ' +
    br("SOLVEIG: LOVELY EVENING. DON'T LOOK DOWN.", 'SOLVEIG: I WANT TO BE WED UNDER A BELL THAT RINGS. THE ONE ON THE FJORD IS CRACKED.')))
mark('g', 40, 21, npc('seterfell.dairymaid', 'dairymaid', br('DAIRYMAID: THREE COWS MISSING, AND FIVE DAYS TILL WE WALK THE HERDS DOWN.', 'DAIRYMAID: CHEESE ON EVERY SHELF, BUTTER IN THE CHURN. HANDS OFF BOTH.')))
mark('h', 38, 20, npc('seterfell.nisse', 'troll', br('BARN NISSE: NO BUTTER. NO BUTTER! NOT A SCRAP OF BUTTER IN MY PORRIDGE.', 'BARN NISSE: SOMEONE WILL HEAR ABOUT THIS PORRIDGE. SOMEONE WITH COWS.')))
mark('j', 34, 28, npc('seterfell.goat', 'fellgoat', br('(THE GOAT EYES YOUR COAT.)', 'MAA.'), '{ wander: true }'))
mark('k', 11, 21, npc('seterfell.elder', 'owl', br('MOUND ELDER: SOMEBODY DUG INTO MY PANTRY. I WOULD LIKE A WORD WITH THEM.', 'MOUND ELDER: WE LIVE UNDER THE MOUNDS AND HEAR EVERY FOOTSTEP. YOURS ARE LOUD.')))
mark('m', 28, 6, npc('q.map.cairn', 'owl',
    br('STEINAR: THAT PAGE BELONGS TO SOMEONE IN STILLSAND.', 'STEINAR: SOUTH-EAST, PAST THE GRAVES. I PUT A STONE DOWN FOR YOU.', when="{ flag: 'q.map.p3' }") + ', ' +
    br('STEINAR: I KEEP THE CAIRNS. A PAGE BLEW INTO THIS ONE. IT HAS DUNES ON IT.', 'STEINAR: WE HAVE NO DUNES UP HERE. TAKE IT.', set_='q.map.p3')))
mark('p', 58, 21, npc('seterfell.herder', 'oldherder', br("OLD HERDER: DON'T WHISTLE NEAR THE HUMPS. THEY'RE ONLY HILLS IN THE DAYTIME.", 'OLD HERDER: FIFTY SUMMERS UP HERE. EVERY ONE ENDS THE SAME: WE WALK DOWN, THEY MOVE IN.')))
mark('s', 20, 39, npc('seterfell.ashlad', 'kid', br('ASH LAD: THAT HILL HAS A NOSE. I POKED IT. IT SNEEZED.', "ASH LAD: MY BROTHERS SAY I'M NO GOOD FOR ANYTHING. I'M GOOD AT POCKETS."), '{ wander: true }'))
mark('y', 42, 37, npc('seterfell.walker', 'keeper', br("WALKER: FORTY YEARS ON THESE PATHS. THE CAIRNS MOVE ABOUT. I DON'T ASK.", "WALKER: YULE FJORD IS NORTH, OVER THE TOPS. I DON'T GO. TOO DARK UP THERE FOR ME.")))
mark('u', 16, 44, npc('seterfell.sitter', 'tree', br("SITTER: I'LL WALK ON. TOMORROW. PROBABLY.", 'SITTER: I STOPPED HERE FOR A REST. THE MOSS WAS VERY WELCOMING.')))
mark('v', 60, 17, npc('seterfell.goat2', 'fellgoat', br('(THE GOAT IS CHEWING SOMETHING. IT MAY ONCE HAVE BEEN A HAT.)'), '{ wander: true }'))
# ---- chests, the pantry door ----------------------------------------------------------------------------
mark('1', 45, 15, "{ ent: { t: 'chest', id: 'seterfell.ledge', item: 'heartPiece' } }")
mark('2', 62, 33, "{ ent: { t: 'chest', id: 'seterfell.nostril', item: 'bits50' } }")
mark('3', 5, 46, "{ ent: { t: 'chest', id: 'seterfell.hedge', item: 'bits20' } }")
mark('5', 7, 21, "{ ent: { t: 'warp', to: 'fellcave', entry: 'door' }, tile: 'D' }", under_ok=True)
# ---- foes (blobs, hounds, bats, a sentry), away from the ways in ------------------------------------------
for x, y in [(5, 33), (30, 45), (8, 12)]: mark('6', x, y, "{ ent: { t: 'enemy', kind: 'blob' } }")
for x, y in [(65, 31), (61, 46)]: mark('7', x, y, "{ ent: { t: 'enemy', kind: 'hound' } }")
for x, y in [(40, 9), (57, 15)]: mark('8', x, y, "{ ent: { t: 'enemy', kind: 'bat' } }")
mark('9', 18, 8, "{ ent: { t: 'enemy', kind: 'sentry' } }")
# ---- cairns along the ridge path -------------------------------------------------------------------------
for x, y in [(26, 5), (31, 6), (35, 9), (24, 9)]:
    assert at(x, y) in VERGE, (x, y, at(x, y))
    rows[y][x] = 'I'

for ch, x, y in placed:
    rows[y][x] = ch

entries = {
    'gate-fell': (45.5, 48.5, 'up'), 'camp': (37.5, 28.5, 'down'), 'ridge': (30.5, 10.5, 'down'),
    'mounds': (12.5, 17.5, 'right'), 'humps': (56.5, 23.5, 'right'), 'pasture': (22.5, 38.5, 'down'),
    'fellcave': (7.5, 22.5, 'down'),
}

# ---- lanterns on verges beside the roads ----------------------------------------------------------------
def verge_near(tx, ty):
    best = None
    for y in range(max(1, ty - 3), min(H - 1, ty + 4)):
        for x in range(max(1, tx - 3), min(W - 1, tx + 4)):
            if rows[y][x] in VERGE and any(rows[y + dy][x + dx] in ROAD for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]):
                d = abs(x - tx) + abs(y - ty)
                if best is None or d < best[0]:
                    best = (d, x, y)
    assert best, (tx, ty)
    return best[1], best[2]

lanterns = []
for tone, pts in [('gold', [(43, 45), (47, 42), (42, 39), (38, 33)]), ('cyan', [(29, 16), (19, 18), (6, 18)]),
                  ('violet', [(52, 22), (62, 21), (68, 21)]), ('pink', [(24, 7), (33, 7), (44, 7)])]:
    for tx, ty in pts:
        x, y = verge_near(tx, ty)
        lanterns.append(f"  lantern('{tone}', {x + 0.5}, {y + 0.5}),")

# ---- fences: dry-stone walls over every F --------------------------------------------------------------------
fences = []
for y in range(H):
    for x in range(W):
        if rows[y][x] != 'F':
            continue
        ew = (x > 0 and rows[y][x - 1] in 'F,') or (x < W - 1 and rows[y][x + 1] in 'F,')
        ns = (y > 0 and rows[y - 1][x] in 'F,') or (y < H - 1 and rows[y + 1][x] in 'F,')
        art = 'seter_fence_ew' if ew and not (ns and not ew) else 'seter_fence_ns'
        if ns and not ew:
            art = 'seter_fence_ns'
        fences.append(f'[{x}, {y}, {q(art)}]')

src = f"""/**
 * SETER FELL: the high summer pasture above the town and Whisper Woods (docs/worlds/atlas.md; its place on the
 * grid is world/atlas.ts). The fell road climbs from the woods gate through the birches to the BIG SETER, the
 * huts in their dry-stone ring where Sigrid comes home when the fjord's bell rings. West of the stream lie the
 * MOUNDS, where the tusse keep their pantry and the road goes on to Lumenby; east the TROLL HUMPS, sleeping trolls
 * with birches on their backs, and the pass down to the Sporelight; north CAIRN RIDGE, the tarn, the lookout and
 * the way over the tops to Yule Fjord. The LOWER PASTURE's hay fields, mill and pond run to the fell's edge over
 * the town. A heart piece waits on a ledge the seter can see and only the ridge can reach.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type {{ AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch }} from '../types'
import {{ gateHome }} from './gates'
import {{ at, cycle, lantern, light, prop }} from './scenery'

type Npc = Extract<EntDef, {{ t: 'npc' }}>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {{}}): Mark => ({{ ent: {{ t: 'npc', id, look, talk, ...more }} }})
const sign = (text: string): Mark => ({{ tile: 'S', ent: {{ t: 'sign', lines: [text] }} }})

/** The fell's first-visit words, in whichever area the hero arrives (a gate, a pass): once. */
const INTRO: AreaIntro = {{ lines: ['HEATHER, BIRCHES AND COWBELLS: THE LAST WEEK OF SUMMER ON THE HIGH PASTURE.', 'SOME OF THE HILLS ARE BREATHING.'], who: null, flag: 'realm:seterfell' }}

/** A seter hut: grass roof, hearth at the door, smoke from the chimney; cover is its 3×3 of H. */
const hut = (x: number, y: number): IsoLandmark => prop('seter_hut', x + 1.5, y + 1.5, {{
  night: 'seter_hut_night', cover: {{ x, y, w: 3, h: 3 }}, motion: cycle(2, 2),
  lights: [light('amber', 2.6, 0.75, {{ z: 0.5, dy: 1.8 }}), light('fire', 2.4, 0.45, {{ dx: -0.4, dy: -0.8, z: 2, anim: 'fire' }})],
}})
/** A troll asleep as a hill on the heather of a HUMP (9×7 at x, y), breathing slowly; solid where it lies. */
const troll = (x: number, y: number): IsoLandmark => prop('seter_troll_big', x + 4.4, y + 4.8, {{ ...at(x + 3, y + 3, 3, 2), motion: cycle(2, 0.3), shadow: {{ tall: 1.0, wide: 0.91, deep: 0.55 }} }})
/** A small one, asleep as a mound. */
const mound = (x: number, y: number): IsoLandmark => prop('seter_troll_small', x + 2.5, y + 1.75, {{ motion: cycle(2, 0.25), shadow: {{ tall: 0.66, wide: 0.64 }} }})
/** The dry-stone walls: a piece over each fence tile. */
const WALLS: Array<[number, number, string]> = [{', '.join(fences)}]

export const SETERFELL: MapDef = {{
  id: 'seterfell',
  name: 'SETER FELL',
  kind: 'overworld',
  track: 'forest',
  look: 'wild',
  realm: 'seterfell',
  kits: ['meadow'],
  views: ['iso', 'classic'],
  away: true,
  rows: [
{chr(10).join("    '" + ''.join(r) + "'," for r in rows)}
  ],
  areas: [
    {{ name: 'CAIRN RIDGE', x: 0, y: 0, w: 72, h: 14, entry: 'ridge', intro: INTRO }},
    {{ name: 'THE MOUNDS', x: 0, y: 14, w: 25, h: 20, entry: 'mounds', intro: INTRO }},
    {{ name: 'THE BIG SETER', x: 25, y: 14, w: 25, h: 20, entry: 'camp', intro: INTRO }},
    {{ name: 'TROLL HUMPS', x: 50, y: 14, w: 22, h: 38, entry: 'humps', intro: INTRO }},
    {{ name: 'LOWER PASTURE', x: 0, y: 34, w: 34, h: 18, entry: 'pasture', intro: INTRO }},
    {{ name: 'THE FELL ROAD', x: 34, y: 34, w: 16, h: 18, entry: 'gate-fell', intro: INTRO }},
  ],
  entries: {{
{chr(10).join(f"    '{k}': {{ x: {x}, y: {y}, dir: '{d}' }}," for k, (x, y, d) in entries.items())}
  }},
  isoLandmarks: [
    // The realm's arch over the gate road, lit at night.
    prop('gate_seterfell_ns_off', 45.5, 47.5, {{ night: 'gate_seterfell_ns_on' }}),
    // The Big Seter: Sigrid's hut, the byre, two more huts; the churns by the path.
    hut(34, 18), hut(44, 18), hut(28, 25),
    prop('seter_byre', 40.5, 19.5, {{ cover: {{ x: 39, y: 18, w: 3, h: 3 }} }}),
    prop('seter_churns', 33.5, 24.45, at(33, 24)),
    // The hay barn in the Lower Pasture, the mill on its knoll, the haystacks.
    prop('seter_byre', 26.5, 42.5, {{ cover: {{ x: 25, y: 41, w: 3, h: 3 }} }}),
    prop('meadow_mill', 22.5, 35.5, {{ motion: cycle(4, 2), cover: {{ x: 22, y: 35, w: 1, h: 1 }}, shadow: {{ tall: 1.45, wide: 0.44 }} }}),
    prop('meadow_hay_large', 6.5, 37.5, at(6, 37)),
    prop('meadow_hay_medium', 9.5, 38.5, at(9, 38)),
    prop('meadow_hay_medium', 12.5, 42.5, at(12, 42)),
    prop('meadow_hay_small', 5.5, 42.5, at(5, 42)),
    // The lookout's waystone on Cairn Ridge.
    prop('meadow_waystone', 51.5, 8.5, {{ ...at(51, 8), light: {{ r: 1.6, tone: 'cyan', a: 0.5 }} }}),
    // The trolls asleep as hills, and the small ones as mounds (not the elder's: its door is the pantry's).
    troll(54, 8), troll(58, 26), troll(56, 37),
    mound(5, 27), mound(17, 24), mound(63, 14), mound(62, 41),
{chr(10).join(lanterns)}
    ...WALLS.map(([x, y, art]) => prop(art, x + 0.5, y + 0.5, {{ cover: {{ x, y, w: 1, h: 1 }} }})),
  ],
  marks: {{
{chr(10).join(f"    '{ch}': {expr}," for ch, expr in marks.items())}
  }},
}}

/** UNDER THE FELL: the tusse's pantry under the elder's mound, through the hole somebody dug in its roof. */
export const FELLCAVE: MapDef = {{
  id: 'fellcave',
  name: 'UNDER THE FELL',
  kind: 'interior',
  track: 'indoor',
  cells: {{ '0,0': {{ dark: true }} }},
  rows: [
    '################',
    '#[[[..oo..[[[..#',
    '#..............#',
    '#.o..t....t..o.#',
    '#......a.......#',
    '#..nn.....nn...#',
    '#..............#',
    '#.....1........#',
    '#..............#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {{
    '@': {{ ent: {{ t: 'entry', id: 'door', dir: 'up' }} }},
    D: {{ tile: 'D', ent: {{ t: 'warp', to: 'seterfell', entry: 'fellcave' }} }},
    '1': {{ ent: {{ t: 'chest', id: 'fellcave.pantry', item: 'bits50' }} }},
    a: npc('fellcave.tusse', 'kid', [{{ lines: ['TUSSE: THE PANTRY IS SHUT FOR STOCKTAKING. THE CHEESE IS BEING COUNTED.', 'TUSSE: SOMEBODY DUG A HOLE IN THE ROOF. THE ELDER IS VERY CROSS ABOUT IT.'] }}]),
  }},
}}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = {{ seterfell: SETERFELL, fellcave: FELLCAVE }}
"""
open(OUT, 'w').write(src)
print('ok', W, H, len(fences), 'walls', len(lanterns), 'lanterns')
