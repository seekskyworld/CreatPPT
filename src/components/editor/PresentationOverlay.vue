<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEditorState } from '@/editor/state'
import { useI18n } from '@/i18n'
import SlideSurface from '@/components/slides/SlideSurface.vue'
import { CANVAS } from '@/domain/geometry'

const editor = useEditorState()
const { t } = useI18n()
const viewport = ref<HTMLElement>()
const scale = ref(1)
let observer: ResizeObserver | undefined

const frameStyle = computed(() => ({ width: `${CANVAS.width * scale.value}px`, height: `${CANVAS.height * scale.value}px` }))
const surfaceStyle = computed(() => ({ transform: `scale(${scale.value})` }))

function measure() {
  if (!viewport.value) return
  scale.value = Math.min(viewport.value.clientWidth / CANVAS.width, viewport.value.clientHeight / CANVAS.height)
}

function go(offset: number) {
  const next = Math.min(editor.deck.value.slides.length - 1, Math.max(0, editor.currentIndex.value + offset))
  editor.selectSlide(editor.deck.value.slides[next].id)
}

function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') editor.presentation.value = false
  if (['ArrowRight', 'PageDown', ' '].includes(event.key)) go(1)
  if (['ArrowLeft', 'PageUp'].includes(event.key)) go(-1)
}

onMounted(() => {
  observer = new ResizeObserver(measure)
  if (viewport.value) observer.observe(viewport.value)
  window.addEventListener('keydown', keydown)
  measure()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', keydown)
})
</script>

<template>
  <div ref="viewport" class="presentation-overlay" role="dialog" :aria-label="t('presentation.mode')">
    <div class="presentation-frame" :style="frameStyle">
      <SlideSurface
        v-if="editor.currentSlide.value"
        class="presentation-surface"
        :style="surfaceStyle"
        :slide="editor.currentSlide.value"
        :template-id="editor.deck.value.templateId"
        :tweaks="editor.deck.value.tweaks"
        :slide-number="editor.currentIndex.value + 1"
      />
    </div>
    <div class="presentation-controls">
      <button class="icon-button" type="button" :title="t('presentation.previous')" :aria-label="t('presentation.previous')" :disabled="editor.currentIndex.value === 0" @click="go(-1)">
        <ChevronLeft :size="22" />
      </button>
      <span>{{ editor.currentIndex.value + 1 }} / {{ editor.deck.value.slides.length }}</span>
      <button class="icon-button" type="button" :title="t('presentation.next')" :aria-label="t('presentation.next')" :disabled="editor.currentIndex.value === editor.deck.value.slides.length - 1" @click="go(1)">
        <ChevronRight :size="22" />
      </button>
    </div>
    <button class="presentation-close icon-button" type="button" :title="t('presentation.exit')" :aria-label="t('presentation.exit')" @click="editor.presentation.value = false">
      <X :size="22" />
    </button>
  </div>
</template>
