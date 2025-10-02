<template>
  <div class="character-page">
    <div class="character-container">
      <!-- Left side - Character Image -->
      <div class="character-image">
        <div class="image-container">
          <img v-if="newCharacter.imageUrl" :src="newCharacter.imageUrl" alt="Character Portrait" class="portrait" />
          <div v-else class="placeholder-portrait">
            <div class="upload-icon">🎭</div>
            <p>Character portrait will appear here</p>
          </div>
        </div>
        <button v-if="newCharacter.physicalDescription && !isGeneratingImage" @click="generateImage"
          class="regenerate-image-btn">
          {{ newCharacter.imageUrl ? '🔄 Regenerate Image' : '🎨 Generate Image' }}
        </button>
        <div v-if="isGeneratingImage" class="image-loading">
          <div class="spinner"></div>
          <p>Generating image...</p>
        </div>
      </div>

      <!-- Right side - Character Creation Form -->
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
                    <option value="">Fantasy (Default)</option>
                    <option value="cyberpunk">Cyberpunk</option>
                    <option value="steampunk">Steampunk</option>
                    <option value="post-apocalyptic">Post-Apocalyptic</option>
                    <option value="space-opera">Space Opera</option>
                    <option value="medieval">Medieval</option>
                    <option value="modern-urban">Modern Urban</option>
                    <option value="victorian">Victorian</option>
                    <option value="wild-west">Wild West</option>
                    <option value="pirate">Pirate</option>
                    <option value="superhero">Superhero</option>
                  </select>
                </div>
              </div>
              <div class="option-row">
                <div class="class-selection">
                  <label class="option-label">Character Class:</label>
                  <select v-model="newCharacter.class" class="option-select">
                    <option value="">Any Class</option>
                    <option value="warrior">🗡️ Warrior</option>
                    <option value="mage">🔮 Mage</option>
                    <option value="rogue">🗡️ Rogue</option>
                    <option value="cleric">⚡ Cleric</option>
                    <option value="ranger">🏹 Ranger</option>
                    <option value="paladin">⚔️ Paladin</option>
                    <option value="barbarian">🪓 Barbarian</option>
                    <option value="bard">🎵 Bard</option>
                    <option value="druid">🌿 Druid</option>
                    <option value="sorcerer">✨ Sorcerer</option>
                    <option value="warlock">🔥 Warlock</option>
                    <option value="wizard">📚 Wizard</option>
                    <option value="monk">👊 Monk</option>
                    <option value="artificer">⚙️ Artificer</option>
                    <option value="gunslinger">🔫 Gunslinger</option>
                    <option value="pilot">🚀 Pilot</option>
                    <option value="hacker">💻 Hacker</option>
                    <option value="medic">🏥 Medic</option>
                    <option value="engineer">🔧 Engineer</option>
                    <option value="scout">🔍 Scout</option>
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
              <button @click="previewCharacter" class="preview-btn">
                👁️ Preview
              </button>
              <button @click="resetForm" class="reset-btn">
                🔄 Reset Form
              </button>
            </div>
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

// Fetch AI models and styles when component mounts
onMounted(() => {
  document.body.classList.add('scrollable');
  fetchAIModels()
  fetchCharacterStyles()
})

onUnmounted(() => {
  document.body.classList.remove('scrollable');
})
</script>

<style scoped>
.character-page {
  min-height: 100vh;
  background: #ffffff;
  color: #1a1a1a;
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
  padding: 2rem;
}

.character-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  background: #ffffff;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.character-image {
  flex: 0 0 400px;
}

.image-container {
  width: 100%;
  aspect-ratio: 9/16;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e5e5;
  margin-bottom: 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.image-upload-area {
  width: 100%;
  aspect-ratio: 9/16;
  cursor: pointer;
  border: 2px dashed #ccc;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.image-upload-area:hover {
  border-color: black;
}

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: white;
}

.placeholder-portrait {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  color: #6c757d;
  font-family: "Bitcount Prop Single Ink", system-ui;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.character-details {
  flex: 1;
  max-width: 600px;
}

.character-generation-section {
  margin-bottom: 2rem;
  padding: 2rem;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.character-generation-section h2 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 0 1.5rem 0;
  color: #1a1a1a;
  border-bottom: 2px solid #e5e5e5;
  padding-bottom: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
}

.generation-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-row {
  display: flex;
  gap: 1rem;
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
  color: #495057;
  font-size: 0.9rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  margin-bottom: 0.5rem;
}

.option-select {
  padding: 0.75rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #ffffff;
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: #1a1a1a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.emoji-input {
  padding: 0.75rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #ffffff;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-size: 1.2rem;
  text-align: center;
  color: #1a1a1a;
  transition: all 0.2s ease;
}

.emoji-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
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
  background: #f8d38d;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  font-size: 1.1rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.generate-btn-top:disabled {
  background: #6c757d;
  cursor: not-allowed;
  box-shadow: none;
}

