<template>
  <!-- Lag Din Figur: the page is the studio. The studio (renderers, panels,
    the drawing board) is its own chunk, loaded on the client only, so the
    site's entry stays small. SSR paints the lilac and the name. -->
  <div class="fg-page">
    <p v-if="!norwayOk" class="fg-loading fg-closed">BARE ÅPENT I NORGE</p>
    <ClientOnly v-else>
      <FigurGame v-if="account.state.value === 'in'" />
      <FgSignIn v-else :account="account" />
      <template #fallback>
        <p class="fg-loading">LAG DIN FIGUR</p>
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
const FgSignIn = defineAsyncComponent(() => import('./ui/SignIn.vue'))
function onVisible() {
  if (document.visibilityState === 'visible') void account.recheck()
}
onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
const FigurGame = defineAsyncComponent(() => import('./Game.vue'))
</script>

<style scoped>
.fg-page {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: var(--figur-bg, #f6d8ff);
}
.fg-loading {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 48px;
  color: #ffffff;
  text-shadow: 6px 6px 0 var(--figur-ink, #2a1744);
  -webkit-font-smoothing: none;
}
@media (max-width: 520px) {
  .fg-loading { font-size: 32px; text-shadow: 4px 4px 0 var(--figur-ink, #2a1744); }
}
.fg-closed { font-size: 28px; text-align: center; padding: 0 16px; }
</style>
