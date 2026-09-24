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
  { when: { notFlag: 'item:hook' }, lines: ['LUNA: THE LLAMA HAS THE HOOK. IT SPITS.', 'LUNA: SPIT BACK. HIT THE SPIT WITH YOUR BLADE.'] },
  {
    when: { notFlag: 'bigkey:lab1' },
    lines: ['LUNA: THE HOLE IN THE HALL GOES DOWN. THERE IS A KEY DOWN THERE.', 'LUNA: THE BIG KEY IS IN THE COOLING VAULT, PAST THE BEDROOMS. THE HOOK BITES POSTS AND PILLARS.'],
  },
  { when: { notFlag: 'mistral' }, lines: ['LUNA: MISTRAL IS THE WIND. YOU CANNOT HIT WIND.', 'LUNA: WHEN IT BREATHES IN, HOOK IT. PULL IT DOWN. THEN HIT IT.'] },
  {
    when: { notFlag: 'item:arc' },
    lines: [
      'LUNA: THE DEEP LAB IS PAST THE RAVINE, IN THE BUNKER. SWING OVER, POST TO POST.',
      'LUNA: MY OLD ROOM IS DOWN THERE. ROOM ELEVEN. THE LIGHTS KNOW THE WORD THAT OPENS THE VAULT.',
    ],
  },
  {
    when: { notFlag: 'gemini' },
    lines: [
      'LUNA: THE STAIRS DOWN ARE UNDER THE VINES. CUT THEM.',
      'LUNA: THE CHUTE DROPS THINGS TO THE FLOOR BELOW. THE BIG KEY IS DOWN THERE.',
      'LUNA: GEMINI GUARDS THE GATE. TWO OF THEM. HIT ONE DOWN, THEN THE OTHER, FAST.',
    ],
  },
  { when: { notFlag: 'boss' }, lines: ['LUNA: THE GATE IS SHUT. THE VINES IN THE GRAVES WILL BE DEAD.', 'LUNA: GO GET YOUR SUN. I AM COMING TOO.'] },
  { lines: ['LUNA: FRIENDS DON\'T LIE. YOU DID IT.', 'LUNA: … CAN WE GET WAFFLES NOW?'] },
]
