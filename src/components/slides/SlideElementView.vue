<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { CANVAS } from '@/domain/geometry'
import { snapMove } from '@/domain/alignment'
import { clampElementGeometry } from '@/domain/elements'
import type { SlideElement } from '@/domain/types'
import { useEditorState } from '@/editor/state'
import { elementTypeLabel, useI18n } from '@/i18n'
import { resolveAssetUrl } from '@/utils/assets'
import EditableTable from './EditableTable.vue'
import EditableChart from './EditableChart.vue'
import EditableForm from './EditableForm.vue'
import EmbedView from './EmbedView.vue'

const props = withDefaults(defineProps<{
  element: SlideElement
  slideId: string
  selected?: boolean
  active?: boolean
  editable?: boolean
}>(), {
  selected: false,
  active: false,
  editable: true,
})

const editor = useEditorState()
const { t } = useI18n()
const root = ref<HTMLElement>()
const editing = ref(false)
const editValue = ref('')
const DRAG_THRESHOLD = 3

const rootStyle = computed(() => ({
  left: `${props.element.x}px`,
  top: `${props.element.y}px`,
  width: `${props.element.width}px`,
  height: `${props.element.height}px`,
  zIndex: props.element.zIndex ?? 1,
  transform: `rotate(${props.element.rotation ?? 0}deg)`,
  opacity: props.element.style?.opacity ?? 1,
}))

const contentStyle = computed(() => {
  const style = props.element.style ?? {}
  const fontScale = editor.deck.value.tweaks?.fontScale ?? 1
  const scaledFontSize = style.fontSize === undefined ? undefined : style.fontSize * fontScale
  return {
    color: style.color,
    background: props.element.type === 'text' || props.element.type === 'image' ? undefined : style.fill,
    borderColor: style.stroke,
    // A solid border with no width falls back to the browser's medium border;
    // generated images should stay borderless unless a template explicitly adds a frame.
    borderWidth: style.strokeWidth === undefined ? '0px' : `${style.strokeWidth}px`,
    borderStyle: style.stroke ? 'solid' : undefined,
    borderRadius: style.radius === undefined ? undefined : `${style.radius}px`,
    fontSize: scaledFontSize === undefined ? undefined : `${scaledFontSize}px`,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    objectFit: style.objectFit,
    '--scene-font-size': scaledFontSize === undefined ? undefined : `${scaledFontSize}px`,
    '--scene-arrow-color': style.fill ?? style.stroke ?? 'var(--slide-accent)',
  }
})

const imageSource = computed(() => props.element.src ? resolveAssetUrl(props.element.src) : '')
const handleDirections = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type HandleDirection = (typeof handleDirections)[number]
type ElementGeometryDraft = Pick<SlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>

function elementLabel(): string {
  return elementTypeLabel(props.element.type)
}

function handleActionClick(event: MouseEvent) {
  if (props.element.action) {
    const { type, target } = props.element.action
    if (type === 'slideJump') {
      const slide = editor.deck.value.slides.find(s => s.id === String(target)) || editor.deck.value.slides[Number(target) - 1]
      if (slide) editor.selectSlide(slide.id)
    } else if (type === 'url' || type === 'hyperlink') {
      if (target) window.open(String(target), '_blank')
    }
  }
}

function select(event?: Event) {
  if (props.element.action && !props.editable) {
    handleActionClick(event as MouseEvent)
  }
  if (!props.editable) return
  event?.stopPropagation()
  const pointer = event as PointerEvent | MouseEvent | undefined
  const additive = Boolean(pointer?.metaKey || pointer?.ctrlKey || pointer?.shiftKey)
  editor.selectElement(props.slideId, props.element.id, additive)
}

function canvasScale(): number {
  const surface = root.value?.closest('.slide-surface') as HTMLElement | null
  if (!surface) return 1
  return surface.getBoundingClientRect().width / CANVAS.width || 1
}

function capturePointer(event: PointerEvent) {
  try {
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId)
  }
  catch {
    // Synthetic events may not expose pointer capture; window listeners still work.
  }
}

function releasePointer(event: PointerEvent) {
  try {
    const target = event.currentTarget as HTMLElement | null
    if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }
  catch {
    // Pointer capture is an enhancement, not a persistence requirement.
  }
}

