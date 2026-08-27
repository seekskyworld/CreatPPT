<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormSpec } from '@/domain/types'

const props = withDefaults(defineProps<{
  form: FormSpec
  slideId?: string
  editable?: boolean
  initialData?: Record<string, any>
}>(), {
  slideId: '',
  editable: false,
  initialData: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:formData', data: Record<string, any>): void
  (e: 'submit', data: Record<string, any>): void
}>()

const formValues = ref<Record<string, any>>({ ...props.initialData })

// Initialize default values from fields
props.form.fields.forEach((field, index) => {
  const key = field.id || field.name || `field_${index}`
  if (formValues.value[key] === undefined) {
    formValues.value[key] = field.value !== undefined ? field.value : ''
  }
})

watch(formValues, (newVal) => {
  emit('update:formData', newVal)
}, { deep: true })

function handleSubmit() {
  emit('submit', formValues.value)
  if (props.form.submitAction) {
    if (typeof props.form.submitAction === 'string') {
      if (props.form.submitAction.startsWith('http')) {
        window.open(props.form.submitAction, '_blank')
      } else {
        alert(`Form submitted successfully!\n${JSON.stringify(formValues.value, null, 2)}`)
      }
    } else if (props.form.submitAction.type === 'url') {
      window.open(String(props.form.submitAction.target), '_blank')
    }
  }
}
</script>

<template>
  <form class="editable-form-container" @submit.prevent="handleSubmit">
    <div v-for="(field, index) in form.fields" :key="field.id || index" class="form-field-group">
      <label class="form-label">{{ field.label }}</label>

      <!-- Text Input -->
      <input
        v-if="field.type === 'text' || field.type === 'email'"
        v-model="formValues[field.id || field.name || `field_${index}`]"
        :type="field.type"
        class="form-control"
      />

      <!-- Number Input -->
      <input
        v-else-if="field.type === 'number'"
        v-model.number="formValues[field.id || field.name || `field_${index}`]"
        type="number"
        class="form-control"
      />

      <!-- Textarea -->
      <textarea
        v-else-if="field.type === 'textarea'"
        v-model="formValues[field.id || field.name || `field_${index}`]"
        class="form-control form-textarea"
        rows="3"
      ></textarea>

      <!-- Select -->
      <select
        v-else-if="field.type === 'select'"
        v-model="formValues[field.id || field.name || `field_${index}`]"
        class="form-control"
      >
        <option v-for="opt in field.options || []" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>

      <!-- Checkbox -->
      <div v-else-if="field.type === 'checkbox'" class="form-options">
        <label v-for="opt in field.options || [field.label]" :key="opt" class="option-label">
          <input
            v-model="formValues[field.id || field.name || `field_${index}`]"
            type="checkbox"
            :value="opt"
          />
          {{ opt }}
        </label>
      </div>

      <!-- Radio -->
      <div v-else-if="field.type === 'radio'" class="form-options">
        <label v-for="opt in field.options || []" :key="opt" class="option-label">
          <input
            v-model="formValues[field.id || field.name || `field_${index}`]"
            type="radio"
            :value="opt"
            :name="field.name || `radio_${index}`"
          />
          {{ opt }}
        </label>
      </div>

      <!-- Fallback Input -->
      <input
        v-else
        v-model="formValues[field.id || field.name || `field_${index}`]"
        type="text"
        class="form-control"
      />
    </div>

    <button type="submit" class="form-submit-btn">
      Submit
    </button>
  </form>
</template>

<style scoped>
.editable-form-container {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  font-family: inherit;
  color: var(--slide-ink, #000);
}

.form-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--slide-ink, #222);
}

.form-control {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--slide-line, #ccc);
  border-radius: 4px;
  font-size: 14px;
  background: var(--slide-surface, #fff);
  color: var(--slide-ink, #000);
  box-sizing: border-box;
}

.form-textarea {
  resize: vertical;
}

.form-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.form-submit-btn {
  margin-top: 8px;
  padding: 10px 16px;
  background-color: var(--slide-accent, #0066ff);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
  transition: opacity 0.2s;
}

.form-submit-btn:hover {
  opacity: 0.9;
}
</style>
