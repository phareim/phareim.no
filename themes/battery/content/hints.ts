/**
 * TALK TO a friend's portrait: the two chat about the first unsolved step
 * of the dependency chart (DESIGN.md) that concerns either of them; if none
 * of the open steps is theirs, the first open step anyone can take. The
 * first talk about a step nudges; the second is direct (`hint.<step>`
 * counts the talks).
 *
 * LOOK AT a friend's portrait: a one-liner per pair.
 */
import type { Ctx, HandlerResult, HeroId, ItemId, Script } from '../types'
import { F } from './flags'

type Lines = Partial<Record<HeroId, readonly [vague: string, direct: string]>>

export interface Step {
  id: string
  /** Who has to act. */
  who: (c: Ctx) => HeroId[]
  /** Its prerequisites are met. */
  avail: (c: Ctx) => boolean
  done: (c: Ctx) => boolean
  /** What each hero says about it: a nudge, then the plain answer. */
  lines: (c: Ctx) => Lines
}

const has = (c: Ctx, item: ItemId, h: HeroId) => c.has(item, h)
const holder = (c: Ctx, item: ItemId) => c.who(item)
const both = (...h: HeroId[]) => () => h

/** Send-steps: if the item has wandered to the wrong friend, say so plainly. */
function misrouted(c: Ctx, item: string, to: string): Lines {
  const l = [`The ${item} is with the wrong one of us. It needs to get to ${to}.`, `Whoever has the ${item}: give it to ${to}'s portrait. Down or up the dumbwaiter it goes.`] as const
  return { kjell: l, dag: l, espen: l }
}

