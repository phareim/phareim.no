<template>
  <!-- The play view's chrome: who you are (top-left), your bits (top-right),
    the menu, the contest line and the "you are sitting" caption. -->
  <div class="mw-hud" :class="{ 'mw-hud--run': running }">
    <button
      v-if="person"
      type="button"
      class="mw-me"
      :disabled="running"
      aria-label="Personer"
      @click="$emit('open', 'persons')"
    >
      <span class="mw-me-pic">
        <img v-if="portrait" :src="portrait" alt="" width="56" height="56">
        <span v-if="netDown" class="mw-net-dot" :title="netDown === 'full' ? 'Verden er full' : 'Ikke på nett'" />
      </span>
      <span class="mw-me-col">
        <span class="mw-me-name mw-t">
          <PxIcon v-if="title" id="crown" :scale="2" />
          <span>{{ person.name }}</span>
        </span>
        <span v-if="here > 0" class="mw-here mw-t" :aria-label="`${here} andre her`">
          <PxIcon id="people" :scale="2" />{{ here }} HER
        </span>
      </span>
    </button>

    <div class="mw-bits" :class="{ 'mw-bits--bump': bump }" aria-label="Bits" @animationend="bump = false">
      <PxIcon id="coin" :scale="3" />
      <span class="mw-t">{{ bits }}</span>
    </div>

    <nav v-if="!running && !quiet && person" class="mw-menu" aria-label="Meny">
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" aria-label="Personer" @click="$emit('open', 'persons')">
        <PxIcon id="person" :scale="3" /><span class="mw-menu-word">PERSONER</span>
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" aria-label="Garderobe" @click="$emit('open', 'wardrobe')">
        <PxIcon id="shirt" :scale="3" /><span class="mw-menu-word">KLÆR</span>
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" aria-label="Sekk" @click="$emit('open', 'bag')">
        <PxIcon id="bag" :scale="3" /><span class="mw-menu-word">SEKK</span>
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" aria-label="Hjem" @click="$emit('home')">
        <PxIcon id="house" :scale="3" /><span class="mw-menu-word">HJEM</span>
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" aria-label="Kart" @click="$emit('open', 'map')">
        <PxIcon id="pin" :scale="3" /><span class="mw-menu-word">KART</span>
      </button>
      <button
        v-if="inbox > 0"
        type="button"
        class="px-btn mw-btn mw-btn--pink mw-menu-btn"
        :aria-label="`Postkassa: ${inbox} gaver`"
        @click="$emit('open', 'mailbox')"
      >
        <PxIcon id="gift" :scale="3" /><span class="mw-t">{{ inbox }}</span>
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--plain mw-menu-btn" :aria-label="muted ? 'Lyd på' : 'Lyd av'" @click="$emit('mute')">
        <span class="mw-t mw-note" :class="{ 'mw-note--off': muted }">♪</span>
      </button>
    </nav>

    <button v-if="running" type="button" class="px-btn mw-btn mw-btn--plain mw-quit" @click="$emit('quit')">◀ AVSLUTT</button>

    <p v-if="line" class="mw-line px-box mw-box mw-t" role="status">{{ line }}</p>
    <p v-if="caption" class="mw-caption mw-t" role="status">{{ caption }}</p>
    <p v-if="keysHint" class="mw-keys mw-t">{{ keysHint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PxIcon from './PxIcon.vue'
import type { Person, RoyalTitle } from '../types'
import { useMw } from './context'

const props = defineProps<{
  person: Person | null
  title: RoyalTitle | null
  bits: number
  inbox: number
  muted: boolean
  /** An obby or star run: only the quit button and the contest line. */
  running: boolean
  /** The catwalk: no menu, no quit (the show runs its course). */
  quiet: boolean
  /** The contest HUD text, or ''. */
  line: string
  caption: string
  keysHint: string
  /** Other players in your place (the shared world). */
  here: number
  /** The shared world is out of reach or full: a quiet dot, the game plays on solo. */
  netDown: '' | 'offline' | 'full'
}>()

defineEmits<{ open: ['persons' | 'wardrobe' | 'bag' | 'map' | 'mailbox']; home: []; mute: []; quit: [] }>()

const { pics } = useMw()
const portrait = computed(() => (props.person ? pics.person(props.person.look, { size: 112 }) : ''))

const bump = ref(false)
watch(() => props.bits, (now, before) => {
  if (now !== before) {
    bump.value = false
    requestAnimationFrame(() => { bump.value = true })
  }
})
</script>

<style scoped>
.mw-hud {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto 1fr;
  grid-template-areas:
    "me menu bits"
    "line line line"
    ". . .";
  align-items: start;
  column-gap: 12px;
  padding:
    max(10px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    0
    max(12px, env(safe-area-inset-left, 0px));
}
.mw-hud > * { pointer-events: auto; }
.mw-hud > .mw-caption,
.mw-hud > .mw-keys,
.mw-hud > .mw-line { pointer-events: none; }

.mw-me {
  grid-area: me;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 0;
}
.mw-me:disabled { cursor: default; }
.mw-me-pic {
  position: relative;
  width: 56px;
  height: 56px;
  flex: none;
  background: var(--mw-paper);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
}
.mw-me-pic img { display: block; width: 56px; height: 56px; image-rendering: pixelated; }
.mw-me-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.mw-here {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--mw-ink);
  background: var(--mw-mint);
  padding: 1px 6px 1px 4px;
  white-space: nowrap;
}
.mw-net-dot {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 12px;
  height: 12px;
  background: var(--mw-muted);
  box-shadow: 0 0 0 3px var(--mw-ink);
}
.mw-me-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  color: #fff;
  /* A dark plate like the name tags in the world, readable over sky and castle. */
  background: var(--mw-ink);
  padding: 2px 6px;
  max-width: 34vw;
  white-space: nowrap;
  overflow: hidden;
}

.mw-bits {
  grid-area: bits;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px;
  font-size: 24px;
  background: var(--mw-paper);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
  justify-self: end;
}
.mw-bits--bump { animation: mw-bump 180ms ease-out; }

.mw-menu {
  grid-area: menu;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}
.mw-root .px-btn.mw-btn.mw-menu-btn { padding: 0 10px; gap: 8px; }
.mw-menu-word { display: none; }
.mw-note { font-size: 24px; line-height: 1; }
.mw-note--off { color: var(--mw-muted); text-decoration: line-through; }

.mw-quit { grid-area: menu; justify-self: start; }

.mw-line {
  grid-area: line;
  justify-self: center;
  margin: 12px 0 0;
  padding: 8px 16px;
  font-size: 24px;
  text-align: center;
}

.mw-caption {
  position: absolute;
  left: 50%;
  bottom: calc(172px + var(--app-safe-bottom, 0px));
  transform: translateX(-50%);
  margin: 0;
  font-size: 16px;
  color: #fff;
  text-shadow: 2px 2px 0 var(--mw-ink);
  white-space: nowrap;
}
.mw-keys {
  position: absolute;
  left: max(12px, env(safe-area-inset-left, 0px));
  bottom: calc(12px + var(--app-safe-bottom, 0px));
  margin: 0;
  font-size: 16px;
  color: #fff;
  text-shadow: 2px 2px 0 var(--mw-ink);
}

/* Phones in portrait: the menu goes under the top row, right-aligned. */
@media (max-width: 599px) {
  .mw-hud {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "me bits"
      "menu menu"
      "line line";
    row-gap: 12px;
  }
  .mw-menu { gap: 8px; }
  .mw-line { margin-top: 0; }
}
@media (min-width: 1000px) {
  .mw-menu-word { display: inline; }
}
</style>
