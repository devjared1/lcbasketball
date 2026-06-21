<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PracticePlan, PracticePlanItem } from '@/types'
import { usePracticePlan } from '@/composables/usePracticePlan'
import { usePlays } from '@/composables/usePlays'
import CourtCanvas from '@/components/CourtCanvas.vue'

const { plans, items, error, fetchPlans, fetchPlanItems, createPlan, deletePlan, addItem, updateItem, deleteItem, reorderItems } = usePracticePlan()
const { plays, fetchPlays } = usePlays()

const activePlan = ref<PracticePlan | null>(null)
const newPlanName = ref('')
const newPlanDate = ref(new Date().toLocaleDateString('en-CA'))
const newPlanNotes = ref('')
const showNewPlan = ref(false)

onMounted(async () => {
  await Promise.all([fetchPlans(), fetchPlays()])
})

async function onCreatePlan() {
  if (!newPlanName.value.trim()) return
  const p = await createPlan({
    name: newPlanName.value.trim(),
    planned_for: newPlanDate.value || null,
    notes: newPlanNotes.value.trim() || null,
  })
  if (p) {
    newPlanName.value = ''
    newPlanNotes.value = ''
    showNewPlan.value = false
    await openPlan(p)
  }
}

async function openPlan(p: PracticePlan) {
  activePlan.value = p
  await fetchPlanItems(p.id)
}

async function onDeletePlan(p: PracticePlan) {
  if (!confirm(`Delete "${p.name}"?`)) return
  await deletePlan(p.id)
  if (activePlan.value?.id === p.id) activePlan.value = null
}

// Add a play from the playbook into the plan
async function addPlayToPlan(playId: string) {
  if (!activePlan.value) return
  const sortOrder = items.value.length
  await addItem({
    plan_id: activePlan.value.id,
    play_id: playId,
    label: null,
    duration_min: 10,
    sort_order: sortOrder,
    notes: null,
  })
}

// Add a free-form drill (no play)
const newDrillLabel = ref('')
async function addDrill() {
  if (!activePlan.value || !newDrillLabel.value.trim()) return
  await addItem({
    plan_id: activePlan.value.id,
    play_id: null,
    label: newDrillLabel.value.trim(),
    duration_min: 10,
    sort_order: items.value.length,
    notes: null,
  })
  newDrillLabel.value = ''
}

const totalMinutes = computed(() => items.value.reduce((s, i) => s + i.duration_min, 0))

// Drag-to-reorder items
const draggingItemId = ref<string | null>(null)

function onItemDragStart(id: string) { draggingItemId.value = id }

function onItemDragOver(e: DragEvent, target: PracticePlanItem) {
  e.preventDefault()
  if (!draggingItemId.value || draggingItemId.value === target.id) return
  const ids = items.value.map((i) => i.id)
  const from = ids.indexOf(draggingItemId.value)
  const to = ids.indexOf(target.id)
  if (from === -1 || to === -1) return
  const reordered = [...items.value]
  reordered.splice(from, 1)
  reordered.splice(to, 0, items.value[from])
  items.value = reordered
}

async function onItemDragEnd() {
  draggingItemId.value = null
  await reorderItems(items.value.map((i) => i.id))
}

// Inline duration edit
async function onDurationChange(item: PracticePlanItem, val: string) {
  const mins = Math.max(1, parseInt(val) || 1)
  await updateItem(item.id, { duration_min: mins })
}

