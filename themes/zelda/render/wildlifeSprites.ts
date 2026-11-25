/** Small animals in the classic palette, drawn at the scene's own pixel pitch. */
const ANIMALS = {
  fish: [
    ['....c....', '...cWc...', '..cWcw...', '.CwWc....', 'ccWc.....', 'C.C......'],
    ['.........', '......c..', '...ccWwc.', '.CCcWWWc.', 'CC.Cccc..', '.........'],
    ['c........', '.cc......', '.CCWc....', '...cWc...', '....cwc..', '.....c...'],
    ['.........', '.c....c..', '..c.Wc...', '...ccc...', 'CC..C..CC', '.CCCCCCC.'],
  ],
  gull: [
    ['w.........w', '.wW.....Ww.', '..wW...Ww..', '...WWWw....', '....wwgy...', '.....W.....'],
    ['...........', '.....w.....', '..WwwwwW...', '.wWwwwwgy..', 'ww..WW..ww.', 'W........W.'],
  ],
  crow: [
    ['G.........G', '.Gu.....uG.', '..Gu...uG..', '...uuuk....', '....uuGy...', '.....u.....'],
    ['...........', '.....u.....', '..ukuuuG...', '.uuuuuGy...', 'Gu..uu..uu.', 'u........G.'],
  ],
  moth: [
    ['m...m', 'Wm.mW', '.WyW.', '..Y..', '.....'],
    ['.....', '.m.m.', 'WWyWW', '.WYw.', '.....'],
  ],
  butterfly: [
    ['m...p', 'mp.pm', '.PyP.', 'p.Y.p', '.....'],
    ['.....', 'm...p', 'PmymP', '.PYP.', '.....'],
  ],
  frog: [
    ['........', '..l..l..', '..TkTt..', '.ttTTT..', 'tTTtTtt.', '.TtTtTTT', '..TTtT..'],
    ['........', '..t..t..', '..TtTt..', '.TtTTT..', 'tTTtTtt.', '.TtTtTTT', '..TTtT..'],
  ],
} as const

export const WILDLIFE_RAW: Record<string, string[]> = {}
for (const [name, frames] of Object.entries(ANIMALS)) {
  frames.forEach((rows, i) => { WILDLIFE_RAW[`wild_${name}_${i}`] = [...rows] })
}
