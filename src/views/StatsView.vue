<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Game, Player, StatType } from '@/types'
import { useStats } from '@/composables/useStats'
import { buildBoxScore, boxScoreToCsv, downloadCsv } from '@/lib/stats-utils'
import ShotChart from '@/components/ShotChart.vue'

const {
  players, games, events, allEvents, subEvents, error,
  fetchPlayers, fetchGames, fetchEvents, fetchAllEvents,
  fetchSubEvents, recordSub,
  addPlayer, updatePlayer, deletePlayer,
  createGame, deleteGame,
  recordStat, undoLastFor,
} = useStats()

// ---- Mode: "game" | "season" ----
const mode = ref<'game' | 'season'>('game')

const activeGame = ref<Game | null>(null)

// ---- Period tracking ----
const activePeriod = ref(1)
const PERIODS = [
  { label: 'Q1', value: 1 },
  { label: 'Q2', value: 2 },
  { label: 'Q3', value: 3 },
  { label: 'Q4', value: 4 },
  { label: 'OT', value: 5 },
]

// ---- Tracker sub-tab: "tracker" | "shotchart" ----
const trackerTab = ref<'tracker' | 'shotchart'>('tracker')

// ---- Shot chart: selected player filter ----
const shotChartPlayerId = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([fetchPlayers(), fetchGames(), fetchAllEvents()])
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
  activePeriod.value = 1
  trackerTab.value = 'tracker'
  shotChartPlayerId.value = null
  await Promise.all([fetchEvents(g.id), fetchSubEvents(g.id)])
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
  await recordStat(activeGame.value.id, playerId, stat, activePeriod.value)
}

const boxScore = computed(() => buildBoxScore(players.value, events.value))

function exportCsv() {
  if (!activeGame.value) return
  const label = `${activeGame.value.opponent} ${activeGame.value.played_on}`
  const csv = boxScoreToCsv(boxScore.value, label)
  downloadCsv(`boxscore-${activeGame.value.opponent}-${activeGame.value.played_on}.csv`, csv)
}

// ----- substitution UI -----
// subPickerPlayerId: the player for whom we're picking a sub-out target
const subPickerPlayerId = ref<string | null>(null)

function toggleSubPicker(playerId: string) {
  subPickerPlayerId.value = subPickerPlayerId.value === playerId ? null : playerId
}

async function doSub(playerIdIn: string, playerIdOut: string) {
  if (!activeGame.value) return
  await recordSub(activeGame.value.id, playerIdIn, playerIdOut, activePeriod.value)
  subPickerPlayerId.value = null
}

// ----- season stats -----
const seasonBoxScore = computed(() => buildBoxScore(players.value, allEvents.value))

interface SeasonRow {
  player_id: string
  name: string
  number: number | null
  gp: number
  pts: number
  ppg: string
  fgm: number
  fga: number
  fgPct: string
  tpm: number
  tpa: number
  tpPct: string
  ftm: number
  fta: number
  ftPct: string
  reb: number
  rpg: string
  ast: number
  apg: string
  stl: number
  blk: number
  tov: number
  pf: number
}

const seasonStats = computed<SeasonRow[]>(() => {
  return seasonBoxScore.value.map((r) => {
    // Count unique game_ids for this player in allEvents
    const playerGameIds = new Set(
      allEvents.value
        .filter((e) => e.player_id === r.player_id)
        .map((e) => e.game_id),
    )
    const gp = playerGameIds.size || 1 // avoid div-by-zero; show 0 stats if gp=0

    const actualGp = playerGameIds.size
    const ppg = actualGp > 0 ? (r.pts / actualGp).toFixed(1) : '—'
    const rpg = actualGp > 0 ? (r.reb / actualGp).toFixed(1) : '—'
    const apg = actualGp > 0 ? (r.ast / actualGp).toFixed(1) : '—'
    const fgPct = r.fga > 0 ? Math.round((r.fgm / r.fga) * 100) + '%' : '—'
    const tpPct = r.tpa > 0 ? Math.round((r.tpm / r.tpa) * 100) + '%' : '—'
    const ftPct = r.fta > 0 ? Math.round((r.ftm / r.fta) * 100) + '%' : '—'

    return {
      player_id: r.player_id,
      name: r.name,
      number: r.number,
      gp: actualGp,
      pts: r.pts,
      ppg,
      fgm: r.fgm,
      fga: r.fga,
      fgPct,
      tpm: r.tpm,
      tpa: r.tpa,
      tpPct,
      ftm: r.ftm,
      fta: r.fta,
      ftPct,
      reb: r.reb,
      rpg,
      ast: r.ast,
      apg,
      stl: r.stl,
      blk: r.blk,
      tov: r.tov,
      pf: r.pf,
    }
  })
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="font-stencil text-2xl font-extrabold tracking-tight">Stats</h1>
        <p class="text-sm text-ink-500">Tap to record. Box score builds live. Export to CSV.</p>
      </div>
      <button
        v-if="mode === 'game'"
        class="btn-primary"
        :disabled="!activeGame"
        @click="exportCsv"
      >Export CSV</button>
    </header>

    <!-- Mode tabs -->
    <div class="flex gap-1 rounded-lg bg-ink-800 p-1 w-fit">
      <button
        class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
        :class="mode === 'game' ? 'bg-rim text-white' : 'text-ink-500 hover:text-chalk'"
        @click="mode = 'game'"
      >Game</button>
      <button
        class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
        :class="mode === 'season' ? 'bg-rim text-white' : 'text-ink-500 hover:text-chalk'"
        @click="mode = 'season'"
      >Season</button>
    </div>

    <p v-if="error" class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {{ error }}
    </p>

    <!-- ==================== GAME MODE ==================== -->
    <template v-if="mode === 'game'">
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
            <!-- Period selector -->
            <div class="card p-4">
              <div class="mb-3 flex items-center gap-2">
                <span class="label">Period</span>
                <div class="flex gap-1">
                  <button
                    v-for="p in PERIODS"
                    :key="p.value"
                    class="rounded px-3 py-1 text-xs font-bold transition"
                    :class="activePeriod === p.value
                      ? 'bg-rim text-white'
                      : 'bg-ink-700 text-ink-500 hover:text-chalk'"
                    @click="activePeriod = p.value"
                  >{{ p.label }}</button>
                </div>
              </div>

              <!-- Tracker / Shot Chart sub-tabs -->
              <div class="mb-3 flex gap-1 rounded-lg bg-ink-800 p-1 w-fit">
                <button
                  class="rounded-md px-3 py-1 text-xs font-semibold transition"
                  :class="trackerTab === 'tracker' ? 'bg-ink-700 text-chalk' : 'text-ink-500 hover:text-chalk'"
                  @click="trackerTab = 'tracker'"
                >Tracker</button>
                <button
                  class="rounded-md px-3 py-1 text-xs font-semibold transition"
                  :class="trackerTab === 'shotchart' ? 'bg-ink-700 text-chalk' : 'text-ink-500 hover:text-chalk'"
                  @click="trackerTab = 'shotchart'"
                >Shot Chart</button>
              </div>

              <h2 class="mb-3 font-stencil font-bold">
                Tracking · vs {{ activeGame.opponent }}
                <span class="text-sm font-normal text-ink-500">
                  · {{ PERIODS.find(p => p.value === activePeriod)?.label }}
                </span>
              </h2>

              <!-- TRACKER TAB -->
              <template v-if="trackerTab === 'tracker'">
                <p v-if="!players.length" class="text-sm text-ink-500">Add players to the roster first.</p>
                <div v-else class="space-y-3">
                  <div v-for="p in players" :key="p.id" class="rounded-lg border border-ink-700 p-2">
                    <div class="mb-2 flex items-center justify-between">
                      <span class="font-semibold">
                        <span class="font-mono text-ink-500">#{{ p.number ?? '—' }}</span>
                        {{ p.name }}
                      </span>
                      <div class="flex items-center gap-2">
                        <!-- Sub button -->
                        <button
                          class="rounded border border-ink-600 px-2 py-0.5 text-xs text-ink-500 hover:border-chalk hover:text-chalk"
                          :class="subPickerPlayerId === p.id ? 'border-yellow-500 text-yellow-400' : ''"
                          @click="toggleSubPicker(p.id)"
                        >Sub ↕</button>
                        <button class="text-xs text-ink-500 hover:text-rim" @click="undoLastFor(p.id)">undo</button>
                      </div>
                    </div>

                    <!-- Sub picker (who comes out for this player in) -->
                    <div
                      v-if="subPickerPlayerId === p.id"
                      class="mb-2 rounded bg-ink-800 p-2"
                    >
                      <p class="mb-1 text-xs text-ink-500">
                        <span class="text-yellow-400">{{ p.name }}</span> comes IN for:
                      </p>
                      <div class="flex flex-wrap gap-1">
                        <button
                          v-for="other in players.filter(op => op.id !== p.id)"
                          :key="other.id"
                          class="rounded bg-ink-700 px-2 py-1 text-xs text-chalk hover:bg-rim hover:text-white"
                          @click="doSub(p.id, other.id)"
                        >
                          #{{ other.number ?? '—' }} {{ other.name }}
                        </button>
                        <button
                          class="text-xs text-ink-500 hover:text-chalk"
                          @click="subPickerPlayerId = null"
                        >Cancel</button>
                      </div>
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

                <!-- Sub log summary -->
                <div v-if="subEvents.length > 0" class="mt-3 rounded bg-ink-800 p-2">
                  <p class="mb-1 text-xs font-semibold text-ink-500">Substitutions</p>
                  <ul class="space-y-0.5 text-xs text-ink-500">
                    <li v-for="sub in subEvents" :key="sub.id">
                      Q{{ sub.period }}: {{ players.find(p => p.id === sub.player_id_in)?.name ?? 'Unknown' }}
                      IN for {{ players.find(p => p.id === sub.player_id_out)?.name ?? 'Unknown' }}
                    </li>
                  </ul>
                </div>
              </template>

              <!-- SHOT CHART TAB -->
              <template v-else>
                <!-- Player filter for shot chart -->
                <div class="mb-3 flex flex-wrap items-center gap-1">
                  <span class="label">Filter player:</span>
                  <button
                    class="rounded px-2 py-0.5 text-xs transition"
                    :class="shotChartPlayerId === null ? 'bg-ink-600 text-chalk' : 'text-ink-500 hover:text-chalk'"
                    @click="shotChartPlayerId = null"
                  >All</button>
                  <button
                    v-for="p in players"
                    :key="p.id"
                    class="rounded px-2 py-0.5 text-xs transition"
                    :class="shotChartPlayerId === p.id ? 'bg-rim text-white' : 'text-ink-500 hover:text-chalk bg-ink-700'"
                    @click="shotChartPlayerId = p.id"
                  >#{{ p.number ?? '—' }} {{ p.name }}</button>
                </div>

                <ShotChart
                  :game-id="activeGame.id"
                  :player-id="shotChartPlayerId"
                  :period="activePeriod"
                />
              </template>
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
    </template>

    <!-- ==================== SEASON MODE ==================== -->
    <template v-else>
      <div class="card overflow-x-auto p-4">
        <h2 class="mb-1 font-stencil font-bold">Season Stats</h2>
        <p class="mb-4 text-xs text-ink-500">Aggregated across all recorded games.</p>

        <table class="w-full text-right font-mono text-sm">
          <thead class="text-ink-500">
            <tr class="border-b border-ink-700">
              <th class="py-1 text-left">Player</th>
              <th title="Games Played">GP</th>
              <th>PTS</th>
              <th title="Points per game">PPG</th>
              <th>FG%</th>
              <th>3P%</th>
              <th>FT%</th>
              <th>REB</th>
              <th title="Rebounds per game">RPG</th>
              <th>AST</th>
              <th title="Assists per game">APG</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>PF</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="seasonStats.length === 0">
              <td colspan="15" class="py-6 text-center text-ink-500">
                No season data yet. Record some game stats first.
              </td>
            </tr>
            <tr
              v-for="r in seasonStats"
              :key="r.player_id"
              class="border-b border-ink-800 hover:bg-ink-800/40"
            >
              <td class="py-1.5 text-left font-body">
                <span class="text-ink-500">#{{ r.number ?? '—' }}</span> {{ r.name }}
              </td>
              <td class="text-ink-500">{{ r.gp }}</td>
              <td class="font-bold text-chalk">{{ r.pts }}</td>
              <td class="text-rim font-semibold">{{ r.ppg }}</td>
              <td>{{ r.fgPct }}</td>
              <td>{{ r.tpPct }}</td>
              <td>{{ r.ftPct }}</td>
              <td>{{ r.reb }}</td>
              <td class="text-ink-500">{{ r.rpg }}</td>
              <td>{{ r.ast }}</td>
              <td class="text-ink-500">{{ r.apg }}</td>
              <td>{{ r.stl }}</td>
              <td>{{ r.blk }}</td>
              <td>{{ r.tov }}</td>
              <td>{{ r.pf }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
