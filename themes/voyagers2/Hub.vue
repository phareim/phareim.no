<template>
  <div class="vg2-hub">
    <nav class="vg2-tabs" aria-label="Rooms of the Deep Dish">
      <button
        v-for="(r, id) in ROOMS"
        :key="id"
        type="button"
        class="vg2-tab"
        :class="{ 'vg2-tab--on': room === id }"
        @click="go(id)"
      >{{ r.name.replace('THE ', '') }}</button>
    </nav>

    <div class="vg2-room" :class="`vg2-room--${room}`">
      <div class="vg2-room__pic" :style="{ backgroundImage: `url(/voyagers2/room-${room}.png)` }" aria-hidden="true">
        <!-- The chalkboard in the kitchen: the sortie's route, drawn in chalk. -->
        <div v-if="room === 'kitchen' && spots.board" class="vg2-board" :style="box(spots.board)">
          <span class="vg2-board__title">{{ brief.title }}</span>
          <span v-for="(nav, i) in navNames" :key="i" class="vg2-board__nav">{{ i + 1 }}. {{ nav }}</span>
        </div>
        <!-- The killboard in the break room. -->
        <div v-if="room === 'breakroom' && spots.board" class="vg2-board" :style="box(spots.board)">
          <span class="vg2-board__title">{{ pilotName }}</span>
          <span class="vg2-board__nav">KILLS {{ save.kills }}</span>
          <span class="vg2-board__nav">{{ save.score }}</span>
        </div>
        <button
          v-for="p in here"
          v-show="spots[p]"
          :key="'spot-' + p"
          type="button"
          class="vg2-spot"
          :style="spots[p] ? box(spots[p]) : undefined"
          :aria-label="'Talk to ' + nameOf(p)"
          @click="talkTo(p)"
        />
        <button v-if="room === 'hangar' && spots.calzone" type="button" class="vg2-spot" :style="box(spots.calzone)" aria-label="Launch" @click="$emit('launch')" />
        <button v-if="room === 'breakroom' && spots.tv" type="button" class="vg2-spot" :style="box(spots.tv)" aria-label="The television" @click="tv" />
      </div>

      <!-- Who is here: the faces, always tappable (the picture's people are too, when it has loaded). -->
      <div class="vg2-people">
        <button v-for="p in here" :key="p" type="button" class="vg2-person" :class="{ 'vg2-person--new': isNew(p) }" @click="talkTo(p)">
          <span class="vg2-face vg2-face--small" :style="{ backgroundImage: `url(${face(p)})` }" aria-hidden="true" />
          <span class="vg2-person__name">{{ nameOf(p).split(' ').slice(-1)[0] }}</span>
        </button>
        <button v-if="room === 'breakroom'" type="button" class="vg2-person" @click="tv">
          <span class="vg2-face vg2-face--small" :style="{ backgroundImage: 'url(/galaga/portrait-babs-wink.png)' }" aria-hidden="true" />
          <span class="vg2-person__name">TV</span>
        </button>
      </div>
    </div>

    <!-- The talk: a face, a line, tap for the next; a choice at the end of some. -->
    <div class="vg2-talk" @click="next">
      <template v-if="say">
        <span class="vg2-face" :style="{ backgroundImage: `url(${face(sayWho!, say.mood)})` }" aria-hidden="true" />
        <div class="vg2-talk__words">
          <p class="vg2-talk__name">{{ nameOf(sayWho!) }}</p>
          <p class="vg2-talk__text">{{ say.text }}</p>
          <div v-if="choice && line === lines.length - 1" class="vg2-choices">
            <button v-for="(c, i) in choice" :key="i" type="button" class="vg2-btn" @click.stop="choose(i)">{{ c.label }}</button>
          </div>
          <p v-else class="vg2-talk__more vg2-blink">{{ line < lines.length - 1 ? '▸' : '' }}</p>
        </div>
      </template>
      <p v-else class="vg2-talk__hint">{{ hint('CLICK SOMEONE TO TALK. THE CALZONE IS IN THE HANGAR.', 'TAP SOMEONE TO TALK. THE CALZONE IS IN THE HANGAR.') }}</p>
    </div>

    <div class="vg2-hub__foot">
      <button type="button" class="vg2-btn vg2-btn--gold" @click="$emit('launch')">LAUNCH · {{ brief.title }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Deep Dish between sorties (DESIGN.md, "The Deep Dish"): three rooms,
 * each a picture with the crew in it and their faces under it to tap, a box
 * of talk (some talks end on a choice of two that moves the crew's morale or
 * the partner's mood), Nonna's briefing at the kitchen counter, the
 * killboard, Babs on the television. The words are `story/hub.ts`. The save
 * is the Landing's; this asks for changes with `update`.
 */
import type { Save, SortieId } from './engine/campaign'
import { MISSIONS } from './engine/missions'
import { SPEAKERS } from './story/cues'
import type { SpeakerId } from './story/cues'
import { BRIEFINGS, GENERIC, HOROSCOPE, ROOMS, speaker, TALKS } from './story/hub'
import type { Choice, RoomId, Say } from './story/hub'
import ROOM_SPOTS from './roomSpots.json'

const props = defineProps<{ save: Save; sortie: SortieId }>()
const emit = defineEmits<{ launch: []; update: [save: Save] }>()
const { hint } = useInputMode()

type Box = [number, number, number, number]
const SPOTS = ROOM_SPOTS as Record<string, Record<string, Box>>

const room = ref<RoomId>('kitchen')
const lines = ref<Say[]>([])
const line = ref(0)
const choice = ref<[Choice, Choice] | null>(null)
const talking = ref<SpeakerId | null>(null)

const brief = computed(() => BRIEFINGS[props.sortie])
const navNames = computed(() => (MISSIONS[props.sortie]?.navs ?? []).slice(1).map(n => n.name).concat('HOME'))
const pilotName = computed(() => props.save.pilot.toUpperCase())
const spots = computed(() => SPOTS[`room-${room.value}`] ?? {})
/** Hans is gone after he takes the Franchise's contract. */
const ORDER: SortieId[] = ['firstshift', 'convoy', 'siege', 'takeout', 'spilled', 'hansshot', 'dare', 'buffet', 'lastslice', 'finale']
const here = computed((): SpeakerId[] => {
  const after = ORDER.indexOf(props.sortie) > ORDER.indexOf('hansshot')
  const r: RoomId = room.value as RoomId
  return ROOMS[r].people.filter((p: SpeakerId) => !(p === 'duo' && after))
})
const say = computed(() => lines.value[line.value] ?? null)
const sayWho = computed(() => (say.value ? speaker(say.value, props.save.pilot) : null))

function nameOf(who: SpeakerId): string {
  return SPEAKERS[who].name
}

function face(who: SpeakerId, mood?: string): string {
  const sp = SPEAKERS[who]
  return `/${sp.dir}/portrait-${who}-${mood ?? sp.moods[0]}.png`
}

function box(b: Box): Record<string, string> {
  return { left: `calc(${b[0]} * var(--u))`, top: `calc(${b[1]} * var(--u))`, width: `calc(${b[2]} * var(--u))`, height: `calc(${b[3]} * var(--u))` }
}

function isNew(p: SpeakerId): boolean {
  return !!TALKS[props.sortie]?.[p] && !props.save.flags[`heard-${props.sortie}-${p}`]
}

function go(id: RoomId): void {
  room.value = id
  lines.value = []
  choice.value = null
}

function play(says: Say[], ch: [Choice, Choice] | null = null): void {
  lines.value = says
  line.value = 0
  choice.value = ch
}

function talkTo(p: SpeakerId): void {
  talking.value = p
  if (p === 'nonna') {
    // Nonna is the briefing.
    play([...brief.value.says, { who: 'mei', text: `ON YOUR WING: ${brief.value.wing}.` }, ...(TALKS[props.sortie]?.nonna?.says ?? [])], TALKS[props.sortie]?.nonna?.choice ?? null)
  } else {
    const t = TALKS[props.sortie]?.[p]
    if (t) play(t.says, props.save.flags[`chose-${props.sortie}-${p}`] ? null : t.choice ?? null)
    else play(GENERIC[p] ?? [{ who: p, text: '...' }])
  }
  emit('update', { ...props.save, flags: { ...props.save.flags, [`heard-${props.sortie}-${p}`]: true } })
}

function tv(): void {
  talking.value = 'babs'
  play([{ who: 'babs', mood: 'purr', text: 'THIS IS BABS ARELLA ON LOVE BAND 96.9 WITH YOUR STARS.' }, { who: 'babs', mood: 'wink', text: HOROSCOPE[props.sortie] }])
}

function next(): void {
  if (!say.value) return
  if (choice.value && line.value === lines.value.length - 1) return
  if (line.value < lines.value.length - 1) line.value++
  else lines.value = []
}

function choose(i: number): void {
  const c = choice.value?.[i]
  const who = talking.value
  if (!c || !who) return
  const s = props.save
  const flags = { ...s.flags, [`chose-${props.sortie}-${who}`]: true }
  if (c.flag) flags[c.flag] = true
  emit('update', {
    ...s,
    morale: Math.max(0, Math.min(1, s.morale + (c.morale ?? 0))),
    mood: Math.max(0, Math.min(1, s.mood + (c.mood ?? 0))),
    flags,
  })
  play([{ who: 'you', text: c.label + '.' }, ...c.reply])
}

onMounted(() => {
  // The briefing first: Nonna at the counter.
  talkTo('nonna')
})
</script>