function beginMove(event: PointerEvent) {
  if (!props.editable || editing.value || event.button !== 0 || !event.isPrimary) return
  // A locked object remains selectable so the inspector can expose its
  // unlock action; only the transform path is blocked.
  if (props.element.locked) {
    select(event)
    return
  }
  capturePointer(event)
  const pointerId = event.pointerId
  const startX = event.clientX
  const startY = event.clientY
  const initial: ElementGeometryDraft = {
    x: props.element.x,
    y: props.element.y,
    width: props.element.width,
    height: props.element.height,
    rotation: props.element.rotation,
  }
  let active = false
  let interactionElementId = props.element.id
  const duplicateOnDrag = Boolean(event.altKey || event.ctrlKey || event.metaKey)
  const wasSelectedWithDuplicateModifier = duplicateOnDrag && editor.selectedElementIds.value.includes(props.element.id)
  // Preserve a selected multi-element set until movement crosses the drag
  // threshold; otherwise Ctrl/Command-drag would toggle the clicked member
  // off before the duplicate transaction is created.
  if (!wasSelectedWithDuplicateModifier) select(event)

  const cleanup = (endEvent?: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    if (endEvent) releasePointer(endEvent)
    editor.setAlignmentGuides([])
    if (active) editor.endElementInteraction()
  }
  const cancel = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId !== pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    releasePointer(cancelEvent)
    editor.cancelElementInteraction()
  }
  const end = (endEvent: PointerEvent) => {
    if (endEvent.pointerId !== pointerId) return
    if (!active && wasSelectedWithDuplicateModifier) select(event)
    cleanup(endEvent)
  }
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    const scale = canvasScale()
    let rawDx = (moveEvent.clientX - startX) / scale
    let rawDy = (moveEvent.clientY - startY) / scale
    if (moveEvent.shiftKey) {
      if (Math.abs(rawDx) >= Math.abs(rawDy)) rawDy = 0
      else rawDx = 0
    }
    if (!active && Math.hypot(rawDx, rawDy) < DRAG_THRESHOLD) return
    if (!active) {
      active = true
      moveEvent.preventDefault()
      interactionElementId = editor.beginElementInteraction(props.slideId, props.element.id, 'move', duplicateOnDrag)
    }
    const selectedIds = editor.selectedElementIds.value.includes(interactionElementId)
      ? editor.selectedElementIds.value
      : [interactionElementId]
    const snap = snapMove(editor.currentSlide.value?.elements ?? [], selectedIds, rawDx, rawDy)
    editor.setAlignmentGuides(snap.guides)
    editor.updateElementGeometry(props.slideId, interactionElementId, clampElementGeometry({
      ...initial,
      x: initial.x + snap.dx,
      y: initial.y + snap.dy,
    }))
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', cancel)
}

function beginResize(event: PointerEvent, direction: HandleDirection) {
  if (!props.editable || props.element.locked || event.button !== 0 || !event.isPrimary) return
  event.preventDefault()
  event.stopPropagation()
  select(event)
  capturePointer(event)
  const pointerId = event.pointerId
  const startX = event.clientX
  const startY = event.clientY
  const initial: ElementGeometryDraft = {
    x: props.element.x,
    y: props.element.y,
    width: props.element.width,
    height: props.element.height,
    rotation: props.element.rotation,
  }
  editor.beginElementInteraction(props.slideId, props.element.id, 'resize')
  const cleanup = (endEvent?: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    if (endEvent) releasePointer(endEvent)
    editor.setAlignmentGuides([])
    editor.endElementInteraction()
  }
  const cancel = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId !== pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    releasePointer(cancelEvent)
    editor.cancelElementInteraction()
  }
  const end = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) cleanup(endEvent)
  }
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    const scale = canvasScale()
    const local = rotateVector((moveEvent.clientX - startX) / scale, (moveEvent.clientY - startY) / scale, -(initial.rotation ?? 0))
    const next = resizeGeometry(initial, direction, local.x, local.y, moveEvent.shiftKey)
    editor.updateElementGeometry(props.slideId, props.element.id, clampElementGeometry(next))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', cancel)
}

function resizeGeometry(initial: ElementGeometryDraft, direction: HandleDirection, dx: number, dy: number, preserveRatio: boolean): ElementGeometryDraft {
  const horizontal = direction.includes('w') ? -1 : direction.includes('e') ? 1 : 0
  const vertical = direction.includes('n') ? -1 : direction.includes('s') ? 1 : 0
  let width = initial.width + horizontal * dx
  let height = initial.height + vertical * dy
  const corner = horizontal !== 0 && vertical !== 0
  if (preserveRatio && corner) {
    const ratio = initial.width / Math.max(1, initial.height)
    const widthDelta = Math.abs(width - initial.width)
    const heightDelta = Math.abs(height - initial.height) * ratio
    if (widthDelta >= heightDelta) height = width / ratio
    else width = height * ratio
  }
  width = Math.max(24, snap(width))
  height = Math.max(24, snap(height))
  const x = horizontal < 0 ? initial.x + initial.width - width : initial.x
  const y = vertical < 0 ? initial.y + initial.height - height : initial.y
  return { x: snap(x), y: snap(y), width, height, rotation: initial.rotation }
}

