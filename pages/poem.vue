<template>
  <div class="poem">
    <h1 v-html="randomPoem"></h1>
  </div>
</template>

<script>
export default {
  data() {
    return {
      poems: [
        'this is<br>a terrible<br>poem',
        'roses are red<br>violets are blue<br>sugar is sweet<br>and so are you',
        'twinkle twinkle<br>little star<br>how I wonder<br>what you are',
        // ... flere dikt ...
      ],
      randomPoem: '',
    };
  },
  mounted() {
    this.randomPoem = this.getRandomPoem();
  },
  methods: {
    getRandomPoem() {
      const randomIndex = Math.floor(Math.random() * this.poems.length);
      return this.poems[randomIndex];
    },
  },
};
</script>

<style>
  /* ... dine stiler ... */
</style>