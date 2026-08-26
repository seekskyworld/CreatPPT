import type { TemplateId } from './types'

/**
 * Agenda geometry is shared by the editable scene, the semantic fallback
 * renderer, and the PPTX exporter. Keeping the rows here prevents a wrapped
 * bullet from being clipped by one renderer while looking correct in another.
 */
export interface AgendaBox {
  x: number
  y: number
  width: number
  height: number
}

export interface AgendaRowLayout {
  index: number
  y: number
  height: number
  lineY: number
  lines: number
  indexBox: AgendaBox
  textBox: AgendaBox
  backgroundBox: AgendaBox
}

export interface AgendaLayout {
  x: number
  width: number
  y: number
  fontSize: number
  lineHeight: number
  rows: AgendaRowLayout[]
  endY: number
}

const AGENDA_RIGHT = 84
const AGENDA_BOTTOM = 790
const INDEX_WIDTH = 54
const TEXT_GAP = 12
const BASE_FONT_SIZE = 30
const MIN_FONT_SIZE = 16
const LINE_HEIGHT = 1.25
const MIN_ROW_HEIGHT = 104
const ROW_PADDING = 48

export function getAgendaFrame(templateId: TemplateId): Pick<AgendaLayout, 'x' | 'width' | 'y'> {
  const width = templateId === 'editorial' ? 700 : 660
  const y = templateId === 'editorial' ? 150 : 176
  return { x: 1600 - AGENDA_RIGHT - width, width, y }
}

/** Build deterministic row boxes that leave enough room for wrapped text. */
export function getAgendaLayout(items: readonly string[] | undefined, templateId: TemplateId): AgendaLayout {
  const frame = getAgendaFrame(templateId)
  const values = items ?? []
  const availableHeight = Math.max(0, AGENDA_BOTTOM - frame.y)
  let fontSize = BASE_FONT_SIZE
  let rows = measureRows(values, frame, fontSize)

  // Six or more agenda items can still fit on a slide, but only after the
  // type is reduced enough for two-line entries to retain their full height.
  while (rowsTotalHeight(rows) > availableHeight && fontSize > MIN_FONT_SIZE) {
    fontSize -= 1
    rows = measureRows(values, frame, fontSize)
  }

  // Extremely dense imported decks may still exceed the safe area at the
  // minimum font size. Compress the row padding as a last resort while never
  // making the text box shorter than the measured line box.
  if (rows.length && rowsTotalHeight(rows) > availableHeight) {
    const compressedHeight = Math.max(64, Math.floor(availableHeight / rows.length))
    rows = rows.map(row => {
      const height = Math.max(compressedHeight, row.textBox.height + 20)
      return {
        ...row,
        height,
        backgroundBox: { ...row.backgroundBox, height: Math.max(0, height - 2) },
        indexBox: centeredBox(row.indexBox.x, row.indexBox.width, row.y, height, row.indexBox.height),
        textBox: centeredBox(row.textBox.x, row.textBox.width, row.y, height, Math.min(row.textBox.height, Math.max(24, height - 20))),
      }
    })
  }

  // Reflow after any compression so the separators always sit at the exact
  // bottom edge of their corresponding row.
  let cursor = frame.y
  rows = rows.map(row => {
    const next = {
      ...row,
      y: cursor,
      lineY: cursor,
      backgroundBox: { ...row.backgroundBox, y: cursor + 2 },
      indexBox: { ...row.indexBox, y: cursor + (row.height - row.indexBox.height) / 2 },
      textBox: { ...row.textBox, y: cursor + (row.height - row.textBox.height) / 2 },
    }
    cursor += row.height
    return next
  })

  return {
    ...frame,
    fontSize,
    lineHeight: LINE_HEIGHT,
    rows,
    endY: cursor,
  }
}

function measureRows(values: readonly string[], frame: Pick<AgendaLayout, 'x' | 'width' | 'y'>, fontSize: number): AgendaRowLayout[] {
  const textWidth = frame.width - INDEX_WIDTH - TEXT_GAP
  let cursor = frame.y
  return values.map((value, index) => {
    const lines = estimateLines(value, textWidth, fontSize)
    const textHeight = Math.ceil(lines * fontSize * LINE_HEIGHT)
    const height = Math.max(MIN_ROW_HEIGHT, textHeight + ROW_PADDING)
    const textBox = centeredBox(frame.x + INDEX_WIDTH + TEXT_GAP, textWidth, cursor, height, textHeight)
    const indexBox = centeredBox(frame.x, INDEX_WIDTH, cursor, height, 36)
    const row: AgendaRowLayout = {
      index,
      y: cursor,
      height,
      lineY: cursor,
      lines,
      indexBox,
      textBox,
      backgroundBox: { x: frame.x, y: cursor + 2, width: frame.width, height: Math.max(0, height - 2) },
    }
    cursor += height
    return row
  })
}

function centeredBox(x: number, width: number, y: number, height: number, boxHeight: number): AgendaBox {
  return { x, y: y + Math.max(0, (height - boxHeight) / 2), width, height: boxHeight }
}

function rowsTotalHeight(rows: readonly AgendaRowLayout[]): number {
  return rows.reduce((total, row) => total + row.height, 0)
}

/** Approximate browser/PPTX wrapping without relying on a runtime font metric. */
function estimateLines(value: string, width: number, fontSize: number): number {
  const capacity = Math.max(1, width / (fontSize * 0.95))
  const explicitLines = value.split(/\r?\n/)
  return Math.max(1, explicitLines.reduce((total, part) => total + Math.max(1, Math.ceil(visualLength(part) / capacity)), 0))
}

function visualLength(value: string): number {
  let length = 0
  for (const character of value) {
    if (/\s/.test(character)) length += 0.35
    else if (/[A-Za-z0-9]/.test(character)) length += 0.58
    else length += 1
  }
  return length
}