// Plays not yet in the plan (for the add-from-playbook sidebar)
const availablePlays = computed(() =>
  plays.value.filter((p) => !p.is_scouting),
)
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="font-stencil text-2xl font-extrabold tracking-tight">Practice Plans</h1>
        <p class="text-sm text-ink-500">Build sessions, assign plays, track time.</p>
      </div>
      <button class="btn-primary" @click="showNewPlan = !showNewPlan">+ New plan</button>
    </header>

    <p v-if="error" class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{{ error }}</p>

    <!-- New plan form -->
    <div v-if="showNewPlan" class="card p-4">
      <h2 class="mb-3 font-stencil font-bold">New Practice Plan</h2>
      <div class="flex flex-col gap-3">
        <input v-model="newPlanName" class="input" placeholder="Plan name (e.g. Tuesday practice)" />
        <input v-model="newPlanDate" type="date" class="input" />
        <textarea v-model="newPlanNotes" class="input resize-none" rows="2" placeholder="Goals for the session…" />
        <div class="flex gap-2">
          <button class="btn-primary grow" @click="onCreatePlan">Create</button>
          <button class="btn-ghost" @click="showNewPlan = false">Cancel</button>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[280px_1fr]">
      <!-- Plan list -->
      <div class="flex flex-col gap-3">
        <p v-if="!plans.length" class="text-sm text-ink-500">No plans yet. Create one above.</p>
        <div
          v-for="p in plans"
          :key="p.id"
          class="card cursor-pointer p-3 transition"
          :class="activePlan?.id === p.id ? 'ring-2 ring-rim' : 'hover:ring-1 hover:ring-ink-600'"
          @click="openPlan(p)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-semibold leading-tight">{{ p.name }}</h3>
              <p v-if="p.planned_for" class="text-xs text-ink-500">{{ p.planned_for }}</p>
            </div>
            <button class="shrink-0 text-[10px] text-red-400 hover:text-red-300" @click.stop="onDeletePlan(p)">Del</button>
          </div>
        </div>
      </div>

      <!-- Plan detail -->
      <div v-if="activePlan" class="flex flex-col gap-4">
        <div class="card p-4">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-stencil font-bold">{{ activePlan.name }}</h2>
            <span class="text-sm text-ink-500">{{ totalMinutes }} min total</span>
          </div>

          <!-- Items -->
          <p v-if="!items.length" class="text-sm text-ink-500">No drills yet. Add from your playbook or add a free-form drill below.</p>
          <div class="space-y-2">
            <div
              v-for="item in items"
              :key="item.id"
              class="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800 p-2"
              :class="draggingItemId === item.id ? 'opacity-40' : ''"
              draggable="true"
              @dragstart="onItemDragStart(item.id)"
              @dragover="onItemDragOver($event, item)"
              @dragend="onItemDragEnd"
            >
              <span class="cursor-grab text-ink-500">⠿</span>
              <div class="min-w-0 flex-1">
                <p class="font-medium leading-tight">
                  {{ item.play?.name ?? item.label ?? 'Drill' }}
                </p>
                <p v-if="item.notes" class="text-xs text-ink-500">{{ item.notes }}</p>
              </div>
              <input
                type="number"
                :value="item.duration_min"
                min="1"
                class="input w-16 py-1 text-center text-xs"
                @change="onDurationChange(item, ($event.target as HTMLInputElement).value)"
              />
              <span class="text-xs text-ink-500">min</span>
              <button class="text-[10px] text-red-400 hover:text-red-300" @click="deleteItem(item.id)">✕</button>
            </div>
          </div>

          <!-- Add free-form drill -->
          <div class="mt-3 flex gap-2">
            <input v-model="newDrillLabel" class="input" placeholder="Add drill (e.g. 3-man weave)…" @keyup.enter="addDrill" />
            <button class="btn-ghost shrink-0 py-1.5 text-xs" @click="addDrill">Add</button>
          </div>
        </div>

        <!-- Add from playbook -->
        <div class="card p-4">
          <h3 class="mb-3 font-stencil font-bold text-sm">Add from Playbook</h3>
          <div class="max-h-64 overflow-y-auto">
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="p in availablePlays"
                :key="p.id"
                class="flex items-center gap-2 rounded-lg border border-ink-700 p-2 text-left text-xs hover:border-ink-500 hover:bg-ink-800"
                @click="addPlayToPlan(p.id)"
              >
                <div class="pointer-events-none h-12 w-16 shrink-0 overflow-hidden rounded border border-ink-700 bg-court-wood">
                  <CourtCanvas :model-value="p.diagram" />
                </div>
                <div class="min-w-0">
                  <p class="font-semibold leading-tight">{{ p.name }}</p>
                  <p v-if="p.category" class="text-ink-500">{{ p.category }}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="card p-10 text-center text-ink-500">
        Select or create a plan to get started.
      </div>
    </div>
  </section>
</template>
