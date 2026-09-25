/**
 * The flags that cross floors: one floor's puzzle sets it, another's reads
 * it. A room's own small state (a drawer open, a line said once) uses
 * `<room>.<thing>` names local to that room's file.
 */
export const F = {
  // cellar
  furnaceKindling: 'furnace.kindling',
  /** The furnace burns: the pipes heat the house, the freezer thaws, jam lids loosen. */
  furnaceLit: 'furnace.lit',
  bonesKey: 'bones.key',
  labOpen: 'lab.open',
  jamOpen: 'jam.open',
  /** Dag has eaten jam and will part with the sandwich. */
  dagAte: 'dag.ate',
  catInBooth: 'cat.booth',
  boothClosed: 'booth.closed',
  leverArmed: 'lever.armed',
  // attic
  trunkMoved: 'trunk.moved',
  monocleTaken: 'monocle.taken',
  diaryRead: 'diary.read',
  lettersRead: 'letters.read',
  lettersTaken: 'letters.taken',
  batFed: 'bat.fed',
  windowOpen: 'window.open',
  socketOiled: 'socket.oiled',
  rodUp: 'rod.up',
  radioHeard: 'radio.heard',
  /** Espen pulled the wire out of his ears for the radio: they flop from now on. */
  earsFlop: 'espen.ears',
  seanceDone: 'seance.done',
  // ground
  matchesTaken: 'matches.taken',
  oilTaken: 'oil.taken',
  /** Mrs Whiskers wears the monocle and has come down off the fridge. */
  catMonocle: 'cat.monocle',
  pokerTaken: 'poker.taken',
  gustavFed: 'gustav.fed',
  clockKeyTaken: 'clockkey.taken',
  glovesTaken: 'gloves.taken',
  junctionOpen: 'junction.open',
  junctionBridged: 'junction.bridged',
  /** Times the clock has been wound to midnight. */
  midnightTries: 'midnight.tries',
  // the end
  won: 'won',
} as const
