<template>
  <div class="character-page" @scroll="handleScroll" ref="pageContainer">
    <!-- Parallax Background Image -->
    <div class="parallax-background" :style="{ transform: `translateY(${parallaxOffset}px)` }">
      <img v-if="newCharacter.imageUrl" :src="newCharacter.imageUrl" alt="Character Portrait" class="bg-portrait" />
      <div v-else class="placeholder-background">
        <div class="upload-icon">🎭</div>
        <p>Generate a character to see the portrait</p>
      </div>
      <!-- Gradient overlay -->
      <div class="gradient-overlay"></div>
    </div>

    <!-- Character Creation Form Overlay -->
    <div class="character-details">
        <div class="character-content">
          <!-- Character Generation Section -->
          <div class="character-generation-section">
            <h2>Generate Character</h2>
            <div class="generation-options">
              <div class="option-row">
                <div class="gender-selection">
                  <label class="option-label">Gender:</label>
                  <select v-model="selectedGender" class="option-select">
                    <option value="">Any Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                  </select>
                </div>
                <div class="setting-selection">
                  <label class="option-label">Setting:</label>
                  <select v-model="selectedSetting" class="option-select">
                    <option v-for="setting in availableSettings" :key="setting.value" :value="setting.value">
                      {{ setting.icon }} {{ setting.title }}{{ setting.description ? ' - ' + setting.description : '' }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="option-row">
                <div class="class-selection">
                  <label class="option-label">Character Class:</label>
                  <select v-model="newCharacter.class" class="option-select">
                    <option v-for="characterClass in availableClasses" :key="characterClass.value" :value="characterClass.value">
                      {{ characterClass.icon }} {{ characterClass.title }}{{ characterClass.description ? ' - ' + characterClass.description : '' }}
                    </option>
                  </select>
                </div>
                <div class="style-selection">
                  <label class="option-label">Art Style:</label>
                  <select v-model="selectedStyle" class="option-select">
                    <option v-for="style in availableStyles" :key="style.value" :value="style.value">
                      {{ style.icon }} {{ style.title }}{{ style.description ? ' - ' + style.description : '' }}
                    </option>
                  </select>
                </div>
                <div class="emoji-selection">
                  <label class="option-label">Inspiration Emojis:</label>
                  <input v-model="selectedEmojis" placeholder="💚 🔮 🤖" class="emoji-input" maxlength="8" />
                </div>
                <div class="model-selection">
                  <label class="option-label">Image Model:</label>
                  <select v-model="selectedModel" class="option-select">
                    <option v-for="model in availableModels" :key="model.value" :value="model.value">
                      {{ model.icon }} {{ model.title }} - {{ model.description }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="generate-button-row">
                <button @click="generateCharacter" :disabled="isGenerating" class="generate-btn-top">
                  {{ isGenerating ? '🎭 Generating...' : '🎭 Generate Character' }}
                </button>
              </div>
            </div>
          </div>
          <div class="character-details-section" v-if="newCharacter.name">
            <div class="character-header">
              <div class="character-name-container">
                <h1 class="character-name">
                  <input v-model="newCharacter.name" placeholder="Character Name" class="name-input" maxlength="50" />
                </h1>
              </div>
              <input v-model="newCharacter.title" placeholder="Character Title" class="title-input" maxlength="100" />
            </div>

            <div class="character-background">
              <h2>Background</h2>
              <textarea v-model="newCharacter.background" placeholder="Write your character's background story..."
                class="background-textarea" rows="4" maxlength="500"></textarea>
            </div>

            <div class="character-physical-description">
              <h2>Physical Description</h2>
              <textarea v-model="newCharacter.physicalDescription"
                placeholder="Describe your character's appearance (hair, eyes, clothing, etc.). A portrait will be automatically generated if you provide a description."
                class="physical-description-textarea" rows="3" maxlength="300"></textarea>
              <div v-if="imageGenerationStatus" class="image-status">
                {{ imageGenerationStatus }}
              </div>
            </div>

            <div class="character-stats">
              <h2>Stats</h2>
              <div class="stats-grid">
                <div class="stat-item" v-for="stat in newCharacter.stats" :key="stat.label">
                  <span class="stat-label">{{ stat.label }}</span>
                  <input v-model="stat.value" type="number" min="1" max="20" class="stat-input" />
                </div>
              </div>
              <button @click="generateRandomStats" class="random-stats-btn">
                🎲 Generate Random Stats
              </button>
            </div>

            <div class="character-abilities">
              <h2>Special Abilities</h2>
              <div class="abilities-list">
                <div v-for="(ability, index) in newCharacter.abilities" :key="index" class="ability-item">
                  <input v-model="ability.name" placeholder="Ability Name" class="ability-name-input" maxlength="50" />
                  <input v-model="ability.description" placeholder="Ability Description" class="ability-desc-input"
                    maxlength="150" />
                  <button @click="removeAbility(index)" class="remove-ability-btn">×</button>
                </div>
              </div>
              <button @click="addAbility" class="add-ability-btn">+ Add Ability</button>
            </div>

            <div class="character-actions">
              <button @click="createCharacter" :disabled="!canCreate || isCreating" class="create-btn">
                {{
                  isCreating
                    ? (newCharacter.physicalDescription?.trim() && !newCharacter.imageUrl ? 'Saving & Generating Image...' :
                      'Saving...')
                    : 'Save Character'
                }}
              </button>
              <button v-if="newCharacter.physicalDescription && !isGeneratingImage" @click="generateImage" class="regenerate-image-btn">
                {{ newCharacter.imageUrl ? '🔄 Regenerate Image' : '🎨 Generate Image' }}
              </button>
              <button @click="previewCharacter" class="preview-btn">
                👁️ Preview
              </button>
              <button @click="resetForm" class="reset-btn">
                🔄 Reset Form
              </button>
            </div>
            <div v-if="isGeneratingImage" class="image-loading">
              <div class="spinner"></div>
              <p>Generating image...</p>
            </div>
          </div>
        </div>
      </div>

    <!-- Success/Error Messages -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
// Parallax scrolling
const parallaxOffset = ref(0)
const pageContainer = ref(null)

const handleScroll = (event) => {
  const scrollTop = event.target.scrollTop
  // Parallax effect: background moves upward slower
  parallaxOffset.value = -scrollTop * 0.3
}

const newCharacter = ref({
  name: '',
  title: '',
  class: '',
  imageUrl: '',
  background: '',
  physicalDescription: '',
  stats: [
    { label: 'Strength', value: '10' },
    { label: 'Dexterity', value: '10' },
    { label: 'Intelligence', value: '10' },
    { label: 'Wisdom', value: '10' },
    { label: 'Constitution', value: '10' },
    { label: 'Charisma', value: '10' }
  ],
  abilities: [
    { name: '', description: '' },
    { name: '', description: '' }
  ]
})

const isCreating = ref(false)
const isGenerating = ref(false)
const isGeneratingImage = ref(false)
const message = ref('')
const messageType = ref('success')
const imageGenerationStatus = ref('')
const selectedGender = ref('')
const selectedSetting = ref('')
const selectedStyle = ref('')
const selectedEmojis = ref('')
const selectedModel = ref('srpo')
const availableModels = ref([])
const availableStyles = ref([])
const availableSettings = ref([])
const availableClasses = ref([])

// Computed property to check if character can be created
const canCreate = computed(() => {
  return newCharacter.value.name.trim().length > 0 &&
    newCharacter.value.title.trim().length > 0
})

// Fetch available AI models and character styles
const fetchAIModels = async () => {
  try {
    const models = await $fetch('/api/ai-models')
    availableModels.value = models
  } catch (error) {
    console.error('Failed to fetch AI models:', error)
    // Fallback to default models
    availableModels.value = [
      { value: 'srpo', title: 'SRPO (Flux-1)', icon: '🎨', description: 'Realistic' },
      { value: 'wan', title: 'WAN-25', icon: '🚀', description: 'Artistic' },
      { value: 'ideogram', title: 'Ideogram', icon: '🖼️', description: 'Text-aware' },
      { value: 'hidream', title: 'HiDream', icon: '✨', description: 'Smooth' }
    ]
  }
}

const fetchCharacterStyles = async () => {
  try {
    const styles = await $fetch('/api/character-styles')
    availableStyles.value = styles
  } catch (error) {
    console.error('Failed to fetch character styles:', error)
    // Fallback to default styles
    availableStyles.value = [
      { value: '', title: 'Default Style', icon: '', description: '' },
      { value: 'disney', title: 'Disney', icon: '🏰', description: 'Colorful and whimsical' },
      { value: 'digital', title: 'Digital', icon: '💻', description: 'Cyberpunk and futuristic' },
      { value: 'heavy-metal', title: 'Heavy Metal', icon: '🤘', description: 'Dark and intense' }
    ]
  }
}

const fetchCharacterSettings = async () => {
  try {
    const settings = await $fetch('/api/character-settings')
    availableSettings.value = settings
  } catch (error) {
    console.error('Failed to fetch character settings:', error)
    // Fallback to default settings
    availableSettings.value = [
      { value: '', title: 'Fantasy', icon: '🏰', description: 'Classic fantasy setting' },
      { value: 'cyberpunk', title: 'Cyberpunk', icon: '🤖', description: 'High-tech dystopian future' },
      { value: 'steampunk', title: 'Steampunk', icon: '⚙️', description: 'Victorian era with steam technology' },
      { value: 'post-apocalyptic', title: 'Post-Apocalyptic', icon: '☢️', description: 'World after civilization collapse' },
      { value: 'space-opera', title: 'Space Opera', icon: '🚀', description: 'Epic space adventures' },
      { value: 'medieval', title: 'Medieval', icon: '⚔️', description: 'Classic medieval period' },
      { value: 'modern-urban', title: 'Modern Urban', icon: '🏙️', description: 'Contemporary city setting' },
      { value: 'victorian', title: 'Victorian', icon: '🎩', description: '19th century Victorian era' },
      { value: 'wild-west', title: 'Wild West', icon: '🤠', description: 'American frontier period' },
      { value: 'pirate', title: 'Pirate', icon: '🏴‍☠️', description: 'Golden age of piracy' },
      { value: 'superhero', title: 'Superhero', icon: '🦸', description: 'Superhero universe' }
    ]
  }
}

const fetchCharacterClasses = async () => {
  try {
    const classes = await $fetch('/api/character-classes')
    availableClasses.value = classes
  } catch (error) {
    console.error('Failed to fetch character classes:', error)
    // Fallback to default classes
    availableClasses.value = [
      { value: '', title: 'Any Class', icon: '🎭', description: 'No specific class' },
      { value: 'warrior', title: 'Warrior', icon: '🗡️', description: 'Melee combat specialist' },
      { value: 'mage', title: 'Mage', icon: '🔮', description: 'Arcane magic user' },
      { value: 'rogue', title: 'Rogue', icon: '🗡️', description: 'Stealth and precision fighter' },
      { value: 'cleric', title: 'Cleric', icon: '⚡', description: 'Divine magic and healing' },
      { value: 'ranger', title: 'Ranger', icon: '🏹', description: 'Wilderness guardian and archer' },
      { value: 'paladin', title: 'Paladin', icon: '⚔️', description: 'Holy warrior and protector' },
      { value: 'barbarian', title: 'Barbarian', icon: '🪓', description: 'Fierce berserker warrior' },
      { value: 'bard', title: 'Bard', icon: '🎵', description: 'Charismatic performer and support' },
      { value: 'druid', title: 'Druid', icon: '🌿', description: 'Nature mystic and shapeshifter' },
      { value: 'sorcerer', title: 'Sorcerer', icon: '✨', description: 'Innate magic wielder' },
      { value: 'warlock', title: 'Warlock', icon: '🔥', description: 'Pact-bound magic user' },
      { value: 'wizard', title: 'Wizard', icon: '📚', description: 'Scholarly magic practitioner' },
      { value: 'monk', title: 'Monk', icon: '👊', description: 'Martial arts and spiritual discipline' },
      { value: 'artificer', title: 'Artificer', icon: '⚙️', description: 'Magical inventor and engineer' },
      { value: 'gunslinger', title: 'Gunslinger', icon: '🔫', description: 'Firearm expert and marksman' },
      { value: 'pilot', title: 'Pilot', icon: '🚀', description: 'Vehicle operator and navigator' },
      { value: 'hacker', title: 'Hacker', icon: '💻', description: 'Digital infiltrator and tech expert' },
      { value: 'medic', title: 'Medic', icon: '🏥', description: 'Battlefield healer and medical expert' },
      { value: 'engineer', title: 'Engineer', icon: '🔧', description: 'Technical expert and builder' },
      { value: 'scout', title: 'Scout', icon: '🔍', description: 'Reconnaissance and stealth specialist' }
    ]
  }
}


// Generate random stats (4d6 drop lowest method)
const generateRandomStats = () => {
  const rollStat = () => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
    rolls.sort((a, b) => b - a)
    return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0)
  }

  newCharacter.value.stats.forEach(stat => {
    stat.value = rollStat().toString()
  })
}

