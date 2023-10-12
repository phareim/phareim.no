<template>
  <div @touchstart="animateText">
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
    }
  },
  methods: {
    animateText() {
      this.isTextAnimated = !this.isTextAnimated;
      this.textColor = this.randomColor();
      this.setRandomBgColor();  // Set a random background color
    },
    randomColor() {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    },
    setRandomBgColor() {
      const newColor = this.randomColor();
      document.body.style.backgroundColor = newColor;
      //document.body.style.transition = 'background-color 0.3s ease-in-out';  // Optional: Add transition

      const metaThemeColor = document.querySelector('meta[name=theme-color]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newColor);
      } else {
        const newMetaThemeColor = document.createElement('meta');
        newMetaThemeColor.name = 'theme-color';
        newMetaThemeColor.content = newColor;
        document.head.appendChild(newMetaThemeColor);
      }
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body, html {
  overflow: hidden;  /* Forhindrer scrolling */
  user-select: none;  /* Forhindrer tekstvalg */
}

div {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 95vh;
  margin: 0;
  padding: 0;
}

header {
  text-align: center;
  font-family: "Comfortaa", cursive;
}

h1 {
  font-size: 5em;
  font-weight: 300;
  margin: 0;
  padding: 0;
  transition: color 0.3s ease-in-out, transform 0.3s ease-in-out; /* beholder transition */
}

h1.animate {
  transform: scale(1.1); /* skalere tekst */
}
</style>
