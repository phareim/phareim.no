<template>
  <!-- Mini World: the page is the game. The game (three.js world, panels,
    audio) is its own chunk, loaded on the client only, so the site's entry
    stays small. SSR paints the sky and the name. -->
  <div class="mw-page">
    <p v-if="!norwayOk" class="mw-loading mw-closed">BARE ÅPENT I NORGE</p>
    <ClientOnly v-else>
      <MiniWorldGame v-if="account.state.value === 'in'" />
      <MwSignIn v-else :account="account" />
      <template #fallback>
        <p class="mw-loading">MINI WORLD</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

// Norway only (server/utils/norway.ts): outside it the game never loads.
const norwayOk = useState<boolean>('norwayOk', () => true)
// Signed in only (2026-09-29): until the account says `in` the window below is
// all there is, and the game's chunk is not even loaded. The server checks the
// session on every route as well (server/utils/account.ts).
const account = useAccount()
const MwSignIn = defineAsyncComponent(() => import('./ui/SignIn.vue'))
function onVisible() {
  if (document.visibilityState === 'visible') void account.recheck()
}
onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
const MiniWorldGame = defineAsyncComponent(() => import('./Game.vue'))
</script>

<style scoped>
.mw-page {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: #8fd8ff;
}
.mw-loading {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  font-size: 48px;
  color: #ffffff;
  text-shadow: 6px 6px 0 #2a1f4a;
  -webkit-font-smoothing: none;
}
@media (max-width: 420px) {
  .mw-loading { font-size: 32px; text-shadow: 4px 4px 0 #2a1f4a; }
}
.mw-closed { font-size: 28px; text-align: center; padding: 0 16px; }
</style>