// Add/remove abilities
const addAbility = () => {
  newCharacter.value.abilities.push({ name: '', description: '' })
}

const removeAbility = (index) => {
  if (newCharacter.value.abilities.length > 1) {
    newCharacter.value.abilities.splice(index, 1)
  }
}

// Create character
const createCharacter = async () => {
  if (!canCreate.value) return

  isCreating.value = true
  message.value = ''
  imageGenerationStatus.value = ''

  try {
    const characterData = newCharacter.value;

    // Add image generation parameters if physical description is provided and no image exists yet
    const hasPhysicalDescription = newCharacter.value.physicalDescription?.trim()
    const needsImageGeneration = hasPhysicalDescription && !newCharacter.value.imageUrl
    if (needsImageGeneration) {
      characterData.generateImage = true
      characterData.imagePrompt = newCharacter.value.physicalDescription
      imageGenerationStatus.value = '🎨 Generating character portrait...'
    }

    const response = await $fetch('/api/characters', {
      method: 'POST',
      body: characterData
    })

    if (response.error) {
      throw new Error(response.error)
    }

    let successMessage = `Character "${newCharacter.value.name}" saved successfully!`
    if (needsImageGeneration && response.imageUrl) {
      successMessage += ' Portrait generated! 🎨'
      imageGenerationStatus.value = '✨ Portrait generated successfully!'
      // Update the local character image URL for preview
      newCharacter.value.imageUrl = response.imageUrl
    } else if (needsImageGeneration) {
      imageGenerationStatus.value = '⚠️ Character saved, but portrait generation failed'
    }

    message.value = successMessage
    messageType.value = 'success'

    // Reset form after successful creation
    setTimeout(() => {
      resetForm()
    }, 3000)

  } catch (error) {
    console.error('Failed to save character:', error)
    message.value = 'Failed to save character. Please try again.'
    messageType.value = 'error'
    imageGenerationStatus.value = ''
  } finally {
    isCreating.value = false
  }
}

