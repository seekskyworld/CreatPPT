<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorState } from '@/editor/state'
import { resolveAssetUrl } from '@/utils/assets'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  slideId: string
  path: string
  label: string
  source?: string
  alt?: string
  editable?: boolean
  selected?: boolean
}>(), {
  source: '',
  alt: '',
  editable: true,
  selected: false,
})

const editor = useEditorState()
const failed = ref(false)
const imageUrl = computed(() => resolveAssetUrl(props.source))

function select() {
  if (!props.editable) return
  editor.setSelection({ slideId: props.slideId, kind: 'image', path: props.path, label: props.label })
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="editable-image"
    :class="{ 'is-editable': editable, 'is-selected': editable && selected, 'is-empty': failed || !source }"
    :role="editable ? 'button' : undefined"
    :tabindex="editable ? 0 : undefined"
    :aria-label="editable ? label : undefined"
    @click.stop="select"
    @keydown.enter.prevent="select"
  >
    <img v-if="source && !failed" :src="imageUrl" :alt="alt" draggable="false" @error="failed = true" />
    <span v-else aria-hidden="true">IMAGE</span>
  </div>
</template>
