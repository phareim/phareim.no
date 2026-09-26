<template>
  <!-- Someone else in the shared world, tapped in the view: who they are,
    and what you can do together. The world keeps running behind it. -->
  <Sheet :title="info?.name ?? 'VENN'" narrow @close="ctx.close()">
    <div class="mw-peer">
      <div class="mw-peer-pic">
        <img v-if="portrait" :src="portrait" alt="" width="128" height="128">
      </div>
      <div class="mw-peer-main">
        <p v-if="info?.title" class="mw-p mw-peer-title">
          <PxIcon id="crown" :scale="2" />{{ TITLE_NAMES[info.title] }}
        </p>
        <p v-if="siteName" class="mw-p mw-dim">{{ siteName }}</p>
        <p v-if="gone" class="mw-p mw-dim">HEN HAR GÅTT HJEM.</p>
        <p v-if="friend" class="mw-p mw-peer-friends"><PxIcon id="heart" :scale="2" />VENNER ✓</p>
      </div>
    </div>

    <p v-if="line" class="mw-p mw-peer-line" :class="{ 'mw-warn': lineBad }" role="status">{{ line }}</p>

    <div class="mw-peer-actions">
      <template v-if="pub && !self">
        <button v-if="!friend" type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="social.busy.value" @click="befriend">
          <PxIcon id="heart" :scale="3" />BLI VENNER
        </button>
        <template v-if="friend || neighbour">
          <button type="button" class="px-btn mw-btn mw-btn--pink" @click="ctx.open({ id: 'gift', to: pub })">
            <PxIcon id="gift" :scale="2" />SEND GAVE
          </button>
          <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.visit(pub)">
            <PxIcon id="house" :scale="2" />BESØK HUSET
          </button>
        </template>
      </template>
      <button v-if="!gone" type="button" class="px-btn mw-btn mw-btn--plain" @click="waveBack">
        <PxIcon id="wave" :scale="2" />VINK
      </button>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw, socialLine } from './context'
import { parseLook } from '../core/save'
import type { RoyalTitle } from '../types'

const props = defineProps<{ /** Their session id in the shared world. */ peer: string }>()

const ctx = useMw()
const { social, pics, world } = ctx

const TITLE_NAMES: Record<RoyalTitle, string> = { king: 'KONGE', queen: 'DRONNING', prince: 'PRINS', princess: 'PRINSESSE' }

/** Kept from when the card opened, so it still reads right if they leave. */
const first = world.peers.get(props.peer) ?? null
const info = computed(() => world.peers.get(props.peer) ?? first)
const gone = computed(() => !world.peers.has(props.peer))
const pub = computed(() => info.value?.pub ?? '')
const self = computed(() => !!pub.value && pub.value === social.me.value)
const friend = computed(() => social.isFriend(pub.value))
const neighbour = computed(() => !!pub.value && !!social.state.value?.hood?.members.some(m => m.id === pub.value))
/** Their Hall of Fame name, when the neighbourhood already told us. */
const siteName = computed(() => {
  const s = social.state.value
  if (!s || !pub.value) return ''
  return s.friends.find(f => f.id === pub.value)?.playerName
    ?? s.hood?.members.find(m => m.id === pub.value)?.playerName
    ?? ''
})
const portrait = computed(() => {
  const look = parseLook(info.value?.look)
  return look ? pics.person(look, { size: 128 }) : ''
})

const line = ref('')
const lineBad = ref(false)

async function befriend() {
  const r = await social.addFriendById(pub.value)
  if (r === 'ok' || r === 'already') {
    ctx.sfx('match')
    ctx.cheer('NÅ ER DERE VENNER!', portrait.value || undefined)
    line.value = ''
    return
  }
  line.value = r === 'not-found' ? 'FANT IKKE HEN. PRØV IGJEN SENERE.' : socialLine(r).toUpperCase()
  lineBad.value = true
}

function waveBack() {
  ctx.close()
  world.emote('wave')
}

// The world runs on behind the card: the others still see you, and you them.
onMounted(() => ctx.setSeeThrough(true))
onBeforeUnmount(() => ctx.setSeeThrough(false))
</script>

<style scoped>
.mw-peer {
  display: flex;
  align-items: center;
  gap: 16px;
}
.mw-peer-pic {
  width: 128px;
  height: 128px;
  flex: none;
  background: var(--mw-tile);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
}
.mw-peer-pic img { display: block; width: 128px; height: 128px; image-rendering: pixelated; }
.mw-peer-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.mw-peer-title,
.mw-peer-friends { display: inline-flex; align-items: center; gap: 8px; }
.mw-peer-friends { color: #1f7a4a; }
.mw-peer-line { margin-top: 12px; }
.mw-peer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
@media (max-height: 420px) {
  .mw-peer-pic, .mw-peer-pic img { width: 96px; height: 96px; }
  .mw-peer-actions { margin-top: 10px; }
}
</style>
