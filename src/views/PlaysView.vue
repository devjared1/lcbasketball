<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Play, PlayDraft } from '@/types'
import { usePlays } from '@/composables/usePlays'
import CourtCanvas from '@/components/CourtCanvas.vue'
import PlayEditorModal from '@/components/PlayEditorModal.vue'

const { plays, loading, error, fetchPlays, createPlay, updatePlay, deletePlay, duplicatePlay } = usePlays()

const editorOpen = ref(false)
const editing = ref<Play | null>(null)
const search = ref('')

const filteredPlays = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return plays.value
  return plays.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q),
  )
})

onMounted(fetchPlays)

function openNew() {
  editing.value = null
  editorOpen.value = true
}
function openEdit(p: Play) {
  editing.value = p
  editorOpen.value = true
}

async function onSave(draft: PlayDraft) {
  if (editing.value) {
    const updated = await updatePlay(editing.value.id, draft)
    if (updated) editing.value = updated
  } else {
    const created = await createPlay(draft)
    // keep editor open on the new play so clips can be attached
    if (created) editing.value = created
  }
}

async function onDelete(p: Play) {
  if (!confirm(`Delete "${p.name}"? This also removes its clips.`)) return
  await deletePlay(p.id)
}

async function onDuplicate(p: Play) {
  const copy = await duplicatePlay(p)
  if (copy) {
    editing.value = copy
    editorOpen.value = true
  }
}
</script>

<template>
  <section>
    <header class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="font-stencil text-2xl font-extrabold tracking-tight">Playbook</h1>
        <p class="text-sm text-ink-500">Diagram sets, attach film, run it back.</p>
      </div>
      <button class="btn-primary" @click="openNew">+ New play</button>
    </header>

    <div class="mb-4">
      <input
        v-model="search"
        class="input"
        placeholder="Search by name or category…"
      />
    </div>

    <p v-if="error" class="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {{ error }}
    </p>
    <p v-if="loading" class="text-sm text-ink-500">Loading plays…</p>

    <div v-if="!loading && !plays.length" class="card p-10 text-center">
      <p class="mb-3 text-ink-500">No plays yet.</p>
      <button class="btn-primary" @click="openNew">Diagram your first play</button>
    </div>

    <p v-else-if="!loading && plays.length && !filteredPlays.length" class="text-sm text-ink-500">
      No plays match "{{ search }}".
    </p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="p in filteredPlays" :key="p.id" class="card overflow-hidden">
        <div class="pointer-events-none bg-court-wood">
          <CourtCanvas :model-value="p.diagram" />
        </div>
        <div class="p-3">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold leading-tight">{{ p.name }}</h3>
            <span v-if="p.videos?.length" class="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[11px] text-ink-500">
              ▶ {{ p.videos.length }}
            </span>
          </div>
          <p v-if="p.category" class="mt-0.5 text-xs uppercase tracking-wide text-rim">{{ p.category }}</p>
          <p v-if="p.description" class="mt-1 line-clamp-2 text-sm text-ink-500">{{ p.description }}</p>
          <div class="mt-3 flex gap-2">
            <button class="btn-ghost grow py-1.5 text-xs" @click="openEdit(p)">Open</button>
            <button class="btn-ghost py-1.5 text-xs" title="Duplicate" @click="onDuplicate(p)">Copy</button>
            <button class="btn-danger py-1.5 text-xs" @click="onDelete(p)">Delete</button>
          </div>
        </div>
      </article>
    </div>

    <PlayEditorModal
      v-if="editorOpen"
      :play="editing"
      @save="onSave"
      @close="editorOpen = false"
    />
  </section>
</template>
