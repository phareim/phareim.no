<!-- Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync. -->
<template>
  <div class="ib" role="radiogroup" aria-label="Intensity">
    <span class="ib__label">{{ intensityNames[controls.intensity] }}</span>
    <div class="ib__row">
      <button
        v-for="(name, i) in intensityNames"
        :key="name"
        type="button"
        role="radio"
        class="ib__seg"
        :class="{ lit: i <= controls.intensity, now: i === controls.intensity, heard: i === heard && heard !== controls.intensity }"
        :aria-checked="i === controls.intensity"
        :title="`${name} [↑ ↓]`"
        @click="set({ intensity: i as Controls['intensity'] })"
      >
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRadio } from '../composables/useRadio'
/**
 * Intensity, five steps from STILL to SURGE. The step the music is heading
 * for is lit; while it builds or thins, the level it is at blinks.
 */
import { computed } from 'vue'
import type { Controls } from '../engine/types.ts'

const { controls, set, intensityNames, hud, started } = useRadio()

/** The level sounding now, while the music moves toward the chosen one. */
const heard = computed(() => (started.value && hud.intensity >= 0 ? Math.round(hud.intensity) : controls.intensity))
</script>

<style scoped>
.ib {
  display: grid;
  grid-template-columns: var(--pxs-label-w, 96px) 1fr;
  align-items: center;
  column-gap: 8px;
}

.ib__label { font-size: 16px; color: var(--pink); text-shadow: 2px 2px 0 var(--bg); }

.ib__row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.ib__seg {
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: color-mix(in srgb, var(--pink) 10%, var(--bg));
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--pink) 22%, var(--bg));
  color: var(--subtle);
  font-size: 16px;
  line-height: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ib__seg:nth-child(1) { height: 16px; align-self: end; }
.ib__seg:nth-child(2) { height: 19px; align-self: end; }
.ib__seg:nth-child(3) { height: 22px; align-self: end; }
.ib__seg:nth-child(4) { height: 25px; align-self: end; }
.ib__seg:nth-child(5) { height: 28px; align-self: end; }

.ib__seg:hover, .ib__seg:focus-visible { outline: none; color: var(--ink); }
.ib__seg.lit { background: color-mix(in srgb, var(--pink) 45%, var(--bg)); box-shadow: none; color: var(--ink); }
.ib__seg.now { background: var(--pink); color: var(--bg); box-shadow: 0 0 12px color-mix(in srgb, var(--pink) 55%, transparent); }
.ib__seg.heard { animation: ib-heard 1.1s steps(1) infinite; }
@keyframes ib-heard { 50% { box-shadow: inset 0 0 0 2px var(--ink); } }
@media (prefers-reduced-motion: reduce) { .ib__seg.heard { animation: none; } }

</style>
