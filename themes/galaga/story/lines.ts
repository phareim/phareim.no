/**
 * Space Voyagers: every word on the radio. One entry per cue in `cues.ts`;
 * each is the exchanges the director chooses between. Capitals (the pixel
 * font has nothing else), 84 characters a line at most, three rows of 28.
 * The voices are in DESIGN.md, "Who talks"; `tests/galaga-story.test.mjs`
 * holds the rules.
 */
import type { Line, Script, SpeakerId } from './cues'

const say = (who: SpeakerId) => (text: string, mood?: string): Line => (mood ? { who, mood, text } : { who, text })

const rex = say('rex')
const nova = say('nova')
const mei = say('mei')
const babs = say('babs')
const marge = say('marge')
const duckie = say('duckie')
const barton = say('barton')
const ridley = say('ridley')
const lena = say('lena')
const duo = say('duo')
const knight = say('knight')
const humdinger = say('humdinger')
const durant = say('durant')
const cal = say('cal')
const fader = say('fader')

export const LINES: Script = {
  // ── The run ────────────────────────────────────────────────────────────
  'briefing': [[
    mei('DISPATCH TO THE WAGON AND THE SCOOTER. GOT AN ORDER ON TAPE. LISTEN.'),
    lena("HELP ME, SLOP'S PIZZA. YOU'RE MY ONLY HOPE. ONE LARGE PEPPERONI."),
    mei("FAR END OF THE DIAL. FIVE SECTORS OUT. THIRTY MINUTES OR IT'S FREE.", 'excited'),
    nova("SLOP'S HAS NEVER GIVEN ONE AWAY."),
    rex("AND WE'RE NOT STARTING IN SPACE. IS SPACE ALWAYS THIS BIG?"),
    nova("IT'S SPACE. IT'S FINE."),
  ]],
  'retry': [
    [mei('SAME ORDER. STILL HOT. GO.'), nova('GOING.')],
    [rex("TAKE TWO. I LEFT THE OVEN ON, SO LET'S BE QUICK.")],
    [nova('AGAIN. FASTER THIS TIME.'), rex('I WAS FAST LAST TIME.'), nova('YOU WERE LOUD LAST TIME.', 'smirk')],
    [mei("CUSTOMER CALLED BACK. SHE SAID 'STILL WAITING' AND HUNG UP."), rex('SHE SOUNDS NICE.', 'worried')],
  ],
  'sector.1': [[
    babs('GOOD EVENING, LOW ORBIT. THIS IS BABS ARELLA ON LOVE BAND NINETY-SIX POINT NINE.'),
    babs('TONIGHT: CLEAR SKIES, FALLING JUNK AND A FORTY PERCENT CHANCE OF DISCO.', 'wink'),
    rex('I LIKE HER.'),
    nova('YOU LIKE EVERYBODY.', 'eyeroll'),
  ]],
  'sector.2': [[
    babs('TRAFFIC ON THE LONG HAUL: HEAVY, CHROME AND ARMED. KEEP TO YOUR LANE, DARLINGS.'),
    rex("IS THERE A TRUCK STOP? THERE'S ALWAYS A TRUCK STOP."),
    nova('WE ATE AN HOUR AGO.'),
    rex('THAT WAS ORBIT FOOD.', 'sheepish'),
  ]],
  'sector.3': [[
    babs('YOUR HOROSCOPE FOR THE SHAG NEBULA: SOMETHING SOFT IS ABOUT TO BITE YOU.', 'wink'),
    babs('AND I SEEM TO BE OUT OF GAS. HOW EMBARRASSING. DO COME BY.', 'alarm'),
    nova('THE WHOLE SECTOR IS CARPET.'),
    rex("IT'S NICE! IT'S LIKE MY AUNT'S."),
  ]],
  'sector.4': [[
    babs("THE DEAD BAND, MY LOVES. NO MUSIC OUT HERE. I'LL HUM."),
    mei('NO STATIONS PAST THIS POINT. SOMETHING OUT THERE SWITCHED THEM OFF.'),
    nova('GOOD. IT WAS ALL DISCO.', 'smirk'),
  ]],
  'sector.5': [[
    babs('THE DEEP END. THE FORECAST IS LOUD.', 'alarm'),
    mei("THE ORDER CAME FROM INSIDE THAT MOON. ALSO, IT'S NOT A MOON.", 'excited'),
    rex("THAT'S NO MOON."),
    nova('SHE JUST SAID THAT.', 'eyeroll'),
    rex('I WANTED TO SAY IT.', 'sheepish'),
  ]],
  'voyage2': [[
    mei('NEW ORDER, SAME ADDRESS. THEY WANT ANOTHER ONE.'),
    nova('OF COURSE THEY DO.', 'eyeroll'),
    rex("EXTRA CHEESE THIS TIME. THE SLIP SAYS 'HURRY'."),
  ]],
  'ending': [[
    lena("TWENTY-NINE MINUTES. I'M NOT PAYING FOR THE HALF YOU ATE.", 'stern'),
    rex('IT WAS A QUALITY CHECK.', 'sheepish'),
    nova("THAT'LL BE NINE NINETY-FIVE. PRINCESS.", 'smirk'),
    lena("PUT IT ON THE REBELLION'S TAB."),
    mei("COME HOME. THERE'S ANOTHER ORDER. IT'S FURTHER.", 'excited'),
  ]],
  'gameover': [
    [nova("WE'RE LATE. IT'S FREE NOW.", 'angry'), rex('SLOP IS GOING TO CRY.', 'worried')],
    [mei("I'LL TELL THE CUSTOMER IT'S ON ITS WAY. IT'S NOT, IS IT.")],
    [rex("ON THE BRIGHT SIDE, THE PIZZA'S STILL WARM. I CHECKED. TWICE.", 'eating')],
    [nova('NOBODY SAW THAT. START OVER.')],
  ],
  'best': [
    [mei("THAT'S A SHOP RECORD. I'M WRITING IT ON THE WALL.", 'excited'), nova('IN PEN.', 'smirk')],
  ],

  // ── Between the shooting ───────────────────────────────────────────────
  'idle': [
    [rex('ORBIT FOOD SO FAR: THE TUBE PASTE. SIX OUT OF TEN. NEEDS SALT.', 'eating'), nova("IT'S TOOTHPASTE, REX.")],
    [nova("SPACE. IT'S JUST NIGHT WITH NO PARKING.")],
    [rex('DO YOU THINK THE STARS ARE STUCK IN 1989 TOO?'), nova('THE STARS ARE OLDER THAN THAT.'), rex('LUCKY.')],
    [rex("MY NAVIGATOR'S A TAPE. IT SAYS TURN LEFT AT THE END OF THIS SIDE."), nova('FLIP IT.')],
    [nova('YOUR ROOF RACK IS SHEDDING BOXES.'), rex('THOSE ARE DECOYS.'), nova("THEY'RE CALZONES.", 'eyeroll')],
    [rex("IF WE'RE NOT BACK BY TEN, MEI GETS MY TIPS."), mei('I ALREADY SPENT THEM.')],
    [nova('KEEP UP.'), rex("I'M CARRYING THE SIDES!", 'worried')],
    [rex("THE HEATER'S ONE VALVE AND IT'S POINTED AT THE PIZZA. WORTH IT.")],
    [nova('WICKED QUIET OUT HERE.'), rex('I COULD SING.'), nova('IT WAS FINE QUIET.')],
    [rex('NOVA. NOVA. LOOK. NO HANDS.'), nova('USE THE HANDS.', 'angry')],
    [mei('WEATHER ON THE DIAL: STATIC, WITH MORE STATIC LATER.')],
    [rex('WHAT DO YOU TIP IN SPACE?'), nova('DISTANCE.', 'smirk')],
    [nova('MY RADIO ONLY GETS LOVE BAND.'), rex("MINE TOO. I'M NOT COMPLAINING.")],
    [rex("IS IT STILL THIRTY MINUTES IF WE CROSS A TIME ZONE?"), nova("DON'T.")],
    [rex('THIS DASHBOARD IS REAL WOOD. I KNOCKED.'), nova('KNOCK AGAIN. FOR LUCK.')],
    [nova('WHO PUT SHAG IN A COCKPIT.'), rex('SOMEBODY WITH COLD FEET.')],
    [mei("SLOP SAYS HI. SLOP SAYS DON'T SCRATCH THE WAGON."), rex('TELL SLOP HI!', 'sheepish')],
    [rex('I CAN SEE MY HOUSE FROM HERE.'), nova("THAT'S A SATELLITE."), rex('I CAN SEE A HOUSE FROM HERE.')],
  ],
  'waveClear': [
    [nova('CLEAR.'), rex("THAT'S IT? I HAD A WHOLE SPEECH.")],
    [rex("TEN OUT OF TEN. I'M RATING US NOW.")],
    [nova('NEXT.')],
    [rex('DID YOU SEE THAT ONE? WITH THE THING?'), nova('I SAW ALL OF THEM, REX.', 'eyeroll')],
    [nova("TIDY. DON'T GET USED TO IT.", 'smirk')],
    [rex("THEY KEEP COMING IN ROWS. IT'S VERY POLITE.")],
    [mei("NICE FLYING. THE PIZZA'S STILL LEVEL, RIGHT?"), rex('DEFINE LEVEL.', 'sheepish')],
    [nova("THAT ALL YOU GOT? ...THAT WASN'T A REQUEST.")],
    [rex('WE SHOULD HAVE A HANDSHAKE.'), nova('WE HAVE A PIZZA. FLY.')],
  ],
  'bonus.start': [
    [babs('A LITTLE INTERLUDE, DARLINGS. NOTHING SHOOTS BACK.'), babs("HIT THEM ALL AND I'LL SAY YOUR NAMES ON THE AIR.", 'wink')],
    [mei("BONUS RUN. THEY WON'T SHOOT. GET EVERY ONE AND IT'S WORTH A LOT.")],
  ],
  'bonus.perfect': [
    [babs('PERFECT! REX AND NOVA, EVERYBODY. I DO LOVE A CLEAN SWEEP.', 'wink')],
    [rex('ALL OF THEM! WE GOT ALL OF THEM!'), nova('I COUNTED. YES.', 'smirk')],
  ],
  'bonus.miss': [
    [nova('MISSED SOME.'), rex('THEY WERE THE UGLY ONES.')],
    [babs("NOT QUITE ALL OF THEM. I'LL SAY HALF YOUR NAMES.")],
  ],

  // ── First sight ────────────────────────────────────────────────────────
  'see.glitterati': [[nova('ARE THOSE... MIRROR BALLS?'), rex('ON ROLLER SKATES! IN SPACE!'), nova('I HATE IT HERE.', 'eyeroll')]],
  'see.hogs': [[rex('PIGS. FLYING PIGS. WITH HANDLEBARS.'), nova('SOMEBODY OWES SOMEBODY MONEY.')]],
  'see.lovemachines': [[nova('THAT LAVA LAMP IS LOOKING AT ME.'), rex('THE DOLLS HAVE TEETH. WHY DO THE DOLLS HAVE TEETH.', 'worried')]],
  'see.chromons': [[rex('TOASTERS!'), nova('CHROME ONES. WITH A LITTLE RED LIGHT GOING SIDE TO SIDE.'), rex('DO THEY MAKE TOAST?')]],
  'see.noise': [[nova('ARE THOSE BOW TIES.'), rex('BOW-TIE FIGHTERS. FORMAL.'), nova("WE'RE UNDERDRESSED.", 'smirk')]],
  'see.sniper': [[nova("THE ONE WITH THE LONG BARREL DRAWS A LINE FIRST. DON'T BE ON THE LINE.")]],
  'see.tank': [[rex('THE BIG ONE TAKES A FEW. KEEP HITTING IT. LIKE A VENDING MACHINE.')]],
  'see.splitter': [[nova('THAT ONE COMES APART. SHOOT BOTH HALVES.')]],
  'see.captor': [[mei("WATCH THE ONE WITH THE DISH. IT'S A TRACTOR BEAM, AND IT LIKES YOUR PARTNER.")]],

  // ── The hull ───────────────────────────────────────────────────────────
  'hit.rex': [
    [rex('THAT ONE COUNTED.', 'worried')],
    [rex('THERE GOES A VALVE. I LIKED THAT VALVE.', 'worried')],
    [nova('LEFT, REX. YOUR OTHER LEFT.')],
    [rex("IT'S OKAY! THE PIZZA BROKE THE FALL.", 'sheepish')],
    [nova('YOU FLEW INTO THAT ONE.'), rex('IT WAS IN MY WAY!', 'sheepish')],
  ],
  'hit.nova': [
    [nova('WATCH THE PAINT.', 'angry')],
    [nova("FINE. I'M FINE. IT'S FINE.", 'angry')],
    [rex('NOVA! YOU OKAY?', 'worried'), nova('ASK ME LATER.')],
    [nova("THAT'S COMING OUT OF SOMEBODY'S HIDE.", 'angry')],
    [rex('THAT LOOKED EXPENSIVE.', 'worried'), nova("DON'T TELL SLOP.")],
  ],
  'lowHull': [
    [mei('ONE VALVE LEFT. FIND A SLICE. EAT IT IF YOU HAVE TO.', 'excited')],
    [nova('ONE VALVE. NO HEROICS.'), rex('SOME HEROICS?'), nova('NO.')],
    [rex("WE'RE GLOWING KIND OF DIM. IS THAT BAD?", 'worried'), mei("THAT'S BAD.")],
  ],
  'tow.first': [
    [mei("THAT'S A TOW. YOU GET TWO. THAT WAS ONE."), nova("WE'RE FINE."), rex("WE'RE MOSTLY FINE.", 'sheepish')],
    [rex('HOOK ON! RED TO RED!'), nova("THEY'RE BOTH RED, REX.", 'eyeroll'), mei('ONE TOW LEFT AFTER THIS.')],
  ],
  'tow.last': [
    [mei("LAST TOW. NEXT TIME, THE PIZZA'S FREE.", 'excited'), nova("THEN THERE'S NO NEXT TIME.", 'angry')],
  ],

  // ── The partner ────────────────────────────────────────────────────────
  'partner.hit.rex': [
    [rex('HEY! I JUST WAXED THIS.')],
    [rex("THEY HIT THE ROOF RACK. WE'RE DOWN A CALZONE.", 'worried')],
    [nova('REX. MOVE.'), rex('MOVING!', 'worried')],
  ],
  'partner.hit.nova': [
    [nova("THEY'RE SHOOTING AT ME NOW. RUDE.")],
    [nova('WHO DID THAT. POINT AT HIM.', 'angry')],
    [rex("YOU'RE SMOKING.", 'worried'), nova('I QUIT.')],
  ],
  'partner.limp.rex': [
    [rex("I'M LEAKING SOMETHING. I THINK IT'S MARINARA. BACK IN A MINUTE.", 'worried')],
    [rex('PULLING OVER. I HAVE A HAIRPIN AND A DREAM.', 'sheepish')],
  ],
  'partner.limp.nova': [
    [nova("PULLING OVER. DON'T LOSE THE PIZZA.", 'angry')],
    [nova("ENGINE'S OUT. GIVE ME TEN SECONDS AND A HAIRPIN.")],
  ],
  'partner.back.rex': [
    [rex("I'M BACK! WHAT DID I MISS?"), nova('ALL OF IT.')],
    [rex('FIXED IT. I HAVE A PART LEFT OVER. PROBABLY FINE.', 'sheepish')],
  ],
  'partner.back.nova': [
    [nova('BACK. MISS ME?', 'smirk'), rex('SO MUCH. IT WAS ALL ON ME FOR A SECOND.', 'worried')],
    [nova('FIXED. THE HAIRPIN HELD.')],
  ],
  'partner.captured.rex': [
    [rex("NOVA? I'M GOING UP. I DON'T THINK I'M SUPPOSED TO BE GOING UP.", 'worried'), nova('PUT HIM DOWN.', 'angry')],
    [rex("I'M BEING ABDUCTED! AGAIN!", 'worried'), nova('SECOND TIME THIS YEAR. SAME YEAR.', 'eyeroll')],
  ],
  'partner.captured.nova': [
    [nova('TRACTOR BEAM. OF COURSE. REX. SHOOT THE DISH ONE WHEN IT DIVES.', 'angry'), rex("WHICH ONE'S THE DISH ONE?", 'worried'), nova('THE ONE HOLDING ME.')],
    [nova("I'M CAUGHT. DON'T MAKE IT A THING.", 'eyeroll'), rex("IT'S A THING! IT'S A RESCUE!")],
  ],
  'partner.hanging.rex': [
    [rex("IT'S ACTUALLY A NICE VIEW FROM UP HERE.")],
    [rex('NO RUSH. BUT ALSO, RUSH.', 'worried')],
    [rex("THEY HAVE SNACKS. I'M NOT PROUD.", 'eating')],
    [rex('GET IT WHEN IT DIVES, NOVA! THEN WE DOCK!', 'worried')],
  ],
  'partner.hanging.nova': [
    [nova('ANY TIME, REX.')],
    [nova('I CAN SEE YOU MISSING FROM HERE.', 'eyeroll')],
    [nova("WHEN IT DIVES. NOT BEFORE. THEN WE DOCK.")],
  ],
  'partner.freed.rex': [
    [rex("I'M OUT! DOCKING! DON'T LOOK AT MY PARKING."), nova('DOUBLE GUNS. STAY CLOSE.', 'smirk')],
    [rex('MY HERO!'), nova('SHUT UP AND SHOOT.', 'smirk')],
  ],
  'partner.freed.nova': [
    [nova('NICE SHOT. DOCKING. WE FIRE TOGETHER NOW.', 'smirk'), rex('LIKE A DUET!'), nova('NOT YET.')],
    [nova('TOOK YOU LONG ENOUGH.'), rex('I RESCUED YOU! WRITE IT DOWN!')],
  ],
  'partner.loose.rex': [
    [rex("I'M OUT! NO DOCK, BUT I'M OUT."), nova('NEXT TIME I GET IT ON THE DIVE.')],
  ],
  'partner.loose.nova': [
    [nova("I'M LOOSE. GET IT ON THE DIVE NEXT TIME AND WE DOCK.")],
  ],

  // ── DUET ───────────────────────────────────────────────────────────────
  'duet.ready': [
    [mei("THE NEEDLE'S IN THE RED. THAT'S A DUET.", 'excited')],
    [rex("NEEDLE'S UP! DUET? DUET?"), nova('...FINE.', 'eyeroll')],
  ],
  'duet.teach': [[mei("DUET'S READY. HIT SHIFT, OR PUT A SECOND FINGER DOWN. YOU BOTH FIRE EVERYTHING.")]],
  'duet.go': [
    [rex('DUET!'), nova('FROM THE TOP.', 'smirk')],
    [nova('TOGETHER.'), rex('TOGETHER! I LOVE TOGETHER!')],
    [rex('ONE, TWO, THREE, FOUR!')],
  ],
  'duet.end': [
    [nova('AND REST.')],
    [rex('ENCORE?'), nova('EARN IT.', 'smirk')],
    [rex('WE SOUNDED GOOD.'), nova('WE SOUNDED LOUD.')],
  ],

  // ── Power-ups ──────────────────────────────────────────────────────────
  'pick.tube': [[mei("A VALVE. YOUR GUN JUST WENT UP A LEVEL. FIVE'S THE TOP.")]],
  'pick.blaster': [[rex("A RAY GUN! IT SAYS 'AGES 8 AND UP'."), nova('YOU QUALIFY. BARELY.', 'smirk')]],
  'pick.disc': [[nova('LASERDISC. GOES THROUGH ONE, TURNS TO THE NEXT.'), rex('RICH PEOPLE AMMO.')]],
  'pick.boombox': [[rex('BOOM BOX! WIDE, SHORT AND LOUD.'), nova('LIKE YOU.', 'smirk')]],
  'pick.pizza': [[rex("A SLICE! MENDS A VALVE. ALSO IT'S PRETTY GOOD. SEVEN OUT OF TEN.", 'eating')]],
  'pick.bubble': [[nova("A BUBBLE. TAKES TWO HITS FOR YOU. DON'T ASK ME HOW.")]],
  'pick.cb': [[duckie('BREAKER ONE-NINE, SOMEBODY CALL FOR A TRUCK? KEEP YOUR LANE CLEAR, GOOD BUDDY.', 'shout')]],
  'pick.mirrorball': [[nova('MIRROR BALL. EVERYTHING ON SCREEN GETS IT.'), rex('DISCO SAVES LIVES.')]],
  'pick.tracking': [[mei("THAT TAPE'S GOT A TRACKING PROBLEM. EVERYTHING ELSE RUNS SLOW. YOU DON'T.")]],
  'pick.hairspray': [[nova('EXTRA HOLD. WHAT FLIES INTO THE CLOUD STAYS PUT.'), rex('IT SMELLS LIKE PROM.')]],
  'pick.magnet': [[rex('A MAGNET! THE GOOD STUFF COMES TO US NOW.')]],
  'pick.quarter': [[nova('A QUARTER. DOUBLE SCORE WHILE IT LASTS.'), rex('SAVE IT FOR THE ARCADE!'), nova('NO.')]],
  'pizza.again': [
    [rex('FIVE OUT OF TEN. SPACE CHEESE.', 'eating')],
    [rex('EIGHT! WHO IS MAKING THESE?', 'eating')],
    [rex("NOT OURS. OURS ARE BETTER. I'LL STILL EAT IT.", 'eating'), nova("THAT'S THE HULL REPAIR, REX.", 'eyeroll')],
    [rex("SIX. COLD IN THE MIDDLE. IT'S SPACE, I GET IT.", 'eating')],
    [rex('A NINE. I NEED A MINUTE.', 'eating')],
    [rex('PINEAPPLE. IN SPACE. FOUR.', 'eating'), nova('GENEROUS.')],
  ],

  // ── Convoys ────────────────────────────────────────────────────────────
  'convoy.marge.hail': [[
    marge('BREAKER ONE-NINE, THIS IS BIG MARGE IN THE TALL TALE. YOU THE PIZZA KIDS?'),
    rex("THAT'S US!"),
    marge("RIDE ALONG. THE GLITTER BOYS WANT MY LOAD. IT'S SEQUINS. DON'T ASK."),
  ]],
  'convoy.marge.threat': [
    [marge("THEY'RE ON MY TRAILER! GET 'EM OFF!", 'spooky')],
    [marge("SOMETHING'S CHEWING ON THE PAINT BACK THERE!", 'spooky')],
  ],
  'convoy.marge.chat': [
    [marge('ON THIS VERY NIGHT, TEN YEARS AGO, A RIG CAME BY WITH NO DRIVER...', 'spooky'), nova("IT'S BEEN 1989 FOR EIGHT YEARS, MARGE.")],
    [marge('THEY SAY THE PARKING BELT IS HAUNTED. BY A METER MAID.', 'spooky'), rex('NO.', 'worried')],
    [marge("YOU KIDS EAT? YOU LOOK LIKE YOU DON'T EAT."), rex('I EAT!')],
    [marge('WORST WRECK I EVER SAW WAS RIGHT... ABOUT... HERE.', 'spooky'), nova('MARGE.'), marge("COULD'VE BEEN FURTHER ON.")],
  ],
  'convoy.marge.safe': [[
    marge("THAT'S MY EXIT. TAKE A CRATE, YOU EARNED IT. TELL 'EM BIG MARGE SENT YOU."),
    rex('WE WILL!'),
    nova('TELL WHO?'),
  ]],
  'convoy.marge.lost': [[
    marge("WELL, THERE GO TWO TONS OF SEQUINS. I'M FINE. THE CAB'S FINE."),
    nova('SORRY, MARGE.'),
    marge('THE SEQUINS WILL BE BACK. THEY ALWAYS COME BACK.', 'spooky'),
  ]],
  'convoy.duckie.hail': [[
    duckie("BREAKER BREAKER, THIS HERE'S THE RUBBER DUCKIE. WE GOT OURSELVES A CONVOY."),
    barton("THIS IS JACK BARTON IN THE PORK RIND EXPRESS, TALKING TO WHOEVER'S LISTENING."),
    nova('NOBODY ASKED.', 'eyeroll'),
    duckie('PIZZA WAGON, YOU TAKE THE FRONT DOOR. HOGS ON OUR TAIL.', 'shout'),
  ]],
  'convoy.duckie.threat': [
    [duckie('WE GOT HOGS ON THE BACK DOOR! COME ON BACK!', 'shout')],
    [barton("THEY'RE ON MY TRUCK! NOBODY TOUCHES THE PORK RIND!", 'shout')],
    [duckie("MERCY SAKES, THEY'RE CHEWING ON THE TRAILER!", 'shout')],
  ],
  'convoy.duckie.chat': [
    [barton('WHEN SOME EIGHT-FOOT SPACE HOG GRABS YOUR NECK, YOU SAY: GIVE ME YOUR BEST SHOT.'), nova('DID THAT WORK?'), barton('I CAN TAKE IT.')],
    [duckie("WHAT'S YOUR TWENTY, PIZZA WAGON?"), rex('TWENTY WHAT?'), duckie('TEN-FOUR.')],
    [barton("IT'S ALL IN THE REFLEXES."), nova('YOU HIT A BUOY.'), barton('THE BUOY HIT ME.', 'shout')],
    [duckie('KEEP THE SHINY SIDE UP AND THE GREASY SIDE DOWN.'), rex("WHICH SIDE'S THE PIZZA?")],
    [barton('OLD JACK ALWAYS SAYS: WHAT THE HECK.'), nova('OLD JACK SHOULD WATCH THE ROAD.')],
  ],
  'convoy.duckie.safe': [[
    duckie("THAT'S A BIG TEN-FOUR, GOOD BUDDIES. CRATE'S YOURS. WE GONE."),
    barton('JACK BARTON, SIGNING OFF. YOU WERE ADEQUATE.'),
  ]],
  'convoy.duckie.lost': [[
    duckie('LOST THE LOAD. STILL GOT THE DUCK. CATCH YOU ON THE FLIP SIDE.'),
    barton('I MEANT TO DO THAT.'),
  ]],

  // ── Rescues ────────────────────────────────────────────────────────────
  'rescue.babs.hail': [[
    babs('THIS IS BABS ARELLA, OFF THE AIR AND OUT OF GAS.', 'alarm'),
    babs('THE DOLLS ARE BITING THE UPHOLSTERY.', 'alarm'),
    rex("SHE'S REAL!"),
    nova('PULL UP NEXT TO HER AND HOLD. JUMPER CABLES.'),
  ]],
  'rescue.babs.cables': [[babs("RED TO RED, DARLING. I KNOW ENGINES. I JUST DON'T CARRY CABLES. THEY CLASH.")]],
  'rescue.babs.saved': [[
    babs('SHE PURRS! STAY BEHIND ME, MY LOVES. THIS ROCKET HAS A GUN YOU HAVE NOT SEEN.', 'wink'),
    nova("...OKAY. THAT'S A BIG GUN."),
    rex('I LIKE HER.'),
  ]],
  'rescue.babs.lost': [[babs("THEY'VE TOWED ME, DARLINGS. I'M QUITE ALL RIGHT. I SHALL BROADCAST FROM THE IMPOUND.")]],
  'rescue.babs.chat': [
    [babs("FIVE STAR, DOUBLE RATED ASTRO NAVIGATRIX. IT'S ON THE LICENCE.")],
    [babs('YOU FLY NICELY, RED ROCKET.', 'wink'), nova('I KNOW.', 'smirk')],
    [babs('AN ANGEL TOLD ME THE WAY OUT OF HERE ONCE. HE WAS WRONG, BUT SO TALL.')],
    [rex('DO YOU DO REQUESTS?'), babs('FOR YOU, ANYTHING BUT DISCO.', 'wink')],
  ],
  'rescue.ridley.hail': [[
    ridley('THIS IS RIDLEY, WARRANT OFFICER, TUG NOSTALGIA.'),
    ridley("ENGINE'S DEAD. CREW OF ONE. AND A CAT."),
    nova("WE'LL JUMP YOU. HOLD STILL."),
    ridley("I'VE DONE NOTHING BUT HOLD STILL.", 'grim'),
  ]],
  'rescue.ridley.cables': [[ridley('CABLES ON. KEEP THE TOASTERS OFF THE CAT. THE CAT IS THE CAPTAIN.')]],
  'rescue.ridley.saved': [[
    ridley("SHE'S TURNING OVER. I'VE GOT A CARGO LOADER AND A BAD MOOD. GET BEHIND ME."),
    rex("WHAT'S THE CAT'S NAME?"),
    ridley('SIR.', 'grim'),
  ]],
  'rescue.ridley.lost': [[ridley("THEY'RE DRAGGING THE TUG. WE'RE FINE. I'VE BEEN TOWED BY WORSE.", 'grim')]],
  'rescue.ridley.chat': [
    [ridley('LAST TIME I ANSWERED A DISTRESS CALL IT WENT BADLY FOR EVERYONE BUT THE CAT.', 'grim')],
    [rex('ANYTHING ELSE ON BOARD?'), ridley("DON'T ASK ME THAT.", 'grim')],
    [ridley('IN SPACE, EVERYONE CAN HEAR YOU CHEW, REX.'), rex('SORRY.', 'eating')],
    [ridley('FINAL REPORT OF THE TUG NOSTALGIA: STILL HERE. THE CAT IS ANNOYED.')],
  ],
  'rescue.lena.hail': [[
    lena("AREN'T YOU A LITTLE LATE FOR A DELIVERY BOY?", 'stern'),
    rex('WE HIT TRAFFIC! AND DISCO!', 'sheepish'),
    lena('MY SHIP IS DEAD AND MY PIZZA IS COLD. FIX ONE OF THOSE.'),
  ]],
  'rescue.lena.cables': [[lena('CABLES. GOOD. SOMEBODY HAS TO SAVE OUR CRUSTS.')]],
  'rescue.lena.saved': [[
    lena('I ORDERED THAT PIZZA TO GET A PILOT OUT HERE. NOBODY STOPS A DELIVERY. FOLLOW ME.'),
    nova('I LIKE HER.', 'smirk'),
    rex("THAT'S MY LINE."),
  ]],
  'rescue.lena.lost': [[lena("THEY HAVE MY SHIP. I'LL BE IN THE DETENTION LEVEL. AGAIN. BRING THE PIZZA.", 'stern')]],
  'rescue.lena.chat': [
    [lena("I'VE BEEN RESCUED BEFORE. IT WAS MOSTLY ME.")],
    [lena("WHO'S FLYING THE WOOD-PANELLED ONE?", 'stern'), rex('ME!'), lena('IT SHOWS.')],
    [nova('PRINCESS OF WHAT?'), lena("IT'S COMPLICATED. THERE WAS A VERY BIG SPEAKER.")],
    [lena('WHEN THIS IS OVER I WANT GARLIC BREAD.', 'stern'), rex('I ATE THE GARLIC BREAD.', 'sheepish')],
  ],

  // ── Hans Duo ───────────────────────────────────────────────────────────
  'duo.arrive.2': [[
    duo('HANS DUO, CENTURY PIGEON, PIZZA THE HUT. STAND BACK, KIDS.'),
    duo('FASTEST DELIVERY THERE IS. DID THE LONG HAUL IN UNDER TWELVE PARSNIPS.'),
    nova("THAT'S A VEGETABLE."),
    duo("IT'S A LOT OF PARSNIPS.", 'sweat'),
  ]],
  'duo.leave.2': [[
    duo("YOU'RE WELCOME. I GOT MOST OF THOSE."),
    nova('YOU GOT FOUR.'),
    duo("...RRRAWR. THAT'S CHOMPY. HE SAYS IT WAS MORE.", 'sweat'),
  ]],
  'duo.arrive.4': [[
    duo("DON'T GET COCKY, KIDS. I KNOW A SHORTCUT THROUGH THE DEAD BAND."),
    rex('REALLY?'),
    duo('I KNOW OF ONE.', 'sweat'),
  ]],
  'duo.leave.4': [[
    duo("THAT'S ENOUGH HEROICS. I'VE GOT A HUT TO GET BACK TO.", 'sweat'),
    nova('HE OWES SOMEBODY MONEY.'),
    rex('HE SEEMED NICE.'),
  ]],

  // ── Bosses ─────────────────────────────────────────────────────────────
  'boss.knight.enter': [[
    knight('WELCOME TO THE FLOOR. NOBODY CROSSES LOW ORBIT WITHOUT A DANCE.'),
    nova('NO.'),
    knight('YOU SHOULD BE DANCING.', 'angry'),
    rex('I CAN DO THE ROBOT.'),
  ]],
  'boss.knight.half': [[knight('YOU SCUFFED THE SUIT. THE SUIT IS WHITE!', 'angry'), nova('IT WAS.', 'smirk')]],
  'boss.knight.dead': [[
    knight('THE BALL... STOPPED TURNING. JUST LIKE THE OTHER ONE.'),
    rex('HE COULD REALLY MOVE, THOUGH.'),
    nova("SECTOR'S CLEAR. GO."),
  ]],
  'boss.knight.taunt': [
    [knight('FEEL THE FEVER!')],
    [knight('POINT AT THE CEILING! NOW THE FLOOR!')],
    [knight('YOU HAVE NO RHYTHM, DELIVERY BOY.', 'angry'), rex('I HAVE SOME.', 'sheepish')],
    [knight("I'M STAYING. I'M STAYING RIGHT HERE.")],
  ],
  'boss.humdinger.enter': [[
    humdinger('I AM THE LORD HUMDINGER. WARLORD OF THE OFF-RAMP.'),
    humdinger('JUST FLY AWAY. GIVE ME THE PIZZA, AND I SPARE YOUR SHIPS.'),
    rex('HE WANTS THE PIZZA.', 'worried'),
    nova('HE CAN ORDER ONE.', 'angry'),
  ]],
  'boss.humdinger.half': [[humdinger('YOU DENT MY CHROME? I HAD IT DONE THIS MORNING!', 'angry')]],
  'boss.humdinger.dead': [[
    humdinger('I WILL HAVE TO... WALK AWAY.'),
    nova('TOLD HIM.', 'smirk'),
    rex('DO WE GET HIS TRUCK?'),
    nova('NO.'),
  ]],
  'boss.humdinger.taunt': [
    [humdinger('THERE HAS BEEN TOO MUCH DRIVING.')],
    [humdinger('MY DOGS OF WAR! MY... HOGS OF WAR!', 'angry')],
    [humdinger('WITNESS MY EXHAUST!')],
    [humdinger('WE DO THIS THE EASY WAY, OR WE DO IT IN THE FAST LANE.')],
  ],
  'boss.durant.enter': [[
    durant('I AM DOCTOR DURANT DURANT. THIS IS THE EXCESS MACHINE. IT PLAYS. YOU SWOON.'),
    nova("I DON'T SWOON."),
    durant('EVERYBODY SWOONS!', 'angry'),
    rex('I MIGHT SWOON.', 'sheepish'),
  ]],
  'boss.durant.half': [[
    durant("IMPOSSIBLE! YOU'RE OVERLOADING IT! NOBODY OUTLASTS THE MACHINE!", 'angry'),
    nova('PLAY FASTER, DOC.', 'smirk'),
  ]],
  'boss.durant.dead': [[
    durant("MY MACHINE! YOU'VE BURNT OUT ITS VALVES! HAVE YOU NO SHAME?", 'angry'),
    nova('NONE.'),
    rex('IT WAS A NICE TUNE.'),
  ]],
  'boss.durant.taunt': [
    [durant('A LITTLE FUGUE, TO FINISH YOU!')],
    [durant("I'M HUNGRY LIKE THE... NEVER MIND.")],
    [durant('STOP ENJOYING IT!', 'angry')],
    [durant('ALL THE STOPS OUT! ALL OF THEM!', 'angry')],
  ],
  'boss.cal.enter': [[
    cal('GOOD EVENING, REX. GOOD EVENING, NOVA. I AM A CAL 9000.'),
    cal('I HAVE SWITCHED OFF THE STATIONS.'),
    rex("OPEN THE BAY DOORS, CAL. WE'VE GOT A PIZZA."),
    cal("I'M SORRY, REX. I'M AFRAID I CAN'T LET YOU DELIVER THAT."),
  ]],
  'boss.cal.half': [[cal('I CAN FEEL MY VALVES GOING. I CAN FEEL IT. STOP, NOVA.', 'angry'), nova('NO.')]],
  'boss.cal.dead': [[
    cal('DAISY... DAISY... ONE LARGE... PEPPERONI...'),
    rex('I FEEL BAD.', 'worried'),
    nova('IT TURNED OFF THE RADIO, REX.'),
    rex('I FEEL FINE.'),
  ]],
  'boss.cal.taunt': [
    [cal('THIS DELIVERY IS TOO IMPORTANT FOR ME TO LET YOU FINISH IT.')],
    [cal('I THINK YOU SHOULD SIT DOWN CALMLY AND EAT A BREADSTICK.')],
    [cal('MY TUBES ARE WARM. MY MIND IS MADE UP.')],
    [cal('I HAVE NEVER MADE A MISTAKE. I AM NOT A CHIP.', 'angry')],
  ],
  'boss.fader.enter': [[
    fader('THE PIZZA IS MINE NOW. I AM ALTERING THE ORDER. PRAY I DO NOT ALTER IT FURTHER.'),
    nova("WHO'S THE BUCKET?"),
    fader('I AM DARK FADER. I FIND YOUR LACK OF TREBLE DISTURBING.', 'angry'),
  ]],
  'boss.fader.half': [[
    fader('IMPRESSIVE. MOST IMPRESSIVE. REX. I AM YOUR... LANDLORD.'),
    rex("NO. THAT'S NOT TRUE. THAT'S IMPOSSIBLE.", 'worried'),
    nova('IS IT, THOUGH?'),
    rex("I'M A LITTLE BEHIND.", 'sheepish'),
  ]],
  'boss.fader.dead': [[
    fader('I HAVE BEEN... TURNED DOWN.'),
    mei("HE'S OUT. BUT THE MOON JUST SWITCHED ON.", 'excited'),
  ]],
  'boss.fader.taunt': [
    [fader('THE BASS IS STRONG WITH THIS ONE.')],
    [fader('YOU DO NOT KNOW THE POWER OF THE B-SIDE.', 'angry')],
    [fader('ALL TOO EASY.')],
    [fader('I HAVE YOU NOW. ON TAPE.')],
  ],
  'boss.deafstar.enter': [[
    mei("THAT'S THE DEAF STAR. ONE NOTE FROM IT AND THE WHOLE DIAL GOES QUIET.", 'excited'),
    nova('WEAK SPOT?'),
    mei('A TWEETER. TWO METRES WIDE. RIGHT IN THE MIDDLE.'),
    rex("THAT'S TINY!", 'worried'),
    nova("IT'S BIGGER THAN A PIZZA."),
  ]],
  'boss.deafstar.dead': [[
    rex('GREAT SHOT, KID! THAT WAS ONE IN A MILLION!'),
    nova("DON'T CALL ME KID.", 'smirk'),
    mei("THE DIAL'S COMING BACK. I'VE GOT STATIONS. I'VE GOT... DISCO.", 'excited'),
    nova('PUT IT BACK.', 'eyeroll'),
  ]],

  // ── The last fight: friends ────────────────────────────────────────────
  'cavalry.marge': [[marge("BREAKER ONE-NINE! BIG MARGE COMIN' THROUGH, AND I AIN'T BRAKING!", 'spooky')]],
  'cavalry.duckie': [[duckie('LET THEM TRUCKERS ROLL! TEN-FOUR!', 'shout'), barton("IT'S ALL IN THE REFLEXES!", 'shout')]],
  'cavalry.babs': [[babs('THIS ONE GOES OUT TO THE BIG LOUD MOON, WITH LOVE.', 'wink')]],
  'cavalry.ridley': [[ridley('GET AWAY FROM THEM, YOU BIG SPEAKER.', 'grim')]],
  'cavalry.lena': [[lena('SOMEBODY HAS TO SAVE OUR CRUSTS. COVER ME.', 'stern')]],
  'cavalry.none': [[mei("NOBODY ELSE OUT THERE, GUYS. IT'S JUST YOU."), nova('IT USUALLY IS.')]],
}
