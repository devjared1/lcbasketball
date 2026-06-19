<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Game, Player, StatType } from '@/types'
import { useStats } from '@/composables/useStats'
import { buildBoxScore, boxScoreToCsv, downloadCsv } from '@/lib/stats-utils'

const {
  players, games, events, error,
  fetchPlayers, fetchGames, fetchEvents,
  addPlayer, updatePlayer, deletePlayer,
  createGame, deleteGame,
  recordStat, undoLastFor,
} = useStats()

const activeGame = ref<Game | null>(null)

onMounted(async () => {
  await Promise.all([fetchPlayers(), fetchGames()])
})

// ----- roster -----
const newPlayerName = ref('')
const newPlayerNumber = ref<number | null>(null)
async function onAddPlayer() {
  if (!newPlayerName.value.trim()) return
  await addPlayer({
    name: newPlayerName.value.trim(),
    number: newPlayerNumber.value,
    position: null,
    active: true,
  })
  newPlayerName.value = ''
  newPlayerNumber.value = null
}

const editingPlayerId = ref<string | null>(null)
const editPlayerName = ref('')
const editPlayerNumber = ref<number | null>(null)

function startEditPlayer(p: Player) {
  editingPlayerId.value = p.id
  editPlayerName.value = p.name
  editPlayerNumber.value = p.number
}

async function saveEditPlayer(id: string) {
  if (!editPlayerName.value.trim()) return
  await updatePlayer(id, {
    name: editPlayerName.value.trim(),
    number: editPlayerNumber.value,
  })
  editingPlayerId.value = null
}

async function onDeletePlayer(id: string) {
  if (!confirm('Remove this player? Their recorded stats will remain.')) return
  await deletePlayer(id)
}

// ----- games -----
const newOpponent = ref('')
// Use local date string to avoid UTC-offset yesterday-date bug
const newDate = ref(new Date().toLocaleDateString('en-CA'))
async function onCreateGame() {
  if (!newOpponent.value.trim()) return
  const g = await createGame({
    opponent: newOpponent.value.trim(),
    played_on: newDate.value,
    location: null,
    notes: null,
  })
  if (g) {
    newOpponent.value = ''
    await openGame(g)
  }
}
async function openGame(g: Game) {
  activeGame.value = g
  await fetchEvents(g.id)
}

async function onDeleteGame(id: string) {
  if (!confirm('Delete this game and all its stat events?')) return
  await deleteGame(id)
  if (activeGame.value?.id === id) activeGame.value = null
}

// ----- live tracking -----
const STAT_BUTTONS: { stat: StatType; label: string; tone: string }[] = [
  { stat: 'fg_made', label: '+2', tone: 'bg-home/20 text-home' },
  { stat: 'fg_miss', label: 'FG ✗', tone: 'bg-ink-700 text-ink-500' },
  { stat: 'three_made', label: '+3', tone: 'bg-home/20 text-home' },
  { stat: 'three_miss', label: '3 ✗', tone: 'bg-ink-700 text-ink-500' },
  { stat: 'ft_made', label: '+1', tone: 'bg-home/20 text-home' },
  { stat: 'ft_miss', label: 'FT ✗', tone: 'bg-ink-700 text-ink-500' },
  { stat: 'rebound_def', label: 'DREB', tone: 'bg-ink-700 text-chalk' },
  { stat: 'rebound_off', label: 'OREB', tone: 'bg-ink-700 text-chalk' },
  { stat: 'assist', label: 'AST', tone: 'bg-ink-700 text-chalk' },
  { stat: 'steal', label: 'STL', tone: 'bg-ink-700 text-chalk' },
  { stat: 'block', label: 'BLK', tone: 'bg-ink-700 text-chalk' },
  { stat: 'turnover', label: 'TOV', tone: 'bg-rim/20 text-rim' },
  { stat: 'foul', label: 'FOUL', tone: 'bg-rim/20 text-rim' },
]

async function tap(playerId: string, stat: StatType) {
  if (!activeGame.value) return
  await recordStat(activeGame.value.id, playerId, stat)
}

const boxScore = computed(() => buildBoxScore(players.value, events.value))

