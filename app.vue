<template>
  <div @touchstart="animateText" :style="{ backgroundColor: bgColor }">
    <header>
      <h1 :style="{ color: textColor }" :class="{ animate: isTextAnimated }">build bad art</h1>
    </header>
    <footer></footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isTextAnimated: false,
      textColor: '#333',  // Initial color
      bgColor: '#fff',  // Initial background color
    }
  },
  methods: {
    animateText() {
      this.isTextAnimated = !this.isTextAnimated;
      this.textColor = this.randomColor();
      this.bgColor = this.randomColor();  // Set a random background color
    },
    randomColor() {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body, html {
  overflow: hidden;  /* Forhindrer scrolling */
}

div {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 95vh;
  margin: 0;
  padding: 0;
  transition: background-color 0.3s ease-in-out;  /* legger til transition for bakgrunnsfarge */
}

/* ... resten av din eksisterende CSS-kode ... */
</style>
