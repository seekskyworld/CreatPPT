<script setup lang="ts">
import { computed, ref } from 'vue'
import { getElementBounds } from '@/domain/alignment'
import { getAgendaLayout } from '@/domain/agenda'
import { CANVAS } from '@/domain/geometry'
import type { SlideSpec, SlideElement, TemplateId, TweakState } from '@/domain/types'
import { getTemplate } from '@/domain/templates'
import { useEditorState } from '@/editor/state'
import { useI18n } from '@/i18n'
import EditableImage from './EditableImage.vue'
import EditableText from './EditableText.vue'
import SlideElementView from './SlideElementView.vue'

const props = withDefaults(defineProps<{
  slide: SlideSpec
  templateId: TemplateId
  slideNumber?: number
  editable?: boolean
  selectedPath?: string | null
  selectedElementIds?: string[]
  tweaks?: TweakState
}>(), {
  slideNumber: 1,
  editable: false,
  selectedPath: null,
  selectedElementIds: () => [],
  tweaks: () => ({ density: 'balanced', fontScale: 1, accentMode: 'default' }),
})

const template = computed(() => getTemplate(props.templateId))
const editor = useEditorState()
const { t } = useI18n()
const surface = ref<HTMLElement>()
const marquee = ref<{ active: boolean; x: number; y: number; width: number; height: number; additive: boolean; startX: number; startY: number }>({
  active: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  additive: false,
  startX: 0,
  startY: 0,
})
const activeTokens = computed(() => {
  const tokens = template.value.tokens
  if (props.tweaks.accentMode === 'warm') {
    return { ...tokens, accent: tokens.accentAlt, accentAlt: tokens.accent }
  }
  if (props.tweaks.accentMode === 'cool') {
    return { ...tokens, accent: tokens.highlight, accentAlt: tokens.accent }
  }
  return tokens
})
const tokenStyle = computed(() => ({
  '--slide-bg': activeTokens.value.background,
  '--slide-bg-alt': activeTokens.value.backgroundAlt,
  '--slide-ink': activeTokens.value.ink,
  '--slide-muted': activeTokens.value.muted,
  '--slide-surface': activeTokens.value.surface,
  '--slide-line': activeTokens.value.line,
  '--slide-accent': activeTokens.value.accent,
  '--slide-accent-alt': activeTokens.value.accentAlt,
  '--slide-highlight': activeTokens.value.highlight,
  '--slide-display-font': activeTokens.value.displayFont,
  '--slide-body-font': activeTokens.value.bodyFont,
  '--slide-font-scale': String(props.tweaks.fontScale),
}))

const maxChartValue = computed(() => Math.max(1, ...((props.slide.chart?.points ?? []).map(point => Math.abs(point.value)))))
const barHeight = (value: number) => `${Math.max(8, (Math.abs(value) / maxChartValue.value) * 170)}px`
const barStyle = (value: number) => ({ '--bar-height': barHeight(value) })
const selected = (path: string) => props.selectedPath === path
const selectedElementId = computed(() => {
  const path = props.selectedPath ?? ''
  return path.startsWith('elements.') ? path.slice('elements.'.length) : undefined
})
const selectedElementIds = computed(() => {
  if (props.selectedElementIds.length) return props.selectedElementIds
  return selectedElementId.value ? [selectedElementId.value] : []
})
const agendaLayout = computed(() => getAgendaLayout(props.slide.bullets, props.templateId))
const sortedElements = computed(() => [...(props.slide.elements ?? [])].filter(element => element.visible !== false).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)))
const multiSelectionBounds = computed(() => {
  const selected = sortedElements.value.filter(element => selectedElementIds.value.includes(element.id))
  if (selected.length < 2) return undefined
  const bounds = selected.map(getElementBounds)
  const left = Math.min(...bounds.map(item => item.left))
  const top = Math.min(...bounds.map(item => item.top))
  const right = Math.max(...bounds.map(item => item.right))
  const bottom = Math.max(...bounds.map(item => item.bottom))
  return { left, top, width: right - left, height: bottom - top }
})

function logicalPoint(event: PointerEvent | DragEvent): { x: number; y: number } {
  const rect = surface.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: Math.max(0, Math.min(CANVAS.width, (event.clientX - rect.left) / (rect.width / CANVAS.width))),
    y: Math.max(0, Math.min(CANVAS.height, (event.clientY - rect.top) / (rect.height / CANVAS.height))),
  }
}

