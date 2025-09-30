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
                    <option value="">Default Style</option>
                    <option value="disney">🏰 Disney - Colorful and whimsical</option>
                    <option value="digital">💻 Digital - Cyberpunk and futuristic</option>
                    <option value="heavy-metal">🤘 Heavy Metal - Dark and intense</option>
                  </select>
                </div>
                <div class="emoji-selection">
                  <label class="option-label">Inspiration Emojis:</label>
                  <input v-model="selectedEmojis" placeholder="💚 🔮 🤖" class="emoji-input" maxlength="8" />
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

// Computed property to check if character can be created
const canCreate = computed(() => {
  return newCharacter.value.name.trim().length > 0 &&
    newCharacter.value.title.trim().length > 0
})


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
        characterClass: newCharacter.value.class
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
      characterId: 'preview'
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
  flex: 0 0 400px;
}

.image-container {
  width: 100%;
  aspect-ratio: 9/16;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #ddd;
  margin-bottom: 1rem;
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
  background-color: #f9f9f9;
  color: #666;
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
  padding: 1.5rem;
  border: 2px solid #9c27b0;
  border-radius: 8px;
  background-color: #fafafa;
}

.character-generation-section h2 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 0 1rem 0;
  color: #9c27b0;
  border-bottom: 1px solid #9c27b0;
  padding-bottom: 0.5rem;
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
.emoji-selection {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 200px;
}

.option-label {
  font-weight: bold;
  color: #333;
  font-size: 0.9rem;
}

.option-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-family: inherit;
  cursor: pointer;
}

.option-select:focus {
  outline: none;
  border-color: #9c27b0;
}

.emoji-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-family: inherit;
  font-size: 1.2rem;
  text-align: center;
}

.emoji-input:focus {
  outline: none;
  border-color: #9c27b0;
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
  background: #9c27b0;
  color: white;
  border: 2px solid #9c27b0;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  transition: all 0.2s ease;
}

.generate-btn-top:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}

.generate-btn-top:hover:not(:disabled) {
  background: white;
  color: #9c27b0;
}

.character-header {
  margin-bottom: 2rem;
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
  color: black;
  width: 100%;
  font-family: inherit;
  padding: 0.2rem 0;
}

.name-input:focus {
  outline: none;
  border-bottom-color: black;
}

.title-input {
  font-size: 1.2rem;
  font-style: italic;
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: #333;
  width: 100%;
  font-family: inherit;
  padding: 0.2rem 0;
}

.title-input:focus {
  outline: none;
  border-bottom-color: #333;
}

.character-background,
.character-physical-description,
.character-stats,
.character-abilities {
  margin-bottom: 2rem;
}

.character-background h2,
.character-physical-description h2,
.character-stats h2,
.character-abilities h2 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 0 1rem 0;
  color: black;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.5rem;
}

.background-textarea,
.physical-description-textarea {
  width: 100%;
  min-height: 100px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  font-family: inherit;
  resize: vertical;
}

.physical-description-textarea {
  min-height: 80px;
}

.background-textarea:focus,
.physical-description-textarea:focus {
  outline: none;
  border-color: black;
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
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid #ddd;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.stat-label {
  font-weight: bold;
}

.stat-input {
  width: 60px;
  text-align: center;
  background: none;
  border: 1px solid #ccc;
  border-radius: 2px;
  padding: 0.2rem;
  font-family: inherit;
}

.stat-input:focus {
  outline: none;
  border-color: black;
}

.random-stats-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.random-stats-btn:hover {
  background: black;
  color: white;
}

.abilities-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.ability-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ability-name-input,
.ability-desc-input {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  font-family: inherit;
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
  border-color: black;
}

.remove-ability-btn {
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-ability-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.add-ability-btn:hover {
  background: black;
  color: white;
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
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  transition: all 0.2s ease;
}

.regenerate-image-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  transition: all 0.2s ease;
}

.regenerate-image-btn:hover {
  background: #1976d2;
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
  background: black;
  color: white;
  border: 2px solid black;
}

.create-btn:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}

.create-btn:hover:not(:disabled) {
  background: white;
  color: black;
}

.preview-btn {
  background: #f0f0f0;
  border: 2px solid #ccc;
  color: black;
}

.preview-btn:hover {
  background: #333;
  color: white;
  border-color: #333;
}

.reset-btn {
  background: white;
  border: 2px solid #ff4444;
  color: #ff4444;
}

.reset-btn:hover {
  background: #ff4444;
  color: white;
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
