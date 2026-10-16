/**
 * Space Voyagers II: the words. Each cue has variants; a variant is an
 * exchange (one line or several, by different speakers). Capitals, at most
 * 96 characters, three rows of 34 (`tests/voyagers2-story.test.mjs` holds
 * that). Voices: DESIGN.md "Who talks", `nova/docs/story.md` "Voice".
 * Where a cue is said by a seat (`by` in `cues.ts`), give a variant for Rex
 * and one for Nova.
 */
import type { CueId, Exchange } from './cues.ts'

const rex = (text: string, mood?: string) => ({ who: 'rex' as const, text, mood })
const nova = (text: string, mood?: string) => ({ who: 'nova' as const, text, mood })
const mei = (text: string, mood?: string) => ({ who: 'mei' as const, text, mood })
const nonna = (text: string, mood?: string) => ({ who: 'nonna' as const, text, mood })
const dougie = (text: string, mood?: string) => ({ who: 'dougie' as const, text, mood })
const mascot = (text: string, mood = 'rat') => ({ who: 'mascot' as const, text, mood })
const marge = (text: string, mood?: string) => ({ who: 'marge' as const, text, mood })
const ridley = (text: string, mood?: string) => ({ who: 'ridley' as const, text, mood })
const duo = (text: string, mood?: string) => ({ who: 'duo' as const, text, mood })
const parm = (text: string, mood?: string) => ({ who: 'parmesan' as const, text, mood })