function handleLayerPointerdown(event: PointerEvent) {
  if (!props.editable || event.button !== 0 || event.target !== event.currentTarget) return
  event.preventDefault()
  const point = logicalPoint(event)
  const pointerId = event.pointerId
  const additive = Boolean(event.shiftKey || event.metaKey || event.ctrlKey)
  marquee.value = { active: false, x: point.x, y: point.y, width: 0, height: 0, additive, startX: point.x, startY: point.y }
  try { (event.currentTarget as HTMLElement).setPointerCapture(pointerId) } catch { /* optional */ }

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    const current = logicalPoint(moveEvent)
    const width = Math.abs(current.x - point.x)
    const height = Math.abs(current.y - point.y)
    if (width < 4 && height < 4) return
    marquee.value = {
      ...marquee.value,
      active: true,
      x: Math.min(point.x, current.x),
      y: Math.min(point.y, current.y),
      width,
      height,
    }
  }
  const cleanup = (endEvent?: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    if (endEvent) {
      try { (event.currentTarget as HTMLElement).releasePointerCapture(endEvent.pointerId) } catch { /* optional */ }
    }
    const current = marquee.value
    if (current.active) {
      const selected = (props.slide.elements ?? []).filter(element => {
        if (element.locked || element.visible === false) return false
        const bounds = getElementBounds(element)
        const intersects = bounds.left < current.x + current.width && bounds.right > current.x && bounds.top < current.y + current.height && bounds.bottom > current.y
        if (current.additive) return intersects
        return bounds.left >= current.x && bounds.right <= current.x + current.width && bounds.top >= current.y && bounds.bottom <= current.y + current.height
      }).map(element => element.id)
      editor.selectElements(props.slide.id, selected, current.additive)
    }
    else if (!current.additive) editor.setSelection(null)
    marquee.value = { ...current, active: false, width: 0, height: 0 }
  }
  const end = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) cleanup(endEvent)
  }
  const cancel = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId === pointerId) cleanup(cancelEvent)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', cancel)
}

function handleDrop(event: DragEvent) {
  if (!props.editable) return
  event.preventDefault()
  const point = logicalPoint(event)
  const file = event.dataTransfer?.files?.[0]
  if (file?.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') editor.addElementAt('image', { x: point.x - 210, y: point.y - 130 }, { src: reader.result, alt: file.name.replace(/\.[^.]+$/, '') })
    }, { once: true })
    reader.readAsDataURL(file)
    return
  }
  const text = event.dataTransfer?.getData('text/plain')?.trim()
  if (text) editor.addElementAt('text', { x: point.x - 180, y: point.y - 60 }, { text })
}
</script>

