<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <AppNav />
  <main class="mx-auto max-w-6xl px-4 py-6">
    <RouterView />
  </main>
</template>
