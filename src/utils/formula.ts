/**
 * FormulaEngine: 轻量 JS 表达式求值器，表格公式联动计算
 */

export function colIndexToLetter(col: number): string {
  let letter = ''
  let c = col
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter
    c = Math.floor(c / 26) - 1
  }
  return letter
}

export function letterToColIndex(letter: string): number {
  let col = 0
  const upper = letter.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64)
  }
  return col - 1
}

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const col = letterToColIndex(match[1])
  const row = parseInt(match[2], 10) - 1
  return { row, col }
}

export function parseRangeRef(range: string): { start: { row: number; col: number }; end: { row: number; col: number } } | null {
  const parts = range.split(':')
  if (parts.length !== 2) return null
  const start = parseCellRef(parts[0])
  const end = parseCellRef(parts[1])
  if (!start || !end) return null
  return {
    start: {
      row: Math.min(start.row, end.row),
      col: Math.min(start.col, end.col),
    },
    end: {
      row: Math.max(start.row, end.row),
      col: Math.max(start.col, end.col),
    },
  }
}

export function getCellValue(
  rows: (string | number)[][],
  row: number,
  col: number,
  visited: Set<string> = new Set(),
  formulas?: Record<string, string>,
): number {
  const key = `${row},${col}`
  if (visited.has(key)) return 0
  visited.add(key)

  if (row < 0 || row >= rows.length) return 0
  const rowData = rows[row]
  if (!rowData || col < 0 || col >= rowData.length) return 0

  const formulaKey = `${row},${col}`
  const formula = formulas?.[formulaKey]
  const val = formula || rowData[col]

  if (typeof val === 'number') return val
  if (!val) return 0

  const strVal = String(val).trim()
  if (strVal.startsWith('=')) {
    return evaluateFormula(strVal, rows, formulas, visited)
  }

  const num = parseFloat(strVal)
  return isNaN(num) ? 0 : num
}

export function evaluateFormula(
  formula: string,
  rows: (string | number)[][],
  formulas?: Record<string, string>,
  visited: Set<string> = new Set(),
): number {
  const expr = formula.startsWith('=') ? formula.slice(1).trim() : formula.trim()
  if (!expr) return 0

  // Standard Functions: SUM, AVERAGE, MIN, MAX
  const funcMatch = expr.match(/^(SUM|AVERAGE|AVG|MIN|MAX)\(([^)]+)\)$/i)
  if (funcMatch) {
    const fnName = funcMatch[1].toUpperCase()
    const arg = funcMatch[2].trim()

    let values: number[] = []
    const range = parseRangeRef(arg)
    if (range) {
      for (let r = range.start.row; r <= range.end.row; r++) {
        for (let c = range.start.col; c <= range.end.col; c++) {
          values.push(getCellValue(rows, r, c, new Set(visited), formulas))
        }
      }
    } else {
      // Comma-separated refs or numbers
      const parts = arg.split(',')
      for (const part of parts) {
        const cell = parseCellRef(part)
        if (cell) {
          values.push(getCellValue(rows, cell.row, cell.col, new Set(visited), formulas))
        } else {
          const num = parseFloat(part.trim())
          if (!isNaN(num)) values.push(num)
        }
      }
    }

    if (values.length === 0) return 0
    if (fnName === 'SUM') return values.reduce((a, b) => a + b, 0)
    if (fnName === 'AVERAGE' || fnName === 'AVG') return values.reduce((a, b) => a + b, 0) / values.length
    if (fnName === 'MIN') return Math.min(...values)
    if (fnName === 'MAX') return Math.max(...values)
  }

  // Replace Cell references e.g. A1, B2 in expression with evaluated numbers
  const substituted = expr.replace(/\b([A-Z]+)(\d+)\b/gi, (match) => {
    const cell = parseCellRef(match)
    if (!cell) return match
    const v = getCellValue(rows, cell.row, cell.col, new Set(visited), formulas)
    return String(v)
  })

  try {
    // Safe expression evaluation for basic arithmetic
    if (/^[0-9+*/.() -]+$/.test(substituted)) {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${substituted})`)()
      return typeof result === 'number' && !isNaN(result) ? result : 0
    }
  } catch {
    // Fallback
  }

  const fallbackNum = parseFloat(substituted)
  return isNaN(fallbackNum) ? 0 : fallbackNum
}

export function computeTableMatrix(
  headers: string[],
  rows: (string | number)[][],
  formulas?: Record<string, string>,
): (string | number)[][] {
  return rows.map((row, rowIndex) =>
    row.map((cellVal, colIndex) => {
      const formulaKey = `${rowIndex},${colIndex}`
      const formula = formulas?.[formulaKey] || (typeof cellVal === 'string' && cellVal.startsWith('=') ? cellVal : undefined)
      if (formula) {
        return evaluateFormula(formula, rows, formulas)
      }
      return cellVal
    }),
  )
}
