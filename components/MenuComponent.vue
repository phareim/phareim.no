<template>
	<div :class="['menu-container', { 'dark-mode': darkMode, 'show-menu': showMenu }]" @touchstart="handleTouchStart"
		@touchend="handleTouchEnd">
		<nav>
			<ul>
				<li>
					<NuxtLink to="/">Home</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/about">About</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/art">art</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/poem">Poem</NuxtLink>
				</li>
				<!-- Flere menyelementer etter behov -->
			</ul>
		</nav>
	</div>
</template>

<script>
export default {
	data() {
		return {
			darkMode: false,
			showMenu: false, // Kontrollerer om menyen er vist
			touchStartX: 0,
		};
	},
	mounted() {
		document.addEventListener('keydown', this.handleKeyDown);
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.darkMode = true;
		}
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.handleKeyDown);
	},
	methods: {
		toggleMenu() {
			this.showMenu = !this.showMenu;
		},
		handleKeyDown(event) {
			if (event.key === 'm') {
				this.toggleMenu();
			}
		},
		handleTouchStart(event) {
			this.touchStartX = event.touches[0].clientX;
		},
		handleTouchEnd(event) {
			const touchEndX = event.changedTouches[0].clientX;
			if (this.touchStartX - touchEndX > 50) { // Swipe fra høyre
				this.toggleMenu();
			}
		},
	}
}
</script>


<style scoped>
.menu-container {
	position: fixed;
	top: 0;
	right: -100%;
	/* Start skjult */
	width: 250px;
	/* Juster etter behov */
	height: 100%;
	background-color: #f0f0f0;
	transition: right 0.5s;
	z-index: 1000;
}

.menu-container.show-menu {
	right: 0;
	/* Vis menyen */
}

.dark-mode {
	background-color: #333333;
	color: #ffffff;
}

.menu-container {
	padding: 20px;
	background-color: #ffffff;
	color: #000000;
}

.menu-container.dark-mode {
	background-color: #333333;
	color: #ffffff;
}

nav ul {
	list-style-type: none;
	padding: 0;
}

nav ul li {
	display: inline-block;
	margin-right: 20px;
}

nav ul li a {
	text-decoration: none;
	color: inherit;
}
</style>
