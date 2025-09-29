<template>
  <div class="poem-container">
    <div class="poem-header">
      <h1>🎭 The Terrible Poem Generator 🎭</h1>
      <p>Enter a theme and witness poetry so bad it's brilliant!</p>
    </div>
    
    <form @submit.prevent="generatePoem" class="poem-form">
      <div class="input-group">
        <label for="theme" class="theme-label">What should this masterpiece be about? 🤔</label>
        <input
          id="theme"
          v-model="themeForPoem"
          type="text"
          placeholder="e.g., pizza, unicorns, Monday mornings..."
          class="theme-input"
          required
        />
      </div>
      <button 
        type="submit" 
        class="generate-btn"
        :disabled="isLoading"
      >
        {{ isLoading ? '🎨 Crafting Terrible Art...' : '🚀 Generate Bad Poetry!' }}
      </button>
    </form>

    <div v-if="randomPoem" class="poem-display">
      <h2>Your Magnificently Awful Poem:</h2>
      <div class="poem-content" v-html="randomPoem"></div>
      <button @click="generatePoem" class="regenerate-btn">
        🔄 Make it Even Worse!
      </button>
    </div>

    <div v-if="error" class="error-message">
      <p>😅 Oops! Even our bad poetry generator had a bad day: {{ error }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      randomPoem: '',
      themeForPoem: '',
      isLoading: false,
      error: null,
    };
  },
  methods: {
    async generatePoem() {
      if (!this.themeForPoem.trim()) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const { data: poem } = await $fetch('/api/write-a-bad-poem', {
          query: {
            theme_for_poem: this.themeForPoem.trim()
          }
        });
        this.randomPoem = poem.poem;
      } catch (err) {
        this.error = 'Failed to generate your terrible poem. Try again!';
        console.error('Poem generation error:', err);
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
.poem-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Comic Sans MS', cursive, sans-serif;
}

.poem-header {
  text-align: center;
  margin-bottom: 3rem;
}

.poem-header h1 {
  font-size: 2.5rem;
  color: #ff6b6b;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}

.poem-header p {
  font-size: 1.2rem;
  color: #666;
  font-style: italic;
}

.poem-form {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2.5rem;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  margin-bottom: 3rem;
}

.input-group {
  margin-bottom: 2rem;
}

.theme-label {
  display: block;
  font-size: 1.3rem;
  font-weight: bold;
  color: white;
  margin-bottom: 1rem;
  text-align: center;
}

.theme-input {
  width: 100%;
  padding: 1.5rem 0;
  font-size: 1.2rem;
  border: none;
  border-radius: 8px;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
  font-family: inherit;
  transition: all 0.3s ease;
}

.theme-input:focus {
  outline: none;
  transform: scale(1.02);
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.2), 0 0 20px rgba(255,255,255,0.3);
}

.generate-btn {
  width: 100%;
  padding: 1.5rem;
  font-size: 1.3rem;
  font-weight: bold;
  background: linear-gradient(45deg, #ff6b6b, #ffa500);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(255,107,107,0.4);
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.poem-display {
  background: #f8f9fa;
  padding: 2.5rem;
  border-radius: 20px;
  border-left: 5px solid #ff6b6b;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.poem-display h2 {
  color: #333;
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 1.5rem;
}

.poem-content {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #444;
  white-space: pre-line;
  text-align: center;
  font-style: italic;
  margin-bottom: 2rem;
}

.regenerate-btn {
  display: block;
  margin: 0 auto;
  padding: 1rem 2rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.regenerate-btn:hover {
  background: #218838;
  transform: translateY(-2px);
}

.error-message {
  background: #ffe6e6;
  border: 2px solid #ff6b6b;
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  color: #d63384;
  font-weight: bold;
}

@media (max-width: 768px) {
  .poem-container {
    padding: 1rem;
  }
  
  .poem-header h1 {
    font-size: 2rem;
  }
  
  .poem-form {
    padding: 1.5rem;
  }
  
  .theme-input, .generate-btn {
    padding: 1rem;
    font-size: 1rem;
  }
}
</style>