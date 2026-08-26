<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { onMounted } from 'vue'
import EditorShell from '@/components/editor/EditorShell.vue'
import { useEditorState } from '@/editor/state'
import { useI18n } from '@/i18n'

const editor = useEditorState()
const { t } = useI18n()
onMounted(editor.load)
</script>

<template>
  <div v-if="!editor.loaded.value" class="app-loading" role="status">
    <LoaderCircle :size="24" class="spin" />
    <span>{{ t('app.loading') }}</span>
  </div>
  <EditorShell v-else />
</template>
