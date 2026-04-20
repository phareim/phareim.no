<template>
	<div>
		<div v-if="showMenu" class="menu-backdrop" @click="toggleMenu" @touchstart.prevent="toggleMenu"></div>
		<button
			ref="hamburgerRef"
			:class="['hamburger', { 'active': showMenu }]"
			@click="toggleMenu"
			:aria-label="showMenu ? 'Close menu' : 'Open menu'"
			:aria-expanded="showMenu"
			aria-controls="site-menu"
		>
			<span></span>
			<span></span>
			<span></span>
		</button>
		<div
			id="site-menu"
			:class="['menu-container', { 'show-menu': showMenu }]"
			@touchstart="handleTouchStart"
			@touchend="handleTouchEnd"
			@keydown="handleMenuKeyDown"
		>
			<nav aria-label="Site navigation">
				<ul>
					<li v-for="(item, index) in menuItems" :key="item.path" :style="{ '--item-index': index }">
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
						:aria-label="`Switch to ${theme.name} theme`"
						:aria-pressed="activeTheme === theme.id"
					>
						{{ theme.icon }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '~/composables/useTheme'
import { useRoute } from 'vue-router'

interface MenuItem {
  path: string
  title: string
  icon: string
  external?: boolean
}

const { activeTheme, themes, setTheme } = useTheme()
const route = useRoute()
const showMenu = ref(false)
const hamburgerRef = ref<HTMLButtonElement | null>(null)

watch(() => route.path, () => {
	showMenu.value = false
})

// Move focus into menu when it opens; return focus to hamburger on close
watch(showMenu, async (open) => {
	if (open) {
		await nextTick()
		const firstLink = document.querySelector<HTMLElement>('#site-menu a, #site-menu button')
		firstLink?.focus()
	} else {
		hamburgerRef.value?.focus()
	}
})

const touchStartX = ref(0)
const menuItems = ref<MenuItem[]>([])

const toggleMenu = () => {
	showMenu.value = !showMenu.value
}

const closeMenu = () => {
	showMenu.value = false
}

// Close menu on Escape key (global listener)
const handleKeyDown = (event: KeyboardEvent) => {
	if (showMenu.value && event.key === 'Escape') {
		event.stopPropagation()
		closeMenu()
	}
}

// Arrow key navigation within the menu
const handleMenuKeyDown = (event: KeyboardEvent) => {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
	event.preventDefault()
	const focusable = [...document.querySelectorAll<HTMLElement>('#site-menu a, #site-menu button')]
	const idx = focusable.indexOf(document.activeElement as HTMLElement)
	if (event.key === 'ArrowDown') {
		;(focusable[idx + 1] ?? focusable[0])?.focus()
	} else {
		;(focusable[idx - 1] ?? focusable[focusable.length - 1])?.focus()
	}
}

const handleTouchStart = (event: TouchEvent) => {
	touchStartX.value = event.touches[0]!.clientX
}

const handleTouchEnd = (event: TouchEvent) => {
	const touchEndX = event.changedTouches[0]!.clientX
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
	document.addEventListener('keydown', handleKeyDown)
	try {
		const menuResponse = await fetch('/api/menu')
		menuItems.value = await menuResponse.json() as MenuItem[]
	} catch (error) {
		console.error('Error fetching menu items:', error)
	}
})

onBeforeUnmount(() => {
	document.removeEventListener('keydown', handleKeyDown)
})

defineExpose({
	toggleMenu,
	closeMenu,
})
</script>

<style scoped>
.menu-backdrop {
	position: fixed;
	inset: 0;
	z-index: 999;
}

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

.hamburger:focus-visible {
	outline: 2px solid var(--theme-text, #333);
	outline-offset: 6px;
	border-radius: 2px;
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

@keyframes menu-item-in {
	from {
		opacity: 0;
		transform: translateX(16px);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
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
	opacity: 0;
}

.show-menu nav ul li {
	animation: menu-item-in 0.25s ease both;
	animation-delay: calc(var(--item-index, 0) * 45ms + 60ms);
}

nav ul li:hover {
	background-color: var(--theme-card-border, rgba(128, 128, 128, 0.1));
}

nav ul li a {
	text-decoration: none;
	color: var(--theme-text, #333);
	display: block;
	font-size: 1.2rem;
}

nav ul li a.router-link-exact-active {
	font-weight: 600;
	color: var(--theme-accent, #6b8cae);
	border-left: 2px solid var(--theme-accent, #6b8cae);
	margin-left: -2rem;
	padding-left: calc(2rem - 2px);
}

nav ul li a:focus-visible {
	outline: 2px solid var(--theme-accent, #6b8cae);
	outline-offset: 2px;
	border-radius: 2px;
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
	opacity: 0;
}

.show-menu .menu-theme-switcher {
	animation: menu-item-in 0.25s ease both;
	animation-delay: 350ms;
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

.theme-btn:focus-visible {
	outline: 2px solid var(--theme-accent, #6b8cae);
	outline-offset: 2px;
}

.theme-btn.active {
	background: var(--theme-bg, #fff);
	box-shadow: 0 2px 8px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
	border-color: var(--theme-card-border, rgba(0, 0, 0, 0.1));
}

@media (prefers-reduced-motion: reduce) {
	.show-menu nav ul li,
	.show-menu .menu-theme-switcher {
		animation: none;
		opacity: 1;
	}
}
</style>
