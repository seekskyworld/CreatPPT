/**
 * Shared presentation geometry. The Web renderer and the PPTX renderer both
 * consume these values so a template cannot silently drift between outputs.
 */
export const CANVAS = {
  width: 1600,
  height: 900,
  ratio: 16 / 9,
} as const

export const PPTX_WIDE = {
  widthIn: 13.333,
  heightIn: 7.5,
  /** Logical canvas pixels to PPTX inches used by the export mapper. */
  unitsPerInch: 120,
} as const

export { alignCenter, box, inset, type Box, type Insets } from './geometry-layout'

export function canvasToInches(value: number): number {
  return Number((value / PPTX_WIDE.unitsPerInch).toFixed(4))
}

export function inchesToCanvas(value: number): number {
  return value * PPTX_WIDE.unitsPerInch
}

export function isCanvasRatio(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && Math.abs(width / height - CANVAS.ratio) < 0.001
}
