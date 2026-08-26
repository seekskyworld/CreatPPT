<script setup lang="ts">
import {
  Check,
  Download,
  LoaderCircle,
  MonitorPlay,
  Printer,
  PanelLeft,
  PanelsTopLeft,
  Redo2,
  Save,
  SlidersHorizontal,
  Undo2,
} from '@lucide/vue'
import { ref } from 'vue'
import { useEditorState } from '@/editor/state'
import { useI18n } from '@/i18n'

const editor = useEditorState()
const { locale, t, setLocale, languageOptions } = useI18n()
const exporting = ref(false)
const titleInput = ref<HTMLInputElement>()

async function exportPptx() {
  if (exporting.value) return
  const blocking = editor.qualityIssues.value.filter(issue => issue.severity === 'error')
  if (blocking.length) {
    editor.notify('error', t('notify.exportBlocked', { count: blocking.length }))
    return
  }
  exporting.value = true
  try {
    const saved = await editor.saveNow()
    if (!saved) throw new Error(t('notify.unsavedExport'))
    const { exportDeckToPptx } = await import('@/export/pptx')
    await exportDeckToPptx(editor.deck.value)
    editor.notify('success', t('notify.exportSuccess'))
  }
  catch (error) {
    editor.notify('error', error instanceof Error ? error.message : t('notify.exportFailed'))
  }
  finally {
    exporting.value = false
  }
}

async function exportPdf() {
  const saved = await editor.saveNow()
  if (!saved) return
  window.print()
}

function saveTitle() {
  if (titleInput.value) editor.updateDeckTitle(titleInput.value.value)
}
</script>

<template>
  <header class="editor-header">
    <div class="brand-lockup" aria-label="CreatPPT">
      <img class="brand-mark" src="/creatppt-icon.png" alt="" aria-hidden="true" />
      <span>CreatPPT</span>
    </div>

    <div class="document-name">
      <input ref="titleInput" :value="editor.deck.value.title" :aria-label="t('header.documentTitle')" @blur="saveTitle" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()" />
      <span class="save-state" :class="`state-${editor.saveState.value}`">
        <LoaderCircle v-if="editor.saveState.value === 'saving'" :size="13" class="spin" />
        <Check v-else-if="editor.saveState.value === 'saved'" :size="13" />
        <span>{{ editor.saveState.value === 'saving' ? t('header.save.saving') : editor.saveState.value === 'error' ? t('header.save.error') : t('header.save.saved') }}</span>
      </span>
    </div>

    <div class="header-tools">
      <button class="icon-button desktop-tool" type="button" :title="t('header.undo')" :aria-label="t('header.undo')" :disabled="!editor.canUndo.value" @click="editor.undo">
        <Undo2 :size="19" />
      </button>
      <button class="icon-button desktop-tool" type="button" :title="t('header.redo')" :aria-label="t('header.redo')" :disabled="!editor.canRedo.value" @click="editor.redo">
        <Redo2 :size="19" />
      </button>
      <button class="icon-button desktop-tool" type="button" :title="t('header.saveNow')" :aria-label="t('header.saveNow')" @click="editor.saveNow">
        <Save :size="18" />
      </button>
      <button class="icon-button" type="button" :title="t('header.present')" :aria-label="t('header.present')" @click="editor.presentation.value = true">
        <MonitorPlay :size="19" />
      </button>
      <button class="icon-button" type="button" :title="t('header.print')" :aria-label="t('header.print')" @click="exportPdf">
        <Printer :size="18" />
      </button>
      <button class="mobile-tool icon-button" type="button" :title="t('header.slides')" :aria-label="t('header.slides')" @click="editor.mobilePanel.value = 'slides'">
        <PanelLeft :size="19" />
      </button>
      <button class="mobile-tool icon-button" type="button" :title="t('header.canvas')" :aria-label="t('header.canvas')" @click="editor.mobilePanel.value = 'canvas'">
        <PanelsTopLeft :size="19" />
      </button>
      <button class="mobile-tool icon-button" type="button" :title="t('header.inspector')" :aria-label="t('header.inspector')" @click="editor.mobilePanel.value = 'inspector'">
        <SlidersHorizontal :size="19" />
      </button>
      <label class="language-control">
        <span class="visually-hidden">{{ t('language.label') }}</span>
        <select class="language-select" :aria-label="t('language.label')" :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'zh')">
          <option v-for="option in languageOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <button class="export-button" data-testid="export-pptx" type="button" :disabled="exporting" @click="exportPptx">
        <LoaderCircle v-if="exporting" :size="18" class="spin" />
        <Download v-else :size="18" />
        <span>{{ exporting ? t('header.exporting') : t('header.export') }}</span>
      </button>
    </div>
  </header>
</template>
