<template>
  <div class="character-page" @scroll="handleScroll" ref="pageContainer">
    <!-- Parallax Background Image -->
    <div class="parallax-background" :style="{ transform: `translateY(${parallaxOffset}px)` }">
      <!-- White background during loading -->
      <img v-if="currentState === 'loading'" :src="white_background" alt="Loading..." class="bg-portrait" />

      <!-- Walk-in video -->
      <video v-if="currentState === 'walk_in' && character?.videoUrls?.walk_in" ref="walkInVideo"
        :src="character.videoUrls.walk_in" class="bg-portrait" muted :poster="walkInPoster" @ended="onWalkInEnded"
        @loadeddata="onWalkInLoaded" @play="onWalkInPlay" />

      <!-- Static character image -->
      <img
        v-if="currentState === 'image' || (currentState === 'walk_in' && !character?.videoUrls?.walk_in) || (currentState === 'idle_video' && !character?.videoUrls?.idle)"
        :src="character.imageUrl" alt="Character Portrait" class="bg-portrait" />

      <!-- Idle animation video -->
      <video v-if="currentState === 'idle_video' && character?.videoUrls?.idle" ref="idleVideo"
        :src="character.videoUrls.idle" class="bg-portrait" muted :poster="idlePoster" @ended="onIdleVideoEnded"
        @loadeddata="onIdleVideoLoaded" />

      <!-- Walk-out video -->
      <video v-if="currentState === 'walk_out' && character?.videoUrls?.walk_out" ref="walkOutVideo"
        :src="character.videoUrls.walk_out" class="bg-portrait" muted :poster="character.imageUrl"
        @ended="onWalkOutEnded" @loadeddata="onWalkOutLoaded" />

      <!-- Gradient overlay -->
      <div class="gradient-overlay"></div>
    </div>

    <!-- Character Details Overlay -->
    <div class="character-details">
      <div v-if="characterLoading" class="loading-state">
        <h1>Loading character data...</h1>
      </div>
      <div v-else-if="character" class="character-content">
        <div class="character-header">
          <div class="character-name-container">
            <button class="nav-chevron left-chevron" @click="previousCharacter"
              :disabled="characterLoading || isVideoPlaying">
              ‹
            </button>
            <h1 class="character-name">{{ character.name }}</h1>
            <button class="nav-chevron right-chevron" @click="nextCharacter"
              :disabled="characterLoading || isVideoPlaying">
              ›
            </button>
          </div>
          <p class="character-title">{{ character.title }}</p>
          <button v-if="canEdit" @click="editCharacter" class="edit-btn">
            ✏️ Edit Character
          </button>
        </div>

        <div class="character-background">
          <h2>Background</h2>
          <p>{{ character.background }}</p>
        </div>

        <div class="character-stats">
          <h2>Stats</h2>
          <div class="stats-grid">
            <div class="stat-item" v-for="stat in statsArray" :key="stat.label">
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
const white_background = "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/white.jpeg?alt=media&token=fb404268-e1e8-4a3a-a2d1-8d5995047dd3"

// Parallax scrolling
const parallaxOffset = ref(0)
const pageContainer = ref(null)

const handleScroll = (event) => {
  const scrollTop = event.target.scrollTop
  // Parallax effect: background moves upward slower (negative value makes it go up)
  parallaxOffset.value = -scrollTop * 0.3
}

// Fetch character data from API
const character = ref(null)
const characterLoading = ref(true)
const allCharacters = ref([])
const currentCharacterIndex = ref(0)

// Computed property to check if character can be edited (not hardcoded)
const canEdit = computed(() => {
  if (!character.value) return false
  // Hardcoded characters have these specific IDs
  const hardcodedIds = ['eddie', 'Joan-Rover', 'Yukiko-Kudou', 'aria-kling']
  return !hardcodedIds.includes(character.value.id)
})

// Computed property to convert stats object to array for display
const statsArray = computed(() => {
  if (!character.value?.stats) return []

  const stats = character.value.stats
  const order = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

  return order
    .filter(key => stats[key] !== undefined)
    .map(key => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: stats[key]
    }))
})

// Edit character function
const editCharacter = () => {
  if (!character.value || !character.value.id) return
  navigateTo(`/drafts/new-character?edit=${character.value.id}`)
}

