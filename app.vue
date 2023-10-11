<template>
  <div @touchstart="animateText">
    <header>
      <h1 :class="{ animate: isTextAnimated }">build bad art</h1>
    </header>
    <footer></footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isTextAnimated: false,
    }
  },
  methods: {
    animateText() {
      this.isTextAnimated = !this.isTextAnimated;
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");
div {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 95vh;
  margin: 0;
  padding: 0;
}
header {
  color: #333;
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
  color: #ff4500; /* endre tekstfarge */
  transform: scale(1.1); /* skalere tekst */
}
</style>