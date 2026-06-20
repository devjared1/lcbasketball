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

type Tool = 'select' | 'pen' | 'arrow' | 'marker' | 'erase'
const tool = ref<Tool>('select')
const color = ref('#000000')
const strokeWidth = ref(3)
const arrowStyle = ref<ArrowElement['style']>('cut')
const markerTeam = ref<MarkerElement['team']>('home')
const markerLabel = ref('1')

// Court geometry constants (10 SVG units = 1 foot, NFHS high school dimensions)
const BOUNDARY = 6
const BASKET_INSET = 56
const KEY_HALF_W = 80
const KEY_LENGTH = 190
const LANE_ARC_R = 60
const THREE_R = 237
const THREE_CORNER_X = 36
const THREE_ARC_Y_HALF = 159
const THREE_ARC_X_FULL = 158

const dims = computed(() =>
  props.modelValue.courtType === 'full'
    ? { w: 940, h: 500 }
    : { w: 500, h: 470 },
)
const viewBox = computed(() => `0 0 ${dims.value.w} ${dims.value.h}`)
const W = computed(() => dims.value.w)
const H = computed(() => dims.value.h)

const svgRef = ref<SVGSVGElement | null>(null)

// ---------- draw state (pen / arrow tools) ----------
const drawing = ref<DiagramElement | null>(null)

// ---------- select/drag state ----------
const selectedId = ref<string | null>(null)

type DragKind = 'marker' | 'arrow-tail' | 'arrow-head' | 'arrow-control'
const dragKind = ref<DragKind | null>(null)
// Live copy of element being dragged, rendered instead of committed version
const dragLive = ref<DiagramElement | null>(null)

watch(tool, () => {
  selectedId.value = null
  dragKind.value = null
  dragLive.value = null
})

// ---------- shared helpers ----------
const elements = computed(() => props.modelValue.elements)

function commit(next: DiagramElement[]) {
  emit('update:modelValue', { ...props.modelValue, elements: next })
}

function setCourt(type: CourtType) {
  if (props.modelValue.courtType === type) return
  if (
    elements.value.length > 0 &&
    !confirm('Switching court type will clear all diagram elements. Continue?')
  ) return
  emit('update:modelValue', { courtType: type, elements: [] })
}

function toNorm(e: PointerEvent): Point {
  const svg = svgRef.value!
  const rect = svg.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}

