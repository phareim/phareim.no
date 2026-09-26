/** What Luna says when you turn to her while she follows you: a hint for where the quest stands. */
import type { TalkBranch } from '../types'

export const LUNA_TALK: TalkBranch[] = [
  {
    when: { notFlag: 'lab1.power' },
    lines: [
      'LUNA: THE LAB IS INSIDE THE FENCE, NORTH OF THE CAMP. A HEAVY BLOCK SITS IN FRONT OF THE DOOR. FACE IT AND PRESS {A}. I WILL MOVE IT.',
      'LUNA: MY BLOCKS SLIDE UNTIL SOMETHING STOPS THEM. THINK FIRST.',
      'LUNA: INSIDE, THE POWER IS OFF. THE BREAKER IS DOWNSTAIRS.',
    ],
  },
  { when: { notFlag: 'item:hook' }, lines: ['LUNA: THE LLAMA HAS THE HOOK. IT SPITS.'] },
  {
    when: { notFlag: 'bigkey:lab1' },
    lines: ['LUNA: THE HOLE IN THE HALL GOES DOWN. THERE IS A KEY DOWN THERE.', 'LUNA: THE BIG KEY IS IN THE COOLING VAULT, PAST THE BEDROOMS.'],
  },
  { when: { notFlag: 'mistral' }, lines: ['LUNA: MISTRAL IS UP THERE. I DO NOT LIKE THE COLD.'] },
  {
    when: { notFlag: 'item:arc' },
    lines: [
      'LUNA: THE DEEP LAB IS PAST THE RAVINE, IN THE BUNKER.',
      'LUNA: MY OLD ROOM IS DOWN THERE. ROOM ELEVEN. I DO NOT WANT TO GO IN ALONE.',
    ],
  },
  {
    when: { notFlag: 'gemini' },
    lines: [
      'LUNA: THE STAIRS DOWN ARE UNDER THE VINES.',
      'LUNA: THE BIG KEY IS ON THE FLOOR BELOW.',
      'LUNA: GEMINI GUARDS THE GATE. THEY FINISH EACH OTHER\'S SENTENCES.',
    ],
  },
  { when: { notFlag: 'boss' }, lines: ['LUNA: THE GATE IS SHUT. THE VINES IN THE GRAVES WILL BE DEAD.', 'LUNA: GO GET YOUR SUN. I AM COMING TOO.'] },
  { lines: ['LUNA: FRIENDS DON\'T LIE. YOU DID IT.', 'LUNA: … CAN WE GET WAFFLES NOW?'] },
]
