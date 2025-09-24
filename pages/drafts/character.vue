<template>
  <div class="character-page">
    <div class="character-container">
      <!-- Left side - Character Image -->
      <div class="character-image">
        <img 
          :src="character.imageUrl" 
          alt="Character Portrait"
          class="portrait"
        />
      </div>

      <!-- Right side - Character Details -->
      <div class="character-details">
        <div class="character-header">
          <h1 class="character-name">{{ character.name }}</h1>
          <p class="character-title">{{ character.title }}</p>
        </div>

        <div class="character-background">
          <h2>Background</h2>
          <p>{{ character.background }}</p>
        </div>

        <div class="character-stats">
          <h2>Stats</h2>
          <div class="stats-grid">
            <div class="stat-item" v-for="stat in character.stats" :key="stat.label">
              <span class="stat-label">{{ stat.label }}</span>
              <span class="stat-value">{{ stat.value }}</span>
            </div>
          </div>
        </div>

        <div class="character-abilities">
          <h2>Special Abilities</h2>
          <ul>
            <li v-for="ability in character.abilities" :key="ability.name">
              <strong>{{ ability.name }}:</strong> {{ ability.description }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const character = ref({
  name: "Aria Shadowbane",
  title: "Elven Arcane Archer",
  imageUrl: "https://v3.fal.media/files/elephant/m3eBfNIauls4PL3p3f-Bm.jpeg",
  background: "Born in the mystical forests of Elderwood, Aria discovered her unique ability to infuse arrows with arcane energy at a young age. After her village was destroyed by dark forces, she dedicated her life to hunting down those who threaten the innocent. Her keen eyes and steady hands make her a formidable opponent from any distance.",
  stats: [
    { label: "Level", value: "12" },
    { label: "Health Points", value: "85/85" },
    { label: "Mana Points", value: "120/120" },
    { label: "Strength", value: "14" },
    { label: "Dexterity", value: "18" },
    { label: "Intelligence", value: "16" },
    { label: "Wisdom", value: "15" },
    { label: "Constitution", value: "13" },
    { label: "Charisma", value: "12" }
  ],
  abilities: [
    {
      name: "Arcane Shot",
      description: "Infuses arrows with magical energy for extra damage"
    },
    {
      name: "Eagle Eye",
      description: "Enhanced accuracy and critical hit chance"
    },
    {
      name: "Shadow Step",
      description: "Brief teleportation to avoid attacks"
    },
    {
      name: "Nature's Blessing",
      description: "Regenerates health slowly in natural environments"
    }
  ]
})
</script>

<style scoped>
.character-page {
  min-height: 100vh;
  background-color: white;
  color: black;
  font-family: 'Sublime Text', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  padding: 2rem;
}

.character-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 3rem;
  align-items: flex-start;
}

.character-image {
  flex: 0 0 300px;
}

.portrait {
  width: 100%;
  aspect-ratio: 9/16;
  object-fit: cover;
  border: 0px;
  background-color: white;
}

.character-details {
  flex: 1;
  max-width: 600px;
}

.character-header {
  margin-bottom: 2rem;
}

.character-name {
  font-size: 2.5rem;
  font-weight: bold;
  margin: 0 0 0.5rem 0;
  color: black;
}

.character-title {
  font-size: 1.2rem;
  margin: 0;
  font-style: italic;
  color: #333;
}

.character-background,
.character-stats,
.character-abilities {
  margin-bottom: 2rem;
}

.character-background h2,
.character-stats h2,
.character-abilities h2 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 0 1rem 0;
  color: black;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.5rem;
}

.character-background p {
  line-height: 1.6;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid #ddd;
  background-color: #f9f9f9;
}

.stat-label {
  font-weight: bold;
}

.stat-value {
  font-family: monospace;
  font-weight: bold;
}

.character-abilities ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.character-abilities li {
  margin-bottom: 0.8rem;
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-left: 3px solid black;
}

.character-abilities strong {
  color: black;
}

/* Responsive design */
@media (max-width: 768px) {
  .character-container {
    flex-direction: column;
    gap: 2rem;
  }
  
  .character-image {
    flex: none;
    max-width: 300px;
    margin: 0 auto;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .character-page {
    padding: 1rem;
  }
  
  .character-name {
    font-size: 2rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
