<template>
    <NuxtPage />
</template>

<script>
export default {
  data() {
    return {
      currentRouteIndex: 0, // Indeks for gjeldende rute
      startX: 0,  // Start X-koordinat for berøringen
      startY: 0,  // Start X-koordinat for berøringen
    }
  },
  mounted() {
    // Sett gjeldende ruteindeks basert på gjeldende rute
    this.currentRouteIndex = this.routes.findIndex(route => route.path === this.$route.path);
    // Legg til touch-begivenhetslyttere
    this.$el.addEventListener('touchstart', this.handleTouchStart);
    this.$el.addEventListener('touchend', this.handleTouchEnd);
  },
  beforeDestroy() {
    // Fjern touch-begivenhetslyttere
    this.$el.removeEventListener('touchstart', this.handleTouchStart);
    this.$el.removeEventListener('touchend', this.handleTouchEnd);
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
      console.log(this.currentRouteIndex,this.routes[this.currentRouteIndex].path);
      this.$router.push(this.routes[this.currentRouteIndex].path);  // Naviger til den nye ruten
	    this.$emit('swipe-event', event);  // Send eventet videre til den gjeldende komponenten
},
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body, html {
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
  transition: color 0.8s ease-in-out, transform 0.4s ease-in-out; /* beholder transition */
}
footer {
  display: none;
}
</style>
