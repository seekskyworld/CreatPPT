<script setup lang="ts">
import {
  ArrowRight,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  BringToFront,
  Circle,
  Copy,
  Image as ImageIcon,
  ImageUp,
  Lock,
  Minus,
  SendToBack,
  ShieldCheck,
  Square,
  Trash2,
  Type,
  Unlock,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { LAYOUTS } from '@/domain/layouts'
import { getAtPath } from '@/domain/path'
import { TEMPLATES } from '@/domain/templates'
import type { ElementTextAlign, ImageAsset, SlideElementType, SlideLayout, TemplateId } from '@/domain/types'
import { useEditorState } from '@/editor/state'
import { elementTypeLabel, layoutLabel, localizeLayoutRationale, localizeQualityIssue, templateLabel, useI18n } from '@/i18n'
import { fileToDataUrl } from '@/utils/assets'

const editor = useEditorState()
const { t } = useI18n()
const textValue = ref('')
const imageSource = ref('')
const imageAlt = ref('')
const imageCaption = ref('')
const elementText = ref('')
const elementSource = ref('')
const elementAlt = ref('')
const upload = ref<HTMLInputElement>()
const tweaks = computed(() => editor.deck.value.tweaks ?? {
  density: 'balanced' as const,
  fontScale: 1,
  accentMode: 'default' as const,
})

const selectionValue = computed(() => {
  const selection = editor.selection.value
  if (!selection || editor.currentSlide.value?.id !== selection.slideId) return undefined
  return getAtPath(editor.currentSlide.value, selection.path)
})
const selectedElement = computed(() => editor.selectedElement())
const layoutCandidates = computed(() => editor.currentSlide.value?.layoutCandidates ?? [])
const selectionLabel = computed(() => {
  const selection = editor.selection.value
  if (!selection) return ''
  if (selection.kind === 'element' && selectedElement.value) {
    const count = editor.selectedElementIds.value.length
    return count > 1 ? t('element.selectionCount', { count }) : elementTypeLabel(selectedElement.value.element.type)
  }
  return selection.kind === 'image' ? t('slide.image') : t('slide.text')
})

watch([() => editor.selection.value, selectionValue, selectedElement], () => {
  const value = selectionValue.value
  if (editor.selection.value?.kind === 'text') textValue.value = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  if (editor.selection.value?.kind === 'image') {
    const image = value as ImageAsset | undefined
    imageSource.value = image?.src ?? ''
    imageAlt.value = image?.alt ?? ''
    imageCaption.value = image?.caption ?? ''
  }
  if (editor.selection.value?.kind === 'element') {
    const element = selectedElement.value?.element
    elementText.value = element?.text ?? ''
    elementSource.value = element?.src ?? ''
    elementAlt.value = element?.alt ?? ''
  }
}, { immediate: true })

const elementTools: Array<{ type: SlideElementType; icon: typeof Type }> = [
  { type: 'text', icon: Type },
  { type: 'image', icon: ImageIcon },
  { type: 'rect', icon: Square },
  { type: 'ellipse', icon: Circle },
  { type: 'line', icon: Minus },
  { type: 'arrow', icon: ArrowRight },
]

function addElement(type: SlideElementType) {
  editor.addElement(type)
}

function updateElementGeometryField(field: 'x' | 'y' | 'width' | 'height' | 'rotation', event: Event) {
  const target = selectedElement.value
  const value = Number((event.target as HTMLInputElement).value)
  if (!target || !Number.isFinite(value)) return
  editor.updateElementGeometry(target.slide.id, target.element.id, {
    x: field === 'x' ? value : target.element.x,
    y: field === 'y' ? value : target.element.y,
    width: field === 'width' ? value : target.element.width,
    height: field === 'height' ? value : target.element.height,
    rotation: field === 'rotation' ? value : target.element.rotation,
  })
}

function updateElementStyleField(field: 'fontSize' | 'fontWeight' | 'lineHeight' | 'strokeWidth' | 'opacity' | 'radius', event: Event) {
  const target = selectedElement.value
  const value = Number((event.target as HTMLInputElement).value)
  if (!target || !Number.isFinite(value)) return
  editor.updateElementStyle(target.slide.id, target.element.id, { [field]: value })
}

function updateElementStyleText(field: 'color' | 'fill' | 'stroke' | 'fontFamily', event: Event) {
  const target = selectedElement.value
  if (!target) return
  editor.updateElementStyle(target.slide.id, target.element.id, { [field]: (event.target as HTMLInputElement).value.trim() || undefined })
}

function updateElementAlign(event: Event) {
  const target = selectedElement.value
  const value = (event.target as HTMLSelectElement).value
  if (!target || !['left', 'center', 'right'].includes(value)) return
  editor.updateElementStyle(target.slide.id, target.element.id, { textAlign: value as ElementTextAlign })
}

function saveElementText() {
  const target = selectedElement.value
  if (!target || target.element.type !== 'text') return
  const value = elementText.value.trim()
  if (value) editor.updateElementText(target.slide.id, target.element.id, value)
}

function saveElementImage() {
  const target = selectedElement.value
  if (!target || target.element.type !== 'image') return
  editor.updateElement(target.slide.id, target.element.id, {
    src: elementSource.value.trim(),
    alt: elementAlt.value.trim() || t('slide.image'),
  })
}

function toggleElementLock() {
  const target = selectedElement.value
  if (!target) return
  editor.updateElement(target.slide.id, target.element.id, { locked: !target.element.locked })
}

function moveElement(delta: number) {
  editor.changeElementZIndex(delta)
}

function alignElement(command: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') {
  editor.alignSelectedElements(command)
}

function saveText() {
  const selection = editor.selection.value
  if (selection?.kind === 'text') {
    const value = /^chart\.points\.\d+\.value$/.test(selection.path) ? Number(textValue.value) : textValue.value.trim()
    if (typeof value === 'number' && !Number.isFinite(value)) {
      editor.notify('error', t('inspector.invalidChart'))
      return
    }
    editor.updateValue(selection.slideId, selection.path, value)
  }
}

function saveImage() {
  const selection = editor.selection.value
  if (selection?.kind !== 'image') return
  editor.updateValue(selection.slideId, selection.path, {
    src: imageSource.value.trim(),
    alt: imageAlt.value.trim() || t('slide.image'),
    ...(imageCaption.value.trim() ? { caption: imageCaption.value.trim() } : {}),
  })
}

async function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    editor.notify('error', t('inspector.selectImage'))
    return
  }
  if (file.size > 4 * 1024 * 1024) {
    editor.notify('error', t('inspector.imageTooLarge'))
    return
  }
  imageSource.value = await fileToDataUrl(file)
  imageAlt.value ||= file.name.replace(/\.[^.]+$/, '')
  if (editor.selection.value?.kind === 'element') {
    elementSource.value = imageSource.value
    elementAlt.value ||= imageAlt.value
    saveElementImage()
  }
  else {
    saveImage()
  }
}

