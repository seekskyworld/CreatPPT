<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useEditorState } from '@/editor/state'
import EditorHeader from './EditorHeader.vue'
import InspectorPanel from './InspectorPanel.vue'
import PresentationOverlay from './PresentationOverlay.vue'
import PrintDeck from './PrintDeck.vue'
import SlideRail from './SlideRail.vue'
import SlideStage from './SlideStage.vue'
import ToastViewport from './ToastViewport.vue'

const editor = useEditorState()

function keydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    editor.saveNow()
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    editor.selectAllElements()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    editor.cancelElementInteraction()
    editor.setSelection(null)
    return
  }

  const selectedElement = editor.selectedElement()
  if (selectedElement) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      editor.deleteSelectedElement()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      editor.duplicateSelectedElement()
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      editor.changeElementZIndex(event.key === 'Home' ? -10000 : 10000)
      return
    }
    const step = event.shiftKey ? 8 : 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      editor.nudgeSelectedElement(
        event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
      )
      return
    }
  }

  if (event.key === 'ArrowDown' || event.key === 'PageDown') {
    const next = Math.min(editor.deck.value.slides.length - 1, editor.currentIndex.value + 1)
    editor.selectSlide(editor.deck.value.slides[next].id)
  }
  if (event.key === 'ArrowUp' || event.key === 'PageUp') {
    const next = Math.max(0, editor.currentIndex.value - 1)
    editor.selectSlide(editor.deck.value.slides[next].id)
  }
}

onMounted(() => window.addEventListener('keydown', keydown))
onBeforeUnmount(() => window.removeEventListener('keydown', keydown))
</script>

<template>
  <div class="editor-shell" :data-mobile-panel="editor.mobilePanel.value">
    <EditorHeader />
    <div class="editor-workspace">
      <SlideRail />
      <SlideStage />
      <InspectorPanel />
    </div>
    <PresentationOverlay v-if="editor.presentation.value" />
    <PrintDeck />
    <ToastViewport />
  </div>
</template>
