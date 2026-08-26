<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useEditorState } from '@/editor/state'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  slideId: string
  path: string
  label: string
  modelValue?: string | number
  editable?: boolean
  as?: string
  singleLine?: boolean
  selected?: boolean
  placeholder?: string
  valueType?: 'string' | 'number'
}>(), {
  modelValue: '',
  editable: true,
  as: 'div',
  singleLine: false,
  selected: false,
  placeholder: '',
  valueType: 'string',
})

const editor = useEditorState()
const element = ref<HTMLElement>()
const initialValue = ref('')

watch(() => props.modelValue, async value => {
  await nextTick()
  const rendered = value === undefined || value === '' ? props.placeholder : String(value)
  if (element.value && document.activeElement !== element.value && element.value.textContent !== rendered) {
    element.value.textContent = rendered
  }
}, { immediate: true })

function focus() {
  if (!props.editable) return
  initialValue.value = String(props.modelValue ?? '')
  editor.setSelection({ slideId: props.slideId, kind: 'text', path: props.path, label: props.label })
}

function blur(event: FocusEvent) {
  const target = event.currentTarget as HTMLElement
  const value = (target.textContent || '').trim()
  if (value !== initialValue.value && value !== props.placeholder) {
    const nextValue = props.valueType === 'number' ? Number(value) : value
    if (typeof nextValue === 'number' && !Number.isFinite(nextValue)) target.textContent = initialValue.value
    else editor.updateValue(props.slideId, props.path, nextValue)
  }
  else target.textContent = String(props.modelValue || props.placeholder)
}

function keydown(event: KeyboardEvent) {
  if (props.singleLine && event.key === 'Enter') {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).blur()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    const target = event.currentTarget as HTMLElement
    target.textContent = initialValue.value
    target.blur()
  }
}

function paste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
}
</script>

<template>
  <component
    :is="as"
    ref="element"
    v-bind="$attrs"
    class="editable-text"
    :class="{ 'is-editable': editable, 'is-selected': editable && selected }"
    :contenteditable="editable ? 'plaintext-only' : undefined"
    :data-placeholder="placeholder"
    :role="editable ? 'textbox' : undefined"
    :aria-label="editable ? label : undefined"
    :spellcheck="editable"
    @focus="focus"
    @click.stop="focus"
    @blur="blur"
    @keydown="keydown"
    @paste="paste"
  >{{ modelValue || placeholder }}</component>
</template>
