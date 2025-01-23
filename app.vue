<template>
  <div>
    <NuxtPage />
    <MenuComponent ref="menuComponent" />
  </div>
</template>

<script>
import MenuComponent from '~/components/MenuComponent.vue'

export default {
  components: {
    MenuComponent
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeyDown);
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    handleKeyDown(event) {
      // Ignorer 'M'-tastetrykk på RPG-siden
      if (window.location.pathname.includes('/drafts/rpg')) {
        return;
      }
      if (event.key === 'm') {
        this.$refs.menuComponent.toggleMenu();
      }
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body,
html {
  overflow: hidden;
  user-select: none;
  font-family: "Comfortaa", sans-serif;
  padding: 0;
  margin: 0;
}

#app {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 100vh;
  margin: 0;
  padding: 0;
}

h1 {
  font-size: 4rem;
  font-weight: 500;
  margin: 0;
  padding: 0;
}
</style>
