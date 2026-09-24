<template>
  <main class="portal-landing">
    <Portal @moved="moved = true" />
    <p class="portal-hint" :class="{ 'portal-hint--gone': moved, 'portal-hint--touch': isTouch }" aria-hidden="true">
      {{ hint('ARROWS TO WALK · SPACE TO TALK', 'DRAG TO WALK · A TO TALK') }}
    </p>

    <!-- The town as plain HTML, for search engines and screen readers. Hidden
      until a keyboard user tabs into it; then it shows as a panel. -->
    <nav class="portal-index" aria-label="Petter Hareim">
      <h1>Petter Hareim</h1>
      <p v-for="b in blurbs" :key="b">{{ b }}</p>
      <h2>Games</h2>
      <ul>
        <li v-for="g in liveThemes" :key="g.id"><a :href="`/?theme=${g.id}`">{{ g.name }}</a></li>
      </ul>
      <h2>Writing and projects</h2>
      <ul>
        <li v-for="l in projects" :key="l.href"><a :href="l.href">{{ l.text }}</a></li>
      </ul>
      <h2>Elsewhere</h2>
      <ul>
        <li v-for="l in contacts" :key="l.href"><a :href="l.href" rel="me">{{ l.text }}</a></li>
      </ul>
    </nav>
  </main>
</template>

<script setup lang="ts">
/**
 * The Portal's page: the world fills the locked viewport, a hint says how
 * to walk until the first step, and a hidden index carries the same places
 * as real links. The links' addresses come from the world's exits, so the
 * town and the index cannot drift apart.
 */
import { profile } from '~/themes/content'
import { liveThemes } from '~/themes'
import Portal from './Portal.vue'
import { portalExits } from './world/index'

const { hint, isTouch } = useInputMode()
const moved = ref(false)

// Back from a game or a page: the visitor has walked here before, so no hint.
onMounted(() => {
  try { if (sessionStorage.getItem('portal.return')) moved.value = true } catch { /* keep the hint */ }
})

const blurbs = profile.blurbs.map(b => b.charAt(0).toUpperCase() + b.slice(1))

const NAMES: Record<string, string> = {
  kiosk: "phareim.md — Petter's writing",
  games: 'games.phareim.no — more games',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  bluesky: 'Bluesky',
}

const urlExits = portalExits().flatMap(e => ('url' in e.to ? [{ id: e.id, look: e.look, href: e.to.url, text: NAMES[e.id] ?? e.label ?? e.to.url }] : []))
const projects = urlExits.filter(e => e.look !== 'terminal')
const contacts = urlExits.filter(e => e.look === 'terminal')
</script>

<style>
.portal-landing {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
}

.portal-hint {
  position: absolute;
  left: 50%;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  z-index: 4;
  margin: 0;
  padding: 0.7em 1.1em;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--portal-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--portal-accent);
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.6);
  background: rgba(11, 6, 22, 0.72);
  border: 1px solid rgba(47, 243, 255, 0.3);
  border-radius: 4px;
  opacity: 0;
  animation: portal-hint-in 0.6s ease 0.8s forwards;
  transition: opacity 0.5s ease;
}

/* Clear of the A button. */
.portal-hint--touch {
  bottom: calc(124px + env(safe-area-inset-bottom, 0px));
}

.portal-hint--gone {
  animation: none;
  opacity: 0;
}

@keyframes portal-hint-in {
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .portal-hint { animation-duration: 0s; }
}

/* Visually hidden, until a keyboard user tabs into a link. */
.portal-index:not(:focus-within) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.portal-index:focus-within {
  position: absolute;
  z-index: 10;
  top: 16px;
  left: 16px;
  max-width: min(360px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 16px 20px;
  background: var(--theme-card-bg);
  border: 1px solid var(--theme-card-border);
  border-radius: var(--theme-card-radius);
  box-shadow: 0 12px 40px var(--theme-card-shadow);
  color: var(--theme-text);
  font-family: var(--theme-font-body);
  font-size: 14px;
  line-height: 1.5;
}

.portal-index h1 {
  margin: 0 0 0.4em;
  font-size: 20px;
  font-weight: 500;
}

.portal-index h2 {
  margin: 1em 0 0.3em;
  font-family: var(--portal-mono);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--theme-text-muted);
}

.portal-index p {
  margin: 0;
  color: var(--theme-text-muted);
}

.portal-index ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.portal-index a {
  color: var(--theme-accent);
  text-decoration: none;
}

.portal-index a:focus-visible {
  outline: 1px solid var(--theme-accent);
  outline-offset: 2px;
}
</style>
