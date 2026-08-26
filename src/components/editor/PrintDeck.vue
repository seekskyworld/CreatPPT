<script setup lang="ts">
import { useEditorState } from '@/editor/state'
import SlideSurface from '@/components/slides/SlideSurface.vue'
import { CANVAS } from '@/domain/geometry'

const editor = useEditorState()
</script>

<template>
  <div class="print-deck" :style="{ width: `${CANVAS.width}px` }" aria-hidden="true">
    <section v-for="(slide, index) in editor.deck.value.slides" :key="slide.id" class="print-page">
      <SlideSurface
        :slide="slide"
        :template-id="editor.deck.value.templateId"
        :tweaks="editor.deck.value.tweaks"
        :slide-number="index + 1"
      />
    </section>
  </div>
</template>