// Fetch character data on component mount
const fetchCharacterData = async () => {
  try {
    const data = await $fetch('/api/characters')
    if (data && data.length > 0) {
      allCharacters.value = data
      currentCharacterIndex.value = 0
      character.value = data[0]
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

// Character navigation functions
const nextCharacter = async () => {
  if (allCharacters.value.length === 0 || isVideoPlaying.value) return

  // Clear any existing timers
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }

  // If walk_out video exists, play it first
  if (character.value?.videoUrls?.walk_out) {
    pendingNavigationAction = () => {
      // Move to next character (loop back to start if at end)
      currentCharacterIndex.value = (currentCharacterIndex.value + 1) % allCharacters.value.length
      character.value = allCharacters.value[currentCharacterIndex.value]
      executeCharacterChange()
    }
    currentState.value = 'walk_out'
  } else {
    // No walk_out video, change immediately
    characterLoading.value = true
    currentState.value = 'loading'

    // Move to next character (loop back to start if at end)
    currentCharacterIndex.value = (currentCharacterIndex.value + 1) % allCharacters.value.length
    character.value = allCharacters.value[currentCharacterIndex.value]

    characterLoading.value = false
    preloadMedia()
  }
}

const previousCharacter = async () => {
  if (allCharacters.value.length === 0 || isVideoPlaying.value) return

  // Clear any existing timers
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }

  // If walk_out video exists, play it first
  if (character.value?.videoUrls?.walk_out) {
    pendingNavigationAction = () => {
      // Move to previous character (loop back to end if at start)
      currentCharacterIndex.value = currentCharacterIndex.value === 0
        ? allCharacters.value.length - 1
        : currentCharacterIndex.value - 1
      character.value = allCharacters.value[currentCharacterIndex.value]
      executeCharacterChange()
    }
    currentState.value = 'walk_out'
  } else {
    // No walk_out video, change immediately
    characterLoading.value = true
    currentState.value = 'loading'

    // Move to previous character (loop back to end if at start)
    currentCharacterIndex.value = currentCharacterIndex.value === 0
      ? allCharacters.value.length - 1
      : currentCharacterIndex.value - 1
    character.value = allCharacters.value[currentCharacterIndex.value]

    characterLoading.value = false
    preloadMedia()
  }
}

// Execute the actual character change after walk_out finishes
const executeCharacterChange = () => {
  characterLoading.value = true
  currentState.value = 'loading'
  characterLoading.value = false
  preloadMedia()
}

// State management for the sequence: loading -> walk_in -> image -> idle_video -> walk_out -> image (loop)
const currentState = ref('loading')
const walkInVideo = ref(null)
const idleVideo = ref(null)
const walkOutVideo = ref(null)
const walkInPoster = ref('')
const idlePoster = ref('')
let idleTimer = null
let idleCycle = 10000

// Track if any video is currently playing (for button states)
const isVideoPlaying = computed(() => {
  return currentState.value === 'walk_in' || currentState.value === 'walk_out'
})

// Store the next character navigation action while walk_out plays
let pendingNavigationAction = null

// Track loading status of all media
const mediaLoaded = ref({
  white_background: false,
  character_image: false,
  walk_in_video: false,
  walk_out_video: false,
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

  // Preload walk-out video (only if available)
  if (character.value.videoUrls?.walk_out) {
    promises.push(new Promise((resolve) => {
      const video = document.createElement('video')
      video.oncanplaythrough = () => {
        mediaLoaded.value.walk_out_video = true
        resolve()
      }
      video.src = character.value.videoUrls.walk_out
      video.load()
    }))
  } else {
    mediaLoaded.value.walk_out_video = true // Mark as "loaded" since it doesn't exist
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
  // wait for 1 second
  setTimeout(() => {
    walkInPoster.value = character.value.imageUrl
  }, 1000)
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

// Handle walk-out video events
const onWalkOutLoaded = () => {
  if (walkOutVideo.value) {
    walkOutVideo.value.play()
  }
}

const onWalkOutEnded = () => {
  // Execute the pending navigation action
  if (pendingNavigationAction) {
    pendingNavigationAction()
    pendingNavigationAction = null
  }
}

// Start fetching data and preloading when component mounts
onMounted(async () => {
  await fetchCharacterData()
  preloadMedia()
  document.body.classList.add('scrollable');
})

// Clean up timer when component unmounts
onUnmounted(() => {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  document.body.classList.remove('scrollable');
})
</script>

<style scoped>
.character-page {
  /* CSS Variables for maintainability */
  --bg-color: #fff;
  --text-primary: #000;
  --text-secondary: rgba(0, 0, 0, 0.9);
  --text-tertiary: rgba(0, 0, 0, 0.8);

  /* Glass morphism opacity values */
  --opacity-header: 0.4;
  --opacity-header-hover: 0.65;
  --opacity-section: 0.3;
  --opacity-section-hover: 0.55;
  --opacity-card: 0.2;
  --opacity-card-hover: 0.5;
  --opacity-nav: 0.1;
  --opacity-nav-hover: 0.25;
  --opacity-border: 0.1;
  --opacity-border-nav: 0.2;
  --opacity-border-nav-hover: 0.4;

  /* Blur amounts */
  --blur-sm: 3px;
  --blur-md: 4px;
  --blur-lg: 5px;
  --blur-xl: 6px;
  --blur-nav: 10px;
  --blur-hover: 20px;

  /* Border radius */
  --radius-sm: 12px;
  --radius-md: 16px;

  /* Spacing */
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 2.5rem;

  /* Transitions */
  --transition-default: all 0.3s ease;

  /* Text shadows for readability */
  --shadow-text-strong: 0 0 16px rgba(0, 0, 0, 0.8), 0 2px 8px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.7);
  --shadow-text-medium: 0 0 8px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(255, 255, 255, 0.6), 1px 1px 1px rgba(255, 255, 255, 0.6);
  --shadow-text-light: 0 0 6px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(255, 255, 255, 0.6), 1px 1px 1px rgba(255, 255, 255, 0.6);
  --shadow-text-subtle: 0 0 4px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -0.5px -0.5px 1px rgba(255, 255, 255, 0.6), 0.5px 0.5px 1px rgba(255, 255, 255, 0.6);
  --shadow-text-minimal: 0 0 2px rgba(255, 255, 255, 0.8), 0 1px 2px rgba(255, 255, 255, 0.6);

  /* Box shadows */
  --shadow-box: 0 8px 32px rgba(200, 200, 200, 0.5);
  --shadow-box-dark: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-box-hover: 0 4px 16px rgba(0, 0, 0, 0.15);
  --shadow-box-nav: 0 4px 20px rgba(255, 255, 255, 0.2);

  /* Glass base color (for overlays) */
  --glass-base: 255, 255, 255;

  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-color);
  color: #fff;
  font-family: "Alan Sans", sans-serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  .character-page {
    --bg-color: #fff;
    --text-primary: #fff;
    --text-secondary: rgba(255, 255, 255, 0.9);
    --text-tertiary: rgba(255, 255, 255, 0.8);
    --glass-base: 0, 0, 0;
    --shadow-box: 0 8px 32px rgba(0, 0, 0, 0.8);
    --shadow-box-dark: 0 8px 32px rgba(0, 0, 0, 0.9);
    --shadow-box-hover: 0 4px 16px rgba(255, 255, 255, 0.1);
    --shadow-box-nav: 0 4px 20px rgba(0, 0, 0, 0.3);
    --opacity-border: 0.2;
  }
}

/* Parallax background */
.parallax-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 150vh;
  z-index: 1;
  will-change: transform;
  background: var(--bg-color);
}

.bg-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 15%;
  background: var(--bg-color);
}

