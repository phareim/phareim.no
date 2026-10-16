/**
 * Space Voyagers II: the words between sorties, on the Deep Dish (DESIGN.md,
 * "The Deep Dish", "The campaign"). For each sortie: Nonna's briefing at the
 * kitchen counter, what each of the crew says when you go up to them, the
 * choices that move morale, and the debrief. Capitals; a line of talk is at
 * most 120 characters (the hub's box is wider than the cockpit's subtitles).
 *
 * `you` and `partner` in a line are filled in by the page (`fill`): the pilot
 * the player is, and the other one.
 */
import type { SortieId } from '../engine/campaign.ts'
import type { SpeakerId } from './cues.ts'

export interface Say { who: SpeakerId | 'you' | 'partner'; mood?: string; text: string }

export interface Choice {
  /** On the button: a few words. */
  label: string
  reply: Say[]
  /** Moves the crew's morale and the partner's mood (−0.15..0.15). */
  morale?: number
  mood?: number
  flag?: string
}

export interface Talk { says: Say[]; choice?: [Choice, Choice] }

export type RoomId = 'kitchen' | 'hangar' | 'breakroom'

/** Who stands in which room. */
export const ROOMS: Record<RoomId, { name: string; people: SpeakerId[] }> = {
  kitchen: { name: 'THE KITCHEN', people: ['nonna', 'mei'] },
  hangar: { name: 'THE HANGAR', people: ['tiny', 'dougie'] },
  breakroom: { name: 'THE BREAK ROOM', people: ['marge', 'ridley', 'duo'] },
}

export interface Briefing {
  title: string
  tagline: string
  says: Say[]
  /** Who flies on the wing, said in the briefing. */
  wing: string
}

const n = (text: string, mood?: string): Say => ({ who: 'nonna', text, mood })
const m = (text: string, mood?: string): Say => ({ who: 'mei', text, mood })
const you = (text: string): Say => ({ who: 'you', text })
const partner = (text: string): Say => ({ who: 'partner', text })

