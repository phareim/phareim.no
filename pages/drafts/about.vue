<template>
    <div class="about">
        <p class="scrolling-text">this is a pet project, written with love, spare time and a bit of AI. </p>
        <p class="centered">peace to the world. Free Palestine.</p>
    </div>
</template>

<style scoped>
.about {
  overflow: hidden;
}
p {
	font-size: 18em;
}

.scrolling-text {
width: 200%;
  display: inline-block;
  position: relative;
  animation: scroll 9s linear infinite;
}

.centered {
  text-align: center;
}

@keyframes scroll {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}
</style>