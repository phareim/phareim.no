<template>
  <div class="character-page">
    <div class="character-container">
      <!-- Left side - Character Image -->
      <div class="character-image">
        <!-- White background during loading -->
        <img 
          v-if="currentState === 'loading'"
          :src="white_background" 
          alt="Loading..."
          class="portrait"
        />
        
        <!-- Walk-in video -->
        <video 
          v-if="currentState === 'walk_in' && character?.videoUrls?.walk_in"
          ref="walkInVideo"
          :src="character.videoUrls.walk_in"
          class="portrait"
          muted
          :poster="walkInPoster"
          @ended="onWalkInEnded"
          @loadeddata="onWalkInLoaded"
          @play="onWalkInPlay"
        />
        
        <!-- Static character image -->
        <img 
          v-if="currentState === 'image' || (currentState === 'walk_in' && !character?.videoUrls?.walk_in) || (currentState === 'idle_video' && !character?.videoUrls?.idle)"
          :src="character.imageUrl" 
          alt="Character Portrait"
          class="portrait"
        />
        
        <!-- Idle animation video -->
        <video 
          v-if="currentState === 'idle_video' && character?.videoUrls?.idle"
          ref="idleVideo"
          :src="character.videoUrls.idle"
          class="portrait"
          muted
          :poster="idlePoster"
          @ended="onIdleVideoEnded"
          @loadeddata="onIdleVideoLoaded"
        />
      </div>

      <!-- Right side - Character Details -->
      <div class="character-details">
        <div v-if="characterLoading" class="loading-state">
          <h1>Loading character data...</h1>
        </div>
        <div v-else-if="character" class="character-content">
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
  </div>
</template>

<script setup>
const white_background = "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/white.jpeg?alt=media&token=fb404268-e1e8-4a3a-a2d1-8d5995047dd3"
// Fetch character data from API
const character = ref(null)
const characterLoading = ref(true)

// Fetch character data on component mount
const fetchCharacterData = async () => {
  try {
    const data = await $fetch('/api/characters')
    // Get the second character (Joan Rover)
    if (data && data.length > 0) {
      character.value = data[2]
    }
  } catch (error) {
    console.error('Failed to fetch character data:', error)
    // Fallback to default character data if API fails
    character.value = {
      name: "Default Character",
      title: "Default Title",
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/iE2tXbWU13A-Zyy2hZaHh.jpeg?alt=media&token=a8418aa2-7bd4-44aa-a407-5eb7fdac901c",
      background: "A very boring character. I'm just filling this out to make it look like a real character.",
      stats: [
        { label: "Strength", value: "1" },
        { label: "Dexterity", value: "2" },
        { label: "Intelligence", value: "3" },
        { label: "Wisdom", value: "4" },
        { label: "Constitution", value: "5" },
        { label: "Charisma", value: "6" }
      ],
      videoUrls: {
        walk_in: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/blue-walk-in.mp4?alt=media&token=65556ebd-c13f-4d91-b920-2d0b2960bfcc",
        walk_out: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/blue-walk-out.mp4?alt=media&token=9b8a1b52-05b0-47e9-9546-434c83240e56",
        idle: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/kling_20250924_Image_to_Video_The_female_1510_0.mp4?alt=media&token=6f802422-ce5c-4896-a049-d8c68f86bbd7"
      },
      abilities: [
        {
          name: "build paper airplanes",
          description: "Not super useful, but it's a fun hobby."
        },
        {
          name: "play with cats",
          description: "Cats are great."
        }
      ]
    }
  } finally {
    characterLoading.value = false
  }
}

// State management for the sequence: loading -> walk_in -> image -> idle_video -> image (loop)
const currentState = ref('loading')
const walkInVideo = ref(null)
const idleVideo = ref(null)
const walkInPoster = ref('')
const idlePoster = ref('')
let idleTimer = null
let idleCycle = 10000

// Track loading status of all media
const mediaLoaded = ref({
  white_background: false,
  character_image: false,
  walk_in_video: false,
  idle_video: false
})

// Preload all media
const preloadMedia = async () => {
  // Wait for character data to be loaded first
  if (!character.value) return
  
  const promises = []
  
  // Preload white background
  promises.push(new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      mediaLoaded.value.white_background = true
      resolve()
    }
    img.src = white_background
  }))
  
  // Preload character image
  promises.push(new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      mediaLoaded.value.character_image = true
      resolve()
    }
    img.src = character.value.imageUrl
  }))
  
  // Preload walk-in video (only if available)
  if (character.value.videoUrls?.walk_in) {
    promises.push(new Promise((resolve) => {
      const video = document.createElement('video')
      video.oncanplaythrough = () => {
        mediaLoaded.value.walk_in_video = true
        resolve()
      }
      video.src = character.value.videoUrls.walk_in
      video.load()
    }))
  } else {
    mediaLoaded.value.walk_in_video = true // Mark as "loaded" since it doesn't exist
  }
  
  // Preload idle video (only if available)
  if (character.value.videoUrls?.idle) {
    promises.push(new Promise((resolve) => {
      const video = document.createElement('video')
      video.oncanplaythrough = () => {
        mediaLoaded.value.idle_video = true
        resolve()
      }
      video.src = character.value.videoUrls.idle
      video.load()
    }))
  } else {
    mediaLoaded.value.idle_video = true // Mark as "loaded" since it doesn't exist
  }
  
  // Wait for all media to load, then start the sequence
  await Promise.all(promises)
  startSequence()
}

// Start the complete sequence
const startSequence = () => {
  // Set initial posters - white background before playback
  walkInPoster.value = white_background
  idlePoster.value = character.value.imageUrl
  
  // If walk_in video exists, start with that, otherwise go straight to image
  if (character.value.videoUrls?.walk_in) {
    currentState.value = 'walk_in'
  } else {
    currentState.value = 'image'
    startIdleCycle()
  }
}

// Handle walk-in video events
const onWalkInLoaded = () => {
  if (walkInVideo.value) {
    walkInVideo.value.play()
  }
}

const onWalkInPlay = () => {
  // Switch poster to character image once playback starts to prevent flickering at the end
  walkInPoster.value = character.value.imageUrl
}

const onWalkInEnded = () => {
  currentState.value = 'image'
  startIdleCycle()
}

// Start the idle animation cycle
const startIdleCycle = () => {
  idleTimer = setTimeout(() => {
    // Only switch to idle_video if the video exists, otherwise stay on image
    if (character.value.videoUrls?.idle) {
      currentState.value = 'idle_video'
    } else {
      // If no idle video, just restart the cycle (stay on image)
      startIdleCycle()
    }
  }, idleCycle)
  idleCycle = Math.floor(Math.random() * 27000) + 3000
}

// Handle idle video events
const onIdleVideoLoaded = () => {
  if (idleVideo.value) {
    idleVideo.value.play()
  }
}

const onIdleVideoEnded = () => {
  currentState.value = 'image'
  startIdleCycle() // Restart the cycle
}

// Start fetching data and preloading when component mounts
onMounted(async () => {
  await fetchCharacterData()
  preloadMedia()
})

// Clean up timer when component unmounts
onUnmounted(() => {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
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
  border: 0px solid black;
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
