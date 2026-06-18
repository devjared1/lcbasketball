<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { Diagram, Play, PlayDraft } from '@/types'
import CourtCanvas from './CourtCanvas.vue'
import VideoUploader from './VideoUploader.vue'

const props = defineProps<{ play: Play | null }>()
const emit = defineEmits<{ save: [PlayDraft]; close: [] }>()

function blankDiagram(): Diagram {
  return { courtType: 'half', elements: [] }
}

const form = reactive<PlayDraft>({
  name: '',
  description: '',
  category: '',
  court_type: 'half',
  diagram: blankDiagram(),
})

const saving = ref(false)

watch(
  () => props.play,
  (p) => {
    if (p) {
      form.name = p.name
      form.description = p.description ?? ''
      form.category = p.category ?? ''
      form.court_type = p.court_type
      form.diagram = JSON.parse(JSON.stringify(p.diagram)) as Diagram
    } else {
      form.name = ''
      form.description = ''
      form.category = ''
      form.court_type = 'half'
      form.diagram = blankDiagram()
    }
  },
  { immediate: true },
)

// keep court_type and diagram.courtType in lockstep
watch(
  () => form.diagram.courtType,
  (ct) => {
    form.court_type = ct
  },
)

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  emit('save', { ...form })
  saving.value = false
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
    @click.self="emit('close')"
  >
    <div class="card my-6 w-full max-w-4xl p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-stencil text-xl font-bold">
          {{ play ? 'Edit play' : 'New play' }}
        </h2>
        <button class="text-ink-500 hover:text-chalk" @click="emit('close')">✕</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr_auto]">
        <div class="flex flex-col gap-3">
          <div>
            <label class="label" for="play-name">Name</label>
            <input id="play-name" v-model="form.name" class="input" placeholder="Horns flare" />
          </div>
          <div>
            <label class="label" for="play-cat">Category</label>
            <input id="play-cat" v-model="form.category" class="input" placeholder="Half-court set / BLOB / Press break" />
          </div>
        </div>
        <div class="md:w-64">
          <label class="label" for="play-desc">Notes</label>
          <textarea id="play-desc" v-model="form.description" rows="3" class="input" placeholder="When to call it, reads, counters…" />
        </div>
      </div>

      <div class="mt-4">
        <label class="label">Diagram</label>
        <CourtCanvas v-model="form.diagram" editable />
      </div>

      <div v-if="play" class="mt-5 border-t border-ink-700 pt-4">
        <label class="label">Video examples</label>
        <VideoUploader :play="play" />
      </div>
      <p v-else class="mt-4 text-xs text-ink-500">Save the play first to attach video clips.</p>

      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="!form.name.trim() || saving" @click="save">
          {{ play ? 'Save changes' : 'Create play' }}
        </button>
      </div>
    </div>
  </div>
</template>
