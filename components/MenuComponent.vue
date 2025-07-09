<template>
	<div>
		<button :class="['hamburger', { 'dark-mode': darkMode, 'active': showMenu }]" @click="toggleMenu">
			<span></span>
			<span></span>
			<span></span>
		</button>
		<div :class="['menu-container', { 'dark-mode': darkMode, 'show-menu': showMenu }]" @touchstart="handleTouchStart"
			@touchend="handleTouchEnd">
			<nav>
				<ul>
					<li>
						<NuxtLink to="/" @click="toggleMenu">Hjem</NuxtLink>
					</li>
					<li v-for="item in menuItems" :key="item.path">
						<NuxtLink :to="item.path" @click="toggleMenu">{{ item.icon }} {{ item.title }}</NuxtLink>
					</li>
				</ul>
			</nav>
		</div>
	</div>
</template>

<script>
export default {
	data() {
		return {
			darkMode: false,
			showMenu: false,
			touchStartX: 0,
			menuItems: []
		};
	},
	async mounted() {
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.darkMode = true;
		}
		
		try {
			const response = await fetch('/api/menu')
			this.menuItems = await response.json()
		} catch (error) {
			console.error('Error fetching menu items:', error)
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
.hamburger {
	position: fixed;
	top: 1.5rem;
	right: 1.5rem;
	width: 30px;
	height: 24px;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 0;
	z-index: 1001;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.hamburger span {
	width: 100%;
	height: 2px;
	background-color: #333;
	transition: all 0.3s ease;
	border-radius: 1px;
}

.hamburger.dark-mode span {
	background-color: #fff;
}

.hamburger:hover span {
	opacity: 0.7;
}

/* Animasjon for hamburger-menyen når den er aktiv */
.hamburger.active span:nth-child(1) {
	transform: translateY(11px) rotate(45deg);
}

.hamburger.active span:nth-child(2) {
	opacity: 0;
}

.hamburger.active span:nth-child(3) {
	transform: translateY(-11px) rotate(-45deg);
}

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