// Preview character (navigate to character page)
const previewCharacter = () => {
  // Store character data temporarily for preview
  sessionStorage.setItem('previewCharacter', JSON.stringify(newCharacter.value))
  navigateTo('/drafts/character?preview=true')
}

// Reset form
const resetForm = () => {
  newCharacter.value = {
    name: '',
    title: '',
    class: '',
    background: '',
    physicalDescription: '',
    imageUrl: '',
    stats: [
      { label: 'Strength', value: '10' },
      { label: 'Dexterity', value: '10' },
      { label: 'Intelligence', value: '10' },
      { label: 'Wisdom', value: '10' },
      { label: 'Constitution', value: '10' },
      { label: 'Charisma', value: '10' }
    ],
    abilities: [
      { name: '', description: '' },
      { name: '', description: '' }
    ]
  }
  message.value = ''
  imageGenerationStatus.value = ''
  isGenerating.value = false
  isGeneratingImage.value = false
  selectedGender.value = ''
  selectedSetting.value = ''
  selectedStyle.value = ''
  selectedEmojis.value = ''
  selectedModel.value = 'srpo'
}

// Generate character using GPT-5
const generateCharacter = async () => {
  isGenerating.value = true
  message.value = ''

  try {
    const response = await $fetch('/api/characters/generate', {
      method: 'POST',
      body: {
        gender: selectedGender.value,
        setting: selectedSetting.value,
        style: selectedStyle.value,
        emojis: selectedEmojis.value,
        characterClass: newCharacter.value.class,
        model: selectedModel.value
      }
    })

    if (response.success && response.character) {
      const generated = response.character
      newCharacter.value.name = generated.name
      newCharacter.value.title = generated.title
      // Keep the selected class from the dropdown
      // newCharacter.value.class is already set from the dropdown selection
      newCharacter.value.background = generated.background
      newCharacter.value.physicalDescription = generated.physicalDescription

      // Update stats if generated (convert from D&D format to our label/value format)
      if (generated.stats) {
        newCharacter.value.stats = [
          { label: 'Strength', value: generated.stats.strength?.toString() || '10' },
          { label: 'Dexterity', value: generated.stats.dexterity?.toString() || '10' },
          { label: 'Intelligence', value: generated.stats.intelligence?.toString() || '10' },
          { label: 'Wisdom', value: generated.stats.wisdom?.toString() || '10' },
          { label: 'Constitution', value: generated.stats.constitution?.toString() || '10' },
          { label: 'Charisma', value: generated.stats.charisma?.toString() || '10' }
        ]
      }

      // Update abilities if generated
      if (generated.abilities && generated.abilities.length >= 2) {
        newCharacter.value.abilities = [
          {
            name: generated.abilities[0].name || '',
            description: generated.abilities[0].description || ''
          },
          {
            name: generated.abilities[1].name || '',
            description: generated.abilities[1].description || ''
          }
        ]
      }

      message.value = 'Complete character generated with stats and abilities! 🎭✨'
      messageType.value = 'success'

      // Auto-generate image if physical description is provided
      if (generated.physicalDescription) {
        await generateImage()
      }
    }
  } catch (error) {
    console.error('Failed to generate character:', error)
    message.value = 'Failed to generate character. Please try again.'
    messageType.value = 'error'
  } finally {
    isGenerating.value = false
  }
}