.generate-btn-top:hover:not(:disabled) {
  background: #0056b3;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  transform: translateY(-1px);
  scale: 1.1;
}

.character-header {
  margin-bottom: 2rem;
  padding: 2rem;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  color: #1a1a1a;
  width: 100%;
  font-family: "Bitcount Prop Single Ink", system-ui;
  padding: 0.2rem 0;
  text-align: center;
  transition: all 0.2s ease;
}

.name-input:focus {
  outline: none;
  border-bottom-color: #007bff;
}

.title-input {
  font-size: 1.2rem;
  font-style: italic;
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: #6c757d;
  width: 100%;
  font-family: "Bitcount Prop Single Ink", system-ui;
  padding: 0.2rem 0;
  text-align: center;
  transition: all 0.2s ease;
}

.title-input:focus {
  outline: none;
  border-bottom-color: #007bff;
}

.character-background,
.character-physical-description,
.character-stats,
.character-abilities {
  margin-bottom: 2rem;
  padding: 2rem;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.character-background h2,
.character-physical-description h2,
.character-stats h2,
.character-abilities h2 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 0 1.5rem 0;
  color: #1a1a1a;
  border-bottom: 2px solid #e5e5e5;
  padding-bottom: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
}

.background-textarea,
.physical-description-textarea {
  width: 100%;
  min-height: 100px;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: #1a1a1a;
  resize: vertical;
  transition: all 0.2s ease;
}

.physical-description-textarea {
  min-height: 80px;
}

.background-textarea:focus,
.physical-description-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
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
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #f8f9fa;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e5e5e5;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-height: 80px;
}

.stat-label {
  font-weight: bold;
  font-size: 0.9rem;
  color: #495057;
  margin-bottom: 0.5rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
}

.stat-input {
  width: 50px;
  height: 50px;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 0.2rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-size: 1.2rem;
  font-weight: bold;
  color: #1a1a1a;
  transition: all 0.2s ease;
}

.stat-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.random-stats-btn {
  background: #f8f9fa;
  border: 1px solid #e5e5e5;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  color: #495057;
  transition: all 0.2s ease;
}

.random-stats-btn:hover {
  background: #e9ecef;
  border-color: #007bff;
  color: #007bff;
  transform: translateY(-1px);
}

.abilities-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #f8f9fa;
}

.ability-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ability-name-input,
.ability-desc-input {
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: "Bitcount Prop Single Ink", system-ui;
  color: #1a1a1a;
  transition: all 0.2s ease;
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
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.remove-ability-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.remove-ability-btn:hover {
  background: #c82333;
  transform: scale(1.1);
}

.add-ability-btn {
  background: #f8f9fa;
  border: 1px solid #e5e5e5;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  color: #495057;
  transition: all 0.2s ease;
}

.add-ability-btn:hover {
  background: #e9ecef;
  border-color: #007bff;
  color: #007bff;
  transform: translateY(-1px);
}

.character-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.create-btn,
.preview-btn,
.reset-btn {
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.regenerate-image-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: "Bitcount Prop Single Ink", system-ui;
  font-weight: bold;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.regenerate-image-btn:hover {
  background: #0056b3;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
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
  background: #28a745;
  color: white;
  border: none;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  box-shadow: none;
}

.create-btn:hover:not(:disabled) {
  background: #218838;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
  transform: translateY(-1px);
}

.preview-btn {
  background: #f8f9fa;
  border: 1px solid #e5e5e5;
  color: #495057;
}

.preview-btn:hover {
  background: #e9ecef;
  border-color: #007bff;
  color: #007bff;
  transform: translateY(-1px);
}

.reset-btn {
  background: #f8f9fa;
  border: 1px solid #e5e5e5;
  color: #dc3545;
}

.reset-btn:hover {
  background: #f8d7da;
  border-color: #dc3545;
  color: #dc3545;
  transform: translateY(-1px);
}

.message {
  position: fixed;
  top: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  z-index: 1000;
}

.message.success {
  background: #4CAF50;
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
    gap: 2rem;
  }

  .character-image {
    flex: none;
    max-width: 300px;
    margin: 0 auto;
  }

  .option-row {
    flex-direction: column;
    gap: 0.5rem;
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
    padding: 1rem;
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
