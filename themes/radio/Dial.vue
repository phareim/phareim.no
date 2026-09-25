<template>
  <div class="dial">
    <div class="dial__read">
      <button class="dial__step" type="button" aria-label="Previous place" @click="step(-1)">◀</button>
      <p class="dial__target" :style="{ color: target.accent }">
        <span>{{ target.name }}</span>
        <span v-if="moving" class="dial__moving px-blink">TUNING...</span>
      </p>
      <button class="dial__step" type="button" aria-label="Next place" @click="step(1)">▶</button>
    </div>
    <p class="dial__blurb"><span>{{ target.blurb }}</span></p>

    <div class="dial__grid" role="radiogroup" aria-label="Places">
      <button
        v-for="(L, i) in visible"
        :key="L.id"
        type="button"
        role="radio"
        class="dial__st"
        :class="{ sounding: L.id === hud.landscape, target: L.id === controls.landscape && L.id !== hud.landscape }"
        :style="{ '--st': L.accent || '#2ff3ff' }"
        :aria-checked="L.id === controls.landscape"
        :title="L.blurb"
        @click="set({ landscape: L.id })"
      >
        <span class="dial__num">{{ i < 10 ? (i + 1) % 10 : '' }}</span>
        <span class="dial__name">{{ L.name }}</span>
      </button>
      <button type="button" class="dial__st dial__ch" title="CHOOSE WHICH CHANNELS SHOW [C]" aria-label="Channels" @click="$emit('channels')">
        <span class="dial__num">■</span>
        <span class="dial__name">CHANNELS</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The station dial, listen-only: the channels that show (all ten built-in
 * places unless some are hidden under CHANNELS) as pixel buttons in their
 * own accent colours, keys 1–9 and 0. The place sounding is lit; the one the
 * music is moving toward blinks until it arrives. Adapted from the radio
 * app's StationDial (phareim/radio components/StationDial.vue); composing
 * stays on radio.phareim.no.
 */
import { computed } from 'vue'
import { useRadio } from './station/composables/useRadio'
import { useChannels } from './station/composables/useChannels'

defineEmits<{ channels: [] }>()

const { controls, hud, set, landscapeOf } = useRadio()
const { visible } = useChannels()
const target = computed(() => landscapeOf(controls.landscape))
const moving = computed(() => controls.landscape !== hud.landscape)

function step(d: number): void {
  const list = visible.value
  const i = list.findIndex(l => l.id === controls.landscape)
  set({ landscape: list[(i + d + list.length) % list.length]!.id })
}
</script>

<style scoped>
.dial { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.dial p { margin: 0; }

.dial__read {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}

.dial__step {
  width: 32px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dial__step:hover, .dial__step:focus-visible { color: var(--ink); outline: none; }

.dial__target {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  min-width: 0;
  font-size: 16px;
  line-height: 20px;
  text-shadow: 2px 2px 0 var(--bg);
  white-space: nowrap;
  overflow: hidden;
}
.dial__target span:first-child { overflow: hidden; text-overflow: ellipsis; }
.dial__moving { color: var(--pink); flex: none; }

.dial__blurb {
  display: flex;
  justify-content: center;
  min-height: 16px;
  font-size: 16px;
  line-height: 16px;
  color: var(--muted);
  text-align: center;
  text-transform: uppercase;
}
.dial__blurb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dial__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
  gap: 8px 12px;
  padding: 2px;
}

.dial__st {
  --st: #2ff3ff;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: rgba(11, 6, 22, 0.88);
  color: color-mix(in srgb, var(--st) 75%, var(--muted));
  font-size: 16px;
  line-height: 16px;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
  box-shadow:
    0 -2px 0 0 color-mix(in srgb, var(--st) 40%, var(--bg)),
    0 2px 0 0 color-mix(in srgb, var(--st) 40%, var(--bg)),
    -2px 0 0 0 color-mix(in srgb, var(--st) 40%, var(--bg)),
    2px 0 0 0 color-mix(in srgb, var(--st) 40%, var(--bg));
  -webkit-tap-highlight-color: transparent;
}
.dial__st:hover, .dial__st:focus-visible {
  outline: none;
  color: var(--st);
  box-shadow: 0 -2px 0 0 var(--st), 0 2px 0 0 var(--st), -2px 0 0 0 var(--st), 2px 0 0 0 var(--st);
}
.dial__st:active { transform: translate(2px, 2px); }

.dial__num { flex: none; width: 12px; color: var(--subtle); }
.dial__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dial__st.sounding {
  background: var(--st);
  color: var(--bg);
  box-shadow: 0 -2px 0 0 var(--st), 0 2px 0 0 var(--st), -2px 0 0 0 var(--st), 2px 0 0 0 var(--st), 0 0 14px color-mix(in srgb, var(--st) 55%, transparent);
}
.dial__st.sounding .dial__num { color: color-mix(in srgb, var(--bg) 60%, var(--st)); }

.dial__st.target {
  color: var(--st);
  animation: dial-target 0.9s steps(1) infinite;
}
@keyframes dial-target {
  0% { box-shadow: 0 -2px 0 0 var(--st), 0 2px 0 0 var(--st), -2px 0 0 0 var(--st), 2px 0 0 0 var(--st); }
  50% { box-shadow: 0 -2px 0 0 var(--pink), 0 2px 0 0 var(--pink), -2px 0 0 0 var(--pink), 2px 0 0 0 var(--pink); }
}
@media (prefers-reduced-motion: reduce) { .dial__st.target { animation: none; } }

.dial__ch { --st: #ffd23f; }
.dial__ch .dial__num { color: var(--gold); }

/* Wide: names on the buttons, the arrows go (← → on the keyboard). */
@media (min-width: 701px) {
  .dial__step { display: none; }
  .dial__read { grid-template-columns: 1fr; }
  .dial__target { justify-content: flex-start; }
  .dial__blurb { justify-content: flex-start; text-align: left; }
}

/* Narrow: numbered tiles in two rows; the name is read out above them. */
@media (max-width: 700px) {
  .dial__grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .dial__st { justify-content: center; padding: 0; }
  .dial__num { width: auto; color: inherit; }
  .dial__st.sounding .dial__num { color: var(--bg); }
  .dial__name { display: none; }
  .dial__blurb { display: none; }
  .dial__ch .dial__num { color: var(--gold); }
}
</style>
