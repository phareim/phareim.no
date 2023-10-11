<template>
  <div>
    <header>
      <h1 contenteditable class="animate-text">build dab art</h1>
    </header>
    <footer></footer>
  </div>
</template>

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
h1.animate-text {
  font-size: 5em;
  font-weight: 300;
  margin: 0;
  padding: 0;
  transition: transform 0.3s ease-in-out, color 0.3s ease-in-out; /* legger til transition */
}

h1.animate-text:hover {
  transform: scale(1.1); /* skalere tekst når hover */
  color: #ff4500; /* endre tekstfarge når hover */
}
</style>