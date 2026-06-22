<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useShotChart } from '@/composables/useShotChart'
import type { ShotEvent } from '@/types'

const props = defineProps<{
  gameId: string
  playerId: string | null
  period: number
}>()

const { shots, fetchShots, recordShot } = useShotChart()

// Court geometry constants (half-court, viewBox 500x470)
const VB_W = 500
const VB_H = 470

// Pending shot placement
const pendingShot = ref<{ x: number; y: number } | null>(null)

// Fetch shots when gameId changes
watch(() => props.gameId, (id) => {
  if (id) fetchShots(id)
}, { immediate: true })

// Filtered shots by player (or all if no player selected)
const displayShots = computed<ShotEvent[]>(() => {
  if (!props.playerId) return shots.value
  return shots.value.filter((s) => s.player_id === props.playerId)
})

// FG% summary
const fgSummary = computed(() => {
  const made = displayShots.value.filter((s) => s.made).length
  const total = displayShots.value.length
  const pct = total > 0 ? Math.round((made / total) * 100) : 0
  return { made, total, pct }
})

function svgToNorm(svgX: number, svgY: number) {
  return { x: svgX / VB_W, y: svgY / VB_H }
}


function onCourtClick(e: MouseEvent) {
  // If there's already a pending shot waiting for made/miss, clear it
  if (pendingShot.value) {
    pendingShot.value = null
    return
  }

  const svg = (e.currentTarget as SVGElement)
  const rect = svg.getBoundingClientRect()
  const scaleX = VB_W / rect.width
  const scaleY = VB_H / rect.height
  const svgX = (e.clientX - rect.left) * scaleX
  const svgY = (e.clientY - rect.top) * scaleY

  pendingShot.value = svgToNorm(svgX, svgY)
}

async function confirmShot(made: boolean) {
  if (!pendingShot.value || !props.playerId || !props.gameId) {
    pendingShot.value = null
    return
  }
  await recordShot(
    props.gameId,
    props.playerId,
    pendingShot.value.x,
    pendingShot.value.y,
    made,
    props.period,
  )
  pendingShot.value = null
}

function cancelPending() {
  pendingShot.value = null
}

// Determine if a shot is a 3-pointer based on court position (simplified)
// Three-point line: corner 3s are within ~14px of sideline, arc is ~190px radius from basket
const BASKET_Y = 56 // basket inset from top (in SVG units when top is baseline)
const THREE_RADIUS = 190 // approximate radius of 3pt arc in SVG units
const CORNER_X_MIN = 30
const CORNER_X_MAX = VB_W - 30

function isThreePointer(nx: number, ny: number): boolean {
  const svgX = nx * VB_W
  const svgY = ny * VB_H
  const basketX = VB_W / 2
  const basketY = BASKET_Y
  const dx = svgX - basketX
  const dy = svgY - basketY
  const dist = Math.sqrt(dx * dx + dy * dy)
  // Corner 3: near sidelines
  if (svgX < CORNER_X_MIN + 30 || svgX > CORNER_X_MAX - 30) {
    return svgY > 140
  }
  return dist > THREE_RADIUS
}

