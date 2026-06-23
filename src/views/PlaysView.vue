<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Play } from '@/types'
import { usePlays } from '@/composables/usePlays'
import CourtCanvas from '@/components/CourtCanvas.vue'
import PlayAnimator from '@/components/PlayAnimator.vue'
import { ArrowsPointingOutIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const { plays, loading, error, fetchPlays, deletePlay, duplicatePlay } = usePlays()

// ---- tabs: playbook vs. scouting ----
const activeTab = ref<'playbook' | 'scouting'>('playbook')
const search = ref('')

const tabPlays = computed(() =>
  activeTab.value === 'playbook'
    ? plays.value.filter((p) => !p.is_scouting)
    : plays.value.filter((p) => p.is_scouting)
)

const filteredPlays = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tabPlays.value
  return tabPlays.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q),
  )
})

onMounted(fetchPlays)

async function onDelete(p: Play) {
  if (!confirm(`Delete "${p.name}"? This also removes its clips.`)) return
  await deletePlay(p.id)
}

async function onDuplicate(p: Play) {
  const copy = await duplicatePlay(p)
  if (copy) router.push(`/plays/${copy.id}`)
}

function phaseCount(p: Play): number {
  return 1 + (p.diagram.phases?.length ?? 0)
}

const animPlay = ref<Play | null>(null)

// ---- drag-to-reorder (localStorage) ----
const STORAGE_KEY = 'lc-plays-order'
function loadCustomOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
const customOrder = ref<string[]>(loadCustomOrder())
const draggingId = ref<string | null>(null)

const sortedFiltered = computed(() => {
  const orderMap = new Map(customOrder.value.map((id, i) => [id, i]))
  return [...filteredPlays.value].sort((a, b) => {
    const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity
    const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity
    // Both unknown → keep original order from server (updated_at desc)
    return ai === Infinity && bi === Infinity ? 0 : ai - bi
  })
})

function onDragStart(e: DragEvent, p: Play) {
  draggingId.value = p.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, target: Play) {
  e.preventDefault()
  if (!draggingId.value || draggingId.value === target.id) return
  const ids = sortedFiltered.value.map((p) => p.id)
  const from = ids.indexOf(draggingId.value)
  const to = ids.indexOf(target.id)
  if (from === -1 || to === -1) return
  ids.splice(from, 1)
  ids.splice(to, 0, draggingId.value)
  customOrder.value = ids
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

function onDragEnd() {
  draggingId.value = null
}
</script>

<template>
  <section>
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="font-stencil text-2xl font-extrabold tracking-tight">Playbook</h1>
        <p class="text-sm text-ink-500">Diagram sets, attach film, run it back.</p>
      </div>
      <button class="btn-primary" @click="router.push('/plays/new')">+ New play</button>
    </header>

    <!-- Playbook / Scouting tabs -->
    <div class="mb-4 flex gap-0 overflow-hidden rounded-lg border border-ink-700">
      <button
        v-for="tab in (['playbook', 'scouting'] as const)"
        :key="tab"
        :class="[
          'flex-1 py-2 text-sm font-medium transition',
          activeTab === tab ? 'bg-ink-700 text-chalk' : 'text-ink-500 hover:text-chalk',
        ]"
        @click="activeTab = tab; search = ''"
      >
        {{ tab === 'playbook' ? 'Playbook' : 'Scouting' }}
      </button>
    </div>

    <div class="mb-4">
      <input
        v-model="search"
        class="input"
        :placeholder="activeTab === 'playbook' ? 'Search plays…' : 'Search scouting reports…'"
      />
    </div>

    <p v-if="error" class="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {{ error }}
    </p>
    <p v-if="loading" class="text-sm text-ink-500">Loading…</p>

    <div v-if="!loading && !tabPlays.length" class="card p-10 text-center">
      <p class="mb-3 text-ink-500">
        {{ activeTab === 'playbook' ? 'No plays yet.' : 'No scouting reports yet.' }}
      </p>
      <button class="btn-primary" @click="router.push('/plays/new')">
        {{ activeTab === 'playbook' ? 'Diagram your first play' : 'Add scouting report' }}
      </button>
    </div>

    <p v-else-if="!loading && tabPlays.length && !filteredPlays.length" class="text-sm text-ink-500">
      No plays match "{{ search }}".
    </p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="p in sortedFiltered"
        :key="p.id"
        class="card cursor-grab overflow-hidden active:cursor-grabbing"
        :class="draggingId === p.id ? 'opacity-40 ring-2 ring-rim' : ''"
        draggable="true"
        @dragstart="onDragStart($event, p)"
        @dragover="onDragOver($event, p)"
        @dragend="onDragEnd"
      >
        <div class="pointer-events-none bg-court-wood">
          <CourtCanvas :model-value="p.diagram" :editable="false" :total-phases="phaseCount(p)" />
        </div>
        <div class="p-3">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold leading-tight">{{ p.name }}</h3>
            <div class="flex shrink-0 items-center gap-1.5">
              <span v-if="phaseCount(p) > 1" class="rounded bg-ink-700 px-1.5 py-0.5 text-[11px] text-ink-400">
                {{ phaseCount(p) }} phases
              </span>
              <span v-if="p.videos?.length" class="rounded bg-ink-700 px-1.5 py-0.5 text-[11px] text-ink-500">
                ▶ {{ p.videos.length }}
              </span>
            </div>
          </div>
          <p v-if="p.category" class="mt-0.5 text-xs uppercase tracking-wide text-rim">{{ p.category }}</p>
          <p v-if="p.description" class="mt-1 line-clamp-2 text-sm text-ink-500">{{ p.description }}</p>
          <div class="mt-3 flex gap-2">
            <span class="ml-auto" />
            <button class="btn-ghost py-1.5 text-xs" @click="router.push(`/plays/${p.id}`)">
              <ArrowsPointingOutIcon class="h-4 w-4" />
            </button>
            <button
              v-if="phaseCount(p) > 1"
              class="btn-ghost py-1.5 text-xs"
              title="Animate phases"
              @click="animPlay = p"
            >▷</button>
            <button class="btn-ghost py-1.5 text-xs" title="Duplicate" @click="onDuplicate(p)">
              <DocumentDuplicateIcon class="h-4 w-4" />
            </button>
            <button class="btn-danger py-1.5 text-xs" @click="onDelete(p)">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>

  <PlayAnimator
    v-if="animPlay"
    :name="animPlay.name"
    :diagram="animPlay.diagram"
    @close="animPlay = null"
  />
</template>