export const STEPS: Step[] = [
  {
    id: 'matches',
    who: both('kjell'),
    avail: () => true,
    done: c => c.is(F.matchesTaken) || c.is(F.furnaceLit),
    lines: () => ({
      kjell: ['Fire. Dag needs a fire down there. A kitchen always has something to light one with.', 'The kitchen drawer. Matches live in kitchen drawers. It\'s practically the law.'],
      dag: ['It\'s freezing down here. Is there anything up there to start a fire with?', 'Try the kitchen drawer, Kjell. Mine are next to the cheese slicer.'],
      espen: ['Every haunted house has a kitchen full of useful things. Check the kitchen, Kjell.', 'Open the kitchen drawer, Kjell. There\'ll be matches. There are always matches.'],
    }),
  },
  {
    id: 'send-fire',
    who: both('kjell', 'dag'),
    avail: c => c.is(F.matchesTaken),
    done: c => c.is(F.furnaceLit) || (has(c, 'matches', 'dag') && (has(c, 'manual', 'dag') || c.is(F.furnaceKindling))),
    lines: c => {
      const m = holder(c, 'matches')
      if (m && m !== 'kjell' && m !== 'dag') return misrouted(c, 'matches', 'Dag')
      return {
        kjell: ['Dag has a furnace and no fire. I have one match and a very dry book.', 'Send Dag the matches and the manual. Give them to his portrait. Goodbye, chapter nine.'],
        dag: ['There\'s a big cold furnace down here. If only I had a light. And something dry.', 'Send me the matches, Kjell. And your manual. It\'s the driest thing I\'ve ever read.'],
        espen: ['Fire goes down, heat comes up. That\'s physics. Or ghosts.', 'Kjell should send Dag the matches and that manual. Nobody\'s reading it. Except Kjell.'],
      }
    },
  },
  {
    id: 'kindling',
    who: both('dag'),
    avail: c => has(c, 'manual', 'dag'),
    done: c => c.is(F.furnaceKindling) || c.is(F.furnaceLit),
    lines: () => ({
      dag: ['The coal\'s damp. One match won\'t do it on its own. It wants something dry underneath.', 'Use the manual on the furnace. Kindling. Kjell will cry, but he\'ll be warm.'],
      kjell: ['One match and damp coal. You\'d want something dry to get it going. Something papery. Oh no.', 'Put the manual in the furnace, Dag. I can\'t believe I\'m saying it. Put it in.'],
      espen: ['Fires need kindling. I learnt that at scouts. Then they asked me to leave scouts.', 'Dag, stuff the manual in the furnace first. Then the match.'],
    }),
  },
  {
    id: 'furnace',
    who: both('dag'),
    avail: c => c.is(F.furnaceKindling) && has(c, 'matches', 'dag'),
    done: c => c.is(F.furnaceLit),
    lines: () => ({
      dag: ['The kindling\'s in. Now the one match. No pressure, Dag.', 'Use the matches on the furnace. Carefully. It\'s the only one.'],
      kjell: ['Is the furnace going yet? Everything up here feels damp. Including me.', 'Strike the match on the furnace, Dag. The kindling\'s in.'],
      espen: ['The house is cold. Ghosts would be happier warm. Everyone would.', 'Light the furnace, Dag! Use the matches on it!'],
    }),
  },
  {
    id: 'bones',
    who: both('dag'),
    avail: c => c.is(F.furnaceLit),
    done: c => c.is(F.bonesKey) || c.is(F.labOpen),
    lines: () => ({
      dag: ['Mr Bones has warmed up. He\'s stopped rattling. He might be in a helping mood.', 'Talk to Mr Bones again, now he\'s warm. Butlers carry keys.'],
      kjell: ['There\'s a butler down there? A skeleton butler? Butlers have keys to everything.', 'Talk to the butler, Dag. He\'s warm now. He\'ll be grateful.'],
      espen: ['A skeleton butler! Ask him things! Ask him EVERYTHING!', 'Dag, talk to Mr Bones now he\'s thawed. He\'ll have keys. Skeletons love keys.'],
    }),
  },
  {
    id: 'labdoor',
    who: both('dag'),
    avail: c => c.is(F.bonesKey) || has(c, 'labkey', 'dag'),
    done: c => c.is(F.labOpen),
    lines: () => ({
      dag: ['I\'ve got a big iron key. There\'s a big iron door. I\'m no genius, but.', 'Use the iron key on the lab door.'],
      kjell: ['Iron key. Iron door. I feel there\'s something there, Dag.', 'Use the key on the locked iron door, Dag. The lab.'],
      espen: ['A lab. A LOCKED lab. With lightning in it. Dag, please.', 'Dag, the iron key goes in the lab door!'],
    }),
  },
  {
    id: 'jam',
    who: both('dag'),
    avail: c => c.is(F.furnaceLit),
    done: c => c.is(F.jamOpen),
    lines: c => {
      const h = holder(c, 'jam')
      if (h && h !== 'dag') return misrouted(c, 'jar of jam', 'Dag, by the warm furnace')
      if (!h) {
        return {
          dag: ['All this jam and not one open jar. I\'d start by picking one up.', 'Pick up a jar of jam, then warm the lid on the furnace. Heat loosens lids.'],
          kjell: ['Dag, you\'re surrounded by jam and you haven\'t got any. That isn\'t like you.', 'Take a jar of jam, Dag, and warm the lid on the furnace.'],
          espen: ['A pantry full of jam, Dag. Grab a jar. For science.', 'Pick up the jam and use it on the furnace, Dag!'],
        }
      }
      return {
        dag: ['This lid won\'t budge. My gran always warmed a stuck lid.', 'Use the jam on the furnace. Hot lid, loose lid.'],
        kjell: ['Stuck lids loosen when they\'re warm. My mother ran them under the hot tap. You have a furnace.', 'Warm the jam lid on the furnace, Dag.'],
        espen: ['Dag, you have a hot furnace and a stuck jar. Put those two ideas together.', 'Use the jam on the lit furnace, Dag!'],
      }
    },
  },
  {
    id: 'trunk',
    who: both('espen'),
    avail: () => true,
    done: c => c.is(F.trunkMoved),
    lines: () => ({
      espen: ['There\'s a door up here behind an enormous trunk. It will not be pushed. I pushed.', 'The trunk\'s on castors. Don\'t push it. Pull it.'],
      kjell: ['Espen, when something won\'t push, have you tried the exact opposite?', 'Pull the trunk, Espen. Pull, don\'t push.'],
      dag: ['Heavy things are easier to pull. That\'s how I get the sofa to the fridge.', 'Pull the trunk, Espen.'],
    }),
  },
  {
    id: 'monocle',
    who: both('espen'),
    avail: c => c.is(F.trunkMoved),
    done: c => c.is(F.monocleTaken),
    lines: () => ({
      espen: ['The Professor\'s study! Her desk has drawers. Drawers have secrets.', 'Open the desk drawer in the study.'],
      kjell: ['A study? Look in the desk, Espen. People keep their whole lives in desks.', 'Open the desk drawer, Espen.'],
      dag: ['Desks have drawers. Drawers have biscuits. Sometimes.', 'Open the desk drawer, Espen. Tell me if there are biscuits.'],
    }),
  },
  {
    id: 'diary',
    who: both('espen'),
    avail: c => c.is(F.trunkMoved),
    done: c => c.is(F.diaryRead),
    lines: () => ({
      espen: ['There\'s a diary on the desk. Reading someone\'s diary is rude. It\'s also research.', 'Look at the Professor\'s diary. For the episode.'],
      kjell: ['Did the Professor leave notes? Inventors always leave notes.', 'Read the diary on the desk, Espen.'],
      dag: ['If there\'s a diary, read it. People put the good stuff in diaries.', 'Look at the diary, Espen.'],
    }),
  },
  {
    id: 'monocle-send',
    who: both('espen', 'kjell'),
    avail: c => c.is(F.monocleTaken),
    done: c => c.is(F.catMonocle) || has(c, 'monocle', 'kjell'),
    lines: c => {
      if (has(c, 'monocle', 'dag')) return misrouted(c, 'monocle', 'Kjell')
      return {
        espen: ['I have a monocle. The portrait downstairs has a monocle. Kjell has the portrait. Hmm.', 'I should send the monocle down to Kjell. Give it to his portrait.'],
        kjell: ['Espen, that monocle. The Professor wears one in the portrait down here.', 'Give the monocle to my portrait, Espen. Send it down.'],
        dag: ['Kjell has the portrait. Espen has the monocle. I have jam. Everybody\'s got something.', 'Espen, send Kjell that monocle.'],
      }
    },
  },
  {
    id: 'cat-monocle',
    who: both('kjell'),
    avail: c => has(c, 'monocle', 'kjell'),
    done: c => c.is(F.catMonocle),
    lines: () => ({
      kjell: ['A monocle. The cat on the fridge has a ring round one eye, exactly that shape…', 'Give the monocle to Mrs Whiskers. I can\'t believe that\'s a sentence.'],
      dag: ['That cat with the ring round her eye. I bet she\'d look good in a monocle.', 'Give the cat the monocle, Kjell.'],
      espen: ['Kjell. The cat\'s eye. The portrait\'s monocle. It\'s all CONNECTED.', 'Give the monocle to the cat, Kjell! Do it!'],
    }),
  },
  {
    id: 'cat-pickup',
    who: both('kjell'),
    avail: c => c.is(F.catMonocle),
    done: c => c.who('cat') !== null || c.is(F.catInBooth),
    lines: () => ({
      kjell: ['She came down off the fridge. She\'s looking at me like I\'m late for something.', 'Pick up the cat. Carefully. I think she\'ll allow it.'],
      dag: ['If the cat\'s friendly now, maybe she\'d like a lift somewhere.', 'Pick up the cat, Kjell.'],
      espen: ['She wants to go somewhere, Kjell. Cats always want to go somewhere.', 'Pick her up, Kjell!'],
    }),
  },
  {
    id: 'cat-send',
    who: c => [holder(c, 'cat') ?? 'kjell', 'dag'],
    avail: c => { const h = holder(c, 'cat'); return h !== null && h !== 'dag' },
    done: c => has(c, 'cat', 'dag') || c.is(F.catInBooth),
    lines: c => {
      if (has(c, 'cat', 'espen')) return misrouted(c, 'cat', 'Dag in the lab')
      return {
        kjell: ['The diary says "same subject, same booth". The booth is in the cellar. The cat is in my arms.', 'Send Mrs Whiskers down to Dag. Give her to his portrait. She\'ll hate it.'],
        dag: ['There\'s a booth down here with a cat-sized seat. Just saying.', 'Send me the cat, Kjell. There\'s a booth her size.'],
        espen: ['The cat and the booth have to be in the same place. That\'s my professional opinion.', 'Kjell, send the cat down to Dag!'],
      }
    },
  },
  {
    id: 'booth',
    who: both('dag'),
    avail: c => has(c, 'cat', 'dag') && c.is(F.labOpen),
    done: c => c.is(F.catInBooth),
    lines: () => ({
      dag: ['There\'s a glass booth in the lab, with a little seat. And I\'m holding a cat.', 'Open the booth, then use the cat on it.'],
      kjell: ['The booth in the lab, Dag. Same subject, same booth, the blackboard says.', 'Open the booth and put Mrs Whiskers in it, Dag.'],
      espen: ['Same subject, same booth! You know what that means!', 'Dag! Open the booth and put the cat in!'],
    }),
  },
  {
    id: 'jam-send',
    who: c => [holder(c, 'jam') ?? 'dag', 'espen'],
    avail: c => c.is(F.jamOpen) && holder(c, 'jam') !== null,
    done: c => has(c, 'jam', 'espen') || c.is(F.batFed),
    lines: c => {
      if (has(c, 'jam', 'kjell')) return misrouted(c, 'open jam', 'Espen')
      return {
        dag: ['Now the jar\'s open, who else would like jam? Somebody with a sweet tooth. Or fangs.', 'I\'ll send the open jam up to Espen. For his bat.'],
        espen: ['The Count wants blood. Something red. Something like Dag\'s jam?', 'Dag, send the open jam up to me! Give it to my portrait!'],
        kjell: ['Espen\'s bat wants something red. Dag has something red.', 'Dag, send Espen the jam.'],
      }
    },
  },
  {
    id: 'bat',
    who: both('espen'),
    avail: c => has(c, 'jam', 'espen') && c.is(F.trunkMoved),
    done: c => c.is(F.batFed),
    lines: () => ({
      espen: ['The Count wants blood. I have jam. Jam is basically fruit blood.', 'Give the jam to Count Flapula.'],
      kjell: ['Offer the bat the jam, Espen. It\'s red. How fussy can a bat be?', 'Give the jam to the bat, Espen.'],
      dag: ['Nobody says no to lingonberry jam. Not even a vampire.', 'Give the bat the jam, Espen.'],
    }),
  },
  {
    id: 'window',
    who: both('espen'),
    avail: c => c.is(F.batFed),
    done: c => c.is(F.windowOpen),
    lines: () => ({
      espen: ['The Count is off the window latch! The roof is right out there.', 'Open the dormer window and walk out onto the roof.'],
      kjell: ['The window\'s free, Espen. And the lightning rod is on the roof.', 'Open the window, Espen. Out onto the roof. Carefully.'],
      dag: ['If the window\'s free, there\'s a roof. Roofs have lightning rods.', 'Open the window, Espen.'],
    }),
  },
  {
    id: 'oil-get',
    who: both('kjell'),
    avail: () => true,
    done: c => c.is(F.oilTaken) || c.is(F.socketOiled),
    lines: () => ({
      kjell: ['Something up there is rusted solid. The kitchen cupboard has all sorts of things. Oily things.', 'Open the kitchen cupboard and take the cooking oil.'],
      espen: ['There\'s something rusted solid up here. Kjell, you have a kitchen. Kitchens have oil.', 'Kjell, get the oil from the kitchen cupboard.'],
      dag: ['Rusty things want oil. A kitchen will have some.', 'Get the oil from the kitchen cupboard, Kjell.'],
    }),
  },
  {
    id: 'oil-send',
    who: c => [holder(c, 'oil') ?? 'kjell', 'espen'],
    avail: c => { const h = holder(c, 'oil'); return h !== null && h !== 'espen' },
    done: c => has(c, 'oil', 'espen') || c.is(F.socketOiled),
    lines: c => {
      if (has(c, 'oil', 'dag')) return misrouted(c, 'oil', 'Espen')
      return {
        kjell: ['I have oil. Espen has rust. It\'s like a dating show.', 'Send the oil up to Espen. Give it to his portrait.'],
        espen: ['Kjell has oil. I have a rusty socket. Kjell. KJELL.', 'Send me the oil, Kjell!'],
        dag: ['Espen needs oil, and Kjell\'s holding the bottle.', 'Kjell, send Espen the oil.'],
      }
    },
  },
  {
    id: 'socket',
    who: both('espen'),
    avail: c => has(c, 'oil', 'espen') && c.is(F.windowOpen),
    done: c => c.is(F.socketOiled),
    lines: () => ({
      espen: ['The rod is rusted into its socket. And I happen to have oil. Hmm.', 'Use the oil on the rusty socket.'],
      kjell: ['Rust plus oil equals no rust, Espen. That\'s all I know about engineering.', 'Use the oil on the rod\'s socket, Espen.'],
      dag: ['Oil on the rusty bit. That\'s the whole trick.', 'Use the oil on the socket, Espen.'],
    }),
  },
  {
    id: 'rod',
    who: both('espen'),
    avail: c => c.is(F.socketOiled),
    done: c => c.is(F.rodUp),
    lines: () => ({
      espen: ['It\'s oiled. Now I just have to be strong. Or clever. Or pull.', 'Pull the rod upright. Standing up, it catches the lightning.'],
      kjell: ['A lightning rod lying down catches nothing. It has to stand up.', 'Pull the rod upright, Espen.'],
      dag: ['Rods work better standing up. Like me after dinner.', 'Pull the rod up, Espen.'],
    }),
  },
  {
    id: 'letters',
    who: both('espen'),
    avail: () => true,
    done: c => c.is(F.lettersRead),
    lines: () => ({
      espen: ['There\'s a trunk of old letters in the storeroom. Old letters are ghost gold.', 'Open the letter trunk, take the letters and read them.'],
      kjell: ['Aunt Hedvig is waiting for news from someone. Old letters, maybe?', 'Read those letters in the storeroom trunk, Espen.'],
      dag: ['Old letters. Might say something nice about someone. Might say something about beards.', 'Read the letters in the trunk, Espen.'],
    }),
  },
  {
    id: 'seance',
    who: both('espen', 'kjell'),
    avail: c => c.is(F.windowOpen) && c.is(F.lettersRead),
    done: c => c.is(F.seanceDone),
    lines: () => ({
      espen: ['Aunt Hedvig wants to reach the spirits of the living. I\'m living! And her chimney comes out on my roof.', 'Talk into the chimney on the roof. When she asks what Torvald called his beard: Sigurd.'],
      kjell: ['Hedvig wants a message from the living. Espen\'s on the roof, right by her chimney.', 'Espen, talk down the chimney to Hedvig. Tell her about Sigurd.'],
      dag: ['Chimneys carry sound. My uncle heard our whole Christmas down one.', 'Espen, talk down the chimney to Hedvig. Mention the beard.'],
    }),
  },
  {
    id: 'poker',
    who: both('kjell'),
    avail: c => c.is(F.seanceDone),
    done: c => c.is(F.pokerTaken),
    lines: () => ({
      kjell: ['Hedvig is thrilled with the living. She said we could have her poker.', 'Pick up the poker in the parlour.'],
      espen: ['The spirits of the living have spoken. Kjell, go and collect the poker.', 'Take the poker from the parlour, Kjell.'],
      dag: ['An iron poker. Good for poking. Good for conducting, probably.', 'Pick up the poker, Kjell.'],
    }),
  },
  {
    id: 'sandwich-send',
    who: c => [holder(c, 'sandwich') ?? 'dag', 'kjell'],
    avail: c => c.is(F.dagAte) && holder(c, 'sandwich') !== null && holder(c, 'sandwich') !== 'kjell' && !c.is(F.gustavFed),
    done: c => has(c, 'sandwich', 'kjell') || c.is(F.gustavFed),
    lines: c => {
      if (has(c, 'sandwich', 'espen')) return misrouted(c, 'sandwich', 'Kjell, for Gustav')
      return {
        dag: ['I\'ve had jam. I\'m feeling generous. Someone could have my sandwich.', 'I\'ll send the sandwich up to Kjell. For the plant.'],
        kjell: ['Gustav wants rabbit. I\'d rather he had something else. Dag has a sandwich.', 'Dag, send me your sandwich. For Gustav. I\'ll explain later. I won\'t.'],
        espen: ['A big hungry plant, and Dag has the only sandwich in Norway.', 'Dag, send your sandwich to Kjell!'],
      }
    },
  },
  {
    id: 'gustav',
    who: both('kjell'),
    avail: c => has(c, 'sandwich', 'kjell'),
    done: c => c.is(F.gustavFed),
    lines: () => ({
      kjell: ['Gustav wants a rabbit. I\'d rather he had a sandwich.', 'Give the sandwich to Gustav.'],
      dag: ['Feed the plant, Kjell. Fed things sleep. Look at me.', 'Give Gustav the sandwich.'],
      espen: ['Feed Gustav, Kjell. Before he feeds on you.', 'Give the sandwich to Gustav!'],
    }),
  },
  {
    id: 'clockkey',
    who: both('kjell'),
    avail: c => c.is(F.gustavFed),
    done: c => c.is(F.clockKeyTaken),
    lines: () => ({
      kjell: ['Gustav burped something up. Something brass. Something slimy.', 'Pick up the clock key by Gustav\'s pot.'],
      dag: ['Whatever Gustav coughed up, pick it up. Burps are clues.', 'Pick up the key Gustav burped, Kjell.'],
      espen: ['He burped up a KEY? Grab it! Wipe it first!', 'Pick up the clock key, Kjell!'],
    }),
  },
  {
    id: 'gloves',
    who: both('kjell'),
    avail: c => c.is(F.furnaceLit),
    done: c => c.is(F.glovesTaken),
    lines: () => ({
      kjell: ['The house is warm now. The freezer must be thawing. There was something frozen in it.', 'Open the freezer and take the rubber gloves.'],
      dag: ['The heating\'s on. Anything frozen up there will be thawing.', 'Open the freezer, Kjell. Get the gloves.'],
      espen: ['You\'ll want gloves for electrical stuff, Kjell. Trust me. I have an EMF meter.', 'Get the rubber gloves out of the freezer, Kjell.'],
    }),
  },
  {
    id: 'junction',
    who: both('kjell'),
    avail: c => c.is(F.pokerTaken) && c.is(F.glovesTaken) && c.is(F.gustavFed),
    done: c => c.is(F.junctionBridged),
    lines: c => c.is(F.junctionOpen)
      ? {
        kjell: ['The cable is cut inside the junction box. Something long and iron would bridge it. With gloves on.', 'Use the poker on the junction box. Gloves on, fingers crossed.'],
        dag: ['A cut cable. You join it with something metal. And you wear the gloves.', 'Use the poker on the junction box, Kjell.'],
        espen: ['The lightning needs a path. The cable has a gap. Kjell has a poker. It\'s poetry.', 'Kjell, bridge the junction box with the poker!'],
      }
      : {
        kjell: ['The lightning cable comes down into the conservatory, into a box on the wall.', 'Open the junction box in the conservatory. Then the poker. Gloves on.'],
        dag: ['That cable from the roof goes through a box somewhere. Look inside the box.', 'Open the junction box, Kjell.'],
        espen: ['Follow the cable, Kjell! It goes into a box! Open the box!', 'Open the junction box in the conservatory, Kjell!'],
      },
  },
  {
    id: 'lever',
    who: both('dag'),
    avail: c => c.is(F.labOpen),
    done: c => c.is(F.leverArmed),
    lines: () => ({
      dag: ['There\'s a big lever in the lab. It says ARM. I haven\'t touched it. Yet.', 'Pull the big lever.'],
      kjell: ['Machines like that have to be switched on. Is there a lever, Dag?', 'Pull the lever in the lab, Dag.'],
      espen: ['Every mad scientist\'s lab has a big lever. It wants pulling.', 'Dag, pull the lever!'],
    }),
  },
  {
    id: 'midnight',
    who: both('kjell'),
    avail: c => c.is(F.clockKeyTaken),
    done: c => c.is(F.won) || c.is(F.struck),
    lines: () => ({
      kjell: ['Rod up, cable joined, machine armed, cat in the booth. Now it only has to be midnight.', 'Use the clock key on the grandfather clock. Wind it to midnight.'],
      dag: ['Everything\'s ready down here. It\'s nearly midnight. It\'s been nearly midnight for ages.', 'Wind the clock, Kjell. With the clock key.'],
      espen: ['Midnight, Kjell. The storm peaks at the stroke of midnight. I heard it on the radio.', 'Use the key on the clock, Kjell!'],
    }),
  },
]