function shotColor(shot: ShotEvent): string {
  if (!shot.made) return '#ef4444' // red for miss
  return isThreePointer(shot.x, shot.y) ? '#3b82f6' : '#16a34a'
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- FG% summary bar -->
    <div class="flex items-center gap-4 text-sm">
      <span class="text-ink-500">
        FG: <span class="font-mono text-chalk">{{ fgSummary.made }}/{{ fgSummary.total }}</span>
      </span>
      <span class="text-ink-500">
        FG%: <span class="font-mono font-bold" :class="fgSummary.pct >= 50 ? 'text-green-400' : 'text-chalk'">
          {{ fgSummary.pct }}%
        </span>
      </span>
      <span class="ml-auto flex items-center gap-2 text-xs text-ink-500">
        <span class="inline-flex items-center gap-1">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#16a34a"/></svg> Made (2pt)
        </span>
        <span class="inline-flex items-center gap-1">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#3b82f6"/></svg> Made (3pt)
        </span>
        <span class="inline-flex items-center gap-1">
          <svg width="10" height="10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="#ef4444" stroke-width="2"/>
            <line x1="9" y1="1" x2="1" y2="9" stroke="#ef4444" stroke-width="2"/>
          </svg> Miss
        </span>
      </span>
    </div>

    <!-- No player warning -->
    <p v-if="!playerId" class="rounded bg-ink-700 px-3 py-2 text-sm text-ink-500">
      Select a player above to place shots. All shots shown below.
    </p>

    <!-- Court SVG wrapper with relative positioning for overlay -->
    <div class="relative w-full">
      <svg
        :viewBox="`0 0 ${VB_W} ${VB_H}`"
        class="w-full cursor-crosshair rounded-lg border border-ink-700 bg-ink-900"
        preserveAspectRatio="xMidYMid meet"
        @click="onCourtClick"
      >
        <!-- Court boundary -->
        <rect x="6" y="6" :width="VB_W - 12" :height="VB_H - 12"
          fill="none" stroke="#374151" stroke-width="2" rx="4"/>

        <!-- Half-court line -->
        <line :x1="6" :y1="VB_H / 2" :x2="VB_W - 6" :y2="VB_H / 2"
          stroke="#374151" stroke-width="1.5"/>

        <!-- Center circle -->
        <circle :cx="VB_W / 2" :cy="VB_H / 2" r="36"
          fill="none" stroke="#374151" stroke-width="1.5"/>

        <!-- Paint / Key (top half) -->
        <rect :x="VB_W / 2 - 80" y="6" width="160" height="190"
          fill="none" stroke="#374151" stroke-width="1.5"/>

        <!-- Free throw circle -->
        <circle :cx="VB_W / 2" cy="196" r="60"
          fill="none" stroke="#374151" stroke-width="1.5" stroke-dasharray="8 6"/>

        <!-- Basket -->
        <circle :cx="VB_W / 2" cy="56" r="10"
          fill="none" stroke="#9ca3af" stroke-width="2"/>
        <!-- Backboard -->
        <line :x1="VB_W / 2 - 24" y1="30" :x2="VB_W / 2 + 24" y2="30"
          stroke="#9ca3af" stroke-width="3"/>

        <!-- Three-point arc (simplified) -->
        <!-- Corner 3 lines -->
        <line x1="36" y1="6" x2="36" y2="144" stroke="#374151" stroke-width="1.5"/>
        <line :x1="VB_W - 36" y1="6" :x2="VB_W - 36" y2="144" stroke="#374151" stroke-width="1.5"/>
        <!-- Arc from corner to corner -->
        <path
          :d="`M 36 144 A 190 190 0 0 1 ${VB_W - 36} 144`"
          fill="none" stroke="#374151" stroke-width="1.5"/>

        <!-- Restricted area arc -->
        <path
          :d="`M ${VB_W / 2 - 40} 56 A 40 40 0 0 1 ${VB_W / 2 + 40} 56`"
          fill="none" stroke="#374151" stroke-width="1" stroke-dasharray="4 3"/>

        <!-- Shot markers -->
        <g v-for="shot in displayShots" :key="shot.id">
          <template v-if="shot.made">
            <!-- Made: filled circle -->
            <circle
              :cx="shot.x * VB_W"
              :cy="shot.y * VB_H"
              r="7"
              :fill="shotColor(shot)"
              fill-opacity="0.85"
              stroke="white"
              stroke-width="0.5"
            />
          </template>
          <template v-else>
            <!-- Miss: X mark -->
            <line
              :x1="shot.x * VB_W - 6" :y1="shot.y * VB_H - 6"
              :x2="shot.x * VB_W + 6" :y2="shot.y * VB_H + 6"
              stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"
            />
            <line
              :x1="shot.x * VB_W + 6" :y1="shot.y * VB_H - 6"
              :x2="shot.x * VB_W - 6" :y2="shot.y * VB_H + 6"
              stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"
            />
          </template>
        </g>

        <!-- Pending shot indicator -->
        <circle
          v-if="pendingShot"
          :cx="pendingShot.x * VB_W"
          :cy="pendingShot.y * VB_H"
          r="9"
          fill="none"
          stroke="#facc15"
          stroke-width="2"
          stroke-dasharray="4 3"
        />
      </svg>

      <!-- Made/Miss overlay buttons near pending shot -->
      <!-- Position derived from normalized coords so it stays correct on resize/rotate -->
      <div
        v-if="pendingShot"
        class="absolute z-10 flex flex-col gap-1"
        :style="{
          left: `${pendingShot.x * 100}%`,
          top: `${pendingShot.y * 100}%`,
          transform: 'translate(-50%, -110%)',
        }"
      >
        <div class="flex gap-1 rounded-lg border border-ink-700 bg-ink-800 p-1.5 shadow-xl">
          <button
            class="rounded bg-green-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-600"
            @click.stop="confirmShot(true)"
          >Made</button>
          <button
            class="rounded bg-red-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            @click.stop="confirmShot(false)"
          >Miss</button>
          <button
            class="rounded px-2 py-1.5 text-xs text-ink-500 hover:text-chalk"
            @click.stop="cancelPending"
          >✕</button>
        </div>
      </div>
    </div>

    <p class="text-center text-xs text-ink-500">Tap court to place a shot · {{ displayShots.length }} shot{{ displayShots.length !== 1 ? 's' : '' }} recorded</p>
  </div>
</template>
