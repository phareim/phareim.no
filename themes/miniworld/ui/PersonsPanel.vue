<template>
  <Sheet title="PERSONER" icon="person" @close="ctx.close()">
    <ul class="mw-people">
      <li v-for="p in persons" :key="p.id" class="mw-person" :class="{ 'mw-person--on': p.id === activeId }">
        <div class="mw-person-pic">
          <img v-if="pic(p.look)" :src="pic(p.look)" alt="">
        </div>
        <div class="mw-person-main">
          <p class="mw-h">{{ p.name }}</p>
          <p v-if="p.id === activeId" class="mw-p mw-dim">DET ER DEG NÅ</p>

          <div v-if="confirmId === p.id" class="mw-stack">
            <p class="mw-p mw-warn">VIL DU FJERNE {{ p.name }}?</p>
            <div class="mw-row">
              <button type="button" class="px-btn mw-btn mw-btn--danger" @click="remove(p.id)">JA, FJERN</button>
              <button type="button" class="px-btn mw-btn mw-btn--plain" @click="confirmId = null">NEI</button>
            </div>
          </div>
          <div v-else class="mw-row">
            <button v-if="p.id !== activeId" type="button" class="px-btn mw-btn mw-btn--go" @click="play(p.id)">SPILL SOM</button>
            <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.open({ id: 'creator', personId: p.id })">ENDRE</button>
            <button
              v-if="persons.length > 1"
              type="button"
              class="px-btn mw-btn mw-btn--plain"
              @click="confirmId = p.id"
            >
              FJERN
            </button>
          </div>
        </div>
      </li>
    </ul>

    <template #footer>
      <p v-if="full" class="mw-p mw-dim mw-full">DU KAN HA {{ MAX_PERSONS }} PERSONER.</p>
      <button type="button" class="px-btn mw-btn mw-btn--go" :disabled="full" @click="ctx.open({ id: 'creator', personId: null })">
        + NY PERSON
      </button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import { useMw } from './context'
import { MAX_PERSONS, type PersonLook } from '../types'

const ctx = useMw()
const { game, pics } = ctx

const persons = computed(() => game.save.value.persons)
const activeId = computed(() => game.save.value.active)
const full = computed(() => persons.value.length >= MAX_PERSONS)
const confirmId = ref<string | null>(null)

const pic = (look: PersonLook) => pics.person(look, { size: 160 })

function play(id: string) {
  const r = game.setActive(id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('dress')
  ctx.close()
}

function remove(id: string) {
  const r = game.deletePerson(id)
  confirmId.value = null
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('store')
}
</script>

<style scoped>
.mw-people { list-style: none; margin: 0; padding: 4px; display: flex; flex-direction: column; gap: 16px; }
.mw-person {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 10px;
  background: var(--mw-tile);
}
.mw-person--on { background: var(--mw-pink-soft); }
.mw-person-pic {
  width: 88px;
  height: 88px;
  flex: none;
  background: var(--mw-paper);
}
.mw-person-pic img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.mw-person-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.mw-person-main .mw-h { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mw-full { margin-right: auto; }
</style>
