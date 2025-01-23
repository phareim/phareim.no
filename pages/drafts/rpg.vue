<template>
	<div class="game-container">
		<div class="game-output" ref="outputBox">
			<div v-for="(message, index) in gameMessages" :key="index" class="message">
				{{ message }}
			</div>
			<div v-if="isLoading" class="message loading">...</div>
		</div>
		<div class="command-buttons">
			<button 
				v-for="cmd in ['↑', '↓', '→', '←']" 
				:key="cmd"
				@click="executeCommand(cmd)"
				class="command-button"
				:disabled="isLoading"
			>
				{{ cmd }}
			</button>
			<button 
				v-for="cmd in ['👀', '🎒', '?']" 
				:key="cmd"
				@click="executeCommand(cmd)"
				class="command-button"
				:disabled="isLoading"
			>
				{{ cmd }}
			</button>
			<div class="dropdown">
				<button class="command-button dropdown-toggle" :disabled="isLoading">...</button>
				<div class="dropdown-content">
					<button @click="executeCommand('help')" class="dropdown-item" :disabled="isLoading">?</button>
					<button @click="resetGame" class="dropdown-item" :disabled="isLoading">Reset Game</button>
				</div>
			</div>
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
		</div>
	</div>
</template>

<script>
import { collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

export default {
	data() {
		return {
			userInput: '',
			gameMessages: ['Welcome to the text adventure!', 'Type "help" to see available commands.'],
			commandHistory: [],
			historyIndex: -1,
			isLoading: false,
			userId: null
		}
	},
	async mounted() {
		// Generate a random user ID if not exists
		this.userId = localStorage.getItem('rpg_user_id') || 
			Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		localStorage.setItem('rpg_user_id', this.userId);

		// Load saved game state
		await this.loadGameState();
		
		// Hold focus on input field
		this.$refs.inputField.focus();
		
		// Add keyboard listeners
		document.addEventListener('keydown', this.handleKeyDown);
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.handleKeyDown);
	},
	methods: {
		async loadGameState() {
			try {
				const { $firebase } = useNuxtApp();
				const gameDoc = doc($firebase.firestore, 'games', this.userId);
				const gameSnapshot = await getDoc(gameDoc);

				if (gameSnapshot.exists()) {
					const data = gameSnapshot.data();
					this.gameMessages = data.messages || this.gameMessages;
					this.commandHistory = data.commands || this.commandHistory;
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
		async saveGameState() {
			try {
				const { $firebase } = useNuxtApp();
				const gameDoc = doc($firebase.firestore, 'games', this.userId);
				await setDoc(gameDoc, {
					messages: this.gameMessages,
					commands: this.commandHistory,
					lastUpdated: new Date()
				});
			} catch (error) {
				console.error('Error saving game state:', error);
			}
		},
		async resetGame() {
			if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
				try {
					const { $firebase } = useNuxtApp();
					const gameDoc = doc($firebase.firestore, 'games', this.userId);
					await deleteDoc(gameDoc);

					this.gameMessages = ['Welcome to the text adventure!', 'Type "help" to see available commands.'];
					this.commandHistory = [];
					this.historyIndex = -1;
					this.userInput = '';
					this.$refs.inputField.focus();
				} catch (error) {
					console.error('Error resetting game:', error);
					this.addMessage('Error resetting game. Please try again.');
				}
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
		},
		setCommand(cmd) {
			this.userInput = cmd;
			const commandMap = {
				'↑': 'go north',
				'↓': 'go south',
				'→': 'go east',
				'←': 'go west'
			};
			this.userInput = commandMap[cmd] || cmd;
			this.$refs.inputField.focus();
		},
		executeCommand(cmd) {
			this.userInput = cmd;
			const commandMap = {
				'↑': 'go north',
				'↓': 'go south',
				'→': 'go east',
				'←': 'go west',
				'👀': 'look',
				'🎒': 'inventory',
				'?': 'help'
			};
			this.userInput = commandMap[cmd] || cmd;
			this.handleCommand();
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

.command-buttons {
	width: 80%;
	max-width: 800px;
	display: flex;
	gap: 10px;
	margin-bottom: 10px;
	flex-wrap: wrap;
}

.command-button {
	padding: 8px 16px;
	background-color: #000;
	border: 2px solid #33ff33;
	border-radius: 5px;
	color: #33ff33;
	font-family: 'Courier New', monospace;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
}

.command-button:hover:not(:disabled) {
	background-color: #33ff33;
	color: #000;
}

.command-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.dropdown {
	position: relative;
	display: inline-block;
}

.dropdown-toggle {
	border-color: #666;
	color: #666;
}

.dropdown-content {
	display: none;
	position: absolute;
	right: 0;
	background-color: #000;
	min-width: 160px;
	box-shadow: 0 0 10px rgba(51, 255, 51, 0.3);
	z-index: 1;
	border: 2px solid #666;
	border-radius: 5px;
}

.dropdown:hover .dropdown-content {
	display: block;
}

.dropdown-item {
	width: 100%;
	padding: 8px 16px;
	background: none;
	border: none;
	color: #ff3333;
	font-family: 'Courier New', monospace;
	font-size: 0.9em;
	cursor: pointer;
	text-align: left;
}

.dropdown-item:hover:not(:disabled) {
	background-color: #ff3333;
	color: #000;
}

.dropdown-item:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

@media (max-width: 600px) {
	.command-buttons {
		width: 95%;
	}
}
</style>