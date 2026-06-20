<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Diagram } from '@/types'
import CourtCanvas from './CourtCanvas.vue'

const props = defineProps<{ name: string; diagram: Diagram }>()
const emit = defineEmits<{ close: [] }>()

const totalPhases = computed(() => 1 + (props.diagram.phases?.length ?? 0))
const currentPhase = ref(0)
const playing = ref(totalPhases.value > 1)

const displayDiagram = computed<Diagram>(() => {
  if (currentPhase.value === 0) return props.diagram
  return {
    ...props.diagram,
    elements: props.diagram.phases?.[currentPhase.value - 1] ?? [],
  }
})

let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  stopTimer()
  if (totalPhases.value <= 1) return
  timer = setInterval(() => {
    currentPhase.value = (currentPhase.value + 1) % totalPhases.value
  }, 1800)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function togglePlay() {
  playing.value = !playing.value
  if (playing.value) startTimer()
  else stopTimer()
}

function prev() {
  playing.value = false
  stopTimer()
  currentPhase.value = (currentPhase.value - 1 + totalPhases.value) % totalPhases.value
}

function next() {
  playing.value = false
  stopTimer()
  currentPhase.value = (currentPhase.value + 1) % totalPhases.value
}

function jumpTo(i: number) {
  playing.value = false
  stopTimer()
  currentPhase.value = i
}

watch(playing, (v) => { if (v) startTimer(); else stopTimer() }, { immediate: true })

onUnmounted(stopTimer)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex flex-col bg-black/96 p-4 backdrop-blur-sm">
      <!-- header -->
      <div class="mb-4 flex items-center gap-3">
        <button class="btn-ghost py-1.5 text-sm" @click="emit('close')">← Close</button>
        <h2 class="grow truncate font-stencil text-lg font-bold">{{ name }}</h2>
        <span class="shrink-0 text-sm text-ink-400">
          Phase {{ currentPhase + 1 }} / {{ totalPhases }}
        </span>
      </div>

      <!-- court -->
      <div class="flex min-h-0 flex-1 items-center justify-center">
        <div class="w-full max-w-2xl">
          <CourtCanvas :model-value="displayDiagram" />
        </div>
      </div>

      <!-- controls -->
      <div class="mt-4 flex items-center justify-center gap-4">
        <button class="btn-ghost px-5 py-2" :disabled="totalPhases <= 1" @click="prev">← Prev</button>
        <button class="btn-primary px-8 py-2" :disabled="totalPhases <= 1" @click="togglePlay">
          {{ playing ? 'Pause' : 'Play' }}
        </button>
        <button class="btn-ghost px-5 py-2" :disabled="totalPhases <= 1" @click="next">Next →</button>
      </div>

      <!-- phase dots -->
      <div v-if="totalPhases > 1" class="mt-3 flex justify-center gap-2">
        <button
          v-for="i in totalPhases"
          :key="i"
          :class="[
            'h-2 rounded-full transition-all duration-300',
            currentPhase === i - 1 ? 'w-6 bg-rim' : 'w-2 bg-ink-600 hover:bg-ink-400',
          ]"
          @click="jumpTo(i - 1)"
        />
      </div>
    </div>
  </Teleport>
</template>