function setDensity(value: string) {
  if (value === 'airy' || value === 'balanced' || value === 'dense') editor.updateTweaks({ density: value })
}

function setAccentMode(value: string) {
  if (value === 'default' || value === 'warm' || value === 'cool') editor.updateTweaks({ accentMode: value })
}

function setFontScale(value: string) {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) editor.updateTweaks({ fontScale: numeric })
}

function updateContext(path: string, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value.trim()
  editor.updateDesignContext(path, value || undefined)
}

function updateNotes(event: Event) {
  const slide = editor.currentSlide.value
  if (!slide) return
  editor.updateValue(slide.id, 'notes', (event.target as HTMLTextAreaElement).value.trim() || undefined)
}
</script>

<template>
  <aside class="inspector" :aria-label="t('header.inspector')">
    <section class="inspector-section">
      <h2>{{ t('inspector.template') }}</h2>
      <div class="template-options" role="radiogroup" :aria-label="t('inspector.templateGroup')">
        <button
          v-for="template in TEMPLATES"
          :key="template.id"
          class="template-option"
          :class="{ 'is-active': editor.deck.value.templateId === template.id }"
          type="button"
          role="radio"
          :aria-checked="editor.deck.value.templateId === template.id"
          @click="editor.setTemplate(template.id as TemplateId)"
        >
          <span class="template-swatches" aria-hidden="true">
            <span v-for="color in template.swatches" :key="color" :style="{ backgroundColor: color }"></span>
          </span>
          <span>{{ templateLabel(template.id) }}</span>
        </button>
      </div>
    </section>

    <section class="inspector-section element-tools-section">
      <h2>{{ t('inspector.canvasElements') }}</h2>
      <div class="element-tool-grid" role="toolbar" :aria-label="t('inspector.addElement')">
        <button v-for="tool in elementTools" :key="tool.type" class="icon-command" type="button" :title="t('inspector.addElementShort', { element: elementTypeLabel(tool.type) })" :aria-label="t('inspector.addElementShort', { element: elementTypeLabel(tool.type) })" @click="addElement(tool.type)">
          <component :is="tool.icon" :size="16" />
          <span>{{ elementTypeLabel(tool.type) }}</span>
        </button>
      </div>
    </section>

    <section v-if="selectedElement" class="inspector-section element-editor">
      <header class="element-editor-header">
        <h2>{{ selectionLabel }}</h2>
        <div class="inline-actions">
          <button class="icon-command" type="button" :title="t('inspector.copy')" :aria-label="t('inspector.copy')" @click="editor.duplicateSelectedElement()"><Copy :size="16" /></button>
          <button class="icon-command" type="button" :title="selectedElement.element.locked ? t('inspector.unlock') : t('inspector.lock')" :aria-label="selectedElement.element.locked ? t('inspector.unlock') : t('inspector.lock')" @click="toggleElementLock"><Unlock v-if="selectedElement.element.locked" :size="16" /><Lock v-else :size="16" /></button>
          <button class="icon-command danger" type="button" :title="t('inspector.delete')" :aria-label="t('inspector.delete')" @click="editor.deleteSelectedElement()"><Trash2 :size="16" /></button>
        </div>
      </header>
      <div class="element-action-row">
        <button class="secondary-command" type="button" :title="t('inspector.bringForward')" @click="moveElement(1)"><BringToFront :size="15" />{{ t('inspector.bringForward') }}</button>
        <button class="secondary-command" type="button" :title="t('inspector.sendBackward')" @click="moveElement(-1)"><SendToBack :size="15" />{{ t('inspector.sendBackward') }}</button>
      </div>
      <div class="element-action-row element-align-row" :aria-label="t('inspector.align')">
        <button class="icon-command" type="button" :title="t('inspector.align.left')" :aria-label="t('inspector.align.left')" @click="alignElement('left')"><AlignStartHorizontal :size="15" /></button>
        <button class="icon-command" type="button" :title="t('inspector.align.centerX')" :aria-label="t('inspector.align.centerX')" @click="alignElement('centerX')"><AlignHorizontalJustifyCenter :size="15" /></button>
        <button class="icon-command" type="button" :title="t('inspector.align.right')" :aria-label="t('inspector.align.right')" @click="alignElement('right')"><AlignEndHorizontal :size="15" /></button>
        <button class="icon-command" type="button" :title="t('inspector.align.top')" :aria-label="t('inspector.align.top')" @click="alignElement('top')"><AlignStartVertical :size="15" /></button>
        <button class="icon-command" type="button" :title="t('inspector.align.centerY')" :aria-label="t('inspector.align.centerY')" @click="alignElement('centerY')"><AlignVerticalJustifyCenter :size="15" /></button>
        <button class="icon-command" type="button" :title="t('inspector.align.bottom')" :aria-label="t('inspector.align.bottom')" @click="alignElement('bottom')"><AlignEndVertical :size="15" /></button>
      </div>
      <div class="field-grid field-grid-2">
        <label class="field-label">{{ t('inspector.x') }}<input type="number" :value="selectedElement.element.x" @change="updateElementGeometryField('x', $event)" /></label>
        <label class="field-label">{{ t('inspector.y') }}<input type="number" :value="selectedElement.element.y" @change="updateElementGeometryField('y', $event)" /></label>
        <label class="field-label">{{ t('inspector.width') }}<input type="number" min="24" :value="selectedElement.element.width" @change="updateElementGeometryField('width', $event)" /></label>
        <label class="field-label">{{ t('inspector.height') }}<input type="number" min="24" :value="selectedElement.element.height" @change="updateElementGeometryField('height', $event)" /></label>
        <label class="field-label">{{ t('inspector.rotation') }}<input type="number" min="-360" max="360" :value="selectedElement.element.rotation ?? 0" @change="updateElementGeometryField('rotation', $event)" /></label>
      </div>

      <template v-if="selectedElement.element.type === 'text'">
        <label class="field-label" for="element-text">{{ t('inspector.textContent') }}</label>
        <textarea id="element-text" v-model="elementText" rows="4" @blur="saveElementText"></textarea>
        <div class="field-grid field-grid-2">
          <label class="field-label">{{ t('inspector.fontSize') }}<input type="number" min="8" max="240" :value="selectedElement.element.style?.fontSize ?? 32" @change="updateElementStyleField('fontSize', $event)" /></label>
          <label class="field-label">{{ t('inspector.fontWeight') }}<input type="number" min="100" max="900" step="100" :value="selectedElement.element.style?.fontWeight ?? 400" @change="updateElementStyleField('fontWeight', $event)" /></label>
          <label class="field-label">{{ t('inspector.lineHeight') }}<input type="number" min="0.8" max="3" step="0.05" :value="selectedElement.element.style?.lineHeight ?? 1.3" @change="updateElementStyleField('lineHeight', $event)" /></label>
          <label class="field-label">{{ t('inspector.textAlign') }}<select :value="selectedElement.element.style?.textAlign ?? 'left'" @change="updateElementAlign"><option value="left">{{ t('inspector.align.leftText') }}</option><option value="center">{{ t('inspector.align.centerText') }}</option><option value="right">{{ t('inspector.align.rightText') }}</option></select></label>
        </div>
        <label class="field-label">{{ t('inspector.textColor') }}<input type="text" :value="selectedElement.element.style?.color ?? 'var(--slide-ink)'" @change="updateElementStyleText('color', $event)" /></label>
        <label class="field-label">{{ t('inspector.font') }}<input type="text" :value="selectedElement.element.style?.fontFamily ?? ''" :placeholder="t('inspector.fontPlaceholder')" @change="updateElementStyleText('fontFamily', $event)" /></label>
      </template>

      <template v-else-if="selectedElement.element.type === 'image'">
        <label class="field-label" for="element-source">{{ t('inspector.imageSource') }}</label>
        <textarea id="element-source" v-model="elementSource" rows="3" @blur="saveElementImage"></textarea>
        <label class="field-label">{{ t('inspector.altText') }}<input type="text" v-model="elementAlt" @blur="saveElementImage" /></label>
        <input ref="upload" class="visually-hidden" type="file" accept="image/*" @change="chooseFile" />
        <button class="secondary-command" type="button" @click="upload?.click()"><ImageUp :size="16" />{{ t('inspector.replaceImage') }}</button>
      </template>

      <template v-else>
        <div class="field-grid field-grid-2">
          <label class="field-label">{{ t('inspector.fill') }}<input type="text" :value="selectedElement.element.style?.fill ?? 'var(--slide-accent)'" @change="updateElementStyleText('fill', $event)" /></label>
          <label class="field-label">{{ t('inspector.stroke') }}<input type="text" :value="selectedElement.element.style?.stroke ?? 'transparent'" @change="updateElementStyleText('stroke', $event)" /></label>
          <label class="field-label">{{ t('inspector.strokeWidth') }}<input type="number" min="0" max="30" :value="selectedElement.element.style?.strokeWidth ?? 0" @change="updateElementStyleField('strokeWidth', $event)" /></label>
          <label class="field-label">{{ t('inspector.radius') }}<input type="number" min="0" max="300" :value="selectedElement.element.style?.radius ?? 0" @change="updateElementStyleField('radius', $event)" /></label>
        </div>
      </template>
      <label class="field-label">{{ t('inspector.opacity') }}<input type="number" min="0" max="1" step="0.05" :value="selectedElement.element.style?.opacity ?? 1" @change="updateElementStyleField('opacity', $event)" /></label>
    </section>

    <section class="inspector-section">
      <label class="field-label" for="layout-select">{{ t('inspector.layout') }}</label>
      <select id="layout-select" :value="editor.currentSlide.value?.layout" @change="editor.setLayout(($event.target as HTMLSelectElement).value as SlideLayout)">
        <option v-for="layout in LAYOUTS" :key="layout.id" :value="layout.id">{{ layoutLabel(layout.id) }}</option>
      </select>
      <template v-if="layoutCandidates.length > 1">
        <label class="field-label" for="candidate-select">{{ t('inspector.recommendedLayout') }}</label>
        <select id="candidate-select" :value="editor.currentSlide.value?.selectedLayoutCandidate" @change="editor.setLayoutCandidate(($event.target as HTMLSelectElement).value)">
          <option v-for="candidate in layoutCandidates" :key="candidate.id" :value="candidate.id">{{ layoutLabel(candidate.layout) }} · {{ localizeLayoutRationale(candidate.rationale ?? '') }}</option>
        </select>
      </template>
    </section>

    <section class="inspector-section">
      <h2>{{ t('inspector.quickAdjust') }}</h2>
      <label class="field-label" for="density-select">{{ t('inspector.density') }}</label>
      <select id="density-select" :value="tweaks.density" @change="setDensity(($event.target as HTMLSelectElement).value)">
        <option value="airy">{{ t('inspector.density.airy') }}</option>
        <option value="balanced">{{ t('inspector.density.balanced') }}</option>
        <option value="dense">{{ t('inspector.density.dense') }}</option>
      </select>
      <label class="field-label" for="accent-select">{{ t('inspector.accent') }}</label>
      <select id="accent-select" :value="tweaks.accentMode" @change="setAccentMode(($event.target as HTMLSelectElement).value)">
        <option value="default">{{ t('inspector.accent.default') }}</option>
        <option value="warm">{{ t('inspector.accent.warm') }}</option>
        <option value="cool">{{ t('inspector.accent.cool') }}</option>
      </select>
      <label class="field-label" for="font-scale">{{ t('inspector.fontScale', { value: Math.round(tweaks.fontScale * 100) }) }}</label>
      <input id="font-scale" type="range" min="0.85" max="1.2" step="0.05" :value="tweaks.fontScale" @input="setFontScale(($event.target as HTMLInputElement).value)" />
    </section>

    <section class="inspector-section">
      <h2>{{ t('inspector.designContext') }}</h2>
      <label class="field-label" for="context-audience">{{ t('inspector.audience') }}</label>
      <input id="context-audience" :value="editor.deck.value.designContext?.audience ?? ''" type="text" @blur="updateContext('audience', $event)" />
      <label class="field-label" for="context-purpose">{{ t('inspector.purpose') }}</label>
      <textarea id="context-purpose" rows="3" :value="editor.deck.value.designContext?.purpose ?? ''" @blur="updateContext('purpose', $event)"></textarea>
      <label class="field-label" for="context-tone">{{ t('inspector.tone') }}</label>
      <input id="context-tone" :value="editor.deck.value.designContext?.tone ?? ''" type="text" @blur="updateContext('tone', $event)" />
    </section>

    <section class="inspector-section">
      <h2>{{ t('inspector.notes') }}</h2>
      <textarea id="slide-notes" rows="4" :value="editor.currentSlide.value?.notes ?? ''" @blur="updateNotes"></textarea>
    </section>

    <section v-if="editor.selection.value?.kind === 'text'" class="inspector-section selection-editor">
      <label class="field-label" for="selected-text">{{ selectionLabel }}</label>
      <textarea id="selected-text" v-model="textValue" rows="8" @blur="saveText"></textarea>
    </section>

    <section v-else-if="editor.selection.value?.kind === 'image'" class="inspector-section selection-editor">
      <h2>{{ selectionLabel }}</h2>
      <label class="field-label" for="image-source">{{ t('inspector.imageSource') }}</label>
      <textarea id="image-source" v-model="imageSource" rows="4" @blur="saveImage"></textarea>
      <label class="field-label" for="image-alt">{{ t('inspector.altText') }}</label>
      <input id="image-alt" v-model="imageAlt" type="text" @blur="saveImage" />
      <label class="field-label" for="image-caption">{{ t('inspector.imageCaption') }}</label>
      <input id="image-caption" v-model="imageCaption" type="text" @blur="saveImage" />
      <input ref="upload" class="visually-hidden" type="file" accept="image/*" @change="chooseFile" />
      <button class="secondary-command" type="button" @click="upload?.click()">
        <ImageUp :size="17" />
        {{ t('inspector.uploadImage') }}
      </button>
    </section>

    <section v-else class="inspector-section inspector-empty">
      <h2>{{ t('inspector.currentSlide') }}</h2>
      <p>{{ layoutLabel(editor.currentSlide.value?.layout || 'statement') }} · {{ String(editor.currentIndex.value + 1).padStart(2, '0') }}</p>
    </section>

    <section class="inspector-section quality-section">
      <header>
        <ShieldCheck :size="18" />
        <h2>{{ t('inspector.quality') }}</h2>
        <span :class="{ 'has-errors': editor.qualityIssues.value.some(issue => issue.severity === 'error') }">{{ editor.qualityIssues.value.length }}</span>
      </header>
      <p v-if="!editor.qualityIssues.value.length" class="quality-clear">{{ t('inspector.qualityClear') }}</p>
      <button
        v-for="issue in editor.qualityIssues.value"
        :key="`${issue.code}-${issue.slideId}`"
        class="quality-issue"
        type="button"
        @click="issue.slideId && editor.selectSlide(issue.slideId)"
      >
        <span :class="issue.severity"></span>
        {{ localizeQualityIssue(issue) }}
      </button>
    </section>
  </aside>
</template>
