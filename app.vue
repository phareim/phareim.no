<template>
  <div :class="themePageClass">
    <SpaceStarfield v-if="activeTheme === 'space'" />
    <NuxtPage />
    <MenuComponent ref="menuComponent" />
  </div>
</template>

<script setup lang="ts">
import MenuComponent from '~/components/MenuComponent.vue';
import SpaceStarfield from '~/components/SpaceStarfield.vue';

const { themePageClass, themeColor, activeTheme } = useTheme()
const menuComponent = ref<InstanceType<typeof MenuComponent> | null>(null);

useHead({
  meta: [
    { name: 'theme-color', content: themeColor }
  ]
})

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'm' && !window.location.pathname.includes('admin')) {
    menuComponent.value?.toggleMenu();
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
</style>
