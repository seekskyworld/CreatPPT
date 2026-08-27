<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChartSpec, ChartType } from '@/domain/types'

const props = withDefaults(defineProps<{
  chart: ChartSpec
  editable?: boolean
}>(), {
  editable: false,
})

const hoveredIndex = ref<number | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const chartType = computed<ChartType>(() => {
  return props.chart.chartType || props.chart.type || 'bar'
})

const points = computed(() => props.chart.points || [])
const maxVal = computed(() => {
  const values = points.value.map(p => Math.abs(p.value))
  return Math.max(1, ...values)
})

function onMouseOver(index: number, event: MouseEvent) {
  hoveredIndex.value = index
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipX.value = event.clientX - rect.left + 10
  tooltipY.value = event.clientY - rect.top - 20
}

function onMouseLeave() {
  hoveredIndex.value = null
}

// Line / Scatter / Area points calculations
const svgWidth = 500
const svgHeight = 300
const padding = 40

const chartPoints = computed(() => {
  const pts = points.value
  if (!pts.length) return []
  const count = pts.length
  const stepX = (svgWidth - padding * 2) / Math.max(1, count - 1)
  return pts.map((p, i) => {
    const x = padding + i * stepX
    const y = svgHeight - padding - (p.value / maxVal.value) * (svgHeight - padding * 2)
    return { x, y, label: p.label, value: p.value }
  })
})

const linePath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

const areaPath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  const line = linePath.value
  return `${line} L ${last.x} ${svgHeight - padding} L ${first.x} ${svgHeight - padding} Z`
})

// Pie Chart Calculations
const pieSlices = computed(() => {
  const pts = points.value
  const total = pts.reduce((acc, p) => acc + Math.max(0, p.value), 0) || 1
  let cumulativeAngle = 0
  const cx = 250
  const cy = 150
  const r = 100

  return pts.map((p) => {
    const value = Math.max(0, p.value)
    const angle = (value / total) * 2 * Math.PI
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + angle
    cumulativeAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2)
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2)
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2)
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2)

    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return {
      label: p.label,
      value: p.value,
      path,
      percentage: Math.round((value / total) * 100),
    }
  })
})

const colors = [
  'var(--slide-accent, #0066ff)',
  'var(--slide-accent-alt, #ff6600)',
  'var(--slide-highlight, #ffcc00)',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
]
</script>

<template>
  <div class="editable-chart-container" @mouseleave="onMouseLeave">
    <!-- Bar Chart -->
    <div v-if="chartType === 'bar'" class="chart-bar-view">
      <div v-for="(p, i) in points" :key="i" class="bar-col" @mousemove="onMouseOver(i, $event)">
        <div class="bar-fill-wrap">
          <div
            class="bar-fill"
            :style="{
              height: `${(Math.abs(p.value) / maxVal) * 100}%`,
              backgroundColor: colors[i % colors.length],
            }"
          ></div>
        </div>
        <span class="bar-label">{{ p.label }}</span>
      </div>
    </div>

    <!-- Pie Chart -->
    <div v-else-if="chartType === 'pie'" class="chart-svg-view">
      <svg :viewBox="`0 0 ${svgWidth} ${svgHeight}`" class="chart-svg">
        <g v-for="(slice, i) in pieSlices" :key="i" @mousemove="onMouseOver(i, $event)">
          <path :d="slice.path" :fill="colors[i % colors.length]" class="pie-slice" />
        </g>
      </svg>
    </div>

    <!-- Line / Area / Scatter Chart -->
    <div v-else class="chart-svg-view">
      <svg :viewBox="`0 0 ${svgWidth} ${svgHeight}`" class="chart-svg">
        <!-- Axes -->
        <line :x1="padding" :y1="svgHeight - padding" :x2="svgWidth - padding" :y2="svgHeight - padding" stroke="var(--slide-line, #ccc)" stroke-width="2" />
        <line :x1="padding" :y1="padding" :x2="padding" :y2="svgHeight - padding" stroke="var(--slide-line, #ccc)" stroke-width="2" />

        <!-- Area Fill -->
        <path v-if="chartType === 'area'" :d="areaPath" fill="var(--slide-accent, #0066ff)" opacity="0.2" />

        <!-- Line Path -->
        <path v-if="chartType === 'line' || chartType === 'area'" :d="linePath" fill="none" stroke="var(--slide-accent, #0066ff)" stroke-width="3" />

        <!-- Scatter Points / Circles -->
        <g v-for="(p, i) in chartPoints" :key="i" @mousemove="onMouseOver(i, $event)">
          <circle
            :cx="p.x"
            :cy="p.y"
            r="6"
            :fill="colors[i % colors.length]"
            class="chart-point"
          />
          <text :x="p.x" :y="svgHeight - padding + 20" text-anchor="middle" font-size="12" fill="var(--slide-muted, #666)">
            {{ p.label }}
          </text>
        </g>
      </svg>
    </div>

    <!-- Interactive Tooltip -->
    <div
      v-if="hoveredIndex !== null && points[hoveredIndex]"
      class="chart-tooltip"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <div class="tooltip-label">{{ points[hoveredIndex].label }}</div>
      <div class="tooltip-val">{{ points[hoveredIndex].value }} {{ chart.unit || '' }}</div>
    </div>
  </div>
</template>

<style scoped>
.editable-chart-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.chart-bar-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: 20px 10px;
  box-sizing: border-box;
}

.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  margin: 0 6px;
  cursor: pointer;
}

.bar-fill-wrap {
  width: 100%;
  height: calc(100% - 24px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-fill {
  width: 60%;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.bar-label {
  font-size: 12px;
  color: var(--slide-muted, #666);
  margin-top: 6px;
  text-align: center;
}

.chart-svg-view {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.pie-slice {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.pie-slice:hover {
  transform: scale(1.03);
  transform-origin: center;
}

.chart-point {
  cursor: pointer;
  transition: r 0.2s ease;
}

.chart-point:hover {
  r: 9;
}

.chart-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tooltip-label {
  font-weight: 600;
}

.tooltip-val {
  font-size: 11px;
  opacity: 0.9;
}
</style>