/** The step a pair would talk about, or null once there's nothing left. */
export function nextStep(c: Ctx, a: HeroId, b: HeroId): Step | null {
  const open = STEPS.filter(s => !s.done(c) && s.avail(c))
  return open.find(s => s.who(c).some(h => h === a || h === b)) ?? open[0] ?? null
}

const OPENERS: Record<HeroId, Record<HeroId, readonly string[]>> = {
  kjell: {
    kjell: [],
    dag: ['Dag? Are you still down there?', 'Dag. Any ideas? Food-related ones don\'t count.', 'Dag, can you hear me? I need a sensible person.'],
    espen: ['Espen? Ideas? Sensible ones?', 'Espen. Talk to me. Not about ghosts.', 'Espen, are you up there? Please say yes.'],
  },
  dag: {
    kjell: ['Kjell? You up there?', 'Kjell. What would the manual do?', 'Kjell, I\'m thinking. It\'s going slowly.'],
    dag: [],
    espen: ['Espen? What would the podcast do?', 'Espen. Any ideas? Real ones?', 'Espen, you there? It\'s me. Dag. From the cellar.'],
  },
  espen: {
    kjell: ['Kjell! Kjell. I\'m stuck. What would you do?', 'Kjell? It\'s me. From above. Like a ghost.', 'Kjell, quick question. What do we do?'],
    dag: ['Dag! Dag. Talk to me. I\'m in the attic and I have questions.', 'Dag? Are you eating? Stop eating and help.', 'Dag, what\'s the plan? You always have a plan. It\'s usually lunch.'],
    espen: [],
  },
}

