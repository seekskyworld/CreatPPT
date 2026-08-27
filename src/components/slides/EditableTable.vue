<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TableSpec } from '@/domain/types'
import { computeTableMatrix, colIndexToLetter } from '@/utils/formula'

const props = withDefaults(defineProps<{
  table: TableSpec
  editable?: boolean
}>(), {
  editable: false,
})

const emit = defineEmits<{
  (e: 'update:table', value: TableSpec): void
}>()

const editingCell = ref<{ row: number; col: number } | null>(null)
const editValue = ref('')

const computedRows = computed(() => {
  return computeTableMatrix(props.table.headers || [], props.table.rows || [], props.table.formulas)
})

function isMergedHidden(r: number, c: number): boolean {
  if (!props.table.mergeCells) return false
  for (const cell of props.table.mergeCells) {
    const rowspan = cell.rowspan || cell.rowSpan || 1
    const colspan = cell.colspan || cell.colSpan || 1
    if (r >= cell.row && r < cell.row + rowspan && c >= cell.col && c < cell.col + colspan) {
      if (r !== cell.row || c !== cell.col) return true
    }
  }
  return false
}

function getMergeSpan(r: number, c: number): { rowspan?: number; colspan?: number } {
  if (!props.table.mergeCells) return {}
  for (const cell of props.table.mergeCells) {
    if (cell.row === r && cell.col === c) {
      return {
        rowspan: cell.rowspan || cell.rowSpan || 1,
        colspan: cell.colspan || cell.colSpan || 1,
      }
    }
  }
  return {}
}

function startEdit(r: number, c: number) {
  if (!props.editable) return
  editingCell.value = { row: r, col: c }
  const formulaKey = `${r},${c}`
  const rawFormula = props.table.formulas?.[formulaKey]
  editValue.value = rawFormula || String(props.table.rows[r]?.[c] ?? '')
}

function finishEdit() {
  if (!editingCell.value) return
  const { row, col } = editingCell.value
  editingCell.value = null

  const newRows = props.table.rows.map(r => [...r])
  if (!newRows[row]) newRows[row] = []

  const val = editValue.value.trim()
  const newFormulas = { ...(props.table.formulas || {}) }
  const formulaKey = `${row},${col}`

  if (val.startsWith('=')) {
    newFormulas[formulaKey] = val
    newRows[row][col] = val
  } else {
    delete newFormulas[formulaKey]
    const num = Number(val)
    newRows[row][col] = val !== '' && !isNaN(num) ? num : val
  }

  emit('update:table', {
    ...props.table,
    rows: newRows,
    formulas: Object.keys(newFormulas).length > 0 ? newFormulas : undefined,
  })
}
</script>

<template>
  <div class="editable-table-container">
    <table class="editable-table">
      <thead v-if="table.headers && table.headers.length">
        <tr>
          <th v-for="(header, hIndex) in table.headers" :key="hIndex">
            {{ header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rIndex) in table.rows" :key="rIndex">
          <template v-for="(cellVal, cIndex) in row" :key="cIndex">
            <td
              v-if="!isMergedHidden(rIndex, cIndex)"
              :rowspan="getMergeSpan(rIndex, cIndex).rowspan"
              :colspan="getMergeSpan(rIndex, cIndex).colspan"
              :class="{ 'is-editing': editingCell?.row === rIndex && editingCell?.col === cIndex }"
              @dblclick="startEdit(rIndex, cIndex)"
            >
              <input
                v-if="editingCell?.row === rIndex && editingCell?.col === cIndex"
                v-model="editValue"
                class="cell-input"
                autofocus
                @blur="finishEdit"
                @keyup.enter="finishEdit"
              />
              <span v-else class="cell-content">
                {{ computedRows[rIndex]?.[cIndex] ?? cellVal }}
              </span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.editable-table-container {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.editable-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  font-family: inherit;
  font-size: 14px;
  color: var(--slide-ink, #000);
}

.editable-table th,
.editable-table td {
  border: 1px solid var(--slide-line, #ccc);
  padding: 8px 12px;
  text-align: left;
  position: relative;
}

.editable-table th {
  background-color: var(--slide-bg-alt, #f0f0f0);
  font-weight: 700;
  color: var(--slide-ink, #000);
}

.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: 2px solid var(--slide-accent, #0066ff);
  background: transparent;
  font: inherit;
  color: inherit;
  padding: 0;
}

.cell-content {
  display: inline-block;
  width: 100%;
  height: 100%;
}
</style>
