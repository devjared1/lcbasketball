<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 pt-6 pb-28">
    <RouterView />
  </main>
  <AppNav />
</template>
