<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Diagram, PlayDraft } from '@/types'
import { usePlays } from '@/composables/usePlays'
import CourtCanvas from '@/components/CourtCanvas.vue'
import VideoUploader from '@/components/VideoUploader.vue'

const route = useRoute()
const router = useRouter()
const { plays, fetchPlays, createPlay, updatePlay } = usePlays()

// null when on /plays/new; UUID string when on /plays/:id
const playId = computed(() => (route.params.id as string) || null)
const play = computed(() => plays.value.find((p) => p.id === playId.value) ?? null)
const isNew = computed(() => !playId.value)

onMounted(async () => {
  // Support direct navigation to /plays/:id without going through PlaysView
  if (!plays.value.length) await fetchPlays()
})

const PLAY_CATEGORIES = [
  'Half-court set',
  'BLOB',
  'SLOB',
  'Press break',
  'Fast break',
  'Motion offense',
  'Zone offense',
  'End-of-game',
  'Special situation',
]

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

// Populate form when play data arrives (handles direct-URL navigation)
watch(
  play,
  (p) => {
    if (p) {
      form.name = p.name
      form.description = p.description ?? ''
      form.category = p.category ?? ''
      form.court_type = p.court_type
      form.diagram = JSON.parse(JSON.stringify(p.diagram)) as Diagram
    }
  },
  { immediate: true },
)

// Keep court_type and diagram.courtType in lockstep
watch(
  () => form.diagram.courtType,
  (ct) => { form.court_type = ct },
)

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    if (playId.value) {
      await updatePlay(playId.value, { ...form })
    } else {
      const created = await createPlay({ ...form })
      if (created) {
        // Swap to edit route so the video section becomes available
        await router.replace(`/plays/${created.id}`)
      }
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <!-- sticky page header -->
    <div
      class="sticky top-0 z-10 -mx-4 -mt-6 flex items-center gap-3 border-b border-ink-700/60 bg-ink-900/95 px-4 py-3 backdrop-blur-xl"
    >
      <button class="btn-ghost py-1.5 text-sm" @click="router.push('/plays')">← Back</button>
      <h1 class="font-stencil grow text-lg font-bold">
        {{ isNew ? 'New play' : 'Edit play' }}
      </h1>
      <button
        class="btn-primary py-1.5 text-sm"
        :disabled="!form.name.trim() || saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : isNew ? 'Create' : 'Save' }}
      </button>
    </div>

    <!-- metadata -->
    <div class="grid gap-3 sm:grid-cols-3">
      <div>
        <label class="label" for="pe-name">Name</label>
        <input
          id="pe-name"
          v-model="form.name"
          class="input"
          placeholder="Horns flare"
          autofocus
        />
      </div>
      <div>
        <label class="label" for="pe-cat">Category</label>
        <select id="pe-cat" v-model="form.category" class="input">
          <option value="">— No category —</option>
          <option v-for="cat in PLAY_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="pe-desc">Notes</label>
        <textarea
          id="pe-desc"
          v-model="form.description"
          rows="2"
          class="input resize-none"
          placeholder="When to call it, reads, counters…"
        />
      </div>
    </div>

    <!-- diagram -->
    <div>
      <label class="label">Diagram</label>
      <CourtCanvas v-model="form.diagram" editable />
    </div>

    <!-- video clips (only once the play exists in the DB) -->
    <div v-if="play" class="border-t border-ink-700 pt-4">
      <label class="label">Video clips</label>
      <VideoUploader :play="play" />
    </div>
    <p v-else class="text-xs text-ink-500">Save the play first to attach video clips.</p>
  </section>
</template>
