<template>
	<div class="game-container">
		<!-- Add player location display -->
		<div class="player-location">
			<div class="location-label">Player Location:</div>
			<div class="place-name">{{ playerPlaceName }}</div>
			<div class="coordinates">{{ playerCoordinates }}</div>
		</div>
		<div class="game-output" ref="outputBox">
			<template v-for="(message, index) in gameMessages" :key="index">
				<div v-if="message.startsWith('>')" class="message command">
					{{ message }}
				</div>
				<TextWindow
					v-else
					:text="message"
					:active="!isLoading"
					@action="handleAction"
					@characterClick="handleCharacterClick"
					@placeClick="handlePlaceClick"
					class="message"
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
import TextWindow from '~/components/rpg/TextWindow.vue'
import { APIClient } from '~/utils/api-client'

const UI_STATE_KEY = 'rpg_ui_state'
const INITIAL_MESSAGES = [
	'You find yourself in the middle of a mysterious forest. The air is thick with ancient magic.',
	'What would you like to do?'
]

const userInput = ref('')
const gameMessages = ref<string[]>([...INITIAL_MESSAGES])
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)
const isLoading = ref(false)
const userId = ref('')
const inputField = ref<HTMLInputElement>()
const outputBox = ref<HTMLElement>()
const playerCoordinates = ref('N: 0, W: 0')
const playerPlaceName = ref('Unknown location')

// Load UI state from localStorage
function loadUIState() {
	try {
		const stored = localStorage.getItem(UI_STATE_KEY)
		if (stored) {
			const state = JSON.parse(stored)
			if (state.uiMessages?.length) gameMessages.value = state.uiMessages
			if (state.commandHistory) {
				commandHistory.value = state.commandHistory
				historyIndex.value = commandHistory.value.length
			}
			if (state.lastNorth !== undefined && state.lastWest !== undefined) {
				playerCoordinates.value = `N: ${state.lastNorth}, W: ${state.lastWest}`
			}
			if (state.lastPlaceName) playerPlaceName.value = state.lastPlaceName
		}
	} catch (error) {
		console.error('Error loading UI state:', error)
	}
}

// Save UI state to localStorage
function saveUIState() {
	try {
		const coordMatch = playerCoordinates.value.match(/N:\s*(-?\d+),\s*W:\s*(-?\d+)/)
		const state = {
			uiMessages: gameMessages.value,
			commandHistory: commandHistory.value,
			lastNorth: coordMatch ? parseInt(coordMatch[1]) : 0,
			lastWest: coordMatch ? parseInt(coordMatch[2]) : 0,
			lastPlaceName: playerPlaceName.value
		}
		localStorage.setItem(UI_STATE_KEY, JSON.stringify(state))
	} catch (error) {
		console.error('Error saving UI state:', error)
	}
}