// Generate character image
const generateImage = async () => {
  if (!newCharacter.value.physicalDescription?.trim()) {
    message.value = 'Please provide a physical description first.'
    messageType.value = 'error'
    return
  }
  
  isGeneratingImage.value = true
  imageGenerationStatus.value = '🎨 Generating character portrait...'
  
  try {
    const requestBody = {
      prompt: newCharacter.value.physicalDescription,
      characterName: newCharacter.value.name,
      characterTitle: newCharacter.value.title,
      characterBackground: newCharacter.value.background,
      gender: selectedGender.value,
      setting: selectedSetting.value,
      emojis: selectedEmojis.value,
      characterId: 'preview',
      style: selectedStyle.value,
      model: selectedModel.value
    }
    
    const response = await $fetch('/api/characters/generate-image', {
      method: 'POST',
      body: requestBody
    })
    if (response.success && response.imageUrl) {
      newCharacter.value.imageUrl = response.imageUrl
      imageGenerationStatus.value = '✨ Portrait generated successfully!'
      message.value = 'Character image generated! 🎨'
      messageType.value = 'success'
    }
  } catch (error) {
    console.error('Failed to generate image:', error)
    imageGenerationStatus.value = '⚠️ Image generation failed'
    message.value = 'Failed to generate image. Please try again.'
    messageType.value = 'error'
  } finally {
    isGeneratingImage.value = false
    setTimeout(() => {
      imageGenerationStatus.value = ''
    }, 3000)
  }
}

