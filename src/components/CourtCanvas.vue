<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ArrowElement,
  CourtType,
  Diagram,
  DiagramElement,
  MarkerElement,
  PenElement,
  Point,
} from '@/types'

const props = defineProps<{ modelValue: Diagram; editable?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Diagram] }>()

type Tool = 'pen' | 'arrow' | 'marker' | 'erase'
const tool = ref<Tool>('pen')
const color = ref('#eef2f6')
const strokeWidth = ref(3)
const arrowStyle = ref<ArrowElement['style']>('pass')
const markerTeam = ref<MarkerElement['team']>('home')
const markerLabel = ref('1')

// Court geometry in SVG user units (10 units == 1 foot).
const dims = computed(() =>
  props.modelValue.courtType === 'full'
    ? { w: 940, h: 500 }
    : { w: 500, h: 470 },
)
const viewBox = computed(() => `0 0 ${dims.value.w} ${dims.value.h}`)

const svgRef = ref<SVGSVGElement | null>(null)
const drawing = ref<DiagramElement | null>(null)

const elements = computed(() => props.modelValue.elements)

function commit(next: DiagramElement[]) {
  emit('update:modelValue', { ...props.modelValue, elements: next })
}

function setCourt(type: CourtType) {
  emit('update:modelValue', { ...props.modelValue, courtType: type })
}

function toNorm(e: PointerEvent): Point {
  const svg = svgRef.value!
  const rect = svg.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}

// hit-test: distance from point to element (normalized space) for eraser
function distToElement(p: Point, el: DiagramElement): number {
  const pts =
    el.type === 'marker' ? [el.at] : el.points
  let min = Infinity
  for (const q of pts) {
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    if (d < min) min = d
  }
  return min
}

function onPointerDown(e: PointerEvent) {
  if (!props.editable) return
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  const p = toNorm(e)

  if (tool.value === 'erase') {
    const hit = [...elements.value]
      .reverse()
      .find((el) => distToElement(p, el) < 0.03)
    if (hit) commit(elements.value.filter((el) => el.id !== hit.id))
    return
  }

  if (tool.value === 'marker') {
    const m: MarkerElement = {
      id: crypto.randomUUID(),
      type: 'marker',
      color: color.value,
      width: strokeWidth.value,
      at: p,
      label: markerLabel.value || '•',
      team: markerTeam.value,
    }
    commit([...elements.value, m])
    return
  }

  if (tool.value === 'pen') {
    drawing.value = {
      id: crypto.randomUUID(),
      type: 'pen',
      color: color.value,
      width: strokeWidth.value,
      points: [p],
    } satisfies PenElement
  } else if (tool.value === 'arrow') {
    drawing.value = {
      id: crypto.randomUUID(),
      type: 'arrow',
      color: color.value,
      width: strokeWidth.value,
      points: [p, p],
      style: arrowStyle.value,
    } satisfies ArrowElement
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value) return
  const p = toNorm(e)
  if (drawing.value.type === 'pen') {
    drawing.value.points.push(p)
  } else if (drawing.value.type === 'arrow') {
    drawing.value.points = [drawing.value.points[0], p]
  }
}

function onPointerUp() {
  if (!drawing.value) return
  const el = drawing.value
  drawing.value = null
  if (el.type === 'pen' && el.points.length < 2) return
  commit([...elements.value, el])
}

function clearAll() {
  commit([])
}

function undo() {
  commit(elements.value.slice(0, -1))
}

// ---------- rendering helpers ----------
const W = computed(() => dims.value.w)
const H = computed(() => dims.value.h)

