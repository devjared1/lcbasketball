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

// ---- Shot chart: selected player filter ----
const shotChartPlayerId = ref<string | null>(null)
const showShotChart = ref(false)

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

// ----- new game sheet -----
const showNewGameSheet = ref(false)
const newOpponent = ref('')
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
    showNewGameSheet.value = false
    selectedPlayerId.value = null
    await openGame(g)
  }
}

async function openGame(g: Game) {
  activeGame.value = g
  activePeriod.value = 1
  selectedPlayerId.value = null
  shotChartPlayerId.value = null
  showShotChart.value = false
  await Promise.all([fetchEvents(g.id), fetchSubEvents(g.id)])
}

async function onDeleteGame(g: Game) {
  if (!confirm(`Delete game vs ${g.opponent}? All stat events will be removed.`)) return
  await deleteGame(g.id)
  if (activeGame.value?.id === g.id) activeGame.value = null
}

// ----- live tracking -----
const SCORING_STATS: { stat: StatType; label: string; tone: string }[] = [
  { stat: 'fg_made',    label: '2FG+', tone: 'bg-home/20 text-home' },
  { stat: 'fg_miss',   label: '2FG−', tone: 'bg-ink-700 text-ink-500' },
  { stat: 'three_made', label: '3FG+', tone: 'bg-home/20 text-home' },
  { stat: 'three_miss', label: '3FG−', tone: 'bg-ink-700 text-ink-500' },
  { stat: 'ft_made',   label: 'FT+',  tone: 'bg-home/20 text-home' },
  { stat: 'ft_miss',   label: 'FT−',  tone: 'bg-ink-700 text-ink-500' },
]

const OTHER_STATS: { stat: StatType; label: string; tone: string }[] = [
  { stat: 'rebound_def', label: 'DREB', tone: 'bg-ink-700 text-chalk' },
  { stat: 'rebound_off', label: 'OREB', tone: 'bg-ink-700 text-chalk' },
  { stat: 'assist',      label: 'AST',  tone: 'bg-ink-700 text-chalk' },
  { stat: 'steal',       label: 'STL',  tone: 'bg-ink-700 text-chalk' },
  { stat: 'block',       label: 'BLK',  tone: 'bg-ink-700 text-chalk' },
  { stat: 'turnover',    label: 'TOV',  tone: 'bg-rim/20 text-rim' },
  { stat: 'foul',        label: 'FOUL', tone: 'bg-rim/20 text-rim' },
]

const selectedPlayerId = ref<string | null>(null)
const selectedPlayer = computed(() => players.value.find((p) => p.id === selectedPlayerId.value) ?? null)

async function tap(stat: StatType) {
  if (!activeGame.value || !selectedPlayerId.value) return
  await recordStat(activeGame.value.id, selectedPlayerId.value, stat, activePeriod.value)
}

const boxScore = computed(() => buildBoxScore(players.value, events.value))

function exportCsv() {
  if (!activeGame.value) return
  const label = `${activeGame.value.opponent} ${activeGame.value.played_on}`
  const csv = boxScoreToCsv(boxScore.value, label)
  downloadCsv(`boxscore-${activeGame.value.opponent}-${activeGame.value.played_on}.csv`, csv)
}

// ----- substitution UI -----
const subPickerOpen = ref(false)