async function resetGame() {
	if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
		try {
			await fetch('/api/rpg', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: userId.value })
			})

			localStorage.removeItem(UI_STATE_KEY)
			gameMessages.value = [...INITIAL_MESSAGES]
			commandHistory.value = []
			historyIndex.value = -1
			userInput.value = ''
			playerCoordinates.value = 'N: 0, W: 0'
			playerPlaceName.value = 'Unknown location'

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
		const data = await APIClient.processCommand(userInput.value, userId.value)

		if ('error' in data) {
			addMessage(data.error)
		} else {
			addMessage(data.response)
			// Update location from API response
			const gs = data.gameState
			if (gs?.coordinates) {
				playerCoordinates.value = `N: ${gs.coordinates.north}, W: ${gs.coordinates.west}`
			}
			if (gs?.currentPlace?.name) {
				playerPlaceName.value = gs.currentPlace.name
			}
		}

		saveUIState()
	} catch (error) {
		console.error('Error processing command:', error)
		addMessage('⚠️ The magical connection seems to be disturbed. Your command may not have been processed.')
	} finally {
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
function handleAction(command: string) {
	if (isLoading.value) return
	userInput.value = command
	handleCommand()
}

function handleCharacterClick(name: string) {
	if (isLoading.value) return
	userInput.value = `talk to ${name}`
	handleCommand()
}

function handlePlaceClick(name: string) {
	if (isLoading.value) return
	userInput.value = `go to ${name}`
	handleCommand()
}

// Track if component is mounted to prevent memory leaks
let isMounted = false

// Initialize game
onMounted(() => {
	isMounted = true

	// Generate a random user ID if not exists
	userId.value = localStorage.getItem('rpg_user_id') ||
		Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
	localStorage.setItem('rpg_user_id', userId.value)

	// Load saved UI state (messages, command history, last known location)
	loadUIState()

	nextTick(() => {
		if (isMounted) {
			scrollToBottom()
			inputField.value?.focus()
		}
	})

	if (isMounted) {
		document.addEventListener('keydown', handleKeyDown)
	}
})

onBeforeUnmount(() => {
	isMounted = false
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
	background-color: var(--theme-bg, #1a1a1a);
	color: var(--theme-rpg-terminal-text, #33ff33);
	font-family: var(--theme-font-body, 'Courier New', monospace);
}

.game-output {
	width: 80%;
	max-width: 800px;
	height: 70vh;
	background-color: var(--theme-rpg-terminal-bg, #000);
	border: 2px solid var(--theme-rpg-terminal-border, #33ff33);
	border-radius: var(--theme-card-radius, 5px);
	padding: 20px;
	margin-bottom: 20px;
	overflow-y: auto;
	box-shadow: 0 0 10px var(--theme-card-shadow, rgba(51, 255, 51, 0.3));
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
	background-color: var(--theme-input-bg, #000);
	border: 2px solid var(--theme-rpg-terminal-border, #33ff33);
	border-radius: var(--theme-card-radius, 5px);
	color: var(--theme-input-text, #33ff33);
	font-family: var(--theme-font-body, 'Courier New', monospace);
	font-size: 1em;
	outline: none;
	box-shadow: 0 0 10px var(--theme-card-shadow, rgba(51, 255, 51, 0.3));
}

.reset-button {
	padding: 10px 20px;
	background-color: var(--theme-rpg-terminal-bg, #000);
	border: 2px solid var(--theme-accent-danger, #ff3333);
	border-radius: var(--theme-card-radius, 5px);
	color: var(--theme-accent-danger, #ff3333);
	font-family: var(--theme-font-body, 'Courier New', monospace);
	font-size: 1em;
	cursor: pointer;
	transition: all var(--theme-transition, 0.3s ease);
}

.reset-button:hover {
	background-color: var(--theme-accent-danger, #ff3333);
	color: var(--theme-rpg-terminal-bg, #000);
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
	background: var(--theme-rpg-terminal-bg, #000);
}

.game-output::-webkit-scrollbar-thumb {
	background: var(--theme-rpg-terminal-border, #33ff33);
	border-radius: 4px;
}

.game-output::-webkit-scrollbar-thumb:hover {
	opacity: 0.8;
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
	background-color: var(--theme-rpg-terminal-bg, #000);
	border: 2px solid var(--theme-rpg-terminal-border, #33ff33);
	border-radius: var(--theme-card-radius, 5px);
	color: var(--theme-rpg-terminal-text, #33ff33);
	font-family: var(--theme-font-body, 'Courier New', monospace);
	font-size: 0.9em;
	cursor: pointer;
	transition: all var(--theme-transition, 0.3s ease);
}

.command-button:hover:not(:disabled) {
	background-color: var(--theme-rpg-terminal-text, #33ff33);
	color: var(--theme-rpg-terminal-bg, #000);
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
	border-color: var(--theme-text-subtle, #666);
	color: var(--theme-text-subtle, #666);
}

.dropdown-content {
	display: none;
	position: absolute;
	right: 0;
	background-color: var(--theme-rpg-terminal-bg, #000);
	min-width: 160px;
	box-shadow: 0 0 10px var(--theme-card-shadow, rgba(51, 255, 51, 0.3));
	z-index: 1;
	border: 2px solid var(--theme-text-subtle, #666);
	border-radius: var(--theme-card-radius, 5px);
}

.dropdown:hover .dropdown-content {
	display: block;
}

.dropdown-item {
	width: 100%;
	padding: 8px 16px;
	background: none;
	border: none;
	color: var(--theme-accent-danger, #ff3333);
	font-family: var(--theme-font-body, 'Courier New', monospace);
	font-size: 0.9em;
	cursor: pointer;
	text-align: left;
}

.dropdown-item:hover:not(:disabled) {
	background-color: var(--theme-accent-danger, #ff3333);
	color: var(--theme-rpg-terminal-bg, #000);
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
	color: var(--theme-rpg-item, #ffcc00);
	font-weight: bold;
}

:deep(.person) {
	color: var(--theme-rpg-character, #ff6b6b);
	font-weight: bold;
}

:deep(.place) {
	color: var(--theme-rpg-place, #4dffb8);
	font-weight: bold;
}

:deep(.command) {
	color: var(--theme-rpg-command, #888);
	font-style: italic;
}

.player-location {
	position: fixed;
	top: 20px;
	left: 20px;
	background: var(--theme-rpg-terminal-bg, #000);
	border: 2px solid var(--theme-rpg-terminal-border, #33ff33);
	border-radius: var(--theme-card-radius, 5px);
	padding: 10px;
	font-family: var(--theme-font-body, 'Courier New', monospace);
	z-index: 1000;
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.location-label {
	color: var(--theme-text-subtle, #666);
	font-size: 0.9em;
}

.coordinates {
	color: var(--theme-rpg-terminal-text, #33ff33);
	font-weight: bold;
}

.place-name {
	color: var(--theme-rpg-place, #66ff66);
	font-weight: bold;
}
</style>