function penPath(el: PenElement): string {
  return el.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * W.value} ${p.y * H.value}`)
    .join(' ')
}

function dribblePath(a: Point, b: Point): string {
  // zigzag between tail and head
  const ax = a.x * W.value, ay = a.y * H.value
  const bx = b.x * W.value, by = b.y * H.value
  const len = Math.hypot(bx - ax, by - ay)
  const segs = Math.max(4, Math.floor(len / 16))
  const nx = (by - ay) / (len || 1)
  const ny = -(bx - ax) / (len || 1)
  const amp = 6
  let d = `M ${ax} ${ay}`
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const cx = ax + (bx - ax) * t
    const cy = ay + (by - ay) * t
    const off = i % 2 === 0 ? amp : -amp
    d += ` L ${cx + nx * off} ${cy + ny * off}`
  }
  d += ` L ${bx} ${by}`
  return d
}

function arrowHead(a: Point, b: Point): string {
  const ax = a.x * W.value, ay = a.y * H.value
  const bx = b.x * W.value, by = b.y * H.value
  const ang = Math.atan2(by - ay, bx - ax)
  const size = 14
  const x1 = bx - size * Math.cos(ang - Math.PI / 6)
  const y1 = by - size * Math.sin(ang - Math.PI / 6)
  const x2 = bx - size * Math.cos(ang + Math.PI / 6)
  const y2 = by - size * Math.sin(ang + Math.PI / 6)
  return `${bx},${by} ${x1},${y1} ${x2},${y2}`
}

// screen notation: perpendicular bar at the head
function screenBar(a: Point, b: Point): { x1: number; y1: number; x2: number; y2: number } {
  const ax = a.x * W.value, ay = a.y * H.value
  const bx = b.x * W.value, by = b.y * H.value
  const ang = Math.atan2(by - ay, bx - ax)
  const half = 12
  return {
    x1: bx + half * Math.cos(ang + Math.PI / 2),
    y1: by + half * Math.sin(ang + Math.PI / 2),
    x2: bx + half * Math.cos(ang - Math.PI / 2),
    y2: by + half * Math.sin(ang - Math.PI / 2),
  }
}

const allElements = computed<DiagramElement[]>(() =>
  drawing.value ? [...elements.value, drawing.value] : elements.value,
)

const teamColor = { home: '#37b6c4', away: '#e8743b', ball: '#e7c993' } as const

// rebuild a default diagram when court toggled with no elements
watch(
  () => props.modelValue.courtType,
  () => {},
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- toolbar -->
    <div v-if="editable" class="flex flex-wrap items-center gap-2">
      <div class="flex overflow-hidden rounded-md border border-ink-600">
        <button
          v-for="t in (['pen', 'arrow', 'marker', 'erase'] as Tool[])"
          :key="t"
          class="px-3 py-1.5 text-xs font-semibold capitalize"
          :class="tool === t ? 'bg-rim text-ink-900' : 'bg-ink-800 text-chalk hover:bg-ink-700'"
          @click="tool = t"
        >
          {{ t }}
        </button>
      </div>

      <select v-if="tool === 'arrow'" v-model="arrowStyle" class="input w-auto py-1.5 text-xs">
        <option value="pass">Pass (dashed)</option>
        <option value="cut">Cut (solid)</option>
        <option value="dribble">Dribble (wavy)</option>
        <option value="screen">Screen (bar)</option>
      </select>

      <template v-if="tool === 'marker'">
        <select v-model="markerTeam" class="input w-auto py-1.5 text-xs">
          <option value="home">Home (cyan)</option>
          <option value="away">Defense (orange)</option>
          <option value="ball">Ball</option>
        </select>
        <input
          v-model="markerLabel"
          maxlength="2"
          class="input w-14 py-1.5 text-center text-xs"
          aria-label="Marker label"
        />
      </template>

      <label class="flex items-center gap-1 text-xs text-ink-500">
        Color
        <input v-model="color" type="color" class="h-7 w-8 cursor-pointer rounded border border-ink-600 bg-ink-800" />
      </label>
      <label class="flex items-center gap-1 text-xs text-ink-500">
        Width
        <input v-model.number="strokeWidth" type="range" min="1" max="8" class="w-20" />
      </label>

      <div class="ml-auto flex gap-2">
        <button class="btn-ghost py-1.5 text-xs" @click="undo">Undo</button>
        <button class="btn-ghost py-1.5 text-xs" @click="clearAll">Clear</button>
        <div class="flex overflow-hidden rounded-md border border-ink-600">
          <button
            v-for="c in (['half', 'full'] as CourtType[])"
            :key="c"
            class="px-3 py-1.5 text-xs font-semibold capitalize"
            :class="modelValue.courtType === c ? 'bg-home text-ink-900' : 'bg-ink-800 text-chalk hover:bg-ink-700'"
            @click="setCourt(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </div>

    <!-- court -->
    <div class="overflow-hidden rounded-lg border border-ink-700 bg-court-wood">
      <svg
        ref="svgRef"
        :viewBox="viewBox"
        class="block w-full touch-none select-none"
        :style="{ aspectRatio: `${dims.w} / ${dims.h}`, cursor: editable ? 'crosshair' : 'default' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <!-- court markings (10 units == 1 ft) -->
        <g fill="none" stroke="#1c1614" stroke-width="3" opacity="0.85">
          <rect :x="6" :y="6" :width="W - 12" :height="H - 12" />

          <!-- FULL COURT -->
          <template v-if="modelValue.courtType === 'full'">
            <line :x1="W / 2" :y1="6" :x2="W / 2" :y2="H - 6" />
            <circle :cx="W / 2" :cy="H / 2" :r="60" />
            <!-- left key + arc -->
            <rect :x="6" :y="H / 2 - 80" :width="190" :height="160" />
            <circle :cx="196" :cy="H / 2" :r="60" />
            <path :d="`M 6 ${H / 2 - 220} A 237 237 0 0 1 6 ${H / 2 + 220}`" />
            <circle :cx="56" :cy="H / 2" r="9" />
            <line :x1="40" :y1="H / 2 - 30" :x2="40" :y2="H / 2 + 30" />
            <!-- right key + arc -->
            <rect :x="W - 196" :y="H / 2 - 80" :width="190" :height="160" />
            <circle :cx="W - 196" :cy="H / 2" :r="60" />
            <path :d="`M ${W - 6} ${H / 2 - 220} A 237 237 0 0 0 ${W - 6} ${H / 2 + 220}`" />
            <circle :cx="W - 56" :cy="H / 2" r="9" />
            <line :x1="W - 40" :y1="H / 2 - 30" :x2="W - 40" :y2="H / 2 + 30" />
          </template>

          <!-- HALF COURT (offensive half, hoop at top) -->
          <template v-else>
            <rect :x="W / 2 - 80" :y="6" :width="160" :height="190" />
            <circle :cx="W / 2" :cy="196" :r="60" />
            <path :d="`M ${W / 2 - 220} 6 A 237 237 0 0 0 ${W / 2 + 220} 6`" />
            <circle :cx="W / 2" :cy="56" r="9" />
            <line :x1="W / 2 - 30" :y1="40" :x2="W / 2 + 30" :y2="40" />
            <path :d="`M 6 ${H - 6} A ${W / 2 - 6} ${W / 2 - 6} 0 0 0 ${W - 6} ${H - 6}`" opacity="0.5" />
          </template>
        </g>

        <!-- drawn elements -->
        <g v-for="el in allElements" :key="el.id">
          <!-- pen -->
          <path
            v-if="el.type === 'pen'"
            :d="penPath(el)"
            fill="none"
            :stroke="el.color"
            :stroke-width="el.width"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- arrow -->
          <template v-else-if="el.type === 'arrow'">
            <path
              v-if="el.style === 'dribble'"
              :d="dribblePath(el.points[0], el.points[1])"
              fill="none"
              :stroke="el.color"
              :stroke-width="el.width"
              stroke-linecap="round"
            />
            <line
              v-else
              :x1="el.points[0].x * W"
              :y1="el.points[0].y * H"
              :x2="el.points[1].x * W"
              :y2="el.points[1].y * H"
              :stroke="el.color"
              :stroke-width="el.width"
              :stroke-dasharray="el.style === 'pass' ? '10 8' : undefined"
              stroke-linecap="round"
            />
            <polygon
              v-if="el.style !== 'screen'"
              :points="arrowHead(el.points[0], el.points[1])"
              :fill="el.color"
            />
            <line
              v-else
              v-bind="screenBar(el.points[0], el.points[1])"
              :stroke="el.color"
              :stroke-width="el.width + 1"
              stroke-linecap="round"
            />
          </template>

          <!-- marker -->
          <template v-else>
            <circle
              :cx="el.at.x * W"
              :cy="el.at.y * H"
              r="16"
              :fill="teamColor[el.team]"
              stroke="#0d0f13"
              stroke-width="2"
            />
            <text
              :x="el.at.x * W"
              :y="el.at.y * H"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="18"
              font-weight="700"
              font-family="Archivo, sans-serif"
              fill="#0d0f13"
            >
              {{ el.label }}
            </text>
          </template>
        </g>
      </svg>
    </div>
  </div>
</template>
