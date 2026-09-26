<template>
  <!-- Six big letter boxes for a friend or neighbourhood code. One real
    input lies over them (so typing, deleting and pasting just work, also
    on a phone keyboard); the boxes show what is in it. -->
  <label class="mw-code" :class="{ 'mw-code--focus': focused }">
    <span class="mw-code-boxes" aria-hidden="true">
      <span
        v-for="i in CODE_LENGTH"
        :key="i"
        class="mw-code-box mw-t"
        :class="{ 'mw-code-box--next': focused && i - 1 === modelValue.length }"
      >{{ modelValue[i - 1] ?? '' }}</span>
    </span>
    <input
      class="mw-code-input"
      :value="modelValue"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="go"
      :maxlength="CODE_LENGTH + 2"
      :aria-label="label"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
      @keydown.enter.prevent="$emit('enter')"
    >
  </label>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CODE_ALPHABET, CODE_LENGTH } from '../core/names'

defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; enter: [] }>()

const focused = ref(false)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = el.value.toUpperCase().split('').filter(ch => CODE_ALPHABET.includes(ch)).join('').slice(0, CODE_LENGTH)
  el.value = clean
  emit('update:modelValue', clean)
}
</script>

<style scoped>
.mw-code {
  position: relative;
  display: inline-block;
  cursor: text;
}
.mw-code-boxes { display: flex; gap: 8px; }
.mw-code-box {
  width: 44px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: var(--mw-tile);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
}
.mw-code--focus .mw-code-box { background: var(--mw-yellow-soft); }
.mw-code-box--next {
  box-shadow:
    0 -3px 0 0 var(--mw-pink),
    0 3px 0 0 var(--mw-pink),
    -3px 0 0 0 var(--mw-pink),
    3px 0 0 0 var(--mw-pink);
}
.mw-code-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: 0;
  padding: 0;
  font-size: 16px;
  color: transparent;
  background: transparent;
  caret-color: transparent;
}
@media (max-width: 380px) {
  .mw-code-boxes { gap: 6px; }
  .mw-code-box { width: 38px; height: 50px; font-size: 24px; }
}
</style>
