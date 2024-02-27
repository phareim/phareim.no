<template>
  <div>
    <NuxtPage />
    <MenuComponent />
  </div>
</template>

<script>
import MenuComponent from '~/components/MenuComponent.vue'

export default {
  components: {
    MenuComponent
  },
  data() {
    return {
      currentRouteIndex: 0, // Indeks for gjeldende rute
      startX: 0,  // Start X-koordinat for berøringen
      startY: 0,  // Start X-koordinat for berøringen
      menuOpen: false,  // Menyen er åpen eller lukket
    }
  },
  mounted() {
    // Sett gjeldende ruteindeks basert på gjeldende rute
    // this.currentRouteIndex = this.routes.findIndex(route => route.path === this.$route.path);
    // Legg til touch-begivenhetslyttere
    // this.$el.addEventListener('touchstart', this.handleTouchStart);
    // this.$el.addEventListener('touchend', this.handleTouchEnd);

    // document.addEventListener('keydown', this.handleKeyDown);
  },
  beforeDestroy() {
    // Fjern touch-begivenhetslyttere
    this.$el.removeEventListener('touchstart', this.handleTouchStart);
    this.$el.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('keydown', this.handleKeyDown);
  },
  computed: {
    routes() {
      // Filtrer ut alle ruter med en navn-egenskap
      return this.$router.options.routes.filter(route => route.name);
    },
  },
  created() {
  },
  methods: {
    dummyMethod() {
    },
    handleKeyDown(event) {
      if (event.key === 'm') {
        this.toggleMenu();
      }
    },
    toggleMenu() {
      this.menuOpen = !this.menuOpen;
      const menuElement = this.$refs.menu;
      if (this.menuOpen) {
        menuElement.style.transform = 'translateX(0%)';
      } else {
        menuElement.style.transform = 'translateX(100%)';
      }
    },
    handleTouchStart(event) {
      this.startX = event.touches[0].clientX;
      this.startY = event.touches[0].clientY;
    },
    handleTouchEnd(event) {
      const endX = event.changedTouches[0].clientX;
      const threshold = window.innerWidth / 4;  // Sveipeterskel, juster etter behov
      if (endX > this.startX + threshold && this.currentRouteIndex > 0) {
        // Sveipet til høyre
        // this.currentRouteIndex--;
      } else if (endX < this.startX - threshold && this.currentRouteIndex < this.routes.length - 1) {
        // Sveipet til venstre
        // this.currentRouteIndex++;
      }
      console.log(this.currentRouteIndex, this.routes[this.currentRouteIndex].path);
      this.$router.push(this.routes[this.currentRouteIndex].path);  // Naviger til den nye ruten
      this.$emit('swipe-event', event);  // Send eventet videre til den gjeldende komponenten
    },
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

.menu {
  position: fixed;
  top: 0;
  right: 0;
  width: 300px;
  /* Juster bredde etter behov */
  height: 100%;
  background-color: #f0f0f0;
  transform: translateX(100%);
  /* Start skjult */
  transition: transform 0.3s ease;
  /* Glatte overganger */
  z-index: 100;
  /* Sørg for at menyen ligger over andre elementer */
  /* Legg til mer styling etter behov */
}</style>
