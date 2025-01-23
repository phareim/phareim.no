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
				placeholder="Skriv din kommando..."
				ref="inputField"
				autocomplete="off"
				:disabled="isLoading"
			>
		</div>
	</div>
</template>

<script>
export default {
	data() {
		return {
			userInput: '',
			gameMessages: ['Velkommen til tekstspillet!', 'Skriv "hjelp" for å se tilgjengelige kommandoer.'],
			commandHistory: [],
			historyIndex: -1,
			isLoading: false
		}
	},
	mounted() {
		// Hold fokus på input-feltet
		this.$refs.inputField.focus();
		
		// Legg til lyttere for piltaster
		document.addEventListener('keydown', this.handleKeyDown);
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.handleKeyDown);
	},
	methods: {
		handleCommand() {
			if (!this.userInput.trim() || this.isLoading) return;
			
			this.isLoading = true;
			
			// Lagre kommandoen i historikken
			this.commandHistory.push(this.userInput);
			this.historyIndex = this.commandHistory.length;
			
			// Vis kommandoen i output
			this.addMessage(`> ${this.userInput}`);
			
			// Send kommandoen til API-et
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
					this.addMessage(`Feil: ${data.error}`);
					if (data.details) {
						this.addMessage(`Detaljer: ${data.details}`);
					}
				} else {
					this.addMessage(data.response);
				}
			})
			.catch(error => {
				console.error('Feil ved sending av kommando:', error);
				this.addMessage('Beklager, noe gikk galt ved sending av kommandoen.');
			})
			.finally(() => {
				// Nullstill input og scroll til bunnen
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
			// Håndter piltaster for kommandohistorikk
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
}

input {
	width: 100%;
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

input:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

input:focus {
	border-color: #66ff66;
	box-shadow: 0 0 15px rgba(51, 255, 51, 0.5);
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