<template>
  <AlmanacFrame title="Playground" kicker="Toys, oddities, mostly-finished experiments.">
    <ul class="toys-list">
      <li>
        <NuxtLink to="/playground/terminal" class="toys-list__link">
          <span class="toys-list__title">Terminal</span>
          <span class="toys-list__desc">An in-browser terminal. Try `help`.</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/playground/morse" class="toys-list__link">
          <span class="toys-list__title">Morse</span>
          <span class="toys-list__desc">Text → dots and dashes, with Web Audio playback.</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/playground/launch" class="toys-list__link">
          <span class="toys-list__title">Launch</span>
          <span class="toys-list__desc">A rocket countdown with a Web Audio rumble at zero.</span>
        </NuxtLink>
      </li>
    </ul>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'Playground — phareim.no' })
</script>

<style scoped>
.toys-list { list-style: none; padding: 0; margin: 0; }
.toys-list li { padding: 1.25rem 0; border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.1)); }
.toys-list__link { display: flex; flex-direction: column; gap: 0.25rem; text-decoration: none; color: inherit; }
.toys-list__title { font-size: 1.25rem; letter-spacing: -0.005em; }
.toys-list__title:hover { color: var(--theme-accent, #c14a2a); }
.toys-list__desc { font-style: italic; color: var(--theme-ink-muted, #555); font-size: 0.9rem; }
</style>
