<template>
    <div class="about">
        <p class="scrolling-text">this is a pet project, written with love, spare time and a bit of AI. </p>
        <p class="scrolling-text">peace.</p>
    </div>
</template>

<style scoped>
.about {
  overflow: hidden;
}

.scrolling-text {
  display: inline-block;
  position: relative;
  animation: scroll 5s linear infinite;
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