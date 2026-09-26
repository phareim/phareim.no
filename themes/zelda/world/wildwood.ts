/**
 * The Wildwood: the forest west of the town, along the shore (its own
 * overworld map, 84×52; the town's west road warps here). A thicket cut
 * open with the blade lets you in from the town; a little way in, cracked
 * boulders need a bomb. Past them: the Party's camp, Luna's hideout in the
 * brambles, Project Horizon's fenced lab (Luna slides the psi block off its
 * door), Radio Hill with Dusty's tower, the Riddle Grove where an owl asks
 * riddles you answer on letter stones, the troll by the broken bridge, and
 * the ravine: crossed with the hook, from post to post, into the Deep Woods
 * and the Deep Lab's bunker. Residents ask for help and give some:
 * Mossa (a waffle; three glowshrooms), Toby (his walkie-talkie), Max
 * (bombs, hints), Dusty (a vacuum tube), the troll (his hat), the owl.
 *
 * Generated once from a layout script, then edited by hand; marker chars
 * are listed in `marks`. Row 0 is the north edge; the sea is the south.
 */
import type { MapDef, Mark, TalkBranch } from '../types'

const npc = (id: string, look: import('../types').NpcLook, talk: TalkBranch[], extra: Partial<{ wander: boolean; dir: import('../types').Dir }> = {}): Mark =>
  ({ ent: { t: 'npc', id, look, talk, ...extra } })
const sign = (lines: string[]): Mark => ({ tile: 'S', ent: { t: 'sign', lines } })
const glyph = (ch: string): Mark => ({ ent: { t: 'glyph', ch } })

