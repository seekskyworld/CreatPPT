import { describe, expect, it } from 'vitest'
import contract from './fixtures/geometry-contract.json'
import { CANVAS, PPTX_WIDE, canvasToInches, inchesToCanvas, isCanvasRatio } from '@/domain/geometry'
import { LAYOUT_CAPABILITIES } from '@/domain/capabilities'
import { LAYOUT_IDS } from '@/domain/types'

describe('shared presentation geometry', () => {
  it('keeps the Web canvas and wide PPTX conversion aligned', () => {
    expect(CANVAS.width / CANVAS.height).toBeCloseTo(16 / 9)
    expect(canvasToInches(CANVAS.width)).toBeCloseTo(PPTX_WIDE.widthIn, 2)
    expect(canvasToInches(CANVAS.height)).toBeCloseTo(PPTX_WIDE.heightIn, 2)
    expect(isCanvasRatio(CANVAS.width, CANVAS.height)).toBe(true)
  })

  it('rejects invalid canvas dimensions', () => {
    expect(isCanvasRatio(0, 0)).toBe(false)
    expect(isCanvasRatio(4, 3)).toBe(false)
  })

  it('matches the checked-in Web/PPTX geometry fixture', () => {
    expect(CANVAS.width).toBe(contract.canvas.width)
    expect(CANVAS.height).toBe(contract.canvas.height)
    expect(PPTX_WIDE.widthIn).toBe(contract.pptx.widthIn)
    expect(PPTX_WIDE.heightIn).toBe(contract.pptx.heightIn)
    for (const anchor of contract.anchors) {
      expect(canvasToInches(anchor.canvas)).toBeCloseTo(anchor.inches, 3)
      expect(inchesToCanvas(anchor.inches)).toBeCloseTo(anchor.canvas, 1)
    }
  })

  it('registers every layout in both renderers', () => {
    expect(LAYOUT_CAPABILITIES.map(capability => capability.layout)).toEqual([...LAYOUT_IDS])
    expect(LAYOUT_CAPABILITIES.every(capability => capability.web === 'native' && capability.pptx === 'native')).toBe(true)
    expect(LAYOUT_CAPABILITIES.filter(capability => capability.requiresMedia).map(capability => capability.layout)).toEqual([
      'cover', 'split', 'gallery', 'quote',
    ])
  })
})