function dist(p: Point, q: Point) {
  return Math.hypot(p.x - q.x, p.y - q.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function controlOf(el: ArrowElement): Point {
  return el.control ?? midpoint(el.points[0], el.points[1])
}

// Distance from point to nearest vertex of element (normalized space)
function distToElement(p: Point, el: DiagramElement): number {
  if (el.type === 'marker') return dist(p, el.at)
  const pts = el.type === 'arrow' && el.control
    ? [...el.points, el.control]
    : el.points
  return Math.min(...pts.map((q) => dist(p, q)))
}

// ---------- select tool ----------
const HIT_HANDLE = 0.055  // normalized hit radius for endpoint handles
const HIT_BODY   = 0.030  // normalized hit radius for element body

function onSelectDown(e: PointerEvent) {
  const p = toNorm(e)
  ;(e.target as Element).setPointerCapture?.(e.pointerId)

  // ── priority 1: handles of already-selected element ──
  if (selectedId.value) {
    const sel = elements.value.find((el) => el.id === selectedId.value)
    if (sel?.type === 'marker' && dist(p, sel.at) < HIT_HANDLE * 1.5) {
      dragKind.value = 'marker'
      dragLive.value = { ...sel }
      return
    }
    if (sel?.type === 'arrow') {
      if (dist(p, sel.points[0]) < HIT_HANDLE) {
        dragKind.value = 'arrow-tail'
        dragLive.value = { ...sel, points: [...sel.points] }
        return
      }
      if (dist(p, sel.points[1]) < HIT_HANDLE) {
        dragKind.value = 'arrow-head'
        dragLive.value = { ...sel, points: [...sel.points] }
        return
      }
      if (dist(p, controlOf(sel)) < HIT_HANDLE) {
        dragKind.value = 'arrow-control'
        dragLive.value = { ...sel, points: [...sel.points] }
        return
      }
    }
  }

  // ── priority 2: hit-test all elements ──
  const reversed = [...elements.value].reverse()

  // Markers first (rendered on top)
  for (const el of reversed) {
    if (el.type === 'marker' && dist(p, el.at) < HIT_HANDLE * 1.5) {
      selectedId.value = el.id
      dragKind.value = 'marker'
      dragLive.value = { ...el }
      return
    }
  }

  // Arrows: endpoint handles or body
  for (const el of reversed) {
    if (el.type !== 'arrow') continue
    if (dist(p, el.points[0]) < HIT_HANDLE) {
      selectedId.value = el.id
      dragKind.value = 'arrow-tail'
      dragLive.value = { ...el, points: [...el.points] }
      return
    }
    if (dist(p, el.points[1]) < HIT_HANDLE) {
      selectedId.value = el.id
      dragKind.value = 'arrow-head'
      dragLive.value = { ...el, points: [...el.points] }
      return
    }
    if (distToElement(p, el) < HIT_BODY) {
      selectedId.value = el.id
      // No immediate drag on body-select — user drags a handle next
      return
    }
  }

  // Miss → deselect
  selectedId.value = null
}

function onSelectMove(e: PointerEvent) {
  if (!dragKind.value || !dragLive.value) return
  const p = toNorm(e)
  const el = dragLive.value
  if (dragKind.value === 'marker' && el.type === 'marker') {
    dragLive.value = { ...el, at: p }
  } else if (dragKind.value === 'arrow-tail' && el.type === 'arrow') {
    dragLive.value = { ...el, points: [p, el.points[1]] }
  } else if (dragKind.value === 'arrow-head' && el.type === 'arrow') {
    dragLive.value = { ...el, points: [el.points[0], p] }
  } else if (dragKind.value === 'arrow-control' && el.type === 'arrow') {
    dragLive.value = { ...el, control: p }
  }
}

function onSelectUp() {
  if (dragKind.value && dragLive.value) {
    const updated = dragLive.value
    commit(elements.value.map((el) => (el.id === updated.id ? updated : el)))
  }
  dragKind.value = null
  dragLive.value = null
}

// ---------- draw tools ----------
function onDrawDown(e: PointerEvent) {
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  const p = toNorm(e)

  if (tool.value === 'erase') {
    const hit = [...elements.value]
      .reverse()
      .find((el) => distToElement(p, el) < HIT_BODY)
    if (hit) commit(elements.value.filter((el) => el.id !== hit.id))
    return
  }

  if (tool.value === 'marker') {
    commit([...elements.value, {
      id: crypto.randomUUID(),
      type: 'marker',
      color: color.value,
      width: strokeWidth.value,
      at: p,
      label: markerLabel.value || '•',
      team: markerTeam.value,
    } satisfies MarkerElement])
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

function onDrawMove(e: PointerEvent) {
  if (!drawing.value) return
  const p = toNorm(e)
  if (drawing.value.type === 'pen') {
    drawing.value.points.push(p)
  } else if (drawing.value.type === 'arrow') {
    drawing.value.points = [drawing.value.points[0], p]
  }
}

function onDrawUp() {
  if (!drawing.value) return
  const el = drawing.value
  drawing.value = null
  if (el.type === 'pen' && el.points.length < 2) return
  commit([...elements.value, el])
  // Auto-select newly drawn arrow so user can immediately curve it
  if (el.type === 'arrow') {
    tool.value = 'select'
    selectedId.value = el.id
  }
}

// ---------- router to per-tool handlers ----------
function onPointerDown(e: PointerEvent) {
  if (!props.editable) return
  if (tool.value === 'select') onSelectDown(e)
  else onDrawDown(e)
}

function onPointerMove(e: PointerEvent) {
  if (!props.editable) return
  if (tool.value === 'select') onSelectMove(e)
  else onDrawMove(e)
}

function onPointerUp() {
  if (!props.editable) return
  if (tool.value === 'select') onSelectUp()
  else onDrawUp()
}

function clearAll() { commit([]) }
function undo() { commit(elements.value.slice(0, -1)) }

// ---------- Quick-start templates ----------
type TemplateName = '5out' | 'horns' | '4low'

const TEMPLATES: Record<TemplateName, { x: number; y: number; label: string }[]> = {
  '5out': [
    { x: 0.50, y: 0.72, label: '1' },
    { x: 0.22, y: 0.60, label: '2' },
    { x: 0.78, y: 0.60, label: '3' },
    { x: 0.10, y: 0.36, label: '4' },
    { x: 0.90, y: 0.36, label: '5' },
  ],
  horns: [
    { x: 0.50, y: 0.72, label: '1' },
    { x: 0.33, y: 0.47, label: '2' },
    { x: 0.67, y: 0.47, label: '3' },
    { x: 0.18, y: 0.64, label: '4' },
    { x: 0.82, y: 0.64, label: '5' },
  ],
  '4low': [
    { x: 0.50, y: 0.78, label: '1' },
    { x: 0.36, y: 0.47, label: '2' },
    { x: 0.64, y: 0.47, label: '3' },
    { x: 0.38, y: 0.28, label: '4' },
    { x: 0.62, y: 0.28, label: '5' },
  ],
}

function applyTemplate(name: TemplateName) {
  if (
    elements.value.length > 0 &&
    !confirm('This will replace existing diagram elements. Continue?')
  ) return
  commit(TEMPLATES[name].map((pos) => ({
    id: crypto.randomUUID(),
    type: 'marker' as const,
    color: '#37b6c4',
    width: 3,
    at: { x: pos.x, y: pos.y },
    label: pos.label,
    team: 'home' as const,
  })))
}

// ---------- rendering helpers ----------
function penPath(el: PenElement): string {
  return el.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * W.value} ${p.y * H.value}`)
    .join(' ')
}

// SVG path for a straight or curved arrow line
function arrowLinePath(el: ArrowElement): string {
  const ax = el.points[0].x * W.value, ay = el.points[0].y * H.value
  const bx = el.points[1].x * W.value, by = el.points[1].y * H.value
  if (el.control) {
    const cx = el.control.x * W.value, cy = el.control.y * H.value
    return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`
  }
  return `M ${ax} ${ay} L ${bx} ${by}`
}

// Dribble zigzag; follows quadratic bezier when a control point is set
function dribblePath(el: ArrowElement): string {
  const ax = el.points[0].x * W.value, ay = el.points[0].y * H.value
  const bx = el.points[1].x * W.value, by = el.points[1].y * H.value
  const amp = 6

  if (!el.control) {
    const len = Math.hypot(bx - ax, by - ay)
    const segs = Math.max(4, Math.floor(len / 16))
    const nx = (by - ay) / (len || 1), ny = -(bx - ax) / (len || 1)
    let d = `M ${ax} ${ay}`
    for (let i = 1; i < segs; i++) {
      const t = i / segs
      const off = i % 2 === 0 ? amp : -amp
      d += ` L ${ax + (bx - ax) * t + nx * off} ${ay + (by - ay) * t + ny * off}`
    }
    return d + ` L ${bx} ${by}`
  }

  // Curved dribble: zigzag along the quadratic bezier
  const cx = el.control.x * W.value, cy = el.control.y * H.value
  const approxLen = Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy)
  const segs = Math.max(4, Math.floor(approxLen / 16))
  let d = `M ${ax} ${ay}`
  for (let i = 1; i <= segs; i++) {
    const t = i / segs, mt = 1 - t
    const px = mt * mt * ax + 2 * t * mt * cx + t * t * bx
    const py = mt * mt * ay + 2 * t * mt * cy + t * t * by
    // Tangent at t for perpendicular offset
    const dtx = 2 * mt * (cx - ax) + 2 * t * (bx - cx)
    const dty = 2 * mt * (cy - ay) + 2 * t * (by - cy)
    const dtLen = Math.hypot(dtx, dty) || 1
    const nx = dty / dtLen, ny = -dtx / dtLen
    const off = i % 2 === 0 ? amp : -amp
    d += i < segs
      ? ` L ${px + nx * off} ${py + ny * off}`
      : ` L ${px} ${py}`
  }
  return d
}

// Arrowhead triangle at the tip; uses control→head direction when curved
function arrowHead(el: ArrowElement): string {
  const bx = el.points[1].x * W.value, by = el.points[1].y * H.value
  const from = el.control ?? el.points[0]
  const ax = from.x * W.value, ay = from.y * H.value
  const ang = Math.atan2(by - ay, bx - ax)
  const size = 14
  return [
    `${bx},${by}`,
    `${bx - size * Math.cos(ang - Math.PI / 6)},${by - size * Math.sin(ang - Math.PI / 6)}`,
    `${bx - size * Math.cos(ang + Math.PI / 6)},${by - size * Math.sin(ang + Math.PI / 6)}`,
  ].join(' ')
}

// Screen bar perpendicular to line at the head
function screenBar(el: ArrowElement): { x1: number; y1: number; x2: number; y2: number } {
  const bx = el.points[1].x * W.value, by = el.points[1].y * H.value
  const from = el.control ?? el.points[0]
  const ax = from.x * W.value, ay = from.y * H.value
  const ang = Math.atan2(by - ay, bx - ax)
  const half = 12
  return {
    x1: bx + half * Math.cos(ang + Math.PI / 2),
    y1: by + half * Math.sin(ang + Math.PI / 2),
    x2: bx + half * Math.cos(ang - Math.PI / 2),
    y2: by + half * Math.sin(ang - Math.PI / 2),
  }
}

// All elements to render, substituting live drag copy when dragging
const allElements = computed<DiagramElement[]>(() => {
  const base = drawing.value ? [...elements.value, drawing.value] : [...elements.value]
  if (!dragLive.value) return base
  return base.map((el) => (el.id === dragLive.value!.id ? dragLive.value! : el))
})

const teamColor = { home: '#37b6c4', away: '#e8743b', ball: '#e7c993' } as const
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- toolbar -->
    <div v-if="editable" class="flex flex-col gap-1.5">
      <!-- Row 1: tool selector + court type toggle — guaranteed single line, no overflow -->
      <div class="flex items-center gap-2">
        <div class="flex overflow-hidden rounded-md border border-ink-600">
          <button
            v-for="t in (['select', 'pen', 'arrow', 'marker', 'erase'] as Tool[])"
            :key="t"
            class="px-3 py-1.5 text-xs font-semibold capitalize"
            :class="tool === t ? 'bg-rim text-ink-900' : 'bg-ink-800 text-chalk hover:bg-ink-700'"
            @click="tool = t"
          >
            {{ t }}
          </button>
        </div>
        <div class="ml-auto flex overflow-hidden rounded-md border border-ink-600">
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

      <!-- Row 2: context-sensitive options + action buttons (wraps on small screens) -->
      <div class="flex flex-wrap items-center gap-2">
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

        <span class="grow" />
        <select
          v-if="modelValue.courtType === 'half'"
          class="input w-auto py-1.5 text-xs"
          @change="(e) => { applyTemplate((e.target as HTMLSelectElement).value as TemplateName); (e.target as HTMLSelectElement).value = '' }"
        >
          <option value="">Templates…</option>
          <option value="5out">5-Out</option>
          <option value="horns">Horns</option>
          <option value="4low">4-Low</option>
        </select>
        <button class="btn-ghost py-1.5 text-xs" @click="undo">Undo</button>
        <button class="btn-ghost py-1.5 text-xs" @click="clearAll">Clear</button>
      </div>
    </div>

    <!-- hint for select mode -->
    <p v-if="editable && tool === 'select'" class="text-[11px] text-ink-500">
      Tap a marker or arrow to select · drag handles to move/resize · drag the red ● to curve an arrow
    </p>

    <!-- court -->
    <div class="overflow-hidden rounded-lg border border-ink-700 bg-court-wood">
      <svg
        ref="svgRef"
        :viewBox="viewBox"
        class="block w-full touch-none select-none"
        :style="{ aspectRatio: `${dims.w} / ${dims.h}`, maxHeight: 'min(70vh, 650px)', cursor: editable && (tool === 'pen' || tool === 'arrow') ? 'crosshair' : 'default' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <!-- court markings -->
        <g fill="none" stroke="#1c1614" stroke-width="3" opacity="0.85">
          <rect :x="BOUNDARY" :y="BOUNDARY" :width="W - BOUNDARY * 2" :height="H - BOUNDARY * 2" />

          <template v-if="modelValue.courtType === 'full'">
            <line :x1="W / 2" :y1="BOUNDARY" :x2="W / 2" :y2="H - BOUNDARY" />
            <circle :cx="W / 2" :cy="H / 2" :r="LANE_ARC_R" />
            <rect :x="BOUNDARY" :y="H / 2 - KEY_HALF_W" :width="KEY_LENGTH + BASKET_INSET - BOUNDARY" :height="KEY_HALF_W * 2" />
            <circle :cx="KEY_LENGTH + BASKET_INSET - BOUNDARY" :cy="H / 2" :r="LANE_ARC_R" />
            <line :x1="BOUNDARY" :y1="H / 2 - (H / 2 - THREE_CORNER_X)" :x2="THREE_ARC_X_FULL" :y2="H / 2 - (H / 2 - THREE_CORNER_X)" />
            <line :x1="BOUNDARY" :y1="H / 2 + (H / 2 - THREE_CORNER_X)" :x2="THREE_ARC_X_FULL" :y2="H / 2 + (H / 2 - THREE_CORNER_X)" />
            <path :d="`M ${THREE_ARC_X_FULL} ${H / 2 - (H / 2 - THREE_CORNER_X)} A ${THREE_R} ${THREE_R} 0 0 1 ${THREE_ARC_X_FULL} ${H / 2 + (H / 2 - THREE_CORNER_X)}`" />
            <circle :cx="BASKET_INSET" :cy="H / 2" r="9" />
            <line :x1="BASKET_INSET - 16" :y1="H / 2 - 30" :x2="BASKET_INSET - 16" :y2="H / 2 + 30" />
            <rect :x="W - KEY_LENGTH - BASKET_INSET + BOUNDARY" :y="H / 2 - KEY_HALF_W" :width="KEY_LENGTH + BASKET_INSET - BOUNDARY" :height="KEY_HALF_W * 2" />
            <circle :cx="W - KEY_LENGTH - BASKET_INSET + BOUNDARY" :cy="H / 2" :r="LANE_ARC_R" />
            <line :x1="W - BOUNDARY" :y1="H / 2 - (H / 2 - THREE_CORNER_X)" :x2="W - THREE_ARC_X_FULL" :y2="H / 2 - (H / 2 - THREE_CORNER_X)" />
            <line :x1="W - BOUNDARY" :y1="H / 2 + (H / 2 - THREE_CORNER_X)" :x2="W - THREE_ARC_X_FULL" :y2="H / 2 + (H / 2 - THREE_CORNER_X)" />
            <path :d="`M ${W - THREE_ARC_X_FULL} ${H / 2 - (H / 2 - THREE_CORNER_X)} A ${THREE_R} ${THREE_R} 0 0 0 ${W - THREE_ARC_X_FULL} ${H / 2 + (H / 2 - THREE_CORNER_X)}`" />
            <circle :cx="W - BASKET_INSET" :cy="H / 2" r="9" />
            <line :x1="W - BASKET_INSET + 16" :y1="H / 2 - 30" :x2="W - BASKET_INSET + 16" :y2="H / 2 + 30" />
          </template>

          <template v-else>
            <rect :x="W / 2 - KEY_HALF_W" :y="BOUNDARY" :width="KEY_HALF_W * 2" :height="KEY_LENGTH + BASKET_INSET - BOUNDARY" />
            <circle :cx="W / 2" :cy="KEY_LENGTH + BASKET_INSET - BOUNDARY" :r="LANE_ARC_R" />
            <line :x1="THREE_CORNER_X" :y1="BOUNDARY" :x2="THREE_CORNER_X" :y2="THREE_ARC_Y_HALF" />
            <line :x1="W - THREE_CORNER_X" :y1="BOUNDARY" :x2="W - THREE_CORNER_X" :y2="THREE_ARC_Y_HALF" />
            <path :d="`M ${THREE_CORNER_X} ${THREE_ARC_Y_HALF} A ${THREE_R} ${THREE_R} 0 0 0 ${W - THREE_CORNER_X} ${THREE_ARC_Y_HALF}`" />
            <circle :cx="W / 2" :cy="BASKET_INSET" r="9" />
            <line :x1="W / 2 - 30" :y1="BASKET_INSET - 16" :x2="W / 2 + 30" :y2="BASKET_INSET - 16" />
          </template>
        </g>

        <!-- drawn elements -->
        <g v-for="el in allElements" :key="el.id">
          <path
            v-if="el.type === 'pen'"
            :d="penPath(el)"
            fill="none"
            :stroke="el.color"
            :stroke-width="el.width"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <template v-else-if="el.type === 'arrow'">
            <!-- dribble wavy line -->
            <path
              v-if="el.style === 'dribble'"
              :d="dribblePath(el)"
              fill="none"
              :stroke="el.color"
              :stroke-width="el.width"
              stroke-linecap="round"
            />
            <!-- all other styles: straight or curved path -->
            <path
              v-else
              :d="arrowLinePath(el)"
              fill="none"
              :stroke="el.color"
              :stroke-width="el.width"
              :stroke-dasharray="el.style === 'pass' ? '10 8' : undefined"
              stroke-linecap="round"
            />
            <!-- arrowhead or screen bar -->
            <polygon
              v-if="el.style !== 'screen'"
              :points="arrowHead(el)"
              :fill="el.color"
            />
            <line
              v-else
              v-bind="screenBar(el)"
              :stroke="el.color"
              :stroke-width="el.width + 1"
              stroke-linecap="round"
            />
          </template>

          <template v-else-if="el.type === 'marker'">
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
              font-family="Inter, system-ui, sans-serif"
              fill="#0d0f13"
            >
              {{ el.label }}
            </text>
          </template>
        </g>

        <!-- selection handles (select tool only) -->
        <g v-if="editable && tool === 'select' && selectedId">
          <template v-for="el in allElements" :key="el.id + '-sel'">
            <template v-if="el.id === selectedId">
              <!-- marker: dashed ring -->
              <circle
                v-if="el.type === 'marker'"
                :cx="el.at.x * W"
                :cy="el.at.y * H"
                r="23"
                fill="none"
                stroke="white"
                stroke-width="2"
                stroke-dasharray="5 3"
                opacity="0.85"
              />
              <!-- arrow: tail, head, and curve-control handles -->
              <template v-else-if="el.type === 'arrow'">
                <!-- guide line to control point -->
                <line
                  :x1="el.points[0].x * W" :y1="el.points[0].y * H"
                  :x2="controlOf(el).x * W" :y2="controlOf(el).y * H"
                  stroke="white" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"
                />
                <line
                  :x1="controlOf(el).x * W" :y1="controlOf(el).y * H"
                  :x2="el.points[1].x * W" :y2="el.points[1].y * H"
                  stroke="white" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"
                />
                <!-- tail handle -->
                <circle
                  :cx="el.points[0].x * W" :cy="el.points[0].y * H"
                  r="9" fill="white" fill-opacity="0.9" stroke="#0d0f13" stroke-width="1.5"
                />
                <!-- head handle -->
                <circle
                  :cx="el.points[1].x * W" :cy="el.points[1].y * H"
                  r="9" fill="white" fill-opacity="0.9" stroke="#0d0f13" stroke-width="1.5"
                />
                <!-- curve control handle (red) -->
                <circle
                  :cx="controlOf(el).x * W" :cy="controlOf(el).y * H"
                  r="9" fill="#cc0000" fill-opacity="0.9" stroke="white" stroke-width="1.5"
                />
              </template>
            </template>
          </template>
        </g>
      </svg>
    </div>
  </div>
</template>