async function doSub(playerIdOut: string) {
  if (!activeGame.value || !selectedPlayerId.value) return
  await recordSub(activeGame.value.id, selectedPlayerId.value, playerIdOut, activePeriod.value)
  subPickerOpen.value = false
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
    const playerGameIds = new Set(
      allEvents.value
        .filter((e) => e.player_id === r.player_id)
        .map((e) => e.game_id),
    )
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
  <section class="flex flex-col gap-4">
    <hr class="border-ink-500" />
    <!-- Sticky page header -->
    <div
      class="sticky top-0 z-10 -mx-4 -mt-6 flex items-center gap-3 border-b border-ink-700/60 bg-ink-900/95 px-4 py-3 backdrop-blur-xl">
      <h1 class="font-stencil grow text-lg font-bold capitalize leading-tight">Stats</h1>
      <!-- Mode tabs -->
      <div class="flex gap-1 rounded-lg bg-ink-800 p-0.5">
        <button
          class="rounded-md px-3 py-1 text-xs font-semibold transition"
          :class="mode === 'game' ? 'bg-rim text-white' : 'text-ink-500 hover:text-chalk'"
          @click="mode = 'game'"
        >Game</button>
        <button
          class="rounded-md px-3 py-1 text-xs font-semibold transition"
          :class="mode === 'season' ? 'bg-rim text-white' : 'text-ink-500 hover:text-chalk'"
          @click="mode = 'season'"
        >Season</button>
      </div>

      <template v-if="mode === 'game'">
        <button
          v-if="activeGame"
          class="btn-ghost py-1.5 text-sm"
          @click="exportCsv"
        >Export CSV</button>
        <button
          class="btn-primary py-1.5 text-sm"
          @click="showNewGameSheet = true"
        >New Game</button>
      </template>
    </div>

    <p v-if="error" class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      {{ error }}
    </p>

    <!-- ==================== GAME MODE ==================== -->
    <template v-if="mode === 'game'">
      <div class="grid gap-5 lg:grid-cols-[280px_1fr] py-2">

        <!-- Left: Roster card (always visible in game mode) -->
        <div class="card p-4">
          <h2 class="mb-3 font-stencil font-bold">Roster</h2>
          <ul class="mb-3 max-h-64 space-y-1 overflow-y-auto text-sm">
            <li v-for="p in players" :key="p.id">
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
            <input v-model="newPlayerName" placeholder="Player name" class="input grow" @keyup.enter="onAddPlayer" />
          </div>
          <button class="btn-ghost mt-2 w-full py-1.5 text-xs" @click="onAddPlayer">Add player</button>
        </div>

        <!-- Right: Game grid (no game selected) or active game tracker -->
        <div>
          <!-- No active game: show game cards grid -->
          <template v-if="!activeGame">
            <div v-if="!games.length" class="flex h-48 items-center justify-center rounded-2xl border border-dashed border-ink-700 text-sm text-ink-500">
              No games yet — tap <strong class="mx-1 text-chalk">New Game</strong> to start tracking.
            </div>
            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                v-for="g in games"
                :key="g.id"
                class="group relative cursor-pointer rounded-2xl border border-ink-700 bg-ink-800 p-4 transition hover:border-ink-600 hover:bg-ink-700"
                @click="openGame(g)"
              >
                <p class="font-stencil font-bold leading-tight">vs {{ g.opponent }}</p>
                <p class="mt-1 text-xs text-ink-500">{{ g.played_on }}</p>
                <button
                  class="absolute right-2 top-2 hidden rounded p-1 text-[10px] text-red-500 hover:text-red-300 group-hover:block"
                  @click.stop="onDeleteGame(g)"
                >Del</button>
              </div>
            </div>
          </template>

          <!-- Active game -->
          <template v-else>
            <!-- Game header bar: back + name + period -->
            <div class="mb-4 flex flex-wrap items-center gap-3">
              <button
                class="btn-ghost py-1 text-sm"
                @click="activeGame = null"
              >← Games</button>
              <span class="font-stencil font-bold">vs {{ activeGame.opponent }}</span>
              <span class="text-sm text-ink-500">· {{ activeGame.played_on }}</span>
              <div class="ml-auto flex gap-1">
                <button
                  v-for="p in PERIODS"
                  :key="p.value"
                  class="rounded px-2.5 py-1 text-xs font-bold transition"
                  :class="activePeriod === p.value
                    ? 'bg-rim text-white'
                    : 'bg-ink-700 text-ink-500 hover:text-chalk'"
                  @click="activePeriod = p.value"
                >{{ p.label }}</button>
              </div>
            </div>

            <!-- Stats toolbar card -->
            <div class="mb-4 rounded-2xl border border-ink-700 bg-ink-800 p-4">
              <!-- Selected player header -->
              <div class="mb-3 flex items-center justify-between">
                <div v-if="selectedPlayer" class="flex items-center gap-2">
                  <span class="h-2 w-2 rounded-full bg-rim"></span>
                  <span class="text-sm font-semibold">
                    <span class="font-mono text-ink-500">#{{ selectedPlayer.number ?? '—' }}</span>
                    {{ selectedPlayer.name }}
                  </span>
                  <button
                    class="ml-1 text-xs text-ink-500 hover:text-chalk"
                    title="Undo last stat"
                    @click="undoLastFor(selectedPlayerId!)"
                  >undo</button>
                </div>
                <p v-else class="text-xs italic text-ink-500">↓ Tap a player in the box score to select</p>
                <button
                  v-if="selectedPlayer"
                  class="rounded border px-2.5 py-1 text-xs transition"
                  :class="subPickerOpen
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-ink-600 text-ink-500 hover:border-chalk hover:text-chalk'"
                  @click="subPickerOpen = !subPickerOpen"
                >Sub ↕</button>
              </div>

              <!-- Sub picker -->
              <div v-if="subPickerOpen && selectedPlayer" class="mb-3 rounded-lg bg-ink-900 p-2">
                <p class="mb-1.5 text-xs text-ink-500">
                  <span class="text-yellow-400">{{ selectedPlayer.name }}</span> comes IN for:
                </p>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="other in players.filter(op => op.id !== selectedPlayerId)"
                    :key="other.id"
                    class="rounded bg-ink-700 px-2 py-1 text-xs text-chalk hover:bg-rim hover:text-white"
                    @click="doSub(other.id)"
                  >#{{ other.number ?? '—' }} {{ other.name }}</button>
                  <button class="text-xs text-ink-500 hover:text-chalk" @click="subPickerOpen = false">Cancel</button>
                </div>
              </div>

              <!-- Scoring buttons -->
              <div class="mb-1.5 grid grid-cols-6 gap-1.5">
                <button
                  v-for="b in SCORING_STATS"
                  :key="b.stat"
                  class="rounded-xl py-3 text-xs font-semibold transition"
                  :class="[b.tone, selectedPlayerId ? 'hover:brightness-125 active:scale-95' : 'cursor-default opacity-30']"
                  :disabled="!selectedPlayerId"
                  @click="tap(b.stat)"
                >{{ b.label }}</button>
              </div>
              <!-- Other stat buttons -->
              <div class="grid grid-cols-7 gap-1.5">
                <button
                  v-for="b in OTHER_STATS"
                  :key="b.stat"
                  class="rounded-xl py-3 text-xs font-semibold transition"
                  :class="[b.tone, selectedPlayerId ? 'hover:brightness-125 active:scale-95' : 'cursor-default opacity-30']"
                  :disabled="!selectedPlayerId"
                  @click="tap(b.stat)"
                >{{ b.label }}</button>
              </div>

              <!-- Sub log summary -->
              <div v-if="subEvents.length > 0" class="mt-3 rounded-lg bg-ink-900 p-2">
                <p class="mb-1 text-xs font-semibold text-ink-500">Substitutions</p>
                <ul class="space-y-0.5 text-xs text-ink-500">
                  <li v-for="sub in subEvents" :key="sub.id">
                    Q{{ sub.period }}: {{ players.find(p => p.id === sub.player_id_in)?.name ?? 'Unknown' }}
                    IN for {{ players.find(p => p.id === sub.player_id_out)?.name ?? 'Unknown' }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- Box score table (clickable rows to select player) -->
            <div class="card overflow-x-auto p-4" style="height: calc(100dvh - 360px)">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="font-stencil font-bold">Box Score</h2>
                <button
                  class="text-xs text-ink-500 hover:text-chalk"
                  @click="showShotChart = !showShotChart"
                >{{ showShotChart ? 'Hide' : 'Show' }} shot chart</button>
              </div>

              <!-- Shot chart -->
              <div v-if="showShotChart" class="mb-4">
                <div class="mb-2 flex flex-wrap items-center gap-1">
                  <button
                    class="rounded px-2 py-0.5 text-xs transition"
                    :class="shotChartPlayerId === null ? 'bg-ink-600 text-chalk' : 'text-ink-500 hover:text-chalk'"
                    @click="shotChartPlayerId = null"
                  >All</button>
                  <button
                    v-for="p in players"
                    :key="p.id"
                    class="rounded px-2 py-0.5 text-xs transition"
                    :class="shotChartPlayerId === p.id ? 'bg-rim text-white' : 'bg-ink-700 text-ink-500 hover:text-chalk'"
                    @click="shotChartPlayerId = p.id"
                  >#{{ p.number ?? '—' }} {{ p.name }}</button>
                </div>
                <ShotChart
                  :game-id="activeGame.id"
                  :player-id="shotChartPlayerId"
                  :period="activePeriod"
                />
              </div>

              <table class="w-full text-right font-mono text-sm">
                <thead class="text-ink-500">
                  <tr class="border-b border-ink-700">
                    <th class="py-1 text-left">Player</th>
                    <th>PTS</th><th>FG</th><th>3P</th><th>FT</th>
                    <th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>PF</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in boxScore"
                    :key="r.player_id"
                    class="cursor-pointer border-b border-ink-800 transition"
                    :class="selectedPlayerId === r.player_id
                      ? 'bg-ink-700 ring-1 ring-inset ring-rim'
                      : 'hover:bg-ink-800/70'"
                    @click="selectedPlayerId = selectedPlayerId === r.player_id ? null : r.player_id"
                  >
                    <td class="py-2 text-left">
                      <span class="font-mono text-xs text-ink-500">#{{ r.number ?? '—' }}</span>
                      <span class="ml-1">{{ r.name }}</span>
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
              <td class="py-1.5 text-left">
                <span class="font-mono text-xs text-ink-500">#{{ r.number ?? '—' }}</span>
                <span class="ml-1">{{ r.name }}</span>
              </td>
              <td class="text-ink-500">{{ r.gp }}</td>
              <td class="font-bold text-chalk">{{ r.pts }}</td>
              <td class="font-semibold text-rim">{{ r.ppg }}</td>
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

  <!-- New Game sheet: slides down from top -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showNewGameSheet"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        @click="showNewGameSheet = false"
      />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="-translate-y-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-to-class="-translate-y-full"
    >
      <div
        v-if="showNewGameSheet"
        class="fixed inset-x-0 top-0 z-50 rounded-b-3xl border-b border-ink-700 bg-ink-900 px-4 pb-8 pt-4 shadow-2xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-stencil text-lg font-bold">New Game</h2>
          <button class="btn-ghost py-1 text-sm" @click="showNewGameSheet = false">Cancel</button>
        </div>
        <div class="flex flex-col gap-3">
          <div>
            <label class="label" for="ng-opponent">Opponent</label>
            <input
              id="ng-opponent"
              v-model="newOpponent"
              class="input"
              placeholder="e.g. West Morgan"
              autofocus
              @keyup.enter="onCreateGame"
            />
          </div>
          <div>
            <label class="label" for="ng-date">Date</label>
            <input
              id="ng-date"
              v-model="newDate"
              type="date"
              class="input"
            />
          </div>
          <button
            class="btn-primary py-3 text-sm font-semibold"
            :disabled="!newOpponent.trim()"
            @click="onCreateGame"
          >Start game</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
