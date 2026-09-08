<template>
  <!-- Owns the page: one blueprint panel over the Neon Dreams horizon —
       who this is, and how to reach him. No game, so nothing locks the
       shell's navigation. -->
  <div class="p1-landing">
    <Horizon />

    <p class="p1-hud p1-hud--left">PLAYER 01</p>
    <p class="p1-hud p1-hud--right">PHAREIM.NO</p>

    <section class="p1-panel">
      <span class="p1-tick p1-tick--tl" aria-hidden="true" />
      <span class="p1-tick p1-tick--tr" aria-hidden="true" />
      <span class="p1-tick p1-tick--bl" aria-hidden="true" />
      <span class="p1-tick p1-tick--br" aria-hidden="true" />

      <ProfileCard class="p1-photo" :flipped="false" />

      <h1 class="p1-name">{{ profile.name }}</h1>
      <p v-for="line in profile.blurbs" :key="line" class="p1-blurb">{{ line }}</p>

      <div class="p1-rule" aria-hidden="true" />

      <p class="p1-coords">{{ profile.location }}</p>

      <p class="p1-label">CONTACT</p>
      <ul class="p1-contacts">
        <li v-for="c in contacts" :key="c.label">
          <a :href="c.href" target="_blank" rel="noopener noreferrer">
            <span class="p1-caret" aria-hidden="true">▶</span>
            <span class="p1-contact-label">{{ c.label }}</span>
            <span class="p1-handle">{{ c.handle }}</span>
          </a>
        </li>
      </ul>
    </section>

    <p class="p1-hint">◀ {{ hint('ARROWS FOR THE ARCADE', 'SWIPE FOR THE ARCADE') }} ▶</p>
  </div>
</template>

<script setup lang="ts">
import Horizon from './Horizon.vue'
import ProfileCard from '~/themes/base/ProfileCard.vue'
import { profile } from '~/themes/content'

const { hint } = useInputMode()

/** The three public channels. No address here on purpose. */
const contacts = [
  { label: 'LINKEDIN', handle: 'in/phareim', href: 'https://www.linkedin.com/in/phareim' },
  { label: 'GITHUB', handle: '@phareim', href: 'https://github.com/phareim' },
  { label: 'BLUESKY', handle: 'phareim.no', href: 'https://bsky.app/profile/phareim.no' },
]
</script>

<style scoped>
.p1-landing {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  touch-action: none;
  display: grid;
  place-items: center;
  padding: 12px;
  box-sizing: border-box;
}

/* The machine speaks: mono, uppercase, tracked. */
.p1-hud,
.p1-label,
.p1-coords,
.p1-contacts,
.p1-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  letter-spacing: .15em;
}

.p1-hud {
  position: absolute;
  z-index: 2;
  top: 16px;
  margin: 0;
  font-size: 10.4px;
  color: var(--p1-text-subtle);
}

.p1-hud--left { left: 18px; }
.p1-hud--right { right: 18px; }

/* Blueprint panel: near-black ground, cyan hairline, corner ticks. */
.p1-panel {
  position: relative;
  z-index: 2;
  width: min(420px, 100%);
  max-height: 100%;
  padding: 26px 24px 22px;
  box-sizing: border-box;
  text-align: center;
  background: var(--p1-card-bg);
  border: 1px solid rgba(47, 243, 255, .28);
  border-radius: 4px;
  box-shadow: 0 0 24px var(--p1-card-shadow);
}

.p1-tick {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 0 solid var(--p1-accent);
  opacity: .8;
}

.p1-tick--tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
.p1-tick--tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
.p1-tick--bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
.p1-tick--br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }

/* The person speaks: lowercase, light, no glow. */
.p1-photo,
.p1-photo :deep(.profile-pic) {
  width: 116px;
  height: 116px;
}

.p1-photo :deep(.profile-pic) {
  border: 2px solid var(--p1-accent);
  box-shadow: 0 0 18px rgba(47, 243, 255, .35);
}

.p1-name {
  margin: 14px 0 6px;
  font-size: 34px;
  font-weight: 300;
  line-height: 1.1;
}

.p1-blurb {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 300;
  color: var(--p1-text-muted);
}

.p1-rule {
  height: 1px;
  margin: 16px 0 14px;
  background: rgba(255, 47, 160, .25);
}

.p1-coords {
  margin: 0 0 18px;
  font-size: 10.4px;
  color: var(--p1-accent);
  text-shadow: 0 0 8px rgba(47, 243, 255, .65), 0 0 24px rgba(255, 47, 160, .35);
}

.p1-label {
  margin: 0 0 8px;
  font-size: 10.4px;
  color: var(--p1-text-subtle);
}

.p1-contacts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.p1-contacts a {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(255, 47, 160, .3);
  border-radius: 3px;
  color: var(--p1-text);
  text-decoration: none;
  font-size: 12px;
  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}

.p1-caret {
  color: var(--p1-pink);
  font-size: 10px;
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
}

.p1-contact-label { text-align: left; }

.p1-handle {
  color: var(--p1-text-subtle);
  letter-spacing: .1em;
  text-transform: none;
  font-size: 11.2px;
}

.p1-contacts a:hover,
.p1-contacts a:focus-visible {
  background: rgba(255, 47, 160, .12);
  border-color: var(--p1-pink);
  box-shadow: 0 0 18px rgba(255, 47, 160, .3);
  outline: none;
}

.p1-contacts a:active { transform: translateY(1px); }




.p1-hint {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 42px;
  margin: 0;
  text-align: center;
  font-size: 11.2px;
  letter-spacing: .12em;
  color: var(--p1-text-subtle);
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
}

/* Short viewports (landscape phones): photo beside the text, no hint. */
/* Wide screens: the panel sits left of centre, so the striped sun and the
   grid stay visible — the brand's profile-over-horizon layout. */
@media (min-width: 900px) and (min-height: 620px) {
  .p1-landing {
    justify-items: start;
    padding-left: clamp(48px, 10vw, 160px);
  }
}

/* Phones: leave room for the pager chevrons, and let the dots carry the
   "there is more" job — the hint would crowd the panel. */
@media (max-width: 640px), (max-height: 700px) {
  .p1-landing { padding: 10px 46px; }
  .p1-panel { padding: 18px 16px 16px; }
  .p1-photo, .p1-photo :deep(.profile-pic) { width: 96px; height: 96px; }
  .p1-name { margin-top: 10px; font-size: 28px; }
  .p1-blurb { font-size: 13px; }
  .p1-rule { margin: 12px 0 10px; }
  .p1-coords { margin-bottom: 12px; }
  .p1-hint { display: none; }
}

@media (max-height: 560px) {
  .p1-hud { display: none; }
  .p1-landing { padding: 8px 46px 26px; }
  .p1-panel {
    width: min(560px, 100%);
    display: grid;
    grid-template-columns: 116px 1fr;
    column-gap: 22px;
    text-align: left;
    padding: 16px 18px;
  }

  .p1-photo, .p1-photo :deep(.profile-pic) { width: 104px; height: 104px; }
  .p1-photo { grid-row: span 8; align-self: center; }
  .p1-name { margin-top: 0; font-size: 26px; }
  .p1-rule { margin: 10px 0; }
  .p1-coords { margin-bottom: 12px; }
  .p1-contacts a { min-height: 34px; }
  .p1-hint { display: none; }
}

@media (max-width: 380px) {
  .p1-name { font-size: 30px; }
}
</style>