// Clear message after 5 seconds
watch(message, (newMessage) => {
  if (newMessage) {
    setTimeout(() => {
      message.value = ''
    }, 5000)
  }
})

// Fetch AI models, styles, settings, and classes when component mounts
onMounted(() => {
  document.body.classList.add('scrollable');
  fetchAIModels()
  fetchCharacterStyles()
  fetchCharacterSettings()
  fetchCharacterClasses()
})

onUnmounted(() => {
  document.body.classList.remove('scrollable');
})
</script>

<style scoped>
.character-page {
  /* CSS Variables for maintainability */
  --bg-color: #ffffff;
  --bg-secondary: #f8f9fa;
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

  /* Border colors */
  --border-color: rgba(0, 0, 0, 0.1);
  --border-focus: #007bff;

  /* Button colors */
  --btn-primary: #007bff;
  --btn-primary-hover: #0056b3;
  --btn-success: #28a745;
  --btn-success-hover: #218838;
  --btn-danger: #dc3545;
  --btn-danger-hover: #c82333;
  --btn-warning: #f8d38d;

  /* Blur amounts */
  --blur-sm: 3px;
  --blur-md: 4px;
  --blur-lg: 5px;
  --blur-xl: 6px;
  --blur-hover: 20px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-circle: 50%;

  /* Spacing */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 2.5rem;

  /* Transitions */
  --transition-default: all 0.3s ease;

  /* Text shadows for readability */
  --shadow-text-strong: 0 0 20px rgba(0, 0, 0, 0.8), 0 2px 8px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.7), 1px 1px 2px rgba(0, 0, 0, 0.7);
  --shadow-text-medium: 0 0 10px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(255, 255, 255, 0.6), 1px 1px 1px rgba(255, 255, 255, 0.6);
  --shadow-text-light: 0 0 8px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(255, 255, 255, 0.6), 1px 1px 1px rgba(255, 255, 255, 0.6);
  --shadow-text-subtle: 0 0 6px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8), -0.5px -0.5px 1px rgba(255, 255, 255, 0.6), 0.5px 0.5px 1px rgba(255, 255, 255, 0.6);

  /* Box shadows */
  --shadow-box: 0 8px 32px rgba(200, 200, 200, 0.5);
  --shadow-box-dark: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-btn-primary: 0 2px 8px rgba(0, 123, 255, 0.3);
  --shadow-btn-primary-hover: 0 4px 12px rgba(0, 123, 255, 0.4);
  --shadow-btn-success: 0 2px 8px rgba(40, 167, 69, 0.3);
  --shadow-btn-success-hover: 0 4px 12px rgba(40, 167, 69, 0.4);

  /* Focus states */
  --focus-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);

  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-color);
  color: #fff;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
  font-variation-settings:
    "slnt" 0,
    "CRSV" 0.5,
    "ELSH" 0,
    "ELXP" 0,
    "SZP1" 0,
    "SZP2" 0,
    "XPN1" 0,
    "XPN2" 0,
    "YPN1" 0,
    "YPN2" 0;
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
  object-position: center 35%;
  background: var(--bg-color);
}

