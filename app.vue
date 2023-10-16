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

    }
  },
	created() {
  },
  methods: {
    dummyMethod() {
      
    }
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

h1.transition {
  transition: transform 0.6s ease-in-out, opacity 0.6s ease-in-out;
  opacity: 0.5;
}
</style>