const AFTER_WIN: readonly (readonly [HeroId | 'to', string])[] = [
  ['to', 'We did it. Brunhilde\'s running.'],
  ['to', 'Next Friday: an actual costume party. I\'ve checked.'],
]

export function hint(c: Ctx, to: HeroId): HandlerResult {
  return (function* (): Script {
    const me = c.hero
    yield c.say(c.pick(OPENERS[me][to]))
    if (c.is(F.won)) {
      for (const [who, line] of AFTER_WIN) yield who === 'to' ? c.sayAs(to, line) : c.say(line)
      return
    }
    const step = nextStep(c, me, to)
    if (!step) {
      yield c.sayAs(to, 'I think we\'ve done everything. Now we wait for midnight. It\'s always nearly midnight here.')
      return
    }
    const n = c.bump('hint.' + step.id)
    const level = n >= 2 ? 1 : 0
    const lines = step.lines(c)
    const theirs = lines[to]
    const mine = lines[me]
    if (theirs) yield c.sayAs(to, theirs[level])
    if (mine && (level === 0 || !theirs)) yield c.say(mine[level])
    else if (level === 1) yield c.say(c.by({ kjell: 'Right. Noted. Thank you.', dag: 'Right. Makes sense.', espen: 'Obviously. I knew that. I was testing you.' }))
  })()
}

