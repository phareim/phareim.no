<!-- Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync. -->
<template>
  <div class="strip" aria-label="Layers">
    <div
      v-for="l in LAYERS"
      :key="l"
      class="strip__cell"
      :class="{ on: active[l], pending: upcoming[l] > 0 }"
      :style="{ '--lv': levels[l] }"
    >
      <span class="strip__name" :class="{ 'px-blink': upcoming[l] > 0 }">{{ NAMES[l] }}</span>
      <span class="strip__meter" aria-hidden="true">
        <span v-for="i in 4" :key="i" :class="{ lit: levels[l] >= i / 4 }" />
      </span>
      <span v-if="upcoming[l] > 0" class="strip__in">IN {{ upcoming[l] }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRadio } from '../composables/useRadio'
/**
 * The ten layers, lit by how loud each is right now (`visual().levels`).
 * A layer the conductor has scheduled to enter blinks with its countdown.
 */
import { LAYERS } from '../engine/types.ts'
import type { Layer } from '../engine/types.ts'

const NAMES: Record<Layer, string> = {
  ambience: 'AMB', drone: 'DRONE', pad: 'PAD', bass: 'BASS', drums: 'DRUMS',
  perc: 'PERC', arp: 'ARP', lead: 'LEAD', counter: 'CTR', bells: 'BELLS',
}

const { levels, active, upcoming } = useRadio()
</script>

<style scoped>
.strip {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 0 4px;
  padding: 8px 16px;
  background: var(--bg-2);
  box-shadow: 0 -2px 0 0 var(--edge-dim), 0 2px 0 0 #0b0616;
}

.strip__cell {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 20px;
  font-size: 16px;
  line-height: 16px;
  color: var(--subtle);
}
.strip__cell.on { color: color-mix(in srgb, var(--cyan) calc(40% + var(--lv) * 60%), var(--muted)); }
.strip__cell.pending { color: var(--pink); }

.strip__name { flex: none; text-shadow: 2px 2px 0 var(--bg); }

.strip__meter { display: flex; gap: 2px; flex: none; }
.strip__meter span {
  width: 4px;
  height: 12px;
  background: var(--bg-3);
}
.strip__meter span.lit { background: var(--cyan); box-shadow: 0 0 6px color-mix(in srgb, var(--cyan) 60%, transparent); }

.strip__in {
  font-size: 8px;
  line-height: 8px;
  color: var(--pink);
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .strip__in { position: absolute; right: 0; top: -2px; }
}

@media (max-width: 700px) {
  .strip {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px 8px;
    padding: 6px 16px;
  }
  .strip__meter { display: none; }
  .strip__cell { height: 16px; }
  .strip__cell.on { color: color-mix(in srgb, var(--cyan) calc(35% + var(--lv) * 65%), var(--subtle)); text-shadow: 0 0 calc(var(--lv) * 10px) color-mix(in srgb, var(--cyan) 60%, transparent); }
  .strip__in { top: -4px; }
}
</style>
