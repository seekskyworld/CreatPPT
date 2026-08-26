<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info } from '@lucide/vue'
import { useEditorState } from '@/editor/state'

const editor = useEditorState()
</script>

<template>
  <div class="toast-viewport" aria-live="polite">
    <div v-for="notice in editor.notices.value" :key="notice.id" class="toast" :class="`toast-${notice.tone}`">
      <CheckCircle2 v-if="notice.tone === 'success'" :size="18" />
      <AlertCircle v-else-if="notice.tone === 'error'" :size="18" />
      <Info v-else :size="18" />
      <span>{{ notice.message }}</span>
    </div>
  </div>
</template>
