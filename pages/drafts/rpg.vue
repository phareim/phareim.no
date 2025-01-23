<template>
	<div class="game-container">
		<div class="game-output" ref="outputBox">
			<div v-for="(message, index) in gameMessages" :key="index" class="message">
				{{ message }}
			</div>
			<div v-if="isLoading" class="message loading">...</div>
		</div>
		<div class="input-container">
			<input 
				type="text" 
				v-model="userInput" 
				@keyup.enter="handleCommand"
				placeholder="Enter your command..."
				ref="inputField"
				autocomplete="off"
				:disabled="isLoading"
			>
			<button @click="resetGame" class="reset-button" :disabled="isLoading">Reset Game</button>
		</div>
	</div>
</template>

<script>
const STORAGE_KEY = 'rpg_game_state';

export default {
	data() {
		return {
			userInput: '',
			gameMessages: ['Welcome to the text adventure!', 'Type "help" to see available commands.'],
			commandHistory: [],
			historyIndex: -1,
			isLoading: false
		}
	},
	mounted() {
		// Load saved game state
		this.loadGameState();
		
		// Hold focus on input field
		this.$refs.inputField.focus();
		
		// Add keyboard listeners
		document.addEventListener('keydown', this.handleKeyDown);
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.handleKeyDown);
	},
	methods: {
		loadGameState() {
			try {
				const savedState = localStorage.getItem(STORAGE_KEY);
				if (savedState) {
					const state = JSON.parse(savedState);
					this.gameMessages = state.messages || this.gameMessages;
					this.commandHistory = state.commands || this.commandHistory;
					this.historyIndex = this.commandHistory.length;
					
					// Scroll to bottom after loading
					this.$nextTick(() => {
						this.scrollToBottom();
					});
				}
			} catch (error) {
				console.error('Error loading game state:', error);
			}
		},
		saveGameState() {
			try {
				const state = {
					messages: this.gameMessages,
					commands: this.commandHistory
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			} catch (error) {
				console.error('Error saving game state:', error);
			}
		},
		resetGame() {
			if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
				localStorage.removeItem(STORAGE_KEY);
				this.gameMessages = ['Welcome to the text adventure!', 'Type "help" to see available commands.'];
				this.commandHistory = [];
				this.historyIndex = -1;
				this.userInput = '';
				this.$refs.inputField.focus();
			}
		},
		handleCommand() {
			if (!this.userInput.trim() || this.isLoading) return;
			
			this.isLoading = true;
			
			// Save command to history
			this.commandHistory.push(this.userInput);
			this.historyIndex = this.commandHistory.length;
			
			// Show command in output
			this.addMessage(`> ${this.userInput}`);
			
			// Send command to API
			fetch('/api/rpg', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ command: this.userInput })
			})
			.then(response => response.json())
			.then(data => {
				if (data.error) {
					this.addMessage(`Error: ${data.error}`);
					if (data.details) {
						this.addMessage(`Details: ${data.details}`);
					}
				} else {
					this.addMessage(data.response);
				}
				// Save game state after each command
				this.saveGameState();
			})
			.catch(error => {
				console.error('Error sending command:', error);
				this.addMessage('Sorry, something went wrong while sending the command.');
			})
			.finally(() => {
				// Reset input and scroll to bottom
				this.userInput = '';
				this.isLoading = false;
				this.$nextTick(() => {
					this.scrollToBottom();
					this.$refs.inputField.focus();
				});
			});
		},
		addMessage(message) {
			this.gameMessages.push(message);
		},
		scrollToBottom() {
			const outputBox = this.$refs.outputBox;
			outputBox.scrollTop = outputBox.scrollHeight;
		},
		handleKeyDown(event) {
			// Handle arrow keys for command history
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				if (this.historyIndex > 0) {
					this.historyIndex--;
					this.userInput = this.commandHistory[this.historyIndex];
				}
			} else if (event.key === 'ArrowDown') {
				event.preventDefault();
				if (this.historyIndex < this.commandHistory.length - 1) {
					this.historyIndex++;
					this.userInput = this.commandHistory[this.historyIndex];
				} else {
					this.historyIndex = this.commandHistory.length;
					this.userInput = '';
				}
			}
		}
	}
}
</script>

<style scoped>
.game-container {
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20px;
	box-sizing: border-box;
	background-color: #1a1a1a;
	color: #33ff33;
	font-family: 'Courier New', monospace;
}

.game-output {
	width: 80%;
	max-width: 800px;
	height: 70vh;
	background-color: #000;
	border: 2px solid #33ff33;
	border-radius: 5px;
	padding: 20px;
	margin-bottom: 20px;
	overflow-y: auto;
	box-shadow: 0 0 10px rgba(51, 255, 51, 0.3);
}

.message {
	margin: 5px 0;
	line-height: 1.4;
}

.loading {
	opacity: 0.7;
	animation: blink 1s infinite;
}

@keyframes blink {
	0% { opacity: 0.3; }
	50% { opacity: 0.7; }
	100% { opacity: 0.3; }
}

.input-container {
	width: 80%;
	max-width: 800px;
	display: flex;
	gap: 10px;
}

input {
	flex: 1;
	padding: 10px;
	background-color: #000;
	border: 2px solid #33ff33;
	border-radius: 5px;
	color: #33ff33;
	font-family: 'Courier New', monospace;
	font-size: 1em;
	outline: none;
	box-shadow: 0 0 10px rgba(51, 255, 51, 0.3);
}

.reset-button {
	padding: 10px 20px;
	background-color: #000;
	border: 2px solid #ff3333;
	border-radius: 5px;
	color: #ff3333;
	font-family: 'Courier New', monospace;
	font-size: 1em;
	cursor: pointer;
	transition: all 0.3s ease;
}

.reset-button:hover {
	background-color: #ff3333;
	color: #000;
}

.reset-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

/* Scrollbar styling */
.game-output::-webkit-scrollbar {
	width: 8px;
}

.game-output::-webkit-scrollbar-track {
	background: #000;
}

.game-output::-webkit-scrollbar-thumb {
	background: #33ff33;
	border-radius: 4px;
}

.game-output::-webkit-scrollbar-thumb:hover {
	background: #66ff66;
}

@media (max-width: 600px) {
	.game-output, .input-container {
		width: 95%;
	}
}
</style>