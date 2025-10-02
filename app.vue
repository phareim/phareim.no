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
      if (event.key === 'm' && !window.location.pathname.includes('rpg') 
      && !window.location.pathname.includes('image-generator') 
      && !window.location.pathname.includes('new-character')) {
        this.$refs.menuComponent.toggleMenu();
      }
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single+Ink:wght@100..900&display=swap");

body,
html {
  overflow: hidden;
  user-select: none;
  font-family: "Comfortaa", sans-serif;
  padding: 0;
  margin: 0;
}

body.scrollable,
html.scrollable {
  overflow: auto !important;
}

body.scrollable #app,
html.scrollable #app {
  display: block !important;
  height: auto !important;
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