// ---------------------------------------------------------------------------
// LOOK AT a friend's portrait
// ---------------------------------------------------------------------------

export function lookHero(c: Ctx, at: HeroId): HandlerResult {
  const me = c.hero
  if (at === me) return c.pick(['That\'s me. Still a rabbit.', 'Me. On a good day.'])
  if (c.is(F.won)) return c.pick(['My friend. We got out. We got the battery.', 'Best night ever. Don\'t tell him I said that.'])
  const flop = c.is(F.earsFlop)
  const key = `${me}>${at}`
  const lines: Record<string, readonly string[]> = {
    'kjell>dag': ['Dag. Somewhere under my feet, eating something.', 'Dag. He\'d survive a shipwreck, as long as it had a pantry.', 'Dag. The calmest man in any cellar in Norway.'],
    'kjell>espen': flop
      ? ['Espen. His ears have given up. Like the rest of us.', 'Espen. Somewhere above me, being thrilled with floppy ears.']
      : ['Espen. Somewhere above me, being thrilled.', 'Espen. His ears are held up with coat hangers. Mine are held up with worry.', 'Espen. If he says "episode twelve" once more, I\'ll send him a strongly worded note.'],
    'dag>kjell': ['Kjell. Upstairs, worrying about his car.', 'Kjell. The only man I know who irons a rabbit suit.', 'Kjell. He\'s probably reading the manual to himself for comfort.'],
    'dag>espen': ['Espen. Way up there, talking to ghosts.', 'Espen. Eleven listeners, and his mum is three of them.', 'Espen. Small, loud and happy. Like a kettle.'],
    'espen>kjell': ['Kjell. Downstairs. He\'ll be fine. Probably.', 'Kjell. If he\'s quiet, he\'s reading the manual.', 'Kjell. My co-host. He doesn\'t know he\'s my co-host.'],
    'espen>dag': ['Dag. In the cellar. Probably happy.', 'Dag. If there\'s food in this house, he\'s sitting on it.', 'Dag. The strongest man on the podcast.'],
  }
  return c.pick(lines[key] ?? ['A friend.'])
}