function exportCsv() {
  if (!activeGame.value) return
  const label = `${activeGame.value.opponent} ${activeGame.value.played_on}`
  const csv = boxScoreToCsv(boxScore.value, label)
  downloadCsv(`boxscore-${activeGame.value.opponent}-${activeGame.value.played_on}.csv`, csv)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="font-stencil text-2xl font-extrabold tracking-tight">Stats</h1>
        <p class="text-sm text-ink-500">Tap to record. Box score builds live. Export to CSV.</p>
      </div>
      <button class="btn-primary" :disabled="!activeGame" @click="exportCsv">Export CSV</button>
    </header>

    <p v-if="error" class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {{ error }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[280px_1fr]">
      <!-- left rail: roster + games -->
      <div class="flex flex-col gap-6">
        <div class="card p-4">
          <h2 class="mb-3 font-stencil font-bold">Roster</h2>
          <ul class="mb-3 max-h-56 space-y-1 overflow-y-auto text-sm">
            <li v-for="p in players" :key="p.id">
              <!-- inline edit row -->
              <template v-if="editingPlayerId === p.id">
                <div class="flex gap-1">
                  <input
                    v-model.number="editPlayerNumber"
                    type="number"
                    placeholder="#"
                    class="input w-12 py-1 text-center text-xs"
                  />
                  <input
                    v-model="editPlayerName"
                    class="input grow py-1 text-xs"
                    @keyup.enter="saveEditPlayer(p.id)"
                  />
                  <button class="text-xs text-home" @click="saveEditPlayer(p.id)">Save</button>
                  <button class="text-xs text-ink-500" @click="editingPlayerId = null">✕</button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-1">
                  <span class="w-7 shrink-0 text-right font-mono text-ink-500">{{ p.number ?? '—' }}</span>
                  <span class="grow">{{ p.name }}</span>
                  <button class="text-[10px] text-ink-500 hover:text-chalk" @click="startEditPlayer(p)">Edit</button>
                  <button class="text-[10px] text-red-400 hover:text-red-300" @click="onDeletePlayer(p.id)">Del</button>
                </div>
              </template>
            </li>
          </ul>
          <div class="flex gap-2">
            <input v-model.number="newPlayerNumber" type="number" placeholder="#" class="input w-14 text-center" />
            <input v-model="newPlayerName" placeholder="Player name" class="input" @keyup.enter="onAddPlayer" />
          </div>
          <button class="btn-ghost mt-2 w-full py-1.5 text-xs" @click="onAddPlayer">Add player</button>
        </div>

        <div class="card p-4">
          <h2 class="mb-3 font-stencil font-bold">Games</h2>
          <ul class="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            <li v-for="g in games" :key="g.id" class="flex items-center gap-1">
              <button
                class="grow rounded px-2 py-1 text-left hover:bg-ink-700"
                :class="activeGame?.id === g.id ? 'bg-ink-700 text-rim' : ''"
                @click="openGame(g)"
              >
                vs {{ g.opponent }}
                <span class="text-ink-500">· {{ g.played_on }}</span>
              </button>
              <button class="shrink-0 text-[10px] text-red-400 hover:text-red-300" @click="onDeleteGame(g.id)">Del</button>
            </li>
          </ul>
          <div class="flex flex-col gap-2 overflow-hidden">
            <input v-model="newOpponent" placeholder="Opponent" class="input" />
            <input v-model="newDate" type="date" class="input min-w-0" />
            <button class="btn-ghost py-1.5 text-xs" @click="onCreateGame">Start game</button>
          </div>
        </div>
      </div>

      <!-- main: tracker + box score -->
      <div class="flex flex-col gap-6">
        <div v-if="!activeGame" class="card p-10 text-center text-ink-500">
          Pick or start a game to begin tracking.
        </div>

        <template v-else>
          <div class="card p-4">
            <h2 class="mb-3 font-stencil font-bold">
              Tracking · vs {{ activeGame.opponent }}
            </h2>
            <p v-if="!players.length" class="text-sm text-ink-500">Add players to the roster first.</p>
            <div v-else class="space-y-3">
              <div v-for="p in players" :key="p.id" class="rounded-lg border border-ink-700 p-2">
                <div class="mb-2 flex items-center justify-between">
                  <span class="font-semibold">
                    <span class="font-mono text-ink-500">#{{ p.number ?? '—' }}</span>
                    {{ p.name }}
                  </span>
                  <button class="text-xs text-ink-500 hover:text-rim" @click="undoLastFor(p.id)">undo</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="b in STAT_BUTTONS"
                    :key="b.stat"
                    class="rounded px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-125"
                    :class="b.tone"
                    @click="tap(p.id, b.stat)"
                  >
                    {{ b.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- box score -->
          <div class="card overflow-x-auto p-4">
            <h2 class="mb-3 font-stencil font-bold">Box score</h2>
            <table class="w-full text-right font-mono text-sm">
              <thead class="text-ink-500">
                <tr class="border-b border-ink-700">
                  <th class="py-1 text-left">Player</th>
                  <th>PTS</th><th>FG</th><th>3P</th><th>FT</th>
                  <th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>PF</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in boxScore" :key="r.player_id" class="border-b border-ink-800">
                  <td class="py-1 text-left font-body">
                    <span class="text-ink-500">#{{ r.number ?? '—' }}</span> {{ r.name }}
                  </td>
                  <td class="font-bold text-chalk">{{ r.pts }}</td>
                  <td>{{ r.fgm }}/{{ r.fga }}</td>
                  <td>{{ r.tpm }}/{{ r.tpa }}</td>
                  <td>{{ r.ftm }}/{{ r.fta }}</td>
                  <td>{{ r.reb }}</td><td>{{ r.ast }}</td><td>{{ r.stl }}</td>
                  <td>{{ r.blk }}</td><td>{{ r.tov }}</td><td>{{ r.pf }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
