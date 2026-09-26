<template>
  <!-- PIP: the helper bird's speech box with big buttons. What Pip does
    replaces the figure (its name and id stay); ANGRE puts it back. -->
  <div ref="rootRef" class="fg-panel-body fg-pip">
    <div class="fg-pip-talk">
      <button type="button" class="fg-pip-bird" aria-label="Pip" @click="chirp">
        <FgIcon id="pip" :scale="4" />
      </button>
      <p class="px-box fg-box fg-pip-say fg-t" aria-live="polite">{{ line }}</p>
    </div>

    <div v-if="undo" class="fg-row fg-pip-undo">
      <button type="button" class="px-btn fg-btn fg-btn--plain" @click="undoPip">
        <FgIcon id="undo" :scale="2" />ANGRE
      </button>
    </div>

    <div v-if="mode === 'menu'" class="fg-pip-menu">
      <button type="button" class="px-btn fg-btn fg-btn--pink fg-btn--wide fg-pip-btn" @click="make">
        <FgIcon id="star" :scale="2" />{{ PIP_HELP.buttons.make }}
      </button>
      <button type="button" class="px-btn fg-btn fg-btn--wide fg-pip-btn" @click="idea">
        <FgIcon id="heart" :scale="2" />{{ PIP_HELP.buttons.idea }}
      </button>
      <button type="button" class="px-btn fg-btn fg-btn--sky fg-btn--wide fg-pip-btn" @click="showDraw">
        <FgIcon id="pencil" :scale="2" />{{ PIP_HELP.buttons.draw }}
      </button>
      <button type="button" class="px-btn fg-btn fg-btn--go fg-btn--wide fg-pip-btn" @click="showWrite">
        <FgIcon id="draw" :scale="2" />{{ PIP_HELP.buttons.write }}
      </button>
    </div>

    <div v-else-if="mode === 'draw'" class="fg-stack">
      <ol class="fg-pip-steps">
        <li v-for="(l, i) in PIP_HELP.draw" :key="i" class="fg-p">
          <span class="fg-pip-num">{{ i + 1 }}</span>{{ l }}
        </li>
      </ol>
      <div class="fg-row">
        <button type="button" class="px-btn fg-btn fg-btn--plain" @click="toMenu">
          <FgIcon id="back" :scale="2" />TILBAKE
        </button>
        <button type="button" class="px-btn fg-btn fg-btn--sky" @click="ctx.setTab('draw')">
          <FgIcon id="pencil" :scale="2" />TIL TEGN
        </button>
      </div>
    </div>

    <form v-else class="fg-stack" @submit.prevent="doIt">
      <input
        ref="inputRef"
        v-model="text"
        class="fg-input fg-pip-input"
        type="text"
        maxlength="120"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="go"
        placeholder="BLÅTT HÅR OG ROSA KJOLE"
        aria-label="Skriv hva du vil ha"
      >
      <div class="fg-row">
        <button type="button" class="px-btn fg-btn fg-btn--plain" @click="toMenu">
          <FgIcon id="back" :scale="2" />TILBAKE
        </button>
        <button type="submit" class="px-btn fg-btn fg-btn--go" :disabled="!text.trim()">
          <FgIcon id="check" :scale="2" />GJØR DET
        </button>
      </div>
    </form>
  </div>
</template>

<script lang="ts">
import { ref as moduleRef } from 'vue'
import type { Figure } from '../types'

/** Pip's last line and the figure before Pip's last change: kept while the child visits other tabs. */
const said = moduleRef<string>('')
const before = moduleRef<{ id: string; fig: Figure } | null>(null)
</script>

<script setup lang="ts">
import { ref, computed, inject, nextTick } from 'vue'
import { PIP_HELP, pipSurprise, pipIdea, understand, pipSay } from '../core/helper'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import { FG_CTX } from './context'

const game = useFigur()
const ctx = inject(FG_CTX)!

const mode = ref<'menu' | 'draw' | 'write'>('menu')
const text = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLDivElement | null>(null)
const line = computed(() => said.value || PIP_HELP.greeting)
const undo = computed(() => before.value && before.value.id === game.active.value.id)

function apply(fig: Figure, say: string) {
  const cur = game.active.value
  before.value = { id: cur.id, fig: cur }
  game.replace(fig)
  said.value = say
  ctx.sfx('sparkle')
}

function chirp() {
  said.value = ''
  mode.value = 'menu'
  ctx.sfx('chirp')
}

function make() {
  const r = pipSurprise(Math.random, game.active.value)
  apply(r.figure, r.line)
}

function idea() {
  const r = pipIdea(game.active.value)
  apply(r.figure, r.line)
}

function showDraw() {
  mode.value = 'draw'
  said.value = PIP_HELP.buttons.draw
  ctx.sfx('chirp')
}

async function showWrite() {
  mode.value = 'write'
  said.value = PIP_HELP.write
  ctx.sfx('chirp')
  await nextTick()
  inputRef.value?.focus()
}

function toMenu() {
  mode.value = 'menu'
  said.value = ''
}

function doIt() {
  const t = text.value.trim()
  if (!t) return
  const r = understand(t, game.active.value)
  if (r.did.length) {
    apply(r.figure, pipSay(r))
    text.value = ''
  } else {
    said.value = pipSay(r)
    ctx.sfx('no')
  }
  inputRef.value?.blur()
  // Pip's answer is at the top of the panel: show it.
  void nextTick(() => rootRef.value?.scrollTo({ top: 0 }))
}

function undoPip() {
  const b = before.value
  if (!b || b.id !== game.active.value.id) return
  before.value = null
  game.replace(b.fig)
  said.value = 'Sånn, nå er den som før.'
  ctx.sfx('whoosh')
}
</script>

<style scoped>
.fg-pip { display: flex; flex-direction: column; gap: 10px; }
.fg-pip-talk { display: flex; align-items: flex-start; gap: 14px; }
.fg-pip-bird {
  flex: none;
  padding: 4px;
  border: 0;
  background: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.fg-pip-say {
  flex: 1;
  min-width: 0;
  margin: 6px 3px 3px 0;
  padding: 12px 14px;
  font-size: 16px;
  line-height: 1.5;
  background: var(--fg-sun-soft);
}
.fg-pip-undo { justify-content: flex-start; }
.fg-root .px-btn.fg-btn.fg-pip-btn { justify-content: flex-start; text-align: left; min-height: 48px; }
.fg-pip .fg-stack { gap: 10px; }
.fg-pip-menu { display: flex; flex-direction: column; gap: 10px; }
/* Narrow screens: four big picture buttons, two by two, so all show at once. */
@media (max-width: 799px) and (orientation: portrait) {
  .fg-pip-menu { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .fg-root .px-btn.fg-btn.fg-pip-btn {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    min-height: 76px;
    padding: 4px 6px;
    gap: 4px;
  }
}
.fg-pip-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.fg-pip-steps li { display: flex; gap: 10px; align-items: baseline; }
.fg-pip-num {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--fg-pink);
  font-size: 24px;
}
.fg-pip-input { font-size: 16px; }
</style>
