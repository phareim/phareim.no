<template>
	<div :class="['menu-container', { 'dark-mode': darkMode, 'show-menu': showMenu }]" @touchstart="handleTouchStart"
		@touchend="handleTouchEnd">
		<nav>
			<ul>
				<li>
					<NuxtLink to="/" @click="toggleMenu">Hjem</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/about" @click="toggleMenu">Om</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/art" @click="toggleMenu">Kunst</NuxtLink>
				</li>
				<li>
					<NuxtLink to="/drafts/poem" @click="toggleMenu">Dikt</NuxtLink>
				</li>
			</ul>
		</nav>
	</div>
</template>

<script>
export default {
	data() {
		return {
			darkMode: false,
			showMenu: false,
			touchStartX: 0,
		};
	},
	mounted() {
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.darkMode = true;
		}
	},
	methods: {
		toggleMenu() {
			this.showMenu = !this.showMenu;
		},
		handleTouchStart(event) {
			this.touchStartX = event.touches[0].clientX;
		},
		handleTouchEnd(event) {
			const touchEndX = event.changedTouches[0].clientX;
			const swipeDistance = this.touchStartX - touchEndX;
			
			if (Math.abs(swipeDistance) > 50) {
				if (swipeDistance > 0 && !this.showMenu) { // Swipe venstre når menyen er lukket
					this.toggleMenu();
				} else if (swipeDistance < 0 && this.showMenu) { // Swipe høyre når menyen er åpen
					this.toggleMenu();
				}
			}
		},
	}
}
</script>

<style scoped>
.menu-container {
	position: fixed;
	top: 0;
	right: -250px;
	width: 250px;
	height: 100vh;
	background-color: rgba(240, 240, 240, 0.95);
	transition: right 0.3s ease;
	z-index: 1000;
	padding: 2rem 0;
	box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
}

.menu-container.show-menu {
	right: 0;
}

.menu-container.dark-mode {
	background-color: rgba(51, 51, 51, 0.95);
	color: #ffffff;
}

nav ul {
	list-style-type: none;
	padding: 0;
	margin: 0;
}

nav ul li {
	display: block;
	margin: 0;
	padding: 0.5rem 2rem;
	transition: background-color 0.2s ease;
}

nav ul li:hover {
	background-color: rgba(0, 0, 0, 0.1);
}

.dark-mode nav ul li:hover {
	background-color: rgba(255, 255, 255, 0.1);
}

nav ul li a {
	text-decoration: none;
	color: inherit;
	display: block;
	font-size: 1.2rem;
}

.dark-mode nav ul li a {
	color: #ffffff;
}

/* Aktiv lenke styling */
nav ul li a.router-link-active {
	font-weight: bold;
}
</style>