.placeholder-background {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  font-family: "Bitcount Prop Single Ink", system-ui;
}

.upload-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-sm);
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

.character-generation-section {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, var(--opacity-header));
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-box);
  transition: var(--transition-default);
}

.character-generation-section:hover {
  background: rgba(255, 255, 255, var(--opacity-header-hover));
  backdrop-filter: blur(var(--blur-xl));
}

.character-generation-section h2 {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0 0 var(--spacing-md) 0;
  color: var(--text-primary);
  border-bottom: 2px solid rgba(0, 0, 0, 0.2);
  padding-bottom: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  text-shadow: var(--shadow-text-light);
}

.generation-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.option-row {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  align-items: flex-start;
}

.gender-selection,
.setting-selection,
.class-selection,
.style-selection,
.emoji-selection,
.model-selection {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 200px;
}

.option-label {
  font-weight: bold;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  margin-bottom: var(--spacing-xs);
  text-shadow: var(--shadow-text-subtle);
}

.option-select {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.9);
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: var(--text-primary);
  cursor: pointer;
  transition: var(--transition-default);
}

.option-select:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--focus-shadow);
  background: rgba(255, 255, 255, 1);
}

.emoji-input {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.9);
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-size: 1.2rem;
  text-align: center;
  color: var(--text-primary);
  transition: var(--transition-default);
}

