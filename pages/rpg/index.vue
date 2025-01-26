<template>
	<div class="game-container">
		<div class="game-output" ref="outputBox">
			<template v-for="(message, index) in gameMessages" :key="index">
				<div v-if="message.startsWith('>')" class="message command">
					{{ message }}
				</div>
				<TextWindow 
					v-else 
					:text="message"
					:items="currentItems"
					@itemClick="handleItemClick"
					@characterClick="handleCharacterClick"
					@placeClick="handlePlaceClick"
					class="message"
					:active="false"
				/>
			</template>
			<div v-if="isLoading" class="message loading">...</div>
		</div>
		<div class="command-buttons">
			<button 
				v-for="cmd in ['↑', '↓', '→', '←', '👀', '🎒']" 
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

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useNuxtApp } from '#app'
import type { Firestore } from 'firebase/firestore'
import TextWindow from '~/components/rpg/TextWindow.vue'
import { collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

declare module '#app' {
	interface NuxtApp {
		$firebase: {
			firestore: Firestore
		}
	}
}

const userInput = ref('')
const gameMessages = ref<string[]>(['You find yourself at the edge of a mysterious forest. The air is thick with ancient magic.', 'What would you like to do?'])
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)
const isLoading = ref(false)
const userId = ref('')
const inputField = ref<HTMLInputElement>()
const outputBox = ref<HTMLElement>()
const currentItems = ref<Record<string, Item>>({})

// Game state management
async function loadGameState() {
	try {
		const { $firebase } = useNuxtApp()
		const gameDoc = doc($firebase.firestore, 'games', userId.value)
		const itemsCollection = collection($firebase.firestore, 'items')
		const placesCollection = collection($firebase.firestore, 'places')
		
		const gameSnapshot = await getDoc(gameDoc)

		if (gameSnapshot.exists()) {
			console.log('gameSnapshot', gameSnapshot.data())
			const data = gameSnapshot.data()
			gameMessages.value = data.messages || gameMessages.value
			commandHistory.value = data.commands || commandHistory.value
			historyIndex.value = commandHistory.value.length
			
			// Scroll to bottom after loading
			nextTick(() => {
				scrollToBottom()
			})
		}
	} catch (error) {
		console.error('Error loading game state:', error)
	}
}

async function saveGameState() {
	try {
		const { $firebase } = useNuxtApp()
		const gameDoc = doc($firebase.firestore, 'games', userId.value)
		await setDoc(gameDoc, {
			messages: gameMessages.value,
			commands: commandHistory.value,
			lastUpdated: new Date()
		})
	} catch (error) {
		console.error('Error saving game state:', error)
	}
}

async function resetGame() {
	if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
		try {
			const { $firebase } = useNuxtApp()
			const gameDoc = doc($firebase.firestore, 'games', userId.value)
			await deleteDoc(gameDoc)

			gameMessages.value = ['You find yourself at the edge of a mysterious forest. The air is thick with ancient magic.', 'What would you like to do? (type "help" for guidance)']
			commandHistory.value = []
			historyIndex.value = -1
			userInput.value = ''
			inputField.value?.focus()
		} catch (error) {
			console.error('Error resetting game:', error)
			addMessage('Error resetting game. Please try again.')
		}
	}
}

// Command handling
async function handleCommand() {
	if (!userInput.value.trim() || isLoading.value) return
	
	isLoading.value = true
	
	// Save command to history
	commandHistory.value.push(userInput.value)
	historyIndex.value = commandHistory.value.length
	
	// Show command in output
	addMessage(`> ${userInput.value}`)
	
	// Send command to API
	try {
		const response = await fetch('/api/rpg', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ 
				command: userInput.value,
				userId: userId.value
			})
		})
		const data = await response.json()
		
		if (data.error) {
			addMessage(data.error)
		} else {
			addMessage(data.response)
		}
		// Save game state after each command
		await saveGameState()
	} catch (error) {
		console.error('Error sending command:', error)
		addMessage('The magical connection seems to be disturbed...')
	} finally {
		// Reset input and scroll to bottom
		userInput.value = ''
		isLoading.value = false
		nextTick(() => {
			scrollToBottom()
			inputField.value?.focus()
		})
	}
}

function addMessage(message: string) {
	gameMessages.value.push(message)
}

function scrollToBottom() {
	if (outputBox.value) {
		outputBox.value.scrollTop = outputBox.value.scrollHeight
	}
}

// Keyboard navigation
function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'ArrowUp') {
		event.preventDefault()
		if (historyIndex.value > 0) {
			historyIndex.value--
			userInput.value = commandHistory.value[historyIndex.value]
		}
	} else if (event.key === 'ArrowDown') {
		event.preventDefault()
		if (historyIndex.value < commandHistory.value.length - 1) {
			historyIndex.value++
			userInput.value = commandHistory.value[historyIndex.value]
		} else {
			historyIndex.value = commandHistory.value.length
			userInput.value = ''
		}
	}
}

// Command shortcuts
function executeCommand(cmd: string) {
	const commandMap: Record<string, string> = {
		'↑': 'go north',
		'↓': 'go south',
		'→': 'go east',
		'←': 'go west',
		'👀': 'look',
		'🎒': 'inventory',
		'?': 'help'
	}
	userInput.value = commandMap[cmd] || cmd
	handleCommand()
}

// Item interaction handlers
function handleItemClick(name: string) {
	userInput.value = `examine ${name}`
	handleCommand()
}

function handleCharacterClick(name: string) {
	userInput.value = `talk to ${name}`
	handleCommand()
}

function handlePlaceClick(name: string) {
	userInput.value = `examine ${name}`
	handleCommand()
}

// Initialize game
onMounted(async () => {
	// Generate a random user ID if not exists
	userId.value = localStorage.getItem('rpg_user_id') || 
		Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
	localStorage.setItem('rpg_user_id', userId.value)

	// Load saved game state
	await loadGameState()
	
	// Hold focus on input field
	inputField.value?.focus()
	
	// Add keyboard listeners
	document.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
	document.removeEventListener('keydown', handleKeyDown)
})
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

/* Add new styles for marked elements */
:deep(.item) {
	color: #ffcc00; /* Gold for items */
	font-weight: bold;
}

:deep(.person) {
	color: #ff6b6b; /* Coral for people */
	font-weight: bold;
}

:deep(.place) {
	color: #4dffb8; /* Mint green for places */
	font-weight: bold;
}

:deep(.command) {
	color: #888; /* Grey for user commands */
	font-style: italic;
}
</style>