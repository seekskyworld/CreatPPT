<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CANVAS } from '@/domain/geometry'
import { useEditorState } from '@/editor/state'
import SlideSurface from '@/components/slides/SlideSurface.vue'

const editor = useEditorState()
const viewport = ref<HTMLElement>()
const scale = ref(0.6)
let observer: ResizeObserver | undefined

const frameStyle = computed(() => ({ width: `${CANVAS.width * scale.value}px`, height: `${CANVAS.height * scale.value}px` }))
const surfaceStyle = computed(() => ({ transform: `scale(${scale.value})` }))

function measure() {
  if (!viewport.value) return
  const width = Math.max(240, viewport.value.clientWidth - 56)
  const height = Math.max(180, viewport.value.clientHeight - 56)
  scale.value = Math.min(width / CANVAS.width, height / CANVAS.height, 1)
}

onMounted(() => {
  observer = new ResizeObserver(measure)
  if (viewport.value) observer.observe(viewport.value)
  measure()
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main ref="viewport" class="stage" @click.self="editor.setSelection(null)">
    <div v-if="editor.currentSlide.value" class="stage-frame" :style="frameStyle">
      <SlideSurface
        class="stage-surface"
        :style="surfaceStyle"
        :slide="editor.currentSlide.value"
        :template-id="editor.deck.value.templateId"
        :tweaks="editor.deck.value.tweaks"
        :slide-number="editor.currentIndex.value + 1"
        :selected-path="editor.selection.value?.path"
        :selected-element-ids="editor.selectedElementIds.value"
        editable
      />
    </div>
  </main>
</template>