export const BRIEFINGS: Record<SortieId, Briefing> = {
  firstshift: {
    title: 'FIRST SHIFT', tagline: 'PATROL THE PARKING BELT. THREE NAV POINTS. BACK BY CLOSING.',
    says: [
      n('SIT. THE FRANCHISE OPENED AN OUTLET IN THE PARKING BELT. THEY WAVE THEIR SIGNS AT OUR CUSTOMERS.'),
      m('THREE NAV POINTS. THEY FLY LITTLE FIGHTERS SHAPED LIKE SLICES. RATS. THEY SING.', 'excited'),
      n('YOU GO, YOU LOOK, YOU COME HOME. AND YOU TAKE DOUGIE. HIS MOTHER ASKED.'),
    ],
    wing: 'DOUGIE IN THE MOPED',
  },
  convoy: {
    title: 'CONVOY', tagline: 'BRING THE MOZZARELLA HOME. MARGE LEADS, TWO HAULERS FOLLOW.',
    says: [
      n('NO CHEESE, NO PIZZA. THE MOZZARELLA COMES UP THE LONG HAUL ON TWO HAULERS.'),
      m('BIG MARGE IS RIDING SHOTGUN IN HER RIG. THE FRANCHISE WILL GO FOR THE HAULERS, NOT FOR YOU.'),
      n('ONE HAULER HOME IS DINNER. TWO IS A PARTY.'),
    ],
    wing: 'BIG MARGE IN THE TALL TALE',
  },
  siege: {
    title: 'OVEN UNDER SIEGE', tagline: 'THE FRANCHISE IS COMING FOR THE DEEP DISH. KEEP THE BOMBERS OFF THE OVEN.',
    says: [
      m('LONG-RANGE TUBES SAY BOMBERS. HOUNDS, WITH TORPEDOES. A LOT OF THEM. COMING HERE.', 'excited'),
      n('THEY WANT MY OVEN. THEY DO NOT GET MY OVEN.', 'stern'),
      m('KILL THE HOUNDS FIRST. IF ONE IS LINING UP ON US, TAUNT IT AND IT COMES FOR YOU INSTEAD.'),
    ],
    wing: 'DOUGIE AND RIDLEY',
  },
  takeout: {
    title: 'TAKE-OUT', tagline: 'AN OUTLET IN THE LONG HAUL. KNOCK OUT ITS GUNS, THEN DELIVER A TORPEDO.',
    says: [
      n('WE HELD. NOW WE ANSWER. THEY OPENED AN OUTLET IN THE LONG HAUL. A DRIVE-THROUGH WITH GUNS.'),
      m('GUNS WILL NOT HURT ITS HULL. SHOOT ITS TURRETS, THEN HOLD IT IN THE NOSE FIVE SECONDS FOR A TORPEDO LOCK.'),
      n('TINY PUT TWO TORPEDOES ON THE CALZONE. BRING ONE BACK IF YOU DO NOT NEED IT.'),
    ],
    wing: 'HANS DUO IN THE CENTURY PIGEON',
  },
  spilled: {
    title: 'SPILLED SAUCE', tagline: 'THE DEEP DISH IS HURT. BRING RIDLEY AND THE SPARE PARTS HOME.',
    says: [
      n('THE OVEN IS CRACKED. WE LIMP. WE NEED PARTS.', 'stern'),
      m('RIDLEY TOWS A CRATE OF VALVES FROM THE DEPOT IN HER TUG. THE FRANCHISE KNOWS. WATCH THE AUTOPILOT.'),
      n('NO PARTS, NO PIZZA. NO PIZZA, NO US.'),
    ],
    wing: 'ELLEN RIDLEY IN THE NOSTALGIA',
  },
  hansshot: {
    title: 'HANS SHOT FIRST', tagline: 'A PATROL WITH HANS DUO. WATCH HIM.',
    says: [
      m('PATROL, THREE NAVS. HANS DUO FLIES WITH YOU.'),
      n('HANS HAS BEEN ON THE PHONE A LOT. LONG CALLS. ON THE FRANCHISE BAND.', 'stern'),
      m('PROBABLY NOTHING. PROBABLY.'),
    ],
    wing: 'HANS DUO IN THE CENTURY PIGEON',
  },
  dare: {
    title: 'THE DARE', tagline: 'PRINCE PARMESAN WANTS YOU. ALONE. AT NAV 2.',
    says: [
      m('A MESSAGE ON EVERY BAND. PRINCE PARMESAN. HE SAYS THE HEART OF THE OVEN IS AFRAID TO FACE HIM.'),
      n('WHAT IS THE HEART OF THE OVEN?'),
      m('YOU. HE MEANS YOU TWO.', 'excited'),
      n('THEN GO. AND IF YOU LOSE, WE CANNOT WAIT FOR YOU. THE DEEP DISH RUNS.', 'stern'),
    ],
    wing: 'NOBODY. A DUEL IS A DUEL',
  },
  buffet: {
    title: 'THE BUFFET', tagline: 'THE FRANCHISE CARRIER IS EXPOSED. GUNS FIRST, THEN THREE TORPEDOES.',
    says: [
      m('THE PRINCE RAN HOME TO THE BUFFET, THE FRANCHISE CARRIER. IT IS SITTING IN THE OPEN.'),
      n('A RESTAURANT THE SIZE OF A TOWN. NOBODY LIKES THE FOOD. SINK IT.'),
      m('IT LAUNCHES FIGHTERS WHILE YOU WORK. TURRETS, THEN THREE TORPEDOES ON THE HULL.'),
    ],
    wing: 'BIG MARGE AND RIDLEY',
  },
  lastslice: {
    title: 'LAST SLICE', tagline: 'THE FRANCHISE FOUND US. HOLD THE DEEP DISH UNTIL HELP COMES.',
    says: [
      n('THEY FOUND US. EVERYTHING THEY HAVE IS COMING.', 'stern'),
      m('MARGE WENT FOR HELP DOWN THE LONG HAUL. THREE MINUTES. MAYBE FOUR.'),
      n('THEN WE HOLD FOR FOUR.'),
    ],
    wing: 'DOUGIE AND RIDLEY',
  },
  finale: {
    title: 'HEART OF THE OVEN', tagline: 'DELIVER THE VOLCANO INTO THE HUT. THIRTY MINUTES OR IT IS FREE.',
    says: [
      n('THIS IS THE VOLCANO. MY GRANDMOTHER\'S RECIPE. NOBODY HAS EVER EATEN ONE AND STAYED IN THE ROOM.'),
      m('THE HUT VENTS ITS OVENS THROUGH ONE CHIMNEY. A TORPEDO LOCK ON THE VENT, FIVE SECONDS, AND IT GOES DOWN.'),
      n('THIRTY MINUTES OR IT IS FREE. NOBODY AT SLOP\'S HAS EVER GIVEN A PIZZA AWAY.', 'stern'),
    ],
    wing: 'EVERYBODY WHO IS LEFT',
  },
}

