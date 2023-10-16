<template>
  <div>
    <header>
    </header>
    <NuxtPage />
    <footer></footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      startX: 0,  // Start X-koordinat for berøringen
      startY: 0,  // Start X-koordinat for berøringen
    }
  },
  mounted() {
    // Legg til touch-begivenhetslyttere
    this.$el.addEventListener('touchstart', this.handleTouchStart);
    this.$el.addEventListener('touchend', this.handleTouchEnd);
  },
  beforeDestroy() {
    // Fjern touch-begivenhetslyttere
    this.$el.removeEventListener('touchstart', this.handleTouchStart);
    this.$el.removeEventListener('touchend', this.handleTouchEnd);
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
      if (endX > this.startX + threshold) {
        // Sveipet til høyre
        this.$nuxt.$router.push('/poem');  // Naviger til poem-siden
      } else if (endX < this.startX - threshold) {
        // Sveipet til venstre
        this.$nuxt.$router.push('/');  // Naviger til index-siden
      }
    },
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body, html {
  overflow: hidden;  /* Forhindrer scrolling */
  user-select: none;  /* Forhindrer tekstvalg */
  font-family: "Comfortaa", sans-serif;
}

div {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 95vh;
  margin: 0;
  padding: 0;
}

h1 {
  font-size: 4em;
  font-weight: 300;
  margin: 0;
  padding: 0;
  transition: color 0.8s ease-in-out, transform 0.4s ease-in-out; /* beholder transition */
}
</style>
