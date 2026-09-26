<template>
  <!-- LAGRE BILDE: the figure in this style on its backdrop as a big PNG.
    On the Minecraft tab also the real 64×64 skin, with how to use it. -->
  <Sheet title="LAGRE" icon="download" narrow @close="$emit('close')">
    <div class="fg-stack">
      <img v-if="preview" class="fg-share-pic" :src="preview" alt="">
      <button type="button" class="px-btn fg-btn fg-btn--go fg-btn--wide fg-btn--big" @click="savePicture">
        <FgIcon id="picture" :scale="3" />LAGRE BILDE
      </button>

      <template v-if="styleId === 'minecraft'">
        <div class="fg-share-skin">
          <img v-if="skin" class="fg-share-skinpic" :src="skin" alt="">
          <button type="button" class="px-btn fg-btn fg-btn--sky fg-btn--wide" @click="saveSkin">
            <FgIcon id="minecraft" :scale="2" />MINECRAFT-SKIN
          </button>
        </div>
        <p class="fg-p fg-dim">Be en voksen hjelpe deg:</p>
        <p class="fg-p fg-dim">Minecraft → Skins → Ny skin → velg fila.</p>
        <p class="fg-p fg-dim">Velg modellen «Classic» (brede armer).</p>
      </template>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useFigur } from '~/composables/useFigur'
import { resolveOutfit } from '../core/textures'
import { minecraftSkin } from '../core/mcskin'
import { frameFor, styleById } from '../render/styles'
import Sheet from './Sheet.vue'
import FgIcon from './FgIcon.vue'
import { bufferCanvas, scaledCanvas, downloadCanvas } from './pics'
import { exportScale, pictureFileName, skinFileName } from './board'
import { FG_CTX } from './context'

const game = useFigur()
const ctx = inject(FG_CTX)!
const styleId = computed(() => game.active.value.style)

function frame() {
  const style = styleById(styleId.value)
  return frameFor(game.active.value, game.closet.value, style, {
    t: 0, pose: { bob: 0, blink: false, cheer: 0 }, backdrop: true,
  })
}

function skinTexture() {
  const f = game.active.value
  return minecraftSkin(f, resolveOutfit(f, game.closet.value))
}

const preview = computed(() => bufferCanvas(frame()).toDataURL())
const skin = computed(() => (styleId.value === 'minecraft' ? bufferCanvas(skinTexture()).toDataURL() : ''))

async function savePicture() {
  const buf = frame()
  const ok = await downloadCanvas(scaledCanvas(buf, exportScale(buf.w, buf.h)), pictureFileName(game.active.value.name, styleId.value))
  if (ok) ctx.sfx('sparkle')
}

async function saveSkin() {
  // A skin is read pixel for pixel by the game: exactly 64×64, never scaled.
  const ok = await downloadCanvas(bufferCanvas(skinTexture()), skinFileName(game.active.value.name))
  if (ok) ctx.sfx('sparkle')
}
</script>

<style scoped>
.fg-share-pic {
  display: block;
  width: 100%;
  height: min(40vh, 280px);
  object-fit: contain;
  image-rendering: pixelated;
}
.fg-share-skin { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
.fg-share-skinpic {
  flex: none;
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  background: var(--fg-grey);
}
</style>