export const LINES: Record<CueId, readonly Exchange[]> = {
  launch: [
    [mei('DEEP DISH TO CALZONE. DECK IS CLEAR. PATROL, THREE NAV POINTS. DO NOT EAT THE CARGO.'),
      nonna('AND COME BACK HUNGRY. I MADE TOO MUCH.')],
  ],
  launched: [
    [rex('CALZONE IS AWAY! NOVA, YOU COMFY BACK THERE?'), nova('THERE IS A PEPPERONI IN MY SEAT.', 'eyeroll'), rex('THAT IS MY EMERGENCY PEPPERONI.', 'sheepish')],
    [nova('WE ARE OUT. TRY NOT TO HIT THE OVEN THIS TIME.'), rex('ONE TIME!', 'sheepish')],
  ],
  autopilot: [
    [rex('AUTOPILOT ON. I AM GOING TO CLOSE MY EYES FOR ONE SECOND.'), nova('YOU ARE NOT FLYING. IT IS FINE.')],
    [nova('TAPE IS ROLLING. THE NAVIGATOR HUMS IN B FLAT.'), rex('IT IS PLAYING OUR SONG.', 'cheerful')],
    [rex('YOU KNOW WHAT GOES GREAT WITH SPACE? A MEATBALL SUB.', 'eating'), nova('YOU ARE EATING ONE.', 'eyeroll')],
    [nova('NAV POINT IN THIRTY. HEADPHONES OFF.'), rex('MINE OR YOURS?')],
  ],
  arrive: [
    [mei('CONTACTS AT THE NAV POINT. FRANCHISE. THEY ARE SINGING.', 'excited')],
    [mei('BANDITS AHEAD. THEY HAVE SEEN YOU. THEY ARE WAVING.')],
    [mascot('PIZZA THE HUT, PIZZA THE HUT, NOW ON EVERY ORBIT, WHAT?')],
  ],
  home: [
    [mei('CALZONE, A HOUND IS ON THE DEEP DISH! IT IS LINING UP A TORPEDO ON THE OVEN!', 'excited'),
      nonna('NOBODY TOUCHES MY OVEN.', 'stern')],
  ],
  landing: [
    [mei('CALZONE, YOU ARE CLEARED. MIND THE OVEN DOOR. IT IS HOT.'), nonna('WIPE YOUR FEET.')],
  ],
  won: [
    [nonna('GOOD. NOW YOU EAT.'), mei('DELIVERED. ON TIME. MOSTLY.')],
  ],
  lost: [
    [nonna('YOU CAME HOME. THAT IS SOMETHING. SIT DOWN.', 'stern')],
  ],
  eject: [
    [rex('EJECT! EJECT! GRAB THE PIZZA!', 'worried')],
    [nova('WE ARE DONE. POD. NOW.', 'angry')],
  ],
  carrierLost: [
    [mei('THE DEEP DISH IS HIT BAD! ALL HANDS TO THE PODS!', 'excited')],
  ],
  convoyLost: [
    [mei('WE LOST ONE. SHE IS OUT. CREW IS SAFE.')],
  ],
  'spawn-rat': [
    [mei('THOSE ARE RATS. LIGHT FIGHTERS, SHAPED LIKE A SLICE. FAST, FLIMSY. AIM AT THE DIAMOND.'),
      rex('THEY ARE SHAPED LIKE A SLICE?', 'cheerful')],
  ],
  'spawn-bear': [
    [mei('A BEAR. MEDIUM FIGHTER, TWO MISSILES. WHEN IT LOCKS, THE BACK SEAT DROPS A DECOY.')],
  ],
  'spawn-gorilla': [
    [mei('GORILLA. HEAVY, SLOW, A TAIL GUN. COME AT IT FROM THE SIDE, NOT FROM BEHIND.')],
  ],
  'spawn-hound': [
    [mei('A HOUND. TORPEDO BOMBER. IT GOES FOR THE SHIP, NOT FOR YOU. KILL IT FIRST.', 'excited')],
  ],
  swap: [
    [rex('SWAP! WATCH THE ELBOWS!'), nova('THAT WAS MY FACE.', 'angry')],
    [nova('CHANGING SEATS. DO NOT TOUCH ANYTHING.'), rex('I AM TOUCHING EVERYTHING.', 'sheepish')],
    [rex('YOUR SEAT IS WARM. NICE.'), nova('FLY.', 'eyeroll')],
    [nova('SCOOT.'), rex('SCOOTING.')],
  ],
  behind: [
    [nova('SIX O CLOCK. HE IS MINE.', 'smirk')],
    [nova('ONE ON OUR TAIL. I SEE HIM.')],
    [rex('UH, SOMEBODY IS BEHIND US. WITH A FACE.', 'worried')],
    [rex('BANDIT ON OUR SIX! I GOT HIM. PROBABLY.')],
  ],
  decoy: [
    [nova('DECOY OUT.')],
    [rex('DECOY! GO CHASE THAT, BUDDY!')],
  ],
  missileIn: [
    [nova('MISSILE. HOLD STILL. NO, DO NOT HOLD STILL.', 'angry')],
    [rex('MISSILE! MISSILE! TURN! OR BURN! OR BOTH!', 'worried')],
  ],
  locked: [
    [nova('LOCKED. SAY CHEESE.', 'smirk')],
    [rex('GOT HIS PICTURE! SEND IT!', 'cheerful')],
  ],
  kill: [
    [nova('GOOD.')],
    [nova('THAT IS ONE.', 'smirk')],
    [rex('NICE! THAT IS A SLICE!', 'cheerful')],
    [rex('HIS HEAD CAME OFF! ON A SPRING!', 'cheerful')],
  ],
  turretKill: [
    [nova('GOT ONE BACK HERE.', 'smirk')],
    [rex('I GOT ONE! I GOT ONE BACK HERE!', 'cheerful')],
  ],
  playerTurretKill: [
    [rex('NICE SHOOTING BACK THERE!', 'cheerful')],
    [nova('NOT BAD. FOR A PASSENGER.', 'smirk')],
  ],
  shieldsDown: [
    [nova('SHIELDS ARE GONE. STOP GETTING SHOT.', 'angry')],
    [rex('SHIELD IS DOWN! I CAN SMELL SPACE!', 'worried')],
  ],
  hurting: [
    [nova('WE ARE LEAKING. FLY LIKE YOU MEAN IT.', 'angry')],
    [rex('THINGS ARE FALLING OFF. IMPORTANT THINGS.', 'worried')],
  ],
  navClear: [
    [nova('CLEAR. AUTO IS LIT.')],
    [rex('ALL CLEAR! AUTO LIGHT IS ON. AUTO LIGHT IS MY FRIEND.')],
  ],
  autoTeach: [
    [mei('SKY IS CLEAR. HIT AUTO AND THE TAPE FLIES YOU TO THE NEXT NAV POINT.')],
  ],
  'order-attack': [
    [dougie('BREAKING! GOING HUNTING!', 'eager')],
  ],
  'order-form': [
    [dougie('COMING BACK! WAIT FOR ME!', 'eager')],
  ],
  'order-help': [
    [dougie('HANG ON, I AM COMING!', 'eager')],
  ],
  'order-taunt': [
    [nova('HEY, MASCOT. YOUR CRUST IS FROZEN.', 'smirk')],
    [rex('HEY! YOUR PIZZA COMES IN A BOX THAT TASTES BETTER!', 'cheerful')],
    [nova('NICE HAT. DID IT COME WITH THE MEAL?', 'smirk')],
  ],
  taunted: [
    [mascot('YOU TAKE THAT BACK! I AM COMING OVER THERE!', 'bear')],
    [mascot('THAT IS IT! NO MORE BIRTHDAY SONG FOR YOU!', 'rat')],
  ],
  'wingKill-dougie': [
    [dougie('I GOT ONE! MOM IS GONNA FREAK!', 'eager')],
    [dougie('DID YOU SEE THAT? TELL NONNA!', 'eager')],
  ],
  'wingHit-dougie': [
    [dougie('THEY ARE ON ME! THEY ARE ON ME!', 'scared')],
    [dougie('I AM HIT! IS THAT BAD? THAT SOUNDED BAD!', 'scared')],
  ],
  'wingKill-marge': [
    [marge('SCRATCH ONE. TEN-FOUR.')],
    [marge('THAT ONE WILL HAUNT THE PARKING BELT NOW, SWEETIE.', 'spooky')],
  ],
  'wingHit-marge': [
    [marge('THEY DENTED MY RIG. NOW I AM ANGRY.')],
  ],
  'wingKill-ridley': [
    [ridley('ONE DOWN. THE CAT SAW IT.')],
    [ridley('GOT HIM.', 'grim')],
  ],
  'wingHit-ridley': [
    [ridley('TAKING FIRE. NOTHING I HAVE NOT HAD BEFORE.', 'grim')],
  ],
  'wingKill-duo': [
    [duo('THAT ONE WAS MINE. PUT IT ON MY TAB.', 'grin')],
    [duo('SAW HIM FIRST. HIT HIM FIRST. CLASSIC DUO.', 'grin')],
  ],
  'wingHit-duo': [
    [duo('HEY! THIS PAINT IS ORIGINAL!', 'sweat')],
  ],
  convoyHit: [
    [mei('A HAULER IS TAKING FIRE! GET THEM OFF IT!', 'excited')],
    [mei('THE MOZZARELLA IS UNDER ATTACK. REPEAT, THE MOZZARELLA.', 'excited')],
  ],
  homeFight: [
    [mei('THEY ARE HERE! BOMBERS ON THE TUBES! EVERYBODY OUT!', 'excited'), nonna('NOBODY TOUCHES MY OVEN.', 'stern')],
  ],
  ambush: [
    [mei('THE AUTOPILOT DROPPED YOU SHORT! THAT IS NOT A NAV POINT, IT IS AN AMBUSH!', 'excited')],
  ],
  defect: [
    [duo('SORRY, KIDS. IT IS NOT PERSONAL. IT IS A FRANCHISE.', 'grin'), nova('HANS.', 'angry'), duo('THEY HAVE DENTAL.', 'sweat')],
  ],
  duoFlees: [
    [duo('OKAY! OKAY! I AM OUT! NO HARD FEELINGS! SOME HARD FEELINGS!', 'sweat')],
  ],
  hansBack: [
    [duo('YOU ARE ALL CLEAR, KIDS! NOW LET US DELIVER THIS THING AND GO HOME!', 'grin'), rex('HANS!', 'cheerful'), nova('LATE.', 'smirk')],
  ],
  'spawn-parmesan': [
    [parm('AH. THE HEART OF THE OVEN. I HAVE HEARD SO MUCH. NONE OF IT IMPRESSIVE.'), nova('NICE GRATER.', 'smirk')],
  ],
  dareLeave: [
    [parm('LEAVE US. THIS IS BETWEEN A PRINCE AND HIS DINNER.'), rex('WE ARE NOT DINNER. WE DELIVER DINNER.', 'worried')],
  ],
  parmesanFlees: [
    [parm('THIS IS NOT OVER! MY FATHER OWNS EIGHT THOUSAND OUTLETS!', 'angry'), nova('RUN, LION. RUN.', 'smirk')],
  ],
  aceFlees: [
    [mei('HE IS RUNNING. LET HIM GO.')],
  ],
  help: [
    [marge('BREAKER BREAKER, THIS IS THE TALL TALE, AND I BROUGHT EVERY RIG ON THE LONG HAUL!', 'spooky'), mei('THEY ARE RUNNING! THEY ARE ALL RUNNING!', 'excited')],
  ],
  targetDown: [
    [mei('IT IS GOING DOWN! IT IS GOING DOWN!', 'excited'), rex('DELIVERED!', 'cheerful')],
    [nova('TARGET DOWN. THAT IS A TIP.', 'smirk')],
  ],
  'spawn-outlet': [
    [mei('THERE IS THE OUTLET. GUNS FRONT AND BACK. TAKE OUT THE TURRETS, THEN TORPEDO THE HULL.')],
  ],
  'spawn-buffet': [
    [mei('THE BUFFET. SIX TURRETS AND A HANGAR FULL OF RATS. TURRETS FIRST. THREE TORPEDOES.', 'excited')],
  ],
  'spawn-hut': [
    [mei('THAT IS THE HUT. THE VENT IS ON TOP. ONE LOCK, ONE VOLCANO. DO NOT MISS.', 'excited'), parm('YOU WOULD NOT DARE.', 'angry'), nova('WE DELIVER.', 'smirk')],
  ],
  'launch-fighters': [
    [mei('IT IS LAUNCHING FIGHTERS! MORE RATS!', 'excited')],
  ],
  torpLock: [
    [mei('TORPEDO LOCK TAKES FIVE SECONDS. KEEP IT IN THE NOSE. DO NOT FLINCH.')],
  ],
  torpAway: [
    [rex('TORPEDO AWAY! GO, LITTLE GUY!', 'cheerful')],
    [nova('TORPEDO AWAY.')],
  ],
  scrape: [
    [rex('WE ARE SCRAPING THE HULL! I CAN HEAR IT IN MY TEETH!', 'worried')],
    [nova('THAT IS A WALL. DO NOT FLY INTO THE WALL.', 'angry')],
  ],
  enemyFlees: [
    [mei('ONE OF THEM IS RUNNING. LET HIM GO.')],
    [mascot('THIS IS NOT IN MY CONTRACT!', 'gorilla')],
  ],
  enemyGone: [
    [mei('HE IS GONE. HE WILL TELL THE OTHERS.')],
  ],
  jingle: [
    [mascot('HAPPY BIRTHDAY TO YOU, YOU LIVE IN A ZOO, YOUR PIZZA IS SOGGY...', 'bear')],
    [mascot('TRY OUR NEW CHEESY CRUST. IT IS CHEESE ALL THE WAY DOWN.', 'rat')],
    [mascot('PIZZA THE HUT. WE DELIVER. EVERYWHERE. FOREVER.', 'gorilla')],
  ],
  chatter: [
    [rex('NOVA. HYPOTHETICALLY. COULD WE ORDER FROM THEM? JUST TO SEE?'), nova('NO.', 'eyeroll')],
    [nova('THE STARS LOOK FAKE.'), rex('THEY LOOK DELICIOUS.', 'eating')],
    [rex('IF WE WIN THIS, NONNA SAID SHE MAKES THE BIG LASAGNA.', 'cheerful'), nova('SHE SAID THAT LAST WAR.')],
    [nova('YOUR MIXTAPE IS STUCK IN THE NAV DECK.'), rex('THAT IS NOT A BUG. THAT IS ROMANCE.', 'sheepish')],
  ],
}
