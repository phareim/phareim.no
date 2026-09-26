<template>
  <!-- KROPP: skin, eyes and their colour, mouth, cheeks and freckles.
    Each choice is a picture of the figure's own head with that choice. -->
  <div class="fg-panel-body">
    <p class="fg-label"><FgIcon id="skin" :scale="2" />HUD</p>
    <div class="fg-grid fg-grid--swatch">
      <button
        v-for="s in SKINS"
        :key="s.id"
        type="button"
        class="fg-tile fg-swatch"
        :class="{ 'fg-tile--on': body.skin === s.id }"
        :aria-label="s.name"
        :aria-pressed="body.skin === s.id"
        @click="set({ skin: s.id })"
      >
        <span class="fg-swatch-fill" :style="{ background: s.color }" />
      </button>
    </div>

    <p class="fg-label"><FgIcon id="eye" :scale="2" />ØYNE</p>
    <div class="fg-grid">
      <button
        v-for="e in EYES"
        :key="e.id"
        type="button"
        class="fg-tile"
        :class="{ 'fg-tile--on': body.eyes === e.id }"
        :aria-label="e.name"
        :aria-pressed="body.eyes === e.id"
        @click="set({ eyes: e.id })"
      >
        <img class="fg-pic" :src="head({ eyes: e.id })" alt="">
      </button>
    </div>
    <div class="fg-grid fg-grid--swatch fg-gap">
      <button
        v-for="c in EYE_COLORS"
        :key="c"
        type="button"
        class="fg-tile fg-swatch"
        :class="{ 'fg-tile--on': body.eyeColor === c }"
        aria-label="Øyenfarge"
        :aria-pressed="body.eyeColor === c"
        @click="set({ eyeColor: c })"
      >
        <span class="fg-swatch-fill fg-swatch-fill--eye" :style="{ background: c }" />
      </button>
    </div>

    <p class="fg-label"><FgIcon id="mouth" :scale="2" />MUNN</p>
    <div class="fg-grid">
      <button
        v-for="m in MOUTHS"
        :key="m.id"
        type="button"
        class="fg-tile"
        :class="{ 'fg-tile--on': body.mouth === m.id }"
        :aria-label="m.name"
        :aria-pressed="body.mouth === m.id"
        @click="set({ mouth: m.id })"
      >
        <img class="fg-pic" :src="head({ mouth: m.id })" alt="">
      </button>
    </div>

    <p class="fg-label"><FgIcon id="cheeks" :scale="2" />KINN OG FREGNER</p>
    <div class="fg-grid fg-grid--two">
      <button
        type="button"
        class="fg-tile fg-tile--wide"
        :class="{ 'fg-tile--on': body.cheeks }"
        :aria-pressed="body.cheeks"
        @click="set({ cheeks: !body.cheeks })"
      >
        <FgIcon id="cheeks" :scale="4" :grey="!body.cheeks" />
        <span class="fg-tile-name">KINN</span>
      </button>
      <button
        type="button"
        class="fg-tile fg-tile--wide"
        :class="{ 'fg-tile--on': body.freckles }"
        :aria-pressed="body.freckles"
        @click="set({ freckles: !body.freckles })"
      >
        <FgIcon id="freckles" :scale="4" :grey="!body.freckles" />
        <span class="fg-tile-name">FREGNER</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { FigureBody } from '../types'
import { SKINS, EYES, MOUTHS, EYE_COLORS } from '../catalog'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import { headPic } from './pics'
import { FG_CTX } from './context'

const game = useFigur()
const ctx = inject(FG_CTX)!
const body = computed(() => game.active.value.body)

function set(patch: Partial<FigureBody>) {
  game.setBody(patch)
  ctx.sfx('pop')
}

/** The figure's head with `patch`, no glasses (they would hide the eyes). */
function head(patch: Partial<FigureBody>): string {
  const f = game.active.value
  return headPic({ ...f, body: { ...f.body, ...patch }, outfit: { ...f.outfit, face: null, back: null } }, game.closet.value, f.style)
}
</script>

<style scoped>
.fg-gap { margin-top: 12px; }
.fg-swatch-fill--eye { inset: 10px; border-radius: 0; }
.fg-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.fg-tile--wide { flex-direction: row; gap: 10px; min-height: 64px; }
</style>
