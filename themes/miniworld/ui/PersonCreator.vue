<template>
  <Sheet
    :title="isNew ? 'NY PERSON' : 'ENDRE PERSON'"
    icon="person"
    wide
    :closable="closable"
    @close="ctx.close()"
  >
    <div class="mw-maker">
      <div class="mw-maker-look">
        <div class="mw-maker-pic">
          <img v-if="portrait" :src="portrait" alt="">
        </div>
        <label class="mw-maker-name">
          <span class="mw-label">NAVN</span>
          <input
            ref="nameRef"
            v-model="name"
            class="mw-input"
            type="text"
            :maxlength="MAX_NAME"
            autocomplete="off"
            autocapitalize="words"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="done"
            placeholder="SKRIV HER"
            @keydown.enter.prevent="blurName"
            @focus="onFocus"
          >
        </label>
        <p v-if="nameProblem" class="mw-p mw-warn">{{ nameProblem }}</p>
      </div>

      <div class="mw-maker-opts">
        <div class="mw-tabs" role="tablist">
          <button
            v-for="t in TABS"
            :key="t.id"
            type="button"
            role="tab"
            class="px-btn mw-btn"
            :class="{ 'mw-on': tab === t.id }"
            :aria-selected="tab === t.id"
            @click="tab = t.id"
          >
            {{ t.name }}
          </button>
        </div>

        <div v-if="tab === 'skin'" class="mw-grid mw-grid--small">
          <button
            v-for="s in SKINS"
            :key="s.id"
            type="button"
            class="mw-tile mw-swatch"
            :class="{ 'mw-tile--on': body.skin === s.id }"
            :aria-label="`Hudfarge ${s.id}`"
            @click="set('skin', s.id)"
          >
            <span class="mw-swatch-fill" :style="{ background: s.color }" />
          </button>
        </div>

        <div v-else-if="tab === 'hair'" class="mw-grid">
          <button
            v-for="h in HAIR_STYLES"
            :key="h.id"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': body.hair === h.id }"
            @click="set('hair', h.id)"
          >
            <img v-if="head({ hair: h.id })" class="mw-pic" :src="head({ hair: h.id })" alt="">
            <span v-else class="mw-pic--empty" />
            <span class="mw-tile-name">{{ h.name }}</span>
          </button>
        </div>

        <div v-else-if="tab === 'color'" class="mw-grid mw-grid--small">
          <button
            v-for="h in HAIR_COLORS"
            :key="h.id"
            type="button"
            class="mw-tile mw-swatch"
            :class="{ 'mw-tile--on': body.hairColor === h.id }"
            :aria-label="h.name"
            @click="set('hairColor', h.id)"
          >
            <span class="mw-swatch-fill" :style="{ background: h.id === 'rainbow' ? rainbow : h.color }" />
            <span class="mw-tile-name">{{ h.name }}</span>
          </button>
        </div>

        <div v-else-if="tab === 'eyes'" class="mw-grid">
          <button
            v-for="e in EYES"
            :key="e.id"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': body.eyes === e.id }"
            @click="set('eyes', e.id)"
          >
            <img v-if="head({ eyes: e.id })" class="mw-pic" :src="head({ eyes: e.id })" alt="">
            <span v-else class="mw-pic--empty" />
            <span class="mw-tile-name">{{ e.name }}</span>
          </button>
        </div>

        <div v-else-if="tab === 'mouth'" class="mw-grid">
          <button
            v-for="m in MOUTHS"
            :key="m.id"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': body.mouth === m.id }"
            @click="set('mouth', m.id)"
          >
            <img v-if="head({ mouth: m.id })" class="mw-pic" :src="head({ mouth: m.id })" alt="">
            <span v-else class="mw-pic--empty" />
            <span class="mw-tile-name">{{ m.name }}</span>
          </button>
          <button
            v-for="c in [true, false]"
            :key="String(c)"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': body.cheeks === c }"
            @click="set('cheeks', c)"
          >
            <img v-if="head({ cheeks: c })" class="mw-pic" :src="head({ cheeks: c })" alt="">
            <span v-else class="mw-pic--empty" />
            <span class="mw-tile-name">{{ c ? 'ROSA KINN' : 'UTEN KINN' }}</span>
          </button>
        </div>

        <ClosetPicker v-else :outfit="outfit" :owned="ctx.game.save.value.closet" @pick="pickCloth" />
      </div>
    </div>

    <template #footer>
      <button type="button" class="px-btn mw-btn mw-btn--sky" @click="shuffle">BLAND</button>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="!clean" @click="done">
        {{ isNew ? 'LAG!' : 'FERDIG' }}
      </button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import Sheet from './Sheet.vue'
import ClosetPicker from './ClosetPicker.vue'
import { useMw } from './context'
import { SKINS, HAIR_STYLES, HAIR_COLORS, EYES, MOUTHS, RAINBOW, STARTER_OUTFIT, clothing } from '../catalog'
import { cleanName } from '../core/names'
import { MAX_NAME, type ClothingSlot, type Outfit, type PersonLook } from '../types'
import type { LookBody } from '~/composables/useMiniWorld'

const props = defineProps<{ personId: string | null }>()

const ctx = useMw()
const { game, pics } = ctx

const existing = computed(() => (props.personId ? game.save.value.persons.find(p => p.id === props.personId) ?? null : null))
const isNew = computed(() => !existing.value)
/** The very first person cannot be skipped. */
const closable = computed(() => game.save.value.persons.length > 0)

const DEFAULT_BODY: LookBody = { skin: 's2', hair: 'ponytail', hairColor: 'brown', eyes: 'big', mouth: 'smile', cheeks: true }