.gradient-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60%;
  background: linear-gradient(to top,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.7) 30%,
      rgba(0, 0, 0, 0.3) 60%,
      transparent 100%);
  pointer-events: none;
}

.character-details {
  position: relative;
  z-index: 2;
  padding-top: 60vh;
  min-height: 150vh;
  padding-left: var(--spacing-lg);
  padding-right: var(--spacing-lg);
  padding-bottom: 4rem;
}

.character-header {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: rgba(var(--glass-base), var(--opacity-header));
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid rgba(var(--text-primary), var(--opacity-border));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-box);
  transition: var(--transition-default);
}

.character-header:hover {
  background: rgba(var(--glass-base), var(--opacity-header-hover));
  backdrop-filter: blur(var(--blur-xl));
}

.character-name-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.character-name {
  font-size: 3.5rem;
  font-weight: bold;
  margin: 0;
  color: #fff;
  flex: 1;
  text-align: center;
  text-shadow: var(--shadow-text-strong);
  letter-spacing: -0.02em;
}

.nav-chevron {
  background: rgba(var(--glass-base), var(--opacity-nav));
  backdrop-filter: blur(var(--blur-nav));
  border: 1px solid rgba(var(--glass-base), var(--opacity-border-nav));
  color: var(--text-primary);
  font-size: 2rem;
  font-weight: bold;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-default);
  font-family: "Alan Sans", sans-serif;
}

.nav-chevron:hover:not(:disabled) {
  background: rgba(var(--glass-base), var(--opacity-nav-hover));
  border-color: rgba(var(--glass-base), var(--opacity-border-nav-hover));
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--shadow-box-nav);
}

.nav-chevron:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.character-title {
  font-size: 1.5rem;
  margin: 0 0 var(--spacing-md) 0;
  font-style: italic;
  color: var(--text-secondary);
  text-align: center;
  text-shadow: var(--shadow-text-medium);
}

.edit-btn {
  background: rgba(var(--glass-base), var(--opacity-nav));
  backdrop-filter: blur(var(--blur-nav));
  border: 1px solid rgba(var(--text-primary), 0.3);
  color: var(--text-primary);
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: 1rem;
  font-weight: bold;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-default);
  font-family: "Alan Sans", sans-serif;
  display: block;
  margin: 0 auto;
  text-shadow: var(--shadow-text-subtle);
}

.edit-btn:hover {
  background: rgba(var(--glass-base), var(--opacity-nav-hover));
  border-color: rgba(var(--text-primary), 0.5);
  transform: translateY(-2px);
  box-shadow: var(--shadow-box-nav);
}

.character-background,
.character-stats,
.character-abilities {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: rgba(var(--glass-base), var(--opacity-section));
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid rgba(var(--text-primary), var(--opacity-border));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-box-dark);
  transition: var(--transition-default);
}

.character-background:hover,
.character-stats:hover,
.character-abilities:hover {
  background: rgba(var(--glass-base), var(--opacity-section-hover));
  backdrop-filter: blur(var(--blur-hover));
}

.character-background h2,
.character-stats h2,
.character-abilities h2 {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0 0 var(--spacing-md) 0;
  color: var(--text-primary);
  border-bottom: 2px solid rgba(0, 0, 0, 0.2);
  padding-bottom: var(--spacing-xs);
  text-shadow: var(--shadow-text-light);
}

.character-background p {
  line-height: 1.8;
  margin: 0;
  color: rgba(0, 0, 0, 0.95);
  font-size: 1.1rem;
  text-shadow: var(--shadow-text-subtle);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: rgba(var(--glass-base), var(--opacity-card));
  backdrop-filter: blur(var(--blur-sm));
  border: 1px solid rgba(var(--text-primary), var(--opacity-border));
  border-radius: var(--radius-sm);
  transition: var(--transition-default);
}

.stat-item:hover {
  background: rgba(var(--glass-base), var(--opacity-card-hover));
  backdrop-filter: blur(var(--blur-lg));
  transform: translateY(-2px);
  box-shadow: var(--shadow-box-hover);
}

.stat-label {
  font-weight: bold;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  text-shadow: var(--shadow-text-minimal);
}

.stat-value {
  font-family: "Alan Sans", sans-serif;
  font-weight: bold;
  color: var(--text-primary);
  font-size: 1.3rem;
  text-shadow: var(--shadow-text-subtle);
}

.character-abilities ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.character-abilities li {
  margin-bottom: var(--spacing-sm);
  padding: 1.25rem;
  background: rgba(var(--glass-base), var(--opacity-card));
  backdrop-filter: blur(var(--blur-sm));
  border: 1px solid rgba(var(--text-primary), var(--opacity-border));
  border-radius: var(--radius-sm);
  transition: var(--transition-default);
  color: var(--text-secondary);
  text-shadow: var(--shadow-text-minimal);
}

.character-abilities li:hover {
  background: rgba(var(--glass-base), var(--opacity-card-hover));
  backdrop-filter: blur(var(--blur-lg));
  transform: translateX(4px);
}

.character-abilities strong {
  color: var(--text-primary);
  text-shadow: var(--shadow-text-subtle);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.loading-state h1 {
  color: #fff;
  font-size: 2rem;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}

/* Responsive design */
@media (max-width: 768px) {
  .character-details {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }

  .character-name {
    font-size: 2.5rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .character-header,
  .character-background,
  .character-stats,
  .character-abilities {
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .character-name {
    font-size: 2rem;
  }

  .character-title {
    font-size: 1.1rem;
  }

  .nav-chevron {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .character-header,
  .character-background,
  .character-stats,
  .character-abilities {
    padding: 1.25rem;
  }
}

/* Note: padding values in responsive sections kept as hardcoded values
   since they don't match standard spacing scale */

/* Smooth scrollbar */
.character-page::-webkit-scrollbar {
  width: 10px;
}

.character-page::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.character-page::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
}

.character-page::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>
