<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-4 pb-16">
    <RouterView />
  </main>
  <AppNav />
  <ConfirmDialog />
</template>
