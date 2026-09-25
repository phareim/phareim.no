<!-- Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync. -->
<template>
  <span class="pxt"><span aria-hidden="true"><template v-for="(part, i) in parts" :key="i"><svg
    v-if="part.glyph"
    class="pxt__g"
    viewBox="0 0 6 8"
    aria-hidden="true"
  ><path :d="part.glyph" /></svg><template v-else>{{ part.text }}</template></template></span><span class="pxt__sr">{{ text }}</span></span>
</template>

<script setup lang="ts">
/**
 * Text in the pixel font that keeps the few lower-case letters music needs.
 * The 5×7 font draws a–z as capitals, which turns Am7 into AM7 and Bb into
 * BB; here b d i j m s u a (flats, minor, maj, dim, sus, add) are drawn as
 * lower-case pixel glyphs in the font's own grid (5×7 on a 6×8 cell, one row
 * below the baseline), everything else is the font.
 */
import { computed } from 'vue'

const props = defineProps<{ text: string }>()

const ROWS: Record<string, string[]> = {
  a: ['.....', '.....', '.111.', '....1', '.1111', '1...1', '.1111'],
  b: ['1....', '1....', '1.11.', '11..1', '1...1', '1...1', '1111.'],
  d: ['....1', '....1', '.11.1', '1..11', '1...1', '1...1', '.1111'],
  i: ['..1..', '.....', '.11..', '..1..', '..1..', '..1..', '.111.'],
  j: ['.....', '...1.', '.....', '..11.', '...1.', '...1.', '1..1.', '.11..'],
  m: ['.....', '.....', '11.1.', '1.1.1', '1.1.1', '1.1.1', '1.1.1'],
  s: ['.....', '.....', '.1111', '1....', '.111.', '....1', '1111.'],
  u: ['.....', '.....', '1...1', '1...1', '1...1', '1..11', '.11.1'],
}

const PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(ROWS).map(([ch, rows]) => {
    let d = ''
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '1') d += `M${x} ${y}h1v1h-1z`
    })
    return [ch, d]
  }),
)

const parts = computed(() => {
  const out: Array<{ text?: string; glyph?: string }> = []
  for (const ch of props.text) {
    const g = PATHS[ch]
    if (g) out.push({ glyph: g })
    else if (out.length && out[out.length - 1]!.text !== undefined) out[out.length - 1]!.text += ch.toUpperCase()
    else out.push({ text: ch.toUpperCase() })
  }
  return out
})
</script>

<style scoped>
.pxt { position: relative; white-space: nowrap; }
.pxt__g {
  display: inline-block;
  width: 0.75em;
  height: 1em;
  /* The cell's bottom row is the font's one-pixel descent. */
  vertical-align: -0.125em;
  fill: currentColor;
  filter: drop-shadow(var(--pxt-shadow, 0.125em 0.125em 0 #0b0616));
  overflow: visible;
}
.pxt__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
