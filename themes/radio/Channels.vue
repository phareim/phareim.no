<template>
  <div class="ch__veil" @click.self="$emit('close')">
    <div class="ch px-box" role="dialog" aria-label="Channels">
      <p class="ch__title">CHANNELS</p>
      <p class="ch__sub">WHAT SHOWS ON THE DIAL · KEPT IN THIS BROWSER</p>

      <ul class="ch__list">
        <li v-for="L in builtins" :key="L.id" class="ch__item" :style="{ '--st': L.accent || '#2ff3ff' }">
          <button
            type="button"
            class="ch__toggle"
            :class="{ off: isHidden(L.id), playing: L.id === hud.landscape }"
            role="switch"
            :aria-checked="!isHidden(L.id)"
            :title="isHidden(L.id) ? 'SHOW ON THE DIAL' : 'HIDE FROM THE DIAL'"
            @click="toggle(L.id)"
          >
            <span class="ch__box" aria-hidden="true">{{ isHidden(L.id) ? '' : '■' }}</span>
            <span class="ch__name">{{ L.name }}</span>
            <span class="ch__blurb">{{ L.blurb }}</span>
          </button>
        </li>
      </ul>

      <div class="ch__row">
        <p v-if="warn" class="ch__warn">ONE CHANNEL HAS TO STAY</p>
        <button type="button" class="px-btn px-btn--dim ch__done" @click="$emit('close')">DONE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Which channels show on the dial, kept in this browser (the vendored
 * useChannels, never synced: phareim.no has no radio-api). Adapted from the
 * radio app's ChannelsDialog without composing, removing or the member sync,
 * which stay on radio.phareim.no. Escape closes it before the shell sees it.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRadio } from './station/composables/useRadio'
import { useChannels } from './station/composables/useChannels'

const emit = defineEmits<{ close: [] }>()

const { landscapes, hud } = useRadio()
const { isHidden, setShown } = useChannels()
const builtins = computed(() => landscapes.value.filter(l => l.origin !== 'opus'))
const warn = ref(false)

function toggle(id: string): void {
  warn.value = !setShown(id, isHidden(id))
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') { e.preventDefault(); e.stopPropagation(); emit('close') }
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<style scoped>
.ch__veil {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(11, 6, 22, 0.6);
}

.ch {
  width: min(640px, 100%);
  max-height: calc(var(--app-height, 100dvh) - 32px - var(--app-safe-bottom, 0px));
  display: flex;
  flex-direction: column;
  padding: 16px 16px 14px;
  background: var(--bg);
  font-size: 16px;
  line-height: 20px;
  color: var(--ink);
  text-transform: uppercase;
}
.ch p { margin: 0; }

.ch__title { color: var(--cyan); text-shadow: 2px 2px 0 var(--bg); }
.ch__sub { color: var(--subtle); margin: 4px 0 12px !important; }

.ch__list {
  list-style: none;
  margin: 0;
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
}

.ch__item { display: flex; }

.ch__toggle {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 20px auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--st) 55%, transparent);
  color: var(--st);
  font: inherit;
  text-transform: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ch__toggle:hover, .ch__toggle:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--st); }
.ch__toggle.playing .ch__name { text-shadow: 0 0 10px color-mix(in srgb, var(--st) 60%, transparent); }
.ch__toggle.off { color: var(--subtle); box-shadow: inset 0 0 0 2px #2a2050; }
.ch__toggle.off:hover { box-shadow: inset 0 0 0 2px var(--muted); }

.ch__box {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 2px currentColor;
  font-size: 16px;
  line-height: 1;
}
.ch__name { white-space: nowrap; }
.ch__blurb { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch__toggle.off .ch__blurb { color: #3a2f66; }

.ch__row { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 14px; }
.ch__warn { color: var(--gold); margin-right: auto !important; }
.ch__done { height: 32px; padding: 0 12px; }

@media (max-width: 700px) {
  .ch__veil { place-items: start center; padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
  .ch__toggle { grid-template-columns: 20px minmax(0, 1fr); }
  .ch__blurb { display: none; }
  .ch__name { overflow: hidden; text-overflow: ellipsis; }
}
</style>
