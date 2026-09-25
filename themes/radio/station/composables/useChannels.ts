// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Which channels show on the dial. Signed out, the choice lives in this
 * browser; signed in as a member, it lives on radio-api under your email
 * and follows you to every device (the server copy wins when the page
 * loads; every change is saved back).
 *
 * A hidden channel keeps playing if it is on; it just leaves the dial, the
 * number keys, ◀ ▶ and AUTO's choices.
 */
import { computed, ref } from 'vue'
import type { Landscape } from '../engine/types.ts'
import { load, save } from './storage'
import { useRadio } from './useRadio'

const HIDDEN_KEY = 'radio.hidden'

const hidden = ref<string[]>(load<string[]>(HIDDEN_KEY, []).filter(x => typeof x === 'string'))
let synced = false
let pushTimer: ReturnType<typeof setTimeout> | null = null

function persist(): void {
  save(HIDDEN_KEY, hidden.value)
  if (!synced) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    $fetch('/api/settings', { method: 'PUT', body: { hidden: hidden.value } }).catch(() => { /* next change retries */ })
  }, 600)
}

/** Members: take the server's copy, or seed it with this browser's. */
async function sync(): Promise<void> {
  try {
    const r = await $fetch<{ settings: { hidden: string[] } | null }>('/api/settings')
    synced = true
    if (r.settings) {
      hidden.value = r.settings.hidden
      save(HIDDEN_KEY, hidden.value)
    } else if (hidden.value.length) {
      persist()
    }
  } catch {
    /* offline or signed out: this browser's copy stands */
  }
}

function isHidden(id: string): boolean {
  return hidden.value.includes(id)
}

/** Show or hide one channel. The last visible one can't be hidden. */
function setShown(id: string, shown: boolean): boolean {
  if (shown) hidden.value = hidden.value.filter(x => x !== id)
  else {
    const { landscapes } = useRadio()
    const left = landscapes.value.filter(l => l.id !== id && !hidden.value.includes(l.id))
    if (!left.length) return false
    hidden.value = [...hidden.value, id]
  }
  persist()
  return true
}

const visible = computed<Landscape[]>(() => {
  const { landscapes } = useRadio()
  const list = landscapes.value.filter(l => !hidden.value.includes(l.id))
  return list.length ? list : landscapes.value
})

export function useChannels() {
  return { hidden, visible, isHidden, setShown, sync }
}