.emoji-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--focus-shadow);
  background: rgba(255, 255, 255, 1);
}

.emoji-hint {
  color: #666;
  font-size: 0.6rem;
  font-style: italic;
}

.generate-button-row {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.generate-btn-top {
  background: var(--btn-warning);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  font-size: 1.1rem;
  transition: var(--transition-default);
  box-shadow: var(--shadow-btn-primary);
}

.generate-btn-top:disabled {
  background: var(--text-tertiary);
  cursor: not-allowed;
  box-shadow: none;
}

.generate-btn-top:hover:not(:disabled) {
  background: var(--btn-primary-hover);
  box-shadow: var(--shadow-btn-primary-hover);
  transform: translateY(-1px);
  scale: 1.1;
}

.character-header {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, var(--opacity-header));
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-box);
  transition: var(--transition-default);
}

.character-header:hover {
  background: rgba(255, 255, 255, var(--opacity-header-hover));
  backdrop-filter: blur(var(--blur-xl));
}

.character-name-container {
  margin-bottom: 0.5rem;
}

.name-input {
  font-size: 2.5rem;
  font-weight: bold;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-primary);
  width: 100%;
  font-family: "Bitcount Prop Single Ink", system-ui;
  padding: 0.2rem 0;
  text-align: center;
  transition: var(--transition-default);
  text-shadow: var(--shadow-text-light);
}

.name-input:focus {
  outline: none;
  border-bottom-color: var(--border-focus);
}

.title-input {
  font-size: 1.2rem;
  font-style: italic;
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--text-secondary);
  width: 100%;
  font-family: "Bitcount Prop Single Ink", system-ui;
  padding: 0.2rem 0;
  text-align: center;
  transition: var(--transition-default);
  text-shadow: var(--shadow-text-medium);
}

.title-input:focus {
  outline: none;
  border-bottom-color: var(--border-focus);
}

.character-background,
.character-physical-description,
.character-stats,
.character-abilities {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, var(--opacity-section));
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-box-dark);
  transition: var(--transition-default);
}

.character-background:hover,
.character-physical-description:hover,
.character-stats:hover,
.character-abilities:hover {
  background: rgba(255, 255, 255, var(--opacity-section-hover));
  backdrop-filter: blur(var(--blur-hover));
}

.character-background h2,
.character-physical-description h2,
.character-stats h2,
.character-abilities h2 {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0 0 var(--spacing-md) 0;
  color: var(--text-primary);
  border-bottom: 2px solid rgba(0, 0, 0, 0.2);
  padding-bottom: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  text-shadow: var(--shadow-text-light);
}

.background-textarea,
.physical-description-textarea {
  width: 100%;
  min-height: 100px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: var(--text-primary);
  resize: vertical;
  transition: var(--transition-default);
}

.physical-description-textarea {
  min-height: 80px;
}

.background-textarea:focus,
.physical-description-textarea:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--focus-shadow);
  background: rgba(255, 255, 255, 1);
}


.image-status {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  background-color: #e3f2fd;
  color: #1976d2;
  border-left: 3px solid #2196f3;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem;
  background: rgba(255, 255, 255, var(--opacity-card));
  backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: var(--transition-default);
  min-height: 80px;
}

.stat-item:hover {
  background: rgba(255, 255, 255, var(--opacity-card-hover));
  backdrop-filter: blur(var(--blur-lg));
  transform: translateY(-2px);
}

.stat-label {
  font-weight: bold;
  font-size: 0.95rem;
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-xs);
  font-family: "Bitcount Prop Single Ink", system-ui;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.8), 0 1px 2px rgba(255, 255, 255, 0.6);
}