<template>
  <article
    ref="surface"
    class="slide-surface"
    :class="[`layout-${slide.layout}`, `template-${templateId}`, `density-${tweaks.density}`]"
    :data-layout="slide.layout"
    :data-template="templateId"
    :style="tokenStyle"
  >
    <div class="slide-grid" aria-hidden="true"></div>
    <div class="slide-marker" aria-hidden="true"></div>

    <template v-if="slide.elements !== undefined">
      <div
        class="element-layer"
        :class="{ 'is-editable': editable }"
        @pointerdown="handleLayerPointerdown"
        @dragover.prevent
        @drop="handleDrop"
      >
        <div
          v-for="guide in editor.alignmentGuides.value"
          :key="`${guide.axis}-${guide.position}`"
          class="alignment-guide"
          :class="`axis-${guide.axis}`"
          :style="guide.axis === 'x' ? { left: `${guide.position}px` } : { top: `${guide.position}px` }"
          aria-hidden="true"
        ></div>
        <div
          v-if="marquee.active"
          class="selection-marquee"
          :style="{ left: `${marquee.x}px`, top: `${marquee.y}px`, width: `${marquee.width}px`, height: `${marquee.height}px` }"
          aria-hidden="true"
        ></div>
        <div
          v-if="editable && multiSelectionBounds"
          class="multi-selection-bounds"
          :style="{
            left: `${multiSelectionBounds.left}px`,
            top: `${multiSelectionBounds.top}px`,
            width: `${multiSelectionBounds.width}px`,
            height: `${multiSelectionBounds.height}px`,
          }"
          aria-hidden="true"
        ></div>
        <SlideElementView
          v-for="element in sortedElements"
          :key="element.id"
          :element="element"
          :slide-id="slide.id"
          :selected="selectedElementIds.includes(element.id)"
          :active="selectedElementId === element.id"
          :editable="editable"
        />
      </div>
    </template>

    <template v-else-if="slide.layout === 'cover'">
      <EditableImage
        v-if="slide.images?.[0]"
        class="cover-image"
        :slide-id="slide.id"
        path="images.0"
        :label="t('slide.coverImage')"
        :source="slide.images[0].src"
        :alt="slide.images[0].alt"
        :editable="editable"
        :selected="selected('images.0')"
      />
      <div class="cover-accent" aria-hidden="true"></div>
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <EditableText class="slide-subtitle" :slide-id="slide.id" path="subtitle" :label="t('slide.subtitle')" :model-value="slide.subtitle" :editable="editable" :selected="selected('subtitle')" />
    </template>

    <template v-else-if="slide.layout === 'agenda'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <div class="agenda-list" :style="{ top: `${agendaLayout.y}px`, width: `${agendaLayout.width}px` }">
        <div
          v-for="(item, index) in slide.bullets || []"
          :key="index"
          class="agenda-row"
          :style="{ height: `${agendaLayout.rows[index]?.height ?? 104}px` }"
        >
          <span
            class="agenda-index"
            :style="{
              height: `${agendaLayout.rows[index]?.indexBox.height ?? 36}px`,
              fontSize: '20px',
              lineHeight: `${agendaLayout.lineHeight}`,
            }"
          >{{ String(index + 1).padStart(2, '0') }}</span>
          <EditableText
            :slide-id="slide.id"
            :path="`bullets.${index}`"
            :label="t('slide.item', { number: index + 1 })"
            :model-value="item"
            :editable="editable"
            :selected="selected(`bullets.${index}`)"
            :style="{
              height: `${agendaLayout.rows[index]?.textBox.height ?? 60}px`,
              fontSize: `${agendaLayout.fontSize}px`,
              lineHeight: `${agendaLayout.lineHeight}`,
            }"
            single-line
          />
        </div>
      </div>
    </template>

    <template v-else-if="slide.layout === 'statement'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <div class="statement-rule" aria-hidden="true"></div>
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.coreStatement')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <EditableText class="slide-body" :slide-id="slide.id" path="body" :label="t('slide.statementBody')" :model-value="slide.body" :editable="editable" :selected="selected('body')" />
    </template>

    <template v-else-if="slide.layout === 'metrics'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <div class="metrics-grid">
        <div v-for="(stat, index) in slide.stats || []" :key="index" class="metric-item">
          <span class="metric-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <EditableText class="metric-value" :slide-id="slide.id" :path="`stats.${index}.value`" :label="t('slide.metric', { number: index + 1 })" :model-value="stat.value" :editable="editable" :selected="selected(`stats.${index}.value`)" single-line />
          <EditableText class="metric-label" :slide-id="slide.id" :path="`stats.${index}.label`" :label="t('slide.metricName', { number: index + 1 })" :model-value="stat.label" :editable="editable" :selected="selected(`stats.${index}.label`)" />
          <EditableText class="metric-detail" :slide-id="slide.id" :path="`stats.${index}.detail`" :label="t('slide.metricDetail', { number: index + 1 })" :model-value="stat.detail" :editable="editable" :selected="selected(`stats.${index}.detail`)" />
        </div>
      </div>
    </template>

    <template v-else-if="slide.layout === 'split'">
      <EditableImage
        v-if="slide.images?.[0]"
        class="split-image"
        :slide-id="slide.id"
        path="images.0"
        :label="t('slide.mainImage')"
        :source="slide.images[0].src"
        :alt="slide.images[0].alt"
        :editable="editable"
        :selected="selected('images.0')"
      />
      <div class="split-copy">
        <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
        <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
        <EditableText class="slide-body" :slide-id="slide.id" path="body" :label="t('slide.body')" :model-value="slide.body" :editable="editable" :selected="selected('body')" />
        <div class="bullet-list">
          <div v-for="(item, index) in slide.bullets || []" :key="index" class="bullet-row">
            <span aria-hidden="true"></span>
            <EditableText :slide-id="slide.id" :path="`bullets.${index}`" :label="t('slide.item', { number: index + 1 })" :model-value="item" :editable="editable" :selected="selected(`bullets.${index}`)" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="slide.layout === 'comparison'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <div class="comparison-grid" :class="{ 'comparison-count-three': (slide.columns?.length ?? 0) >= 3 }">
        <section v-for="(column, index) in slide.columns || []" :key="index" class="comparison-column">
          <span class="comparison-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <EditableText class="column-title" :slide-id="slide.id" :path="`columns.${index}.title`" :label="t('slide.columnTitle', { number: index + 1 })" :model-value="column.title" :editable="editable" :selected="selected(`columns.${index}.title`)" />
          <EditableText class="column-body" :slide-id="slide.id" :path="`columns.${index}.body`" :label="t('slide.columnBody', { number: index + 1 })" :model-value="column.body" :editable="editable" :selected="selected(`columns.${index}.body`)" />
          <div class="column-bullets">
            <EditableText v-for="(item, bulletIndex) in column.bullets || []" :key="bulletIndex" :slide-id="slide.id" :path="`columns.${index}.bullets.${bulletIndex}`" :label="t('slide.columnItem', { column: index + 1, number: bulletIndex + 1 })" :model-value="item" :editable="editable" :selected="selected(`columns.${index}.bullets.${bulletIndex}`)" />
          </div>
        </section>
      </div>
    </template>

    <template v-else-if="slide.layout === 'chart'">
      <div class="chart-copy">
        <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
        <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
        <EditableText class="slide-body" :slide-id="slide.id" path="body" :label="t('slide.body')" :model-value="slide.body" :editable="editable" :selected="selected('body')" />
      </div>
      <div class="chart-area">
        <div v-for="(point, index) in slide.chart?.points || []" :key="index" class="chart-column" :class="{ 'is-negative': point.value < 0 }">
          <EditableText class="chart-value" :slide-id="slide.id" :path="`chart.points.${index}.value`" :label="t('slide.dataValue', { number: index + 1 })" :model-value="point.value" :editable="editable" :selected="selected(`chart.points.${index}.value`)" value-type="number" single-line />
          <div class="chart-bar" :style="barStyle(point.value)"></div>
          <EditableText class="chart-label" :slide-id="slide.id" :path="`chart.points.${index}.label`" :label="t('slide.dataName', { number: index + 1 })" :model-value="point.label" :editable="editable" :selected="selected(`chart.points.${index}.label`)" single-line />
        </div>
        <span class="chart-unit">{{ slide.chart?.unit }}</span>
      </div>
    </template>

    <template v-else-if="slide.layout === 'timeline'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <div class="timeline-track">
        <section v-for="(step, index) in slide.steps || []" :key="index" class="timeline-step">
          <EditableText class="step-label" :slide-id="slide.id" :path="`steps.${index}.label`" :label="t('slide.stepNumber', { number: index + 1 })" :model-value="step.label" :editable="editable" :selected="selected(`steps.${index}.label`)" single-line />
          <span class="step-dot" aria-hidden="true"></span>
          <EditableText class="step-title" :slide-id="slide.id" :path="`steps.${index}.title`" :label="t('slide.stepTitle', { number: index + 1 })" :model-value="step.title" :editable="editable" :selected="selected(`steps.${index}.title`)" />
          <EditableText class="step-body" :slide-id="slide.id" :path="`steps.${index}.body`" :label="t('slide.stepBody', { number: index + 1 })" :model-value="step.body" :editable="editable" :selected="selected(`steps.${index}.body`)" />
        </section>
      </div>
    </template>

    <template v-else-if="slide.layout === 'gallery'">
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <div class="gallery-grid">
        <figure v-for="(image, index) in slide.images || []" :key="index" class="gallery-item">
          <EditableImage
            :slide-id="slide.id"
            :path="`images.${index}`"
            :label="t('slide.imageItem', { number: index + 1 })"
            :source="image.src"
            :alt="image.alt"
            :editable="editable"
            :selected="selected(`images.${index}`)"
          />
          <EditableText :slide-id="slide.id" :path="`images.${index}.caption`" :label="t('slide.imageCaption', { number: index + 1 })" :model-value="image.caption" :editable="editable" :selected="selected(`images.${index}.caption`)" single-line />
        </figure>
      </div>
    </template>

    <template v-else-if="slide.layout === 'quote'">
      <EditableImage
        v-if="slide.images?.[0]"
        class="quote-image"
        :slide-id="slide.id"
        path="images.0"
        :label="t('slide.personImage')"
        :source="slide.images[0].src"
        :alt="slide.images[0].alt"
        :editable="editable"
        :selected="selected('images.0')"
      />
      <div class="quote-copy">
        <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
        <span class="quote-mark" aria-hidden="true">“</span>
        <EditableText class="quote-text" :slide-id="slide.id" path="quote" :label="t('slide.quote')" :model-value="slide.quote" :editable="editable" :selected="selected('quote')" />
        <EditableText class="quote-by" :slide-id="slide.id" path="quoteBy" :label="t('slide.quoteBy')" :model-value="slide.quoteBy" :editable="editable" :selected="selected('quoteBy')" single-line />
      </div>
    </template>

    <template v-else-if="slide.layout === 'closing'">
      <div class="closing-number" aria-hidden="true">END</div>
      <EditableText class="slide-eyebrow" :slide-id="slide.id" path="eyebrow" :label="t('slide.eyebrow')" :model-value="slide.eyebrow" :editable="editable" :selected="selected('eyebrow')" single-line />
      <EditableText class="slide-title" :slide-id="slide.id" path="title" :label="t('slide.title')" :model-value="slide.title" :editable="editable" :selected="selected('title')" />
      <EditableText class="slide-body" :slide-id="slide.id" path="body" :label="t('slide.body')" :model-value="slide.body" :editable="editable" :selected="selected('body')" />
    </template>

    <footer class="slide-footer">
      <EditableText :slide-id="slide.id" path="footer" :label="t('slide.footer')" :model-value="slide.footer" :editable="editable" :selected="selected('footer')" single-line />
      <span>{{ String(slideNumber).padStart(2, '0') }}</span>
    </footer>
  </article>
</template>