const start = existing.value?.look
const body = reactive<LookBody>(start
  ? { skin: start.skin, hair: start.hair, hairColor: start.hairColor, eyes: start.eyes, mouth: start.mouth, cheeks: start.cheeks }
  : { ...DEFAULT_BODY })
const outfit = reactive<Outfit>({ ...(start?.outfit ?? STARTER_OUTFIT) })
const name = ref(existing.value?.name ?? '')
const nameRef = ref<HTMLInputElement | null>(null)

type Tab = 'skin' | 'hair' | 'color' | 'eyes' | 'mouth' | 'clothes'
const TABS: { id: Tab; name: string }[] = [
  { id: 'skin', name: 'HUD' },
  { id: 'hair', name: 'HÅR' },
  { id: 'color', name: 'HÅRFARGE' },
  { id: 'eyes', name: 'ØYNE' },
  { id: 'mouth', name: 'MUNN' },
  { id: 'clothes', name: 'KLÆR' },
]
const tab = ref<Tab>('skin')

const rainbow = `linear-gradient(180deg, ${RAINBOW.map((c, i) => `${c} ${(i * 100) / RAINBOW.length}% ${((i + 1) * 100) / RAINBOW.length}%`).join(', ')})`

const look = computed<PersonLook>(() => ({ ...body, outfit: { ...outfit } }))
const portrait = computed(() => pics.person(look.value, { full: true, size: 320 }))
const head = (patch: Partial<LookBody>) => pics.person({ ...look.value, ...patch }, { size: 112 })

const clean = computed(() => cleanName(name.value))
const nameProblem = computed(() => {
  if (!name.value.trim()) return ''
  return clean.value ? '' : 'BARE BOKSTAVER, OPPTIL 12.'
})

function set<K extends keyof LookBody>(key: K, value: LookBody[K]) {
  body[key] = value
  ctx.sfx('click')
}

function pickCloth(slot: ClothingSlot, id: string | null) {
  outfit[slot] = id as never
  ctx.sfx('dress')
}

function shuffle() {
  const any = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!
  body.skin = any(SKINS).id
  body.hair = any(HAIR_STYLES).id
  body.hairColor = any(HAIR_COLORS).id
  body.eyes = any(EYES).id
  body.mouth = any(MOUTHS).id
  body.cheeks = Math.random() < 0.6
  ctx.sfx('click')
}

function blurName() {
  nameRef.value?.blur()
}

function onFocus() {
  // iOS: let the keyboard settle, then keep the field in the sheet's view.
  setTimeout(() => nameRef.value?.scrollIntoView({ block: 'center', behavior: 'auto' }), 250)
}

function done() {
  const n = clean.value
  if (!n) { nameRef.value?.focus(); return }
  let id = props.personId
  if (isNew.value) {
    const r = game.createPerson(n, { ...body })
    if (!r.ok) { ctx.say(r.message); return }
    id = game.active.value?.id ?? null
  } else {
    const r = game.updatePerson(props.personId!, { name: n, look: { ...body } })
    if (!r.ok) { ctx.say(r.message); return }
  }
  if (id) {
    const now = game.save.value.persons.find(p => p.id === id)?.look.outfit
    for (const slot of Object.keys(outfit) as ClothingSlot[]) {
      const want = outfit[slot]
      if (now && now[slot] !== want && (want === null || clothing(want))) game.dress(id, slot, want)
    }
  }
  ctx.sfx(isNew.value ? 'fanfare' : 'dress')
  if (isNew.value) ctx.cheer(`HEI, ${n}!`, pics.person(look.value, { full: true, size: 256, pose: 'wave' }))
  ctx.close()
}
</script>

<style scoped>
.mw-maker {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.mw-maker-opts { min-width: 0; }
.mw-maker-look {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  grid-template-areas: "pic name" "pic warn";
  align-items: center;
  column-gap: 16px;
}
.mw-maker-pic {
  grid-area: pic;
  width: 120px;
  height: 150px;
  background: var(--mw-tile);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
}
.mw-maker-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.mw-maker-name { grid-area: name; display: flex; flex-direction: column; min-width: 0; }
.mw-maker-look .mw-warn { grid-area: warn; }
.mw-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 56px;
  padding: 0 12px;
  border: 0;
  border-radius: 0;
  outline: none;
  font-family: var(--font-pixel);
  font-size: 24px;
  text-transform: uppercase;
  color: var(--mw-ink);
  background: var(--mw-tile);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
  -webkit-appearance: none;
  appearance: none;
  user-select: text;
  -webkit-user-select: text;
}
.mw-input:focus { background: var(--mw-yellow-soft); box-shadow: 0 -3px 0 0 var(--mw-pink), 0 3px 0 0 var(--mw-pink), -3px 0 0 0 var(--mw-pink), 3px 0 0 0 var(--mw-pink); }
.mw-input::placeholder { color: var(--mw-muted); }

.mw-swatch { padding: 6px; }
.mw-swatch-fill {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  max-width: 64px;
}

/* Wide sheets and landscape phones: the person on the left, options on the right. */
@media (min-width: 640px), (orientation: landscape) and (max-height: 500px) {
  .mw-maker { grid-template-columns: minmax(180px, 34%) minmax(0, 1fr); align-items: start; }
  .mw-maker-look {
    position: sticky;
    top: 0;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "pic" "name" "warn";
    row-gap: 10px;
  }
  .mw-maker-pic { width: 100%; height: auto; aspect-ratio: 4 / 5; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .mw-maker { grid-template-columns: 200px minmax(0, 1fr); }
  .mw-maker-pic { aspect-ratio: 1; max-height: 130px; }
  .mw-input { font-size: 16px; min-height: 48px; }
}
</style>
