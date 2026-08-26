<script setup lang="ts">
import { Copy, GripVertical, Plus, Trash2 } from '@lucide/vue'
import { ref } from 'vue'
import { useEditorState } from '@/editor/state'
import { useI18n } from '@/i18n'
import SlideSurface from '@/components/slides/SlideSurface.vue'

const editor = useEditorState()
const { t } = useI18n()
const draggingIndex = ref<number | null>(null)

function startDrag(index: number, event: DragEvent) {
  draggingIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function drop(index: number) {
  if (draggingIndex.value !== null) editor.moveSlide(draggingIndex.value, index)
  draggingIndex.value = null
}
</script>

<template>
  <aside class="slide-rail" :aria-label="t('rail.slides')">
    <header class="rail-header">
      <span>{{ t('rail.slides') }}</span>
      <span>{{ editor.deck.value.slides.length }}</span>
      <button class="icon-button" type="button" :title="t('rail.newSlide')" :aria-label="t('rail.newSlide')" @click="editor.addSlide">
        <Plus :size="18" />
      </button>
    </header>

    <div class="rail-list">
      <div
        v-for="(slide, index) in editor.deck.value.slides"
        :key="slide.id"
        class="rail-item"
        :class="{ 'is-current': slide.id === editor.currentSlideId.value, 'is-dragging': draggingIndex === index }"
        draggable="true"
        @dragstart="startDrag(index, $event)"
        @dragover.prevent
        @drop.prevent="drop(index)"
      >
        <button class="drag-handle" type="button" :title="t('rail.reorder')" :aria-label="t('rail.reorder')">
          <GripVertical :size="15" />
        </button>
        <button class="thumbnail-button" type="button" :aria-label="t('rail.openSlide', { number: index + 1 })" @click="editor.selectSlide(slide.id)">
          <span class="thumbnail-frame">
            <SlideSurface class="thumbnail-surface" :slide="slide" :template-id="editor.deck.value.templateId" :tweaks="editor.deck.value.tweaks" :slide-number="index + 1" />
          </span>
          <span class="thumbnail-meta">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ slide.title }}</span>
          </span>
        </button>
      </div>
    </div>

    <footer class="rail-actions">
      <button class="icon-button" type="button" :title="t('rail.duplicate')" :aria-label="t('rail.duplicate')" @click="editor.duplicateSlide">
        <Copy :size="18" />
      </button>
      <button class="icon-button" type="button" :title="t('rail.delete')" :aria-label="t('rail.delete')" @click="editor.deleteSlide">
        <Trash2 :size="18" />
      </button>
    </footer>
  </aside>
</template>
