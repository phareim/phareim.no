<template>
  <Sheet title="VERKSTEDET" icon="sparkle" :bits="bits" wide @close="ctx.close()">
    <div class="mw-tabs" role="tablist">
      <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': tab === 'make' }" :aria-selected="tab === 'make'" @click="tab = 'make'">LAG MAGI</button>
      <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': tab === 'up' }" :aria-selected="tab === 'up'" @click="tab = 'up'">OPPGRADER</button>
    </div>

    <!-- Make a weapon -->
    <div v-if="tab === 'make'" class="mw-make">
      <div class="mw-make-preview">
        <div class="mw-make-pic"><img v-if="previewPic" :src="previewPic" alt=""></div>
        <p class="mw-h mw-center">{{ name }}</p>
        <p class="mw-price mw-big"><PxIcon id="coin" :scale="3" />{{ cost }}</p>
        <p v-if="short > 0" class="mw-p mw-warn mw-center">DU TRENGER {{ short }} BITS TIL.</p>
      </div>
      <div class="mw-make-parts">
        <p class="mw-label">1. HVA?</p>
        <div class="mw-grid mw-grid--small">
          <button
            v-for="b in WEAPON_BASES"
            :key="b.id"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': base === b.id }"
            @click="base = b.id; ctx.sfx('click')"
          >
            <img v-if="partPic(b.id, magic)" class="mw-pic" :src="partPic(b.id, magic)" alt="">
            <span v-else class="mw-pic--empty" />
            <span class="mw-tile-name">{{ shy(b.name) }}</span>
          </button>
        </div>
        <p class="mw-label">2. HVILKEN MAGI?</p>
        <div class="mw-grid mw-grid--small">
          <button
            v-for="m in WEAPON_MAGIC"
            :key="m.id"
            type="button"
            class="mw-tile"
            :class="{ 'mw-tile--on': magic === m.id }"
            @click="magic = m.id; ctx.sfx('click')"
          >
            <span class="mw-magic" aria-hidden="true">
              <span v-for="c in m.colors.slice(0, 3)" :key="c" :style="{ background: c }" />
            </span>
            <span class="mw-tile-name">{{ shy(m.name) }}</span>
          </button>
        </div>
        <p class="mw-label">3. HVILKEN FARGE?</p>
        <div class="mw-row">
          <button
            v-for="c in WEAPON_COLORS"
            :key="c"
            type="button"
            class="mw-tile mw-color"
            :class="{ 'mw-tile--on': color === c }"
            :aria-label="`Farge ${c}`"
            @click="color = c; ctx.sfx('click')"
          >
            <span :style="{ background: c }" />
          </button>
        </div>
      </div>
    </div>

    <!-- Upgrade -->
    <div v-else class="mw-stack">
      <p class="mw-p mw-dim">SKINNENDE ER NIVÅ 2. MAGISK ER NIVÅ 3.</p>
      <div v-if="upList.length" class="mw-grid">
        <div v-for="u in upList" :key="u.uid" class="mw-tile mw-tile--static">
          <img v-if="u.pic" class="mw-pic" :src="u.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(u.name) }}</span>
          <span class="mw-stars" :aria-label="`Nivå ${u.level}`">
            <PxIcon v-for="n in 3" :key="n" id="star" :scale="2" :grey="n > u.level" />
          </span>
          <button
            v-if="u.cost !== null"
            type="button"
            class="px-btn mw-btn mw-btn--go"
            :disabled="u.cost > bits"
            @click="upgrade(u.kind, u.uid)"
          >
            <PxIcon id="coin" :scale="2" />{{ u.cost }}
          </button>
          <span v-else class="mw-p">MAGISK!</span>
        </div>
      </div>
      <p v-else class="mw-p mw-dim mw-center">DU HAR INGENTING Å OPPGRADERE ENNÅ.</p>
    </div>

    <template v-if="tab === 'make'" #footer>
      <button v-if="madeUid" type="button" class="px-btn mw-btn mw-btn--sky" @click="hold">TA I HÅNDA</button>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="short > 0" @click="make">LAG!</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { shy } from './text'
import { ref, computed, watch } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { WEAPON_BASES, WEAPON_MAGIC, WEAPON_COLORS, furniture } from '../catalog'
import { weaponName } from '../core/names'
import type { Weapon, WeaponBaseId, WeaponMagicId } from '../types'

