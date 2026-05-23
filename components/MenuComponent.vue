<template>
	<div>
		<div v-if="showMenu" class="menu-backdrop" @click="toggleMenu" @touchstart.prevent="toggleMenu"></div>
		<button
			ref="hamburgerRef"
			:class="['hamburger', { 'active': showMenu }]"
			@click="toggleMenu"
			:aria-label="showMenu ? 'Close menu' : 'Open menu'"
			:title="showMenu ? 'Close menu' : 'Menu (M)'"
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
			:inert="!showMenu"
			@touchstart="handleTouchStart"
			@touchend="handleTouchEnd"
			@keydown="handleMenuKeyDown"
		>
			<nav aria-label="Site navigation">
				<ul>
					<li v-for="(item, index) in menuItems" :key="item.path" :style="{ '--item-index': index }">
						<NuxtLink :to="item.path" @click="toggleMenu" :target="item.external ? '_blank' : '_self'"
							class="menu-item" :class="{ 'external': item.external }">{{ item.icon }} {{ item.title
							}}<span class="external-arrow" v-if="item.external" aria-hidden="true">→</span></NuxtLink>
					</li>
				</ul>
			</nav>

			<!-- Page position indicator -->
			<div v-if="navPos.index !== -1" class="menu-nav-hint" aria-label="Current page position in navigation">
				<button
					v-if="navPos.prev"
					class="nav-hint-btn nav-hint-btn--prev"
					:aria-label="`Go to ${navPos.prevLabel}`"
					@click="navigate(navPos.prev)"
				>← {{ navPos.prevLabel }}</button>
				<span v-else class="nav-hint-empty"></span>
				<span class="nav-hint-pos">
					{{ navPos.index + 1 }}<span class="nav-hint-sep" aria-hidden="true">/</span>{{ navPos.total }}
				</span>
				<button
					v-if="navPos.next"
					class="nav-hint-btn nav-hint-btn--next"
					:aria-label="`Go to ${navPos.nextLabel}`"
					@click="navigate(navPos.next)"
				>{{ navPos.nextLabel }} →</button>
				<span v-else class="nav-hint-empty"></span>
			</div>

			<!-- Theme Switcher -->
			<div class="menu-theme-switcher">
				<div class="theme-label">Theme</div>
				<div class="theme-options">
					<button
						v-for="(theme, idx) in themes"
						:key="theme.id"
						@click="setTheme(theme.id)"
						:class="['theme-btn', { active: activeTheme === theme.id }]"
						:title="`${theme.name} (${idx + 1})`"
						:aria-label="`Switch to ${theme.name} theme (keyboard shortcut: ${idx + 1})`"
						:aria-pressed="activeTheme === theme.id"
					>
						{{ theme.icon }}
						<span class="theme-btn-key" aria-hidden="true">{{ idx + 1 }}</span>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '~/composables/useTheme'
import { useRoute, useRouter } from 'vue-router'
import { NAV_PAGES } from '~/composables/useNavPages'

interface MenuItem {
  path: string
  title: string
  icon: string
  external?: boolean
}

const { activeTheme, themes, setTheme } = useTheme()
const route = useRoute()
const router = useRouter()
const showMenu = ref(false)
const hamburgerRef = ref<HTMLButtonElement | null>(null)

const navPos = computed(() => {
  const currentPath = route.path === '/' ? '/' : route.path.replace(/\/$/,'')
  const index = NAV_PAGES.indexOf(currentPath)
  const total = NAV_PAGES.length
  if (index === -1) return { index: -1, total, prev: null, next: null, prevLabel: '', nextLabel: '' }
  const labelOf = (p: string) => (p === '/' ? 'home' : p.slice(1))
  return {
    index,
    total,
    prev: index > 0 ? NAV_PAGES[index - 1]! : null,
    next: index < total - 1 ? NAV_PAGES[index + 1]! : null,
    prevLabel: index > 0 ? labelOf(NAV_PAGES[index - 1]!) : '',
    nextLabel: index < total - 1 ? labelOf(NAV_PAGES[index + 1]!) : '',
  }
})

function navigate(path: string) {
  router.push(path)
  closeMenu()
}

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

let touchStartX = 0
const menuItems = ref<MenuItem[]>([])

// Edge-swipe state — plain vars, no Vue reactivity needed
let edgeSwipeStartX: number | null = null
let edgeSwipeStartY: number | null = null
const EDGE_ZONE = 44   // px from right viewport edge that activates the gesture
const MIN_SWIPE = 60   // minimum horizontal distance to trigger open

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

// Arrow/Home/End key navigation within the menu
const handleMenuKeyDown = (event: KeyboardEvent) => {
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
	event.preventDefault()
	const focusable = [...document.querySelectorAll<HTMLElement>('#site-menu a, #site-menu button')]
	const idx = focusable.indexOf(document.activeElement as HTMLElement)
	if (event.key === 'ArrowDown') {
		;(focusable[idx + 1] ?? focusable[0])?.focus()
	} else if (event.key === 'ArrowUp') {
		;(focusable[idx - 1] ?? focusable[focusable.length - 1])?.focus()
	} else if (event.key === 'Home') {
		focusable[0]?.focus()
	} else {
		focusable[focusable.length - 1]?.focus()
	}
}

// Panel-level touch: swipe the open menu rightward to close it
const handleTouchStart = (event: TouchEvent) => {
	touchStartX = event.touches[0]!.clientX
}

const handleTouchEnd = (event: TouchEvent) => {
	const touchEndX = event.changedTouches[0]!.clientX
	const swipeDistance = touchStartX - touchEndX
	// Negative distance = finger moved rightward = push menu closed
	if (swipeDistance < -50 && showMenu.value) {
		toggleMenu()
	}
}

// Global edge-swipe: touch in rightmost EDGE_ZONE px then swipe left = open menu
function handleGlobalTouchStart(e: TouchEvent) {
	if (showMenu.value) return
	const touch = e.touches[0]
	if (!touch) return
	if (touch.clientX >= window.innerWidth - EDGE_ZONE) {
		edgeSwipeStartX = touch.clientX
		edgeSwipeStartY = touch.clientY
	}
}

function handleGlobalTouchEnd(e: TouchEvent) {
	if (edgeSwipeStartX === null || edgeSwipeStartY === null) return
	const touch = e.changedTouches[0]
	if (!touch) return
	const dx = edgeSwipeStartX - touch.clientX       // positive = swiped left
	const dy = Math.abs(touch.clientY - edgeSwipeStartY)
	if (dx >= MIN_SWIPE && dy < 100) {
		toggleMenu()
	}
	edgeSwipeStartX = null
	edgeSwipeStartY = null
}

onMounted(async () => {
	document.addEventListener('keydown', handleKeyDown)
	document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true })
	document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true })
	try {
		const menuResponse = await fetch('/api/menu')
		menuItems.value = await menuResponse.json() as MenuItem[]
	} catch (error) {
		console.error('Error fetching menu items:', error)
	}
})

onBeforeUnmount(() => {
	document.removeEventListener('keydown', handleKeyDown)
	document.removeEventListener('touchstart', handleGlobalTouchStart)
	document.removeEventListener('touchend', handleGlobalTouchEnd)
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
	background: rgba(0, 0, 0, 0.2);
	backdrop-filter: blur(2px);
	-webkit-backdrop-filter: blur(2px);
	animation: backdrop-in 0.25s ease forwards;
}

@keyframes backdrop-in {
	from { opacity: 0; }
	to   { opacity: 1; }
}

.hamburger {
	position: fixed;
	top: calc(1.5rem - 10px);
	right: calc(1.5rem - 8px);
	width: 30px;
	height: 24px;
	box-sizing: content-box;
	padding: 10px 8px;
	background: transparent;
	border: none;
	cursor: pointer;
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
	right: 0;
	width: 250px;
	height: 100vh;
	height: 100dvh;
	background-color: var(--theme-card-bg, rgba(240, 240, 240, 0.95));
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	transform: translateX(100%);
	transition: transform var(--theme-transition, 0.3s ease);
	z-index: 1000;
	padding-top: 4.4rem;
	box-shadow: -2px 0 8px rgba(0, 0, 0, 0.06), -1px 0 24px var(--theme-card-shadow, transparent);
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	border-left: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
}

.menu-container.show-menu {
	transform: translateX(0);
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
	color: var(--theme-accent, #6b8cae);
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

/* Page nav hint */
.menu-nav-hint {
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	gap: 0.35rem;
	padding: 0.5rem 1.25rem;
	border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
	flex-shrink: 0;
	opacity: 0;
}

.show-menu .menu-nav-hint {
	animation: menu-item-in 0.25s ease both;
	animation-delay: 310ms;
}

.nav-hint-btn {
	background: none;
	border: none;
	color: var(--theme-text-subtle, #aaa);
	cursor: pointer;
	padding: 0.2rem 0.3rem;
	font-size: 0.68rem;
	font-family: inherit;
	transition: color 0.2s ease;
	border-radius: 3px;
	line-height: 1.3;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.nav-hint-btn--prev {
	text-align: left;
}

.nav-hint-btn--next {
	text-align: right;
}

.nav-hint-btn:hover {
	color: var(--theme-accent, #6b8cae);
}

.nav-hint-btn:focus-visible {
	outline: 2px solid var(--theme-accent, #6b8cae);
	outline-offset: 2px;
}

.nav-hint-pos {
	font-size: 0.65rem;
	color: var(--theme-text-subtle, #aaa);
	letter-spacing: 0.06em;
	text-align: center;
	white-space: nowrap;
}

.nav-hint-sep {
	margin: 0 0.12rem;
	opacity: 0.4;
}

.nav-hint-empty {
	display: block;
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
	padding: 0.5rem 0.5rem 0.85rem;
	border-radius: 12px;
	transition: all 0.2s;
	flex: 1;
	display: flex;
	justify-content: center;
	position: relative;
}

.theme-btn-key {
	position: absolute;
	bottom: 0.2rem;
	left: 50%;
	transform: translateX(-50%);
	font-size: 0.5rem;
	font-family: inherit;
	color: var(--theme-text-subtle, #aaa);
	opacity: 0.55;
	line-height: 1;
	letter-spacing: 0.04em;
	pointer-events: none;
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
	.show-menu .menu-nav-hint,
	.show-menu .menu-theme-switcher {
		animation: none;
		opacity: 1;
	}

	.menu-backdrop {
		animation: none;
	}
}
</style>
