<template>
  <div class="random-fact-container">
    <h1>Random Fact</h1>
    <p class="random-fact">{{ randomFact }}</p>
    <button class="random-fact-button" @click="getRandomFact">Get Random Fact</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const facts = ref([
    'The first computer program was written in 1843 by Ada Lovelace. 👩🏻‍💻',
    'The first computer was built in 1880 by Charles Babbage. 🤓',
    'Bananas are berries, but strawberries aren\'t! 🍌',
    'A group of flamingos is called a "flamboyance" - how fabulous! 💃',
    'Octopuses have three hearts and blue blood! 🐙💙',
    'Honey never spoils - archaeologists found edible honey in Egyptian tombs!',
    'A shrimp\'s heart is in its head! 🦐',
    'Wombat poop is cube-shaped! Perfect for stacking! 📦',
    'Penguins propose to their mates with pebbles! 🐧💍',
    'Sea otters hold hands while sleeping so they don\'t drift apart! 🦦',
    'Cats can\'t taste sweetness - they\'re missing that taste receptor! 🐱',
    'There are more possible chess games than atoms in the observable universe!'
  ])

const randomFact = ref(facts.value[Math.floor(Math.random() * facts.value.length)])

const getRandomFact = () => {
  randomFact.value = facts.value[Math.floor(Math.random() * facts.value.length)]
}

</script>

<style scoped>
h1 {
display: none;
}
.random-fact-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
}
.random-fact {
  font-size: 2.3rem;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  margin: 0;
}
.random-fact-button {
  background-color: #fff;
  color: #000;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 2rem;
}
.random-fact-button:hover {
  box-shadow: 0 0 10px rgba(200,200,200,0.8);
}
</style>