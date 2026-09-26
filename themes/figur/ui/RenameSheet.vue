<template>
  <!-- A new name for the figure: 1 to 16 letters. -->
  <Sheet title="NYTT NAVN" icon="pencil" narrow @close="$emit('close')">
    <form class="fg-stack" @submit.prevent="save">
      <input
        ref="inputRef"
        v-model="name"
        class="fg-input"
        type="text"
        maxlength="16"
        autocomplete="off"
        autocapitalize="words"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="done"
        aria-label="Navn"
      >
      <p v-if="problem" class="fg-p fg-warn">{{ problem }}</p>
      <div class="fg-row fg-row--end">
        <button type="button" class="px-btn fg-btn fg-btn--plain" @click="$emit('close')">
          <FgIcon id="close" :scale="2" />AVBRYT
        </button>
        <button type="submit" class="px-btn fg-btn fg-btn--go">
          <FgIcon id="check" :scale="2" />OK
        </button>
      </div>
    </form>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, watch } from 'vue'
import { useFigur } from '~/composables/useFigur'
import Sheet from './Sheet.vue'
import FgIcon from './FgIcon.vue'
import { FG_CTX } from './context'
import { typedName } from './board'

const emit = defineEmits<{ close: [] }>()
const game = useFigur()
const ctx = inject(FG_CTX)!
const name = ref(game.active.value.name)
const problem = ref('')
// Letters, digits, space and hyphen only: anything else is dropped as it is typed.
watch(name, (v) => { const t = typedName(v, 16); if (t !== v) name.value = t })
const inputRef = ref<HTMLInputElement | null>(null)

function save() {
  const r = game.rename(name.value)
  if (!r.ok) { problem.value = r.message; ctx.sfx('no'); return }
  ctx.sfx('sparkle')
  emit('close')
}

onMounted(() => {
  inputRef.value?.focus()
  inputRef.value?.select()
})
</script>
