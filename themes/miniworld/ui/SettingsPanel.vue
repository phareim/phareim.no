<template>
  <!-- Settings: who is playing, and Logg ut. Two taps, so a small finger
    cannot log out by accident. -->
  <Sheet title="INNSTILLINGER" icon="gear" narrow @close="ctx.close()">
    <div class="mw-stack">
      <p class="mw-p mw-dim">DU ER LOGGET INN SOM</p>
      <p class="mw-h mw-set-who">{{ who }}</p>

      <template v-if="!asking">
        <button type="button" class="px-btn mw-btn mw-btn--plain mw-btn--wide" @click="asking = true">LOGG UT</button>
      </template>
      <template v-else>
        <p class="mw-p mw-center">LOGGE UT?</p>
        <div class="mw-row mw-row--center">
          <button type="button" class="px-btn mw-btn mw-btn--plain mw-btn--big" :disabled="account.busy.value" @click="asking = false">NEI</button>
          <button type="button" class="px-btn mw-btn mw-btn--danger mw-btn--big" :disabled="account.busy.value" @click="logOut">
            {{ account.busy.value ? 'VENT …' : 'JA' }}
          </button>
        </div>
      </template>
      <p v-if="account.problem.value" class="mw-p mw-warn" role="alert">{{ account.problem.value }}</p>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import { useMw } from './context'
import { useAccount } from '~/composables/useAccount'
import { savesSettled } from '~/composables/useGameSave'
import { syncWallet } from '~/composables/useWallet'

const ctx = useMw()
const account = useAccount()
const asking = ref(false)
const who = computed(() => account.user.value?.name || account.user.value?.email || 'DEG')

/** The last save and the wallet go up first (they need the session), then the session ends. */
function logOut() {
  void account.logOut(async () => {
    ctx.game.flush()
    await savesSettled()
    await syncWallet()
  })
}
</script>

<style scoped>
.mw-set-who { overflow-wrap: anywhere; text-transform: none; font-family: var(--font-machine); font-size: 18px; }
</style>
