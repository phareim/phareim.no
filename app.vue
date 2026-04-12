<template>
  <div :class="themePageClass">
    <SpaceStarfield v-if="activeTheme === 'space'" />
    <ScandiAurora v-if="activeTheme === 'scandi'" />
    <HackerRain v-if="activeTheme === 'hacker'" />
    <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    <MenuComponent ref="menuComponent" />
    <ThemeTransition />
    <KeyboardShortcutsOverlay :open="showShortcuts" @close="showShortcuts = false" />
    <CommandPalette :open="showPalette" @close="showPalette = false" />
  </div>
</template>

<script setup lang="ts">
import MenuComponent from '~/components/MenuComponent.vue';
import SpaceStarfield from '~/components/SpaceStarfield.vue';
import ScandiAurora from '~/components/ScandiAurora.vue';
import HackerRain from '~/components/HackerRain.vue';
import ThemeTransition from '~/components/ThemeTransition.vue';
import KeyboardShortcutsOverlay from '~/components/KeyboardShortcutsOverlay.vue';
import CommandPalette from '~/components/CommandPalette.vue';

const { themePageClass, themeColor, activeTheme, setTheme } = useTheme()
const menuComponent = ref<InstanceType<typeof MenuComponent> | null>(null);
const showShortcuts = ref(false);
const showPalette = ref(false);
const router = useRouter();
const route = useRoute();

const NAV_PAGES = ['/', '/about', '/projects', '/feed', '/now', '/uses', '/guestbook', '/activity', '/stats', '/meta', '/playground', '/gallery'];

useHead({
  meta: [
    { name: 'theme-color', content: themeColor }
  ]
})

const THEME_KEYS: Record<string, 'scandi' | 'hacker' | 'space'> = {
  '1': 'scandi',
  '2': 'hacker',
  '3': 'space',
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Cmd+K / Ctrl+K works everywhere (even in inputs)
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    showPalette.value = !showPalette.value
    showShortcuts.value = false
    return
  }

  // All other shortcuts: ignore when typing in inputs
  const tag = (event.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) return

  const isAdmin = window.location.pathname.includes('admin')

  if (event.key === 'Escape') {
    if (showPalette.value) { showPalette.value = false; return }
    if (showShortcuts.value) { showShortcuts.value = false; return }
    return
  }

  if (event.key === '?' || event.key === '/') {
    event.preventDefault()
    showShortcuts.value = !showShortcuts.value
    return
  }

  if (!isAdmin && event.key === 'm') {
    menuComponent.value?.toggleMenu();
    return
  }

  if (THEME_KEYS[event.key]) {
    setTheme(THEME_KEYS[event.key])
    return
  }

  if (event.key === '[' || event.key === ']') {
    const currentPath = route.path === '/' ? '/' : route.path.replace(/\/$/, '')
    const idx = NAV_PAGES.indexOf(currentPath)
    if (idx === -1) return
    const nextIdx = event.key === '[' ? idx - 1 : idx + 1
    if (nextIdx < 0 || nextIdx >= NAV_PAGES.length) return
    router.push(NAV_PAGES[nextIdx])
  }
};

onMounted(() => {
  document.body.classList.add('scrollable');
  document.documentElement.classList.add('scrollable');
  document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  document.body.classList.remove('scrollable');
  document.documentElement.classList.remove('scrollable');
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single+Ink:wght@100..900&display=swap");

body,
html {
  overflow: hidden;
  user-select: none;
  font-family: "Comfortaa", sans-serif;
  padding: 0;
  margin: 0;
}

body.scrollable,
html.scrollable {
  overflow: auto !important;
}

body.scrollable #app,
html.scrollable #app {
  display: block !important;
  height: auto !important;
}

#app {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 100vh;
  margin: 0;
  padding: 0;
}

h1 {
  font-size: 4rem;
  font-weight: 500;
  margin: 0;
  padding: 0;
}

/* ── Page transitions ─────────────────────────────────────── */

/* Scandinavian (default): gentle fade + lift */
.page-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Hacker theme: sharp horizontal glitch */
.hacker-page .page-enter-active {
  transition: opacity 0.12s steps(4), transform 0.12s steps(4);
}
.hacker-page .page-leave-active {
  transition: opacity 0.08s steps(3), transform 0.08s steps(3);
}
.hacker-page .page-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}
.hacker-page .page-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

/* Space theme: zoom-drift through deep space */
.space-page .page-enter-active {
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.space-page .page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.space-page .page-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.space-page .page-leave-to {
  opacity: 0;
  transform: scale(1.03);
}
</style>
