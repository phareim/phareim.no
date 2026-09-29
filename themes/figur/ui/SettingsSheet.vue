<template>
  <!-- Settings: who is making figures, and Logg ut. Two taps, so a small
    finger cannot log out by accident. -->
  <Sheet title="INNSTILLINGER" icon="gear" narrow @close="$emit('close')">
    <div class="fg-stack">
      <p class="fg-p fg-dim">DU ER LOGGET INN SOM</p>
      <p class="fg-h fg-set-who">{{ who }}</p>

      <template v-if="!asking">
        <button type="button" class="px-btn fg-btn fg-btn--plain fg-btn--wide" @click="asking = true">LOGG UT</button>
      </template>
      <template v-else>
        <p class="fg-p fg-set-center">LOGGE UT?</p>
        <div class="fg-row fg-row--center">
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-btn--big" :disabled="account.busy.value" @click="asking = false">NEI</button>
          <button type="button" class="px-btn fg-btn fg-btn--danger fg-btn--big" :disabled="account.busy.value" @click="logOut">
            {{ account.busy.value ? 'VENT …' : 'JA' }}
          </button>
        </div>
      </template>
      <p v-if="account.problem.value" class="fg-p fg-warn" role="alert">{{ account.problem.value }}</p>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import { useFigur } from '~/composables/useFigur'
import { useAccount } from '~/composables/useAccount'
import { savesSettled } from '~/composables/useGameSave'

defineEmits<{ close: [] }>()
const game = useFigur()
const account = useAccount()
const asking = ref(false)
const who = computed(() => account.user.value?.name || account.user.value?.email || 'DEG')

/** The last save goes up first (it needs the session), then the session ends. */
function logOut() {
  void account.logOut(async () => {
    game.flush()
    await savesSettled()
  })
}
</script>

<style scoped>
.fg-set-who { overflow-wrap: anywhere; text-transform: none; font-family: var(--font-machine); font-size: 18px; }
.fg-set-center { text-align: center; }
</style>
