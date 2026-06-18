<script setup lang="ts">
import { isSupabaseConfigured } from '@/lib/supabase'
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
      <RouterLink to="/plays" class="flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-full bg-rim font-stencil text-lg font-extrabold text-ink-900">P</span>
        <span class="font-stencil text-lg font-extrabold tracking-tight">PLAYBOOK</span>
      </RouterLink>
      <nav class="flex gap-1 text-sm font-semibold">
        <RouterLink
          to="/plays"
          class="rounded-md px-3 py-1.5 text-ink-500 hover:text-chalk"
          active-class="bg-ink-700 !text-chalk"
        >Plays</RouterLink>
        <RouterLink
          to="/stats"
          class="rounded-md px-3 py-1.5 text-ink-500 hover:text-chalk"
          active-class="bg-ink-700 !text-chalk"
        >Stats</RouterLink>
      </nav>
      <span
        v-if="!isSupabaseConfigured"
        class="ml-auto rounded-md border border-rim/40 bg-rim/10 px-2 py-1 text-xs text-rim"
        title="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
      >Supabase not configured</span>
    </div>
  </header>
</template>