export const WILDWOOD: MapDef = {
  id: 'wildwood',
  name: 'THE WILDWOOD',
  kind: 'overworld',
  track: 'forest',
  look: 'wild',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..............TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TT.......;.T.T........T.T..TTTTT..A;...4....U.T..:......:...:TTTTTTTTTTTTTTTTTTTTTTT',
    'T...;;....;...T...T...T.;..OOOOO.....-...5....T:...HHHHH.....TTTTTTTTTTTTTTTTTTTTTTT',
    'TT..;TT..;T.T..T.T.....T.T.OOOOO...;..........T....HHHHH.:a..TTTTTTTTTTTTTTTTTTTTTTT',
    'T..T......T.........a;.....OOOOO....+..u..6...T.:..HHHHH.....TTTTTTTTTTTTTTTTTTTTTTT',
    'T....T...........T.....T.T.OOOOO........;...`.T....HHHHH.Z...TTTTTTTTTTTTTTTTTTTTTTT',
    'T...T.............T..T..T..OOOOO..;..9...7....T....HHgHH.Z...TTTTTTTTTTTTTTTTTTTTTTT',
    'T.....,,,,,,,,,;...........OOOOO.rrr...8......T.:....,....###TTTTTTTTTTTTTTTTTTTTTTT',
    'T.;T.......TT.,;........T..OOOOO.r0r....a.....T.&....,....%2#TTTTTTTTTTTTTTTTTTTTTTT',
    'T..T..TT...TT.,.T..;z......OOOOO.rrr..........T......,....###TTTTTTTTTTTTTTTTTTTTTTT',
    'T.T........T.T,T..;...;....OOOOO.,,,,,,,,,,,,,,,,,,,,,,,,,,,,TTTTTTTTTTTTTTTTTTTTTTT',
    'T...T..THHHHHH,.T..........OOOOO.,,,,,,,,,,,,,,,,,,,,,,,,,,,,TTTTTTTTTTTTTTTTTTTTTTT',
    'T.......HHHHHH,.....T...T..OOOOO.TTTTTTT..,,.FFFFFFFFFFFFFFFFTTTTTTTTTTTTTTTTTTTTTTT',
    'TTT.....HHHHHH,.;.TTT......OOOOO...T.T....,,.F..............FTTTTTTTTTTTTTTTTTTTTTTT',
    'T.......HHKHHH,...T......T.OOOOO....`.T...,,.F.HHHHHHHHHHH..FTTTTTTTTTTTTTTTTTTTTTTT',
    'T..TTT....G...,.TT....T....OOOOO...T.TT.T.,,.F.HHHHHHHHHHH..FTTTTTTTTTTTTTTTTTTTTTTT',
    'T....TT...,.].,T..;.T......OOOOO.T.T...T..,,.F.HHHHHHHHHHH..FTTTTTTTTTTTTTTTTTTTTTTT',
    'T.........,,,,,,,,,,,,,,,|.OOOOO.T.a......,,.F.HHHHHHHHHHHz.FTTTTTTTTTTTTTTTTTTTTTTT',
    'T.....T..;.......T......;..OOOOO.,,,,,,,,,,,.F.HHHHHHHHHHH..FTTTTTTTTTTTTTTTTTTTTTTT',
    'T............;...TTT..;..T.OOOOO.|........,,.F.HHHHHQHHHHH..FTTTTTTTTTTTTTTTTTTTTTTT',
    'TT.........TT.,...;......T.OOOOO....T.T...,,.F......B.......FTTTTTTTTTTTTTTTTTTTTTTT',
    'T;TT..z;..T;.T,.......T..;.OOOOO....T.....,,.F..............FTTTTTTTTTTTTTTTTTTTTTTT',
    'TT..................T..T.T.OOOOO.....TaT..,,.F...ZZZ....z...FTTTTTTTTTTTTTTTTTTTTTTT',
    'T.T........;...T........T..OOOOO.....TTT..,,.F.........s....FTTTTTTTTTTTTTTTTTTTTTTT',
    'TT......T...z...T.T....;...OOOOO..T..TT.T.,,.F.k............FTTTTTTTTTTTTTTTTTTTTTTT',
    'T...1...T......TT..T....TT.OOOOO.*********,,.F..............FTTTTT........:......TTT',
    'T..............T.;.T.....T.OOOOO.*.......*,,.FFFFFF,,FFFFFFFFTTT..T..T.........T..TT',
    'T;......T..T..,T.......T...OOOOO.*.......*,,.TTTTTT,,TTTTTTTTTT...............T....T',
    'T....T..TT..TT,T.....T..TT.OOOOO.*..ZZ...*,,.......,,......TTTT.....;.HHHHH:.;.....T',
    'T;..T.T.aT..T.,;..z........OOOOO.*.......*.....;;..,,...;..TTTT..FFFF.HHHHH.;......T',
    'T...;.T.......,T...........OOOOO.*...j...*..................TTT..F:::.HHHHH:....T..T',
    'T.T...........,.........TT.OOOOO.*.......*..................TTT..F:::.HHmHH........T',
    'TT....T..z....,.........T..OOOOO.*......J*....ZZ.....ZZ.....TTT.TF:::...,......:...T',
    'T;..;........T,..T..;T...;.OOOOO.*.......*..................TTT..FFFF.;.,;.........T',
    'T....;.......T,............OOOOO.*********........Z.........TTT.....:...,:.......T.T',
    'T.......;..T.T,.T;.......T.OOOOO.;.q...;;....;;.y...p;..ZZ..TTT...e.....,:....:.!..T',
    'TTTTTTTTT.....,,,,,,,,,,,|.OOOOO......................;.....TTT...;.....,;...;;...:T',
    'T.T....;T..........T.;.TT..OOOOO.,,,,,,,,,,,,,,,,,,,,,,,,,,,,R,,,,,,,,,,,,,,,,,,,@,<',
    'T.T...;.l......T........TT.OOOOO.,,,,,,,,,,,,,,,,,,,,,,,,,,,,R,,,,,,,,,,,,,,,,,,,,,<',
    'T.T..N..l......T.T....hT...OOOOO.|..e.;..............;......TTT:...........;.......T',
    'T.T.....l.;..............T.OOOOO......V........;..?....e;...TTT....T..e..;...rrr...T',
    'T.T.....T......T.;T..T.T...OOOOO...............e............TTT...;.......:..r3r...T',
    'TTTTTTTTT......T......;..T.OOOOO.......e....................TTT............T.rrr..;T',
    'T.........TT...T....T..T...OOOOO..;...;...T;.....;........TTTTTTT....:..:........;TT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  areas: [
    { name: 'THE DEEP WOODS', x: 0, y: 0, w: 27, h: 52, track: 'static', entry: 'deep' },
    { name: 'RIDDLE GROVE', x: 27, y: 0, w: 19, h: 13, entry: 'grove' },
    { name: 'RADIO HILL', x: 46, y: 0, w: 16, h: 13, entry: 'radioHill' },
    { name: 'THE BRAMBLES', x: 27, y: 13, w: 18, h: 23, entry: 'brambles' },
    { name: 'TROLL BRIDGE', x: 27, y: 36, w: 15, h: 16, entry: 'bridge' },
    { name: 'HORIZON LAB', x: 45, y: 13, w: 17, h: 15, entry: 'compound' },
    { name: 'THE CAMP', x: 42, y: 28, w: 20, h: 24, entry: 'camp' },
    { name: 'WILDWOOD SHORE', x: 62, y: 0, w: 22, h: 52, entry: 'town' },
  ],
  entries: {
    lab: { x: 52.5, y: 21.5, dir: 'down' },
    mossa: { x: 72.5, y: 33.5, dir: 'down' },
    radio: { x: 53.5, y: 8.5, dir: 'down' },
    deepDoor: { x: 10.5, y: 16.5, dir: 'down' },
    camp: { x: 50.5, y: 38.5, dir: 'left' },
    compound: { x: 52.5, y: 26.5, dir: 'up' },
    radioHill: { x: 53.5, y: 10.5, dir: 'up' },
    grove: { x: 39.5, y: 10.5, dir: 'up' },
    brambles: { x: 42.5, y: 20.5, dir: 'up' },
    bridge: { x: 36.5, y: 38.5, dir: 'left' },
    deep: { x: 26.5, y: 38.5, dir: 'left' },
  },
  props: [
    { kind: 'tent', x: 47, y: 34 },
    { kind: 'tent', x: 54, y: 34, color: '#2ff3ff' },
    { kind: 'campfire', x: 50.5, y: 36 },
    { kind: 'bike', x: 56.5, y: 37 },
    { kind: 'bike', x: 57.5, y: 37 },
    { kind: 'van', x: 50.5, y: 24 },
    { kind: 'mast', x: 57.5, y: 8 },
    { kind: 'fort', x: 37, y: 30 },
  ],
  codes: [
    { word: 'ECHO', flag: 'riddle1' },
    { word: 'STEPS', flag: 'riddle2' },
  ],
  marks: {
    // ---- Coming and going ----
    '@': { ent: { t: 'entry', id: 'town', dir: 'left' } },
    '<': { tile: ',', ent: { t: 'warp', to: 'overworld', entry: 'wildwood' } },
    m: { tile: 'D', ent: { t: 'warp', to: 'mossa', entry: 'door' } },
    g: { tile: 'D', ent: { t: 'warp', to: 'radio', entry: 'door' } },
    Q: { tile: 'D', ent: { t: 'warp', to: 'lab1', entry: 'start' } },
    K: { tile: 'D', ent: { t: 'warp', to: 'deep1', entry: 'start' } },
    // The Deep Lab's bunker opens once Mistral's wind has died.
    G: { tile: 'X', ent: { t: 'gate', open: { flag: 'mistral' } } },
    // ---- Signs ----
    '!': sign(['THE WILDWOOD.   ↑ MOSSA\'S COTTAGE   ← THE CAMP   → PHAREIM.NO', 'KEEP TO THE TRAIL. THE WOODS ARE OLDER THAN THE TOWN.']),
    '?': sign(['CAMP OF THE PARTY. NO GROWN-UPS. (EXCEPT MOSSA. MOSSA IS OK.)']),
    s: sign(['PROJECT HORIZON — RESTRICTED AREA.', 'BY ORDER OF THE DEPARTMENT OF SUNSETS.']),
    k: sign(['A NOTICE, HALF TORN:', '…THE GATE STAYS OPEN UNTIL THE TEST IS DONE. IF SUBJECT L ESCAPES, DO NOT FOLLOW HER INTO THE BRAMBLES…']),
    '&': sign(['RADIO HILL. DUSTY\'S TOWER.', 'IF THE LIGHT ON THE MAST BLINKS, HE IS ON THE AIR.']),
    ']': sign(['HORIZON DEEP SITE. ELEVATOR TO THE DEEP LAB.', 'THE GRILLE OPENS WHEN THE WIND IN THE UPPER LAB IS STILLED.']),
    V: sign(['TROLL BRIDGE. (THE BRIDGE IS GONE. THE TROLL IS NOT.)']),
    // ---- Things to find ----
    '0': { ent: { t: 'chest', id: 'ww.grove', item: 'bits20' } },
    J: { ent: { t: 'chest', id: 'ww.fort', item: 'bits50' } },
    N: { ent: { t: 'chest', id: 'ww.nook', item: 'bits50' } },
    A: { ent: { t: 'chest', id: 'ww.riddle1', item: 'heartPiece', appear: { flag: 'riddle1' } } },
    U: { ent: { t: 'chest', id: 'ww.riddle2', item: 'heartPiece', appear: { flag: 'riddle2' } } },
    '1': { ent: { t: 'item', id: 'ww.shroom1', item: 'shroom' } },
    '2': { ent: { t: 'item', id: 'ww.shroom2', item: 'shroom' } },
    '3': { ent: { t: 'item', id: 'ww.shroom3', item: 'shroom' } },
    h: { ent: { t: 'item', id: 'ww.hat', item: 'hat' } },
    // ---- The Riddle Grove's letter stones ----
    '4': glyph('E'), '5': glyph('C'), '6': glyph('H'), '7': glyph('O'),
    '8': glyph('S'), '9': glyph('T'), '+': glyph('P'), '-': glyph('N'),
    // ---- Residents ----
    u: npc('owl', 'owl', [
      {
        when: { notFlag: 'riddle1' },
        lines: [
          'OWL: HOO. A RIDDLE FOR A WALKER. ANSWER IT WITH YOUR FEET, ON THE STONES.',
          'OWL: I SPEAK WITHOUT A MOUTH AND HEAR WITHOUT EARS. I HAVE NO BODY, BUT THE HILLS GIVE ME ONE. WHAT AM I?',
        ],
      },
      {
        when: { notFlag: 'riddle2' },
        lines: [
          'OWL: HOO! CORRECT. ANOTHER, THEN.',
          'OWL: THE MORE OF ME YOU TAKE, THE MORE OF ME YOU LEAVE BEHIND. WHAT AM I?',
        ],
      },
      { lines: ['OWL: HOO. YOU ARE WISER THAN YOU LOOK. THAT IS A COMPLIMENT, FROM AN OWL.'] },
    ]),
    y: npc('toby', 'toby', [
      { when: { flag: 'got:toby:bits50' }, lines: ['TOBY: MAX, COME IN. THE HERO BROUGHT MY WALKIE BACK. OVER.', 'MAX (ON THE WALKIE): I\'M RIGHT NEXT TO YOU, TOBY.'] },
      {
        when: { item: 'walkie' },
        lines: ['TOBY: MY WALKIE! YOU WENT INTO THE LAB FOR IT? YOU\'RE INSANE. IN A GOOD WAY.', 'TOBY: HERE, OUR WHOLE ALLOWANCE. DON\'T TELL MAX.'],
        give: 'bits50',
      },
      {
        when: { notFlag: 'luna' },
        lines: [
          'TOBY: SHH. WE\'RE ON A MISSION. THERE\'S A GIRL IN THE BRAMBLES, WEST OF CAMP. SHE RAN AWAY FROM THE LAB.',
          'TOBY: SHE WON\'T TALK TO US. MOSSA SAYS SHE STEALS WAFFLES.',
          'TOBY: ALSO I LOST MY WALKIE-TALKIE IN THE LAB WHEN THE DRONES CHASED US. NOT THAT I WAS SCARED.',
        ],
      },
      { lines: ['TOBY: YOU FOUND LUNA! COOL. COOL COOL COOL.', 'TOBY: MY WALKIE\'S STILL IN THE LAB SOMEWHERE. THE DORMS, I THINK. BEHIND SOME GLOWY BLOCKS.'] },
    ]),
    p: npc('max', 'max', [
      {
        when: { notFlag: 'got:max:bombs5' },
        lines: ['MAX: YOU\'VE GOT BOMBS? SAME. FOUND A CRATE OF THEM IN THE LAB VAN. HAVE A FEW.'],
        give: 'bombs5',
      },
      { when: { notFlag: 'luna' }, lines: ['MAX: THE GIRL IN THE BRAMBLES? SHE MOVED A ROCK BY LOOKING AT IT. I SAW IT.', 'MAX: CUT THROUGH THE BUSHES, THEN BE NICE. AND BRING FOOD.'] },
      { when: { notFlag: 'item:hook' }, lines: ['MAX: HI, LUNA.', '(LUNA DOES NOT SAY HI BACK. MAX LOOKS DELIGHTED ANYWAY.)'] },
      { when: { notFlag: 'mistral' }, lines: ['MAX: A HOOK! CAN I TRY IT? NO? OK.'] },
      { lines: ['MAX: THE DEEP LAB IS PAST THE RAVINE. TOBY SAYS IT GOES DOWN FOREVER.', 'MAX: I SAY IT GOES DOWN TWO FLOORS. WE\'LL SEE.'] },
    ]),
    q: npc('troll', 'troll', [
      { when: { flag: 'got:troll:bigBag' }, lines: ['TROLL: HAT ON, TROLL HAPPY. MIND THE RAVINE, LITTLE ONE.'] },
      {
        when: { item: 'hat' },
        lines: ['TROLL: MY HAT! THE WIND FROM THE LAB TOOK IT OVER THE RAVINE, AND TROLLS DON\'T JUMP.', 'TROLL: HAVE MY BIG BAG. IT HELD MY LUNCH. NOW IT CAN HOLD YOUR BOMBS.'],
        give: 'bigBag',
      },
      {
        lines: [
          'TROLL: HRM. A VISITOR. DON\'T WORRY, I ONLY EAT BROWN CHEESE.',
          'TROLL: THE WIND BLEW MY HAT OVER THE RAVINE. I SEE IT FROM HERE, ON THE FAR RIM.',
          'TROLL: I HAD A BRIDGE ONCE. NOBODY PAID THE TOLL, SO IT LEFT.',
        ],
      },
    ]),
    j: {
      ent: {
        t: 'npc', id: 'luna', look: 'luna', dir: 'down', hide: { flags: ['luna.fed'], not: ['luna.home'] }, join: true,
        talk: [
          // Left at her fort (walk her back to it): talk to her and she comes along again.
          { when: { flag: 'luna.home' }, lines: ['LUNA: OUT AGAIN? OK. I\'M COMING.'], clear: 'luna.home' },
          { when: { notFlag: 'item:waffle' }, lines: ['…', '(THE GIRL HUGS HER KNEES AND WATCHES YOU. HER STOMACH GROWLS.)'] },
          {
            lines: [
              '… WAFFLE?',
              '(SHE EATS IT IN FOUR BITES.)',
              'LUNA: I AM LUNA. I RAN FROM THE LAB. THEY OPENED A DOOR TO THE OTHER SIDE. SOMETHING CAME THROUGH.',
              'LUNA: THE STATIC KING. HE TOOK YOUR SUN. THE DOOR IS STILL OPEN, DEEP UNDER THE LAB.',
              'LUNA: I CAN MOVE THINGS. (SHE STARES AT A PEBBLE. IT SLIDES AWAY.) I WILL HELP. WE CLOSE THE DOOR.',
              'LUNA: IF YOU WANT TO GO ALONE FOR A BIT, WALK ME BACK TO MY FORT. I\'LL WAIT THERE.',
            ],
            set: 'luna.fed',
          },
        ],
      },
    },
    // ---- Foes ----
    z: { ent: { t: 'enemy', kind: 'hound' } },
    e: { ent: { t: 'enemy', kind: 'blob' } },
    a: { ent: { t: 'enemy', kind: 'bat' } },
    '`': { ent: { t: 'enemy', kind: 'spitter' } },
  },
}
