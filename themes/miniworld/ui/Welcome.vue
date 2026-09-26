<template>
  <!-- The first thing a new player sees: the name, a friendly person, and
    one button into the person maker. -->
  <div class="mw-welcome">
    <div class="mw-welcome-card px-box mw-box">
      <h1 class="mw-welcome-title mw-t">MINI WORLD</h1>
      <div class="mw-welcome-pic">
        <img v-if="pic" :src="pic" alt="">
      </div>
      <p class="mw-h mw-center">LAG DIN FØRSTE PERSON!</p>
      <button ref="goRef" type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" @click="$emit('start')">
        LAG PERSON{{ hint(' — ENTER', '') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMw } from './context'
import { STARTER_OUTFIT } from '../catalog'
import type { PersonLook } from '../types'

defineEmits<{ start: [] }>()

const { pics } = useMw()
const { hint } = useInputMode()

const LOOK: PersonLook = { skin: 's2', hair: 'pigtails', hairColor: 'blond', eyes: 'big', mouth: 'grin', cheeks: true, outfit: { ...STARTER_OUTFIT, top: 'tee-blue' } }
const pic = computed(() => pics.person(LOOK, { full: true, size: 320, pose: 'wave' }))

const goRef = ref<HTMLButtonElement | null>(null)
onMounted(() => goRef.value?.focus({ preventScroll: true }))
</script>

<style scoped>
.mw-welcome {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(12px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    calc(12px + var(--app-safe-bottom, 0px))
    max(12px, env(safe-area-inset-left, 0px));
  background: rgba(143, 216, 255, 0.55);
}
.mw-welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 460px;
  max-height: 100%;
  padding: 24px 20px 22px;
  overflow: hidden;
}
.mw-welcome-title {
  margin: 0;
  font-size: 48px;
  line-height: 1;
  font-weight: 400;
  color: var(--mw-pink);
  text-shadow: 4px 4px 0 var(--mw-ink);
  text-align: center;
}
.mw-welcome-pic {
  width: 180px;
  height: 180px;
  flex: 0 1 auto;
  min-height: 0;
  background: var(--mw-tile);
}
.mw-welcome-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
@media (min-width: 700px) and (min-height: 700px) {
  .mw-welcome-title { font-size: 64px; }
  .mw-welcome-pic { width: 240px; height: 240px; }
}
@media (max-height: 460px) {
  .mw-welcome-card { gap: 8px; padding: 14px 16px; }
  .mw-welcome-title { font-size: 32px; }
  .mw-welcome-pic { width: 110px; height: 110px; }
}
</style>
