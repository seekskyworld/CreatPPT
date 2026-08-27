import { describe, expect, it } from 'vitest'
import { alignCenter, box, inset } from '../src/domain/geometry-layout'

describe('layout geometry helpers', () => {
  it('composes boxes without changing coordinate units', () => {
    const frame = box(100, 80, 600, 400)
    expect(inset(frame, { top: 20, left: 30, right: 10 })).toEqual({ x: 130, y: 100, width: 560, height: 380 })
    expect(alignCenter(frame, 200, 100)).toEqual({ x: 300, y: 230, width: 200, height: 100 })
  })
})