.stat-input {
  width: 50px;
  height: 50px;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.2rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-size: 1.3rem;
  font-weight: bold;
  color: var(--text-primary);
  transition: var(--transition-default);
  text-shadow: var(--shadow-text-subtle);
}

.stat-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--focus-shadow);
  background: rgba(255, 255, 255, 1);
}

.random-stats-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.75rem var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  color: var(--text-secondary);
  transition: var(--transition-default);
}

.random-stats-btn:hover {
  background: #e9ecef;
  border-color: var(--border-focus);
  color: var(--border-focus);
  transform: translateY(-1px);
}

.abilities-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.ability-item {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  padding: 1.25rem;
  background: rgba(255, 255, 255, var(--opacity-card));
  backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: var(--transition-default);
}

.ability-item:hover {
  background: rgba(255, 255, 255, var(--opacity-card-hover));
  backdrop-filter: blur(var(--blur-lg));
  transform: translateX(4px);
}

.ability-name-input,
.ability-desc-input {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: var(--text-primary);
  transition: var(--transition-default);
}

.ability-name-input {
  flex: 0 0 150px;
  font-weight: bold;
}

.ability-desc-input {
  flex: 1;
}

.ability-name-input:focus,
.ability-desc-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--focus-shadow);
  background: rgba(255, 255, 255, 1);
}

.remove-ability-btn {
  background: var(--btn-danger);
  color: white;
  border: none;
  border-radius: var(--radius-circle);
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-default);
}

.remove-ability-btn:hover {
  background: var(--btn-danger-hover);
  transform: scale(1.1);
}

.add-ability-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.75rem var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  color: var(--text-secondary);
  transition: var(--transition-default);
}

.add-ability-btn:hover {
  background: #e9ecef;
  border-color: var(--border-focus);
  color: var(--border-focus);
  transform: translateY(-1px);
}

.character-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-top: var(--spacing-lg);
}

.create-btn,
.preview-btn,
.reset-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  font-size: 1rem;
  transition: var(--transition-default);
}

.regenerate-image-btn {
  width: 100%;
  padding: 0.75rem var(--spacing-sm);
  background: var(--btn-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  transition: var(--transition-default);
  box-shadow: var(--shadow-btn-primary);
}

.regenerate-image-btn:hover {
  background: var(--btn-primary-hover);
  box-shadow: var(--shadow-btn-primary-hover);
  transform: translateY(-1px);
}

.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  color: #666;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 0.5rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.create-btn {
  background: var(--btn-success);
  color: white;
  border: none;
  box-shadow: var(--shadow-btn-success);
}

.create-btn:disabled {
  background: var(--text-tertiary);
  cursor: not-allowed;
  box-shadow: none;
}

.create-btn:hover:not(:disabled) {
  background: var(--btn-success-hover);
  box-shadow: var(--shadow-btn-success-hover);
  transform: translateY(-1px);
}

.preview-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.preview-btn:hover {
  background: #e9ecef;
  border-color: var(--border-focus);
  color: var(--border-focus);
  transform: translateY(-1px);
}

.reset-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--btn-danger);
}

.reset-btn:hover {
  background: #f8d7da;
  border-color: var(--btn-danger);
  color: var(--btn-danger);
  transform: translateY(-1px);
}

.message {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 4px;
  font-weight: bold;
  z-index: 1000;
}

.message.success {
  background: var(--btn-success);
  color: white;
}

.message.error {
  background: #f44336;
  color: white;
}

/* Responsive design */
@media (max-width: 768px) {
  .character-container {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .character-image {
    flex: none;
    max-width: 300px;
    margin: 0 auto;
  }

  .option-row {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .gender-selection,
  .setting-selection,
  .emoji-selection {
    min-width: unset;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .character-actions {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .character-page {
    padding: var(--spacing-sm);
  }

  .name-input {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .ability-item {
    flex-direction: column;
    align-items: stretch;
  }

  .ability-name-input {
    flex: none;
  }
}
</style>
