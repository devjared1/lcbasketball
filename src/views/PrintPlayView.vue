<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Diagram } from '@/types'
import { usePlays } from '@/composables/usePlays'
import CourtCanvas from '@/components/CourtCanvas.vue'

const route = useRoute()
const { plays, fetchPlays } = usePlays()

const play = computed(() => plays.value.find((p) => p.id === route.params.id) ?? null)

const allPhases = computed<Diagram[]>(() => {
  if (!play.value) return []
  const d = play.value.diagram
  const base: Diagram = { courtType: d.courtType, elements: d.elements }
  const extras = (d.phases ?? []).map((els) => ({ courtType: d.courtType, elements: els }))
  return [base, ...extras]
})

const ready = ref(false)

onMounted(async () => {
  if (!plays.value.length) await fetchPlays()
  ready.value = true
  // Give Vue a tick to render, then print
  setTimeout(() => window.print(), 300)
})
</script>

<template>
  <div v-if="!ready || !play" class="flex h-screen items-center justify-center text-ink-500">
    Loading…
  </div>

  <div v-else class="print-sheet bg-white text-black">
    <!-- Each phase is one print page -->
    <div
      v-for="(phase, idx) in allPhases"
      :key="idx"
      class="print-page"
    >
      <header class="mb-4 border-b-2 border-black pb-3">
        <div class="flex items-baseline justify-between">
          <h1 class="text-2xl font-extrabold tracking-tight">{{ play.name }}</h1>
          <span v-if="allPhases.length > 1" class="text-sm font-semibold text-gray-600">
            Phase {{ idx + 1 }} / {{ allPhases.length }}
          </span>
        </div>
        <div class="mt-1 flex items-center gap-4 text-sm text-gray-600">
          <span v-if="play.category" class="font-semibold uppercase tracking-wide">{{ play.category }}</span>
          <span v-if="play.is_scouting" class="rounded bg-gray-200 px-2 py-0.5 text-xs font-bold uppercase">Scouting</span>
        </div>
      </header>

      <div class="court-diagram mx-auto max-w-lg">
        <CourtCanvas :model-value="phase" :total-phases="allPhases.length" />
      </div>

      <div v-if="play.description && idx === 0" class="mt-6 rounded border border-gray-300 p-4">
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Notes</p>
        <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ play.description }}</p>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  /* Hide browser chrome and everything outside print-sheet */
  body > *:not(.print-sheet) { display: none !important; }
  body, html { background: white !important; }
  .print-page { page-break-after: always; padding: 1.5rem; }
  .print-page:last-child { page-break-after: avoid; }
}

@media screen {
  .print-sheet { max-width: 720px; margin: 0 auto; padding: 2rem; }
  .print-page { margin-bottom: 4rem; }
}
</style>
