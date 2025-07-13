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
  computed: {
    needsScrolling() {
      // Pages that need normal scrolling behavior
      const scrollablePages = [
        '/blog',
        '/rpg',
        '/drafts/about',
        '/drafts/places',
        '/drafts/image-generator'
      ]
      
      return scrollablePages.some(page => 
        this.$route.path.startsWith(page)
      )
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeyDown);
    this.applyScrollStyles();
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  },
  watch: {
    '$route'() {
      this.applyScrollStyles();
    }
  },
  methods: {
    applyScrollStyles() {
      // Apply overflow styles based on current page
      if (this.needsScrolling) {
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
      } else {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    },
    handleKeyDown(event) {
      // Ignorer 'M'-tastetrykk på RPG-siden
      if (event.key === 'm' && !window.location.pathname.includes('rpg') && !window.location.pathname.includes('image-generator')) {
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
  user-select: none;
  font-family: "Comfortaa", sans-serif;
  padding: 0;
  margin: 0;
}

/* Add a class for scrollable pages */
.scrollable-page {
  overflow: auto !important;
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
