<template>
  <!-- Owns the page: a sheet of paper lying on the desk. -->
  <div class="desk-landing">
    <div class="desk-sheet-stack desk-landing-stack">
      <article class="desk-sheet desk-landing-sheet">
        <header class="desk-landing-header">
          <span class="desk-landing-slug">— phareim.no</span>
          <span class="desk-label">father / husband / geek</span>
        </header>
        <hr class="desk-rule" />

        <div class="desk-landing-body">
          <ProfileCard :flipped="flipped" @flip="flipped = !flipped" />

          <h1 class="desk-landing-name">{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="desk-landing-blurb">{{ line }}</p>
          <p class="desk-label desk-landing-location">{{ profile.location }}</p>

          <div class="social-links desk-landing-socials">
            <SocialLink
              v-for="s in profile.socials"
              :key="s.type"
              :href="s.href"
              :type="s.type"
              :css-class="s.cssClass ?? ''"
            />
          </div>
        </div>

        <span class="desk-stamp desk-landing-stamp" aria-hidden="true">aspiring<br />good guy</span>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProfileCard from '~/themes/base/ProfileCard.vue'
import SocialLink from '~/themes/base/SocialLink.vue'
import { profile } from '~/themes/content'

const flipped = ref(false)
</script>

<style scoped>
.desk-landing {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(1rem, 3vw, 2.5rem);
  box-sizing: border-box;
  display: flex;
}

.desk-landing-stack {
  flex: 1;
  display: flex;
}

.desk-landing-sheet {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: clamp(1.25rem, 3vw, 2rem) clamp(1.25rem, 4vw, 2.5rem) 5rem;
  box-sizing: border-box;
}

.desk-landing-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 0.6rem;
  color: var(--theme-text, #111);
}

.desk-landing-slug {
  font-size: 1.05rem;
  font-weight: 600;
}

.desk-landing-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 0;
}

.desk-landing-name {
  font-size: clamp(2.2rem, 6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: 0.01em;
  margin: 1.25rem 0 0.5rem;
  color: var(--theme-text, #111);
}

.desk-landing-blurb {
  font-size: 1.125rem;
  line-height: 1.55;
  margin: 0.15rem 0;
  color: var(--desk-paper-ink-soft, #4a473f);
}

.desk-landing-location {
  margin: 0.9rem 0 1.25rem;
}

.desk-landing-stamp {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 3vw, 2rem);
}

@media (max-width: 480px) {
  .desk-landing-header {
    flex-direction: column;
    gap: 0.2rem;
  }
}
</style>
