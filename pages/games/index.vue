<template>
  <AlmanacFrame title="Games" kicker="Things you can play." back="/">
    <ul class="games-list">
      <li>
        <NuxtLink to="/games/space-invaders" class="games-list__link">
          <span class="games-list__title">Space Invaders</span>
          <span class="games-list__desc">Arrows to move, space to fire. A first cut.</span>
        </NuxtLink>
      </li>
    </ul>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'Games — phareim.no' })
</script>

<style scoped>
.games-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.games-list li {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.1));
}
.games-list__link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-decoration: none;
  color: inherit;
}
.games-list__title {
  font-size: 1.25rem;
  letter-spacing: -0.005em;
}
.games-list__title:hover {
  color: var(--theme-accent, #c14a2a);
}
.games-list__desc {
  font-style: italic;
  color: var(--theme-ink-muted, #555);
  font-size: 0.9rem;
}
</style>
