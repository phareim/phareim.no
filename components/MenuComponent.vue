<template>
	<div>
		<button :class="['hamburger', { 'active': showMenu }]" @click="toggleMenu">
			<span></span>
			<span></span>
			<span></span>
		</button>
		<div :class="['menu-container', { 'show-menu': showMenu }]"
			@touchstart="handleTouchStart" @touchend="handleTouchEnd">
			<nav>
				<ul>
					<li v-for="item in menuItems" :key="item.path">
						<NuxtLink :to="item.path" @click="toggleMenu" :target="item.external ? '_blank' : '_self'"
							class="menu-item" :class="{ 'external': item.external }">{{ item.icon }} {{ item.title
							}}<span class="external-arrow" v-if="item.external">→</span></NuxtLink>
					</li>
				</ul>
			</nav>

			<!-- Theme Switcher -->
			<div class="menu-theme-switcher">
				<div class="theme-label">Theme</div>
				<div class="theme-options">
					<button
						v-for="theme in themes"
						:key="theme.id"
						@click="setTheme(theme.id)"
						:class="['theme-btn', { active: activeTheme === theme.id }]"
						:title="theme.name"
					>
						{{ theme.icon }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '~/composables/useTheme'
import { useRoute } from 'vue-router'
const { activeTheme, themes, setTheme } = useTheme()
const route = useRoute()
const showMenu = ref(false)
const touchStartX = ref(0)
const menuItems = ref([])

const toggleMenu = () => {
	showMenu.value = !showMenu.value
}

const handleTouchStart = (event) => {
	touchStartX.value = event.touches[0].clientX
}

const handleTouchEnd = (event) => {
	const touchEndX = event.changedTouches[0].clientX
	const swipeDistance = touchStartX.value - touchEndX

	if (Math.abs(swipeDistance) > 50) {
		if (swipeDistance > 0 && !showMenu.value) {
			toggleMenu()
		} else if (swipeDistance < 0 && showMenu.value) {
			toggleMenu()
		}
	}
}

onMounted(async () => {
	try {
		const menuResponse = await fetch('/api/menu')
		menuItems.value = await menuResponse.json()
	} catch (error) {
		console.error('Error fetching menu items:', error)
	}
})

defineExpose({
	toggleMenu
})

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
	background-color: var(--theme-text, #333);
	transition: all 0.3s ease;
	border-radius: 1px;
	filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.hamburger:hover span {
	opacity: 0.7;
}

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
	height: 100dvh;
	background-color: var(--theme-card-bg, rgba(240, 240, 240, 0.95));
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	transition: right 0.3s ease;
	z-index: 1000;
	padding-top: 4.4rem;
	box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	border-left: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
}

.menu-container.show-menu {
	right: 0;
}

nav {
	flex: 1;
	overflow-y: auto;
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
	background-color: rgba(128, 128, 128, 0.1);
}

nav ul li a {
	text-decoration: none;
	color: var(--theme-text, #333);
	display: block;
	font-size: 1.2rem;
}

nav ul li a.router-link-active {
	font-weight: bold;
}

.menu-item.external {
	color: var(--theme-accent, #164e8a);
}

.menu-item.external:hover {
	opacity: 0.8;
}

.external-arrow {
	font-size: 0.8rem;
	font-weight: bold;
	vertical-align: middle;
	margin-left: 0.2rem;
}

/* Theme Switcher Styles */
.menu-theme-switcher {
	padding: 1rem 1.5rem;
	padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
	border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
	flex-shrink: 0;
	margin-top: auto;
}

.theme-label {
	font-size: 0.8rem;
	text-transform: uppercase;
	letter-spacing: 1px;
	margin-bottom: 0.8rem;
	opacity: 0.7;
	color: var(--theme-text-muted, #666);
}

.theme-options {
	display: flex;
	gap: 0.8rem;
	justify-content: space-between;
}

.theme-btn {
	background: rgba(128, 128, 128, 0.1);
	border: 1px solid transparent;
	font-size: 1.5rem;
	cursor: pointer;
	padding: 0.5rem;
	border-radius: 12px;
	transition: all 0.2s;
	flex: 1;
	display: flex;
	justify-content: center;
}

.theme-btn:hover {
	transform: scale(1.05);
	background: rgba(128, 128, 128, 0.2);
}

.theme-btn.active {
	background: var(--theme-bg, #fff);
	box-shadow: 0 2px 8px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
	border-color: var(--theme-card-border, rgba(0, 0, 0, 0.1));
}
</style>