function beginRotate(event: PointerEvent) {
  if (!props.editable || props.element.locked || event.button !== 0 || !event.isPrimary) return
  event.preventDefault()
  event.stopPropagation()
  select(event)
  capturePointer(event)
  const pointerId = event.pointerId
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
  const initialRotation = props.element.rotation ?? 0
  editor.beginElementInteraction(props.slideId, props.element.id, 'rotate')

  const cleanup = (endEvent?: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    if (endEvent) releasePointer(endEvent)
    editor.endElementInteraction()
  }
  const cancel = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId !== pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    releasePointer(cancelEvent)
    editor.cancelElementInteraction()
  }
  const end = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) cleanup(endEvent)
  }
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX)
    const delta = (currentAngle - startAngle) * 180 / Math.PI
    const nextRotation = snapRotation(initialRotation + delta, moveEvent.shiftKey ? 45 : 15)
    editor.updateElementGeometry(props.slideId, props.element.id, {
      x: props.element.x,
      y: props.element.y,
      width: props.element.width,
      height: props.element.height,
      rotation: nextRotation,
    })
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', cancel)
}

function snapRotation(value: number, interval: number): number {
  const snapped = Math.round(value / interval) * interval
  return Math.abs(snapped - value) <= 3 ? snapped : value
}

function rotateVector(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180
  return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) }
}

function snap(value: number): number {
  return Math.round(value / 8) * 8
}

async function beginEdit(event: MouseEvent) {
  if (!props.editable || props.element.locked || props.element.type !== 'text') return
  event.stopPropagation()
  select(event)
  editValue.value = props.element.text ?? ''
  editing.value = true
  await nextTick()
  const content = root.value?.querySelector('.scene-text-content') as HTMLElement | null
  content?.focus()
}

function beginTextEdit(event: FocusEvent) {
  if (!props.editable || props.element.type !== 'text') return
  // Focus alone means the object was selected (or reached by keyboard). Keep
  // it draggable until an explicit double-click enters text-edit mode.
  if (!editing.value) {
    editValue.value = props.element.text ?? ''
    return
  }
  event.stopPropagation()
}

function finishEdit() {
  if (props.element.type !== 'text') return
  editing.value = false
  const next = editValue.value.trim()
  if (!next) {
    editValue.value = props.element.text ?? ''
    return
  }
  if (next !== (props.element.text ?? '')) editor.updateElementText(props.slideId, props.element.id, next)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    editing.value = false
    editValue.value = props.element.text ?? ''
  }
}
</script>

<template>
  <div
    ref="root"
    class="scene-element"
    :class="[`scene-${element.type}`, { 'is-selected': selected, 'is-editing': editing, 'is-locked': element.locked }]"
    :style="rootStyle"
    :data-element-id="element.id"
    :aria-label="editable ? elementLabel() : undefined"
    @pointerdown="beginMove"
    @dblclick="beginEdit"
  >
    <div
      v-if="element.type === 'text'"
      class="scene-text-content"
      :class="{ 'slide-title': element.path === 'title', 'slide-eyebrow': element.path === 'eyebrow', 'slide-body': element.path === 'body', 'slide-subtitle': element.path === 'subtitle' }"
      :style="contentStyle"
      :contenteditable="editable ? 'plaintext-only' : undefined"
      :tabindex="editable ? 0 : undefined"
      @focus="beginTextEdit"
      @input="editValue = ($event.target as HTMLElement).textContent ?? ''"
      @blur="finishEdit"
      @keydown="handleKeydown"
    >{{ element.text }}</div>
    <img v-else-if="element.type === 'image'" class="scene-image-content" :src="imageSource" :alt="element.alt ?? ''" :style="contentStyle" draggable="false" />
    <EditableTable v-else-if="element.type === 'table' && element.table" :table="element.table" :editable="editable" />
    <EditableChart v-else-if="element.type === 'chart' && element.chart" :chart="element.chart" :editable="editable" />
    <EditableForm v-else-if="element.type === 'form' && element.form" :form="element.form" :slide-id="slideId" :editable="editable" :initial-data="editor.formData.value[slideId]" @update:form-data="(data) => editor.updateFormData(slideId, data)" />
    <EmbedView v-else-if="element.type === 'embed' && element.embed" :embed="element.embed" :editable="editable" />
    <span v-else class="scene-shape-content" :class="{ 'has-arrowhead': element.type === 'arrow' }" :style="contentStyle" aria-hidden="true"></span>

    <template v-if="selected && active && editable && !element.locked">
      <span class="rotation-stem" aria-hidden="true"></span>
      <button class="rotation-handle" type="button" :aria-label="t('element.rotate')" @pointerdown="beginRotate"></button>
      <button
        v-for="direction in handleDirections"
        :key="direction"
        class="element-handle"
        :class="`handle-${direction}`"
        type="button"
        :aria-label="t('element.resize', { element: elementLabel(), direction })"
        @pointerdown="beginResize($event, direction)"
      ></button>
    </template>
  </div>
</template>