/** What the crew say before each sortie. A missing person has nothing new to say (an old line is used). */
export const TALKS: Partial<Record<SortieId, Partial<Record<SpeakerId, Talk>>>> = {
  firstshift: {
    nonna: { says: [n('EAT FIRST. NOBODY FLIES HUNGRY ON MY SHIP.'), partner('SHE MEANS IT.')] },
    mei: { says: [m('TIP: THE DIAMOND IN FRONT OF A BANDIT IS WHERE TO AIM. NOT AT THE BANDIT. AT THE DIAMOND.')] },
    tiny: { says: [{ who: 'tiny', text: 'CALZONE IS WELDED.' }, { who: 'tiny', mood: 'grin', text: 'MOSTLY.' }] },
    dougie: {
      says: [{ who: 'dougie', mood: 'eager', text: 'MY FIRST SORTIE! I PAINTED FLAMES ON THE MOPED. THEY MAKE IT FASTER.' }],
      choice: [
        { label: 'STAY ON MY WING', reply: [{ who: 'dougie', mood: 'eager', text: 'ON YOUR WING. LIKE GLUE. LIKE CHEESE.' }], morale: 0.03 },
        { label: 'GO GET THEM, KID', reply: [{ who: 'dougie', mood: 'eager', text: 'YES! I MEAN, YES SIR. MA\'AM. WHOEVER.' }], morale: 0.05, flag: 'dougieBold' },
      ],
    },
    marge: { says: [{ who: 'marge', mood: 'spooky', text: 'THEY SAY A GHOST DRIVES THE PARKING BELT. AN ICE CREAM VAN. PLAYING GREENSLEEVES. NOBODY ORDERED.' }] },
    ridley: { says: [{ who: 'ridley', text: 'THE CAT DOES NOT LIKE THE FRANCHISE. THE CAT IS USUALLY RIGHT.' }] },
    duo: { says: [{ who: 'duo', text: 'I DELIVERED FOR THE HUT FOR TWO YEARS. BEST TIPS IN SPACE. I MISS THE TIPS.' }] },
  },
  convoy: {
    nonna: { says: [n('MOZZARELLA IS NOT A LUXURY. MOZZARELLA IS A HUMAN RIGHT.')] },
    mei: { says: [m('THE HAULERS ARE SLOW AND THEY CANNOT SHOOT. THE FRANCHISE KNOWS THAT. STAY CLOSE TO THEM.')] },
    marge: {
      says: [{ who: 'marge', text: 'YOU TWO RIDE BEHIND ME. I HAVE A TAIL GUN AND OPINIONS.' }],
      choice: [
        { label: 'TELL US A STORY', reply: [{ who: 'marge', mood: 'spooky', text: 'ON THE LONG HAUL THERE IS A MILE MARKER WITH NO NUMBER. YOU PASS IT TWICE. NEVER THREE TIMES.' }], morale: 0.05 },
        { label: 'JUST DRIVE', reply: [{ who: 'marge', text: 'SUIT YOURSELF, SWEETIE. TEN-FOUR.' }], morale: -0.02 },
      ],
    },
    tiny: { says: [{ who: 'tiny', text: 'NEW DECOYS.' }, { who: 'tiny', mood: 'grin', text: 'THEY ARE TINSEL.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'eager', text: 'I GOT A KILL LAST TIME! WELL, A HALF. WELL, I WAS THERE.' }] },
    duo: { says: [{ who: 'duo', text: 'CONVOY DUTY. THE JOB FOR PEOPLE WHO CANNOT FLY. NO OFFENCE.' }, partner('SOME TAKEN.')] },
  },
  siege: {
    nonna: {
      says: [n('IF THE OVEN GOES OUT, IT TAKES THREE DAYS TO HEAT AGAIN. WE DO NOT HAVE THREE DAYS.', 'stern')],
      choice: [
        { label: 'WE HOLD THE LINE', reply: [n('GOOD. THEN HOLD IT.')], morale: 0.05 },
        { label: 'WE COULD RUN', reply: [n('SLOP\'S DOES NOT RUN. SLOP\'S DELIVERS.', 'stern')], morale: -0.05, flag: 'saidRun' },
      ],
    },
    mei: { says: [m('A HOUND WITH A LOCK ON US FLIES STRAIGHT FOR FIVE SECONDS BEFORE IT FIRES. THAT IS YOUR WINDOW.')] },
    tiny: { says: [{ who: 'tiny', text: 'TURRETS ARE LOADED.' }] },
    ridley: { says: [{ who: 'ridley', mood: 'grim', text: 'I HAVE DONE THIS BEFORE. IT WAS A DIFFERENT SHIP. THE CAT REMEMBERS.' }] },
    duo: { says: [{ who: 'duo', mood: 'sweat', text: 'BOMBERS? I JUST REMEMBERED I HAVE A THING.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'scared', text: 'HOW MANY IS A LOT OF THEM? LIKE, A NUMBER?' }] },
  },
  takeout: {
    nonna: { says: [n('THEY HIT US. WE HIT BACK. THEN WE ALL EAT.')] },
    tiny: { says: [{ who: 'tiny', text: 'TWO TORPEDOES.' }, { who: 'tiny', mood: 'grin', text: 'DO NOT DROP THEM.' }] },
    duo: {
      says: [{ who: 'duo', mood: 'grin', text: 'YOU NEED ME ON THIS ONE. I KNOW OUTLETS. I KNOW WHERE THE FRYERS ARE.' }],
      choice: [
        { label: 'GLAD YOU ARE IN', reply: [{ who: 'duo', mood: 'grin', text: 'EVERYBODY IS.' }], morale: 0.03, flag: 'trustDuo' },
        { label: 'WHO ARE YOU CALLING?', reply: [{ who: 'duo', mood: 'sweat', text: 'NOBODY. MY MOTHER. A PIZZA PLACE. WHY?' }], flag: 'doubtDuo' },
      ],
    },
    marge: { says: [{ who: 'marge', text: 'AN OUTLET IN THE LONG HAUL. THEY PUT IT RIGHT ON TOP OF THE OLD DINER. NO RESPECT.' }] },
    mei: { says: [m('THE OUTLET HAS TWO TURRETS, FRONT AND BACK. THE BACK ONE IS LAZY. COME IN FROM BEHIND.')] },
  },
  spilled: {
    nonna: { says: [n('I HAVE BAKED IN WORSE. THE WINTER OF THE EIGHTH 1989. NO GAS, NO FLOUR. WE MADE IT.')] },
    ridley: {
      says: [{ who: 'ridley', text: 'I TOW. YOU SHOOT. IF THE CAT SAYS WE STOP, WE STOP.' }],
      choice: [
        { label: 'THE CAT IS IN CHARGE', reply: [{ who: 'ridley', text: 'FINALLY. SOMEBODY GETS IT.' }], morale: 0.05 },
        { label: 'IT IS A CAT', reply: [{ who: 'ridley', mood: 'grim', text: 'SO WAS THE LAST CAPTAIN.' }] },
      ],
    },
    tiny: { says: [{ who: 'tiny', text: 'OVEN IS CRACKED.' }, { who: 'tiny', text: 'I CAN FIX IT.' }, { who: 'tiny', mood: 'grin', text: 'WITH PARTS.' }] },
    mei: { says: [m('THE FRANCHISE LISTENS ON THE AUTOPILOT BAND. IF IT DROPS YOU EARLY, IT IS AN AMBUSH.')] },
  },
  hansshot: {
    duo: { says: [{ who: 'duo', mood: 'grin', text: 'BIG DAY. I CAN FEEL IT. HOW MUCH DO YOU THINK A GOOD PILOT IS WORTH? JUST ASKING.' }] },
    nonna: { says: [n('HANS PAYS FOR HIS PIZZA. ALWAYS. EXACT CHANGE. THAT IS A MAN WITH A PLAN.', 'stern')] },
    mei: {
      says: [m('I HEARD HIM. ON THE FRANCHISE BAND. HE SAID THE WORD CONTRACT. TWICE.', 'excited')],
      choice: [
        { label: 'WE WATCH HIM', reply: [m('I WATCH EVERYBODY. IT IS MY JOB.')], morale: 0.02, flag: 'watchDuo' },
        { label: 'HANS IS FAMILY', reply: [m('FAMILY CAN SIGN CONTRACTS TOO.')], mood: -0.03 },
      ],
    },
    tiny: { says: [{ who: 'tiny', text: 'HANS ASKED FOR A FULL TANK.' }, { who: 'tiny', text: 'TO GO.' }] },
    marge: { says: [{ who: 'marge', mood: 'spooky', text: 'A MAN WHO COUNTS HIS TIPS TWICE IS A MAN WHO IS LEAVING. MY UNCLE SAID THAT. THEN HE LEFT.' }] },
  },
  dare: {
    nonna: { says: [n('YOU DO NOT HAVE TO GO. NOBODY WOULD SAY ANYTHING.'), partner('WE ARE GOING.'), n('I KNOW. I MADE YOU SANDWICHES.')] },
    mei: { says: [m('PARMESAN FLIES A GOLDEN GRATER. FAST, TOUGH, AND HE NEVER STOPS TALKING. HIT HIM FROM BEHIND.')] },
    tiny: { says: [{ who: 'tiny', text: 'NEW GUNS.' }, { who: 'tiny', mood: 'grin', text: 'SAME GUNS. CLEANED.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'scared', text: 'HANS WAS MY FAVOURITE. NOW I DO NOT HAVE A FAVOURITE. CAN YOU BE MY FAVOURITE?' }] },
    marge: { says: [{ who: 'marge', text: 'A PRINCE IN A KITCHEN UTENSIL. I HAVE SEEN EVERYTHING NOW.' }] },
    ridley: {
      says: [{ who: 'ridley', mood: 'grim', text: 'A DUEL IS A TRAP WITH MANNERS.' }],
      choice: [
        { label: 'WE GO ANYWAY', reply: [{ who: 'ridley', text: 'I KNOW. TAKE THE CAT\'S ADVICE. KEEP YOUR SPEED UP.' }], morale: 0.04 },
        { label: 'IT IS ABOUT PRIDE', reply: [{ who: 'ridley', mood: 'grim', text: 'IT ALWAYS IS. THAT IS WHY IT IS A TRAP.' }] },
      ],
    },
  },
  buffet: {
    nonna: { says: [n('AFTER THIS, WE CLOSE FOR A WEEK. EVERYBODY SLEEPS. THEN WE OPEN.')] },
    tiny: { says: [{ who: 'tiny', text: 'THREE TORPEDOES.' }, { who: 'tiny', mood: 'grin', text: 'I NAMED THEM.' }] },
    marge: { says: [{ who: 'marge', text: 'I HAVE BEEN WAITING TWENTY YEARS TO DRIVE INTO A BUFFET.' }] },
    ridley: { says: [{ who: 'ridley', text: 'BIG SHIP. BIG GUNS. SMALL BRAIN. GO FOR THE GUNS.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'eager', text: 'I AM NOT SCARED. I AM EXCITED. IT FEELS THE SAME.' }] },
  },
  lastslice: {
    nonna: { says: [n('THE OVEN STAYS LIT. WHATEVER HAPPENS, THE OVEN STAYS LIT.', 'stern')] },
    tiny: { says: [{ who: 'tiny', text: 'GO.' }] },
    ridley: { says: [{ who: 'ridley', mood: 'grim', text: 'FOUR MINUTES IS A LONG TIME. THE CAT HAS DONE LONGER.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'scared', text: 'WHEN THIS IS OVER I AM GOING BACK TO DELIVERING. ON THE GROUND. WITH STAIRS.' }] },
  },
  finale: {
    nonna: {
      says: [n('COME HERE. BOTH OF YOU.'), n('YOU ARE THE WORST DELIVERY BOYS I EVER HIRED. AND THE BEST.')],
      choice: [
        { label: 'WE WILL BE BACK', reply: [n('I KNOW. I SAVED YOU SOME.')], morale: 0.08 },
        { label: 'THIRTY MINUTES', reply: [n('OR IT IS FREE. GO.', 'stern')], morale: 0.05 },
      ],
    },
    mei: { says: [m('EVERY BAND IS QUIET. EVERYBODY IN THE DIAL IS LISTENING TO US. NO PRESSURE.', 'excited')] },
    tiny: { says: [{ who: 'tiny', text: 'THE VOLCANO IS LOADED.' }, { who: 'tiny', mood: 'grin', text: 'IT IS HOT.' }] },
    marge: { says: [{ who: 'marge', mood: 'spooky', text: 'THE GHOST VAN WILL BE OUT TONIGHT. I CAN FEEL IT. THIS TIME IT IS ON OUR SIDE.' }] },
    ridley: { says: [{ who: 'ridley', text: 'COME BACK. THE CAT GETS ATTACHED.' }] },
    dougie: { says: [{ who: 'dougie', mood: 'eager', text: 'IF YOU DO NOT COME BACK, CAN I HAVE THE CALZONE?' }, partner('NO.')] },
  },
}

/** Nonna and Mei after a sortie. */
export const DEBRIEFS: Record<SortieId, { won: Say[]; lost: Say[] }> = {
  firstshift: {
    won: [n('YOU CAME HOME AND YOU BROUGHT DOUGIE. SIT. EAT.'), m('THE FRANCHISE NOTICED. THEY ARE TALKING ABOUT US ON THEIR BAND.', 'excited')],
    lost: [n('YOU CAME HOME IN A PIZZA BOX. IT HAPPENS. TINY WILL WELD.', 'stern')],
  },
  convoy: {
    won: [n('MOZZARELLA. BEAUTIFUL. YOU ARE FORGIVEN FOR EVERYTHING.'), m('MARGE SAYS YOU FLY LIKE TRUCKERS. FROM HER THAT IS A COMPLIMENT.')],
    lost: [n('NO CHEESE. WE MAKE MARINARA. NOBODY COMPLAINS ABOUT MARINARA.', 'stern')],
  },
  siege: {
    won: [n('THE OVEN IS LIT. THE DEEP DISH IS WHOLE. NOW WE GO AFTER THEM.'), m('THEY HAVE AN OUTLET IN THE LONG HAUL. IT JUST LOST ITS FIGHTERS.', 'excited')],
    lost: [n('THEY CRACKED MY OVEN.', 'stern'), m('WE NEED PARTS. RIDLEY KNOWS A DEPOT.')],
  },
  takeout: {
    won: [n('THE OUTLET IS CLOSED. PERMANENTLY.'), m('HANS WAS ON THE FRANCHISE BAND AGAIN DURING THE FIGHT. FOR A WHILE.')],
    lost: [n('IT IS STILL OPEN. IT WILL SELL BAD PIZZA FOR A WHILE. WE LIVE.', 'stern')],
  },
  spilled: {
    won: [{ who: 'tiny', text: 'PARTS.' }, { who: 'tiny', mood: 'grin', text: 'OVEN IS FIXED.' }, n('GOOD. WE ARE BACK IN BUSINESS.')],
    lost: [n('WE PATCH WITH WHAT WE HAVE. TINY IS A GENIUS. A SAD GENIUS.', 'stern')],
  },
  hansshot: {
    won: [n('HANS. AFTER EVERYTHING. WITH EXACT CHANGE.', 'stern'), m('PRINCE PARMESAN IS ON EVERY BAND. HE WANTS TO MEET YOU.', 'excited')],
    lost: [n('HANS WAS ALWAYS GOING TO GO. WE SHOULD HAVE CHARGED HIM FOR THE TIPS.', 'stern'), m('THE PRINCE IS ASKING FOR YOU BY NAME.')],
  },
  dare: {
    won: [n('YOU BEAT A PRINCE. IN SPACE. I WILL TELL THE NEIGHBOURS.'), m('HE RAN HOME TO THE BUFFET. THE BUFFET IS IN THE OPEN.', 'excited')],
    lost: [m('YOU ARE ALIVE. THE DEEP DISH RAN, LIKE NONNA SAID. WE PICKED YOU UP ON THE WAY.'), n('THEY ARE FOLLOWING US.', 'stern')],
  },
  buffet: {
    won: [n('THE BUFFET IS CLOSED. ALL YOU CAN EAT IS NOW NOTHING.'), m('ONE THING LEFT. THE HUT.', 'excited')],
    lost: [n('IT IS STILL OUT THERE. SO ARE WE. ONE THING LEFT.', 'stern')],
  },
  lastslice: {
    won: [n('WE HELD. MARGE CAME. THE OVEN IS LIT.'), m('NOW WE KNOW WHERE THEY CAME FROM. THE HUT.', 'excited')],
    lost: [n('WE LOST HALF THE SHIP. THE OVEN IS STILL LIT. THAT IS ENOUGH.', 'stern')],
  },
  finale: {
    won: [n('YOU DELIVERED.'), m('THE HUT IS... WELL. IT IS MELTED CHEESE. ON EVERY BAND. THE DIAL IS CHEERING.', 'excited')],
    lost: [n('WE LOST. WE ARE STILL HERE. SLOP\'S IS STILL HERE. THAT IS SOMETHING.', 'stern')],
  },
}

export const ENDINGS = {
  won: [
    'DAWN ON THE DEEP DISH.',
    'SLOP\'S PIZZA DELIVERS TO EVERY ORBIT ON THE DIAL.',
    'NONNA STILL CHARGES FULL PRICE.',
  ],
  lost: [
    'THE FRANCHISE BOUGHT THE DEEP DISH.',
    'REX WEARS THE BEAR SUIT ON TUESDAYS. NOVA DOES NOT.',
    'SOMEWHERE, NONNA IS HEATING AN OVEN. TRY AGAIN.',
  ],
}

/** Fill `you` and `partner` with the pilots. */
export function speaker(s: Say, you: 'rex' | 'nova'): SpeakerId {
  if (s.who === 'you') return you
  if (s.who === 'partner') return you === 'rex' ? 'nova' : 'rex'
  return s.who
}