const ctx = useMw()
const { game, pics } = ctx

const tab = ref<'make' | 'up'>('make')
const bits = computed(() => game.bits.value)

// ---------------------------------------------------------------- make

const base = ref<WeaponBaseId>('wand')
const magic = ref<WeaponMagicId>('stars')
const color = ref<string>(WEAPON_COLORS[0]!)
const madeUid = ref<string | null>(null)

const name = computed(() => weaponName(base.value, magic.value))
const cost = computed(() => game.weaponCost(base.value, magic.value))
const short = computed(() => Math.max(0, cost.value - bits.value))

const draft = (b: WeaponBaseId, m: WeaponMagicId, c = color.value): Weapon =>
  ({ uid: 'preview', base: b, magic: m, color: c, level: 1, name: weaponName(b, m) })
const previewPic = computed(() => pics.weapon(draft(base.value, magic.value), 256))
const partPic = (b: WeaponBaseId, m: WeaponMagicId) => pics.weapon(draft(b, m), 96)

watch([base, magic, color], () => { madeUid.value = null })

function make() {
  const r = game.craftWeapon(base.value, magic.value, color.value)
  if (!r.ok) { ctx.sfx(r.error === 'poor' ? 'poor' : 'close'); ctx.say(r.message); return }
  ctx.sfx('upgrade')
  ctx.cheer(`${name.value}!`, previewPic.value)
  madeUid.value = r.uid ?? null
}

function hold() {
  if (!madeUid.value) return
  const r = game.equip(madeUid.value)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('equip')
  ctx.say('DEN ER I HÅNDA. TRYKK MAGI!')
  madeUid.value = null
}

// ---------------------------------------------------------------- upgrade

const upList = computed(() => {
  const s = game.save.value
  const things = s.furniture
    .filter(f => furniture(f.id)?.rarity === 'shop')
    .map(f => ({
      kind: 'furniture' as const, uid: f.uid, level: f.level,
      name: furniture(f.id)?.name ?? f.id,
      pic: pics.furniture(f.id, f.level, 96),
      cost: game.upgradeCost('furniture', f.uid),
    }))
  const weapons = s.weapons.map(w => ({
    kind: 'weapon' as const, uid: w.uid, level: w.level, name: w.name,
    pic: pics.weapon(w, 96),
    cost: game.upgradeCost('weapon', w.uid),
  }))
  return [...weapons, ...things].sort((a, b) => a.level - b.level)
})

function upgrade(kind: 'furniture' | 'weapon', uid: string) {
  const r = kind === 'furniture' ? game.upgradeFurniture(uid) : game.upgradeWeapon(uid)
  if (!r.ok) { ctx.sfx(r.error === 'poor' ? 'poor' : 'close'); ctx.say(r.message); return }
  ctx.sfx('upgrade')
  const s = game.save.value
  const f = s.furniture.find(x => x.uid === uid)
  const w = s.weapons.find(x => x.uid === uid)
  const level = f?.level ?? w?.level ?? 2
  const pic = f ? pics.furniture(f.id, f.level, 256) : w ? pics.weapon(w, 256) : ''
  ctx.cheer(level >= 3 ? 'MAGISK!' : 'SKINNENDE!', pic)
}
</script>

<style scoped>
.mw-make { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.mw-make-preview { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.mw-make-pic {
  width: 100%;
  max-width: 200px;
  aspect-ratio: 1;
  background: var(--mw-tile);
}
.mw-make-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
.mw-magic { display: flex; width: 100%; max-width: 64px; aspect-ratio: 1; }
.mw-magic span { flex: 1; }
.mw-root .mw-tile.mw-color { width: 56px; height: 56px; padding: 6px; }
.mw-color span { display: block; width: 100%; height: 100%; }
.mw-stars { display: flex; gap: 2px; }
.mw-root .mw-tile--static { cursor: default; }
@media (min-width: 640px), (orientation: landscape) and (max-height: 500px) {
  .mw-make { grid-template-columns: minmax(160px, 32%) minmax(0, 1fr); align-items: start; }
  .mw-make-preview { position: sticky; top: 0; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .mw-make-pic { max-width: 120px; }
}
</style>
