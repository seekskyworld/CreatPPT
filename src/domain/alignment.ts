import { CANVAS } from './geometry'
import type { AlignmentGuide, SlideElement } from './types'

export interface SnapMoveResult {
  dx: number
  dy: number
  guides: AlignmentGuide[]
}

interface Anchor {
  value: number
  start: number
  end: number
}

const SNAP_DISTANCE = 8

/**
 * Calculate PowerPoint-style edge/center snapping for a moving selection.
 * Coordinates are logical 1600x900 canvas units; the caller applies the
 * returned delta to every selected element.
 */
export function snapMove(
  elements: SlideElement[],
  selectedIds: string[],
  dx: number,
  dy: number,
  threshold = SNAP_DISTANCE,
): SnapMoveResult {
  const selected = elements.filter(element => selectedIds.includes(element.id) && element.visible !== false)
  if (!selected.length) return { dx, dy, guides: [] }

  const bounds = getSelectionBounds(selected)
  const horizontal = collectHorizontalAnchors(elements, selectedIds)
  const vertical = collectVerticalAnchors(elements, selectedIds)
  const nextX = bounds.left + dx
  const nextY = bounds.top + dy
  const xCandidates = [nextX, nextX + bounds.width / 2, nextX + bounds.width]
  const yCandidates = [nextY, nextY + bounds.height / 2, nextY + bounds.height]

  const xSnap = nearestSnap(xCandidates, vertical, threshold, { start: nextY, end: nextY + bounds.height })
  const ySnap = nearestSnap(yCandidates, horizontal, threshold, { start: nextX, end: nextX + bounds.width })
  const guides: AlignmentGuide[] = []
  if (xSnap) guides.push({ axis: 'x', position: xSnap.value, start: 0, end: CANVAS.height })
  if (ySnap) guides.push({ axis: 'y', position: ySnap.value, start: 0, end: CANVAS.width })

  return {
    dx: dx + (xSnap?.offset ?? 0),
    dy: dy + (ySnap?.offset ?? 0),
    guides,
  }
}

export function getSelectionBounds(elements: SlideElement[]): { left: number; top: number; width: number; height: number } {
  const bounds = elements.map(getElementBounds)
  const left = Math.min(...bounds.map(item => item.left))
  const top = Math.min(...bounds.map(item => item.top))
  const right = Math.max(...bounds.map(item => item.right))
  const bottom = Math.max(...bounds.map(item => item.bottom))
  return { left, top, width: right - left, height: bottom - top }
}

export interface ElementBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** Return the axis-aligned bounds used by snapping and marquee selection. */
export function getElementBounds(element: SlideElement): ElementBounds {
  const rotation = ((element.rotation ?? 0) * Math.PI) / 180
  if (rotation === 0) return { left: element.x, top: element.y, right: element.x + element.width, bottom: element.y + element.height }
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const corners = [
    [-element.width / 2, -element.height / 2],
    [element.width / 2, -element.height / 2],
    [element.width / 2, element.height / 2],
    [-element.width / 2, element.height / 2],
  ].map(([x, y]) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }))
  return {
    left: Math.min(...corners.map(point => point.x)),
    top: Math.min(...corners.map(point => point.y)),
    right: Math.max(...corners.map(point => point.x)),
    bottom: Math.max(...corners.map(point => point.y)),
  }
}

function collectHorizontalAnchors(elements: SlideElement[], selectedIds: string[]): Anchor[] {
  const anchors: Anchor[] = [
    { value: 0, start: 0, end: CANVAS.width },
    { value: CANVAS.height / 2, start: 0, end: CANVAS.width },
    { value: CANVAS.height, start: 0, end: CANVAS.width },
  ]
  elements.forEach(element => {
    if (selectedIds.includes(element.id) || element.visible === false) return
    const bounds = getElementBounds(element)
    const start = bounds.left
    const end = bounds.right
    anchors.push(
      { value: bounds.top, start, end },
      { value: bounds.top + (bounds.bottom - bounds.top) / 2, start, end },
      { value: bounds.bottom, start, end },
    )
  })
  return anchors
}

function collectVerticalAnchors(elements: SlideElement[], selectedIds: string[]): Anchor[] {
  const anchors: Anchor[] = [
    { value: 0, start: 0, end: CANVAS.height },
    { value: CANVAS.width / 2, start: 0, end: CANVAS.height },
    { value: CANVAS.width, start: 0, end: CANVAS.height },
  ]
  elements.forEach(element => {
    if (selectedIds.includes(element.id) || element.visible === false) return
    const bounds = getElementBounds(element)
    const start = bounds.top
    const end = bounds.bottom
    anchors.push(
      { value: bounds.left, start, end },
      { value: bounds.left + (bounds.right - bounds.left) / 2, start, end },
      { value: bounds.right, start, end },
    )
  })
  return anchors
}

function nearestSnap(values: number[], anchors: Anchor[], threshold: number, range: { start: number; end: number }): { value: number; offset: number } | undefined {
  let best: { value: number; offset: number } | undefined
  values.forEach(candidate => {
    anchors.forEach(anchor => {
      if (Math.min(range.end, anchor.end) <= Math.max(range.start, anchor.start)) return
      const offset = anchor.value - candidate
      if (Math.abs(offset) > threshold) return
      if (!best || Math.abs(offset) < Math.abs(best.offset)) best = { value: anchor.value, offset }
    })
  })
  return best
}
