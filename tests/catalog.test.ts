import { describe, expect, it } from 'vitest'
import { LAYOUTS } from '@/domain/layouts'
import { TEMPLATES } from '@/domain/templates'

describe('template and layout catalogs', () => {
  it('ships three composition-ready templates', () => {
    expect(TEMPLATES.map(template => template.id)).toEqual(['signal', 'editorial', 'studio'])
    expect(TEMPLATES.every(template => template.swatches.length >= 4)).toBe(true)
  })

  it('covers the complete first-party layout set', () => {
    expect(LAYOUTS).toHaveLength(11)
    expect(LAYOUTS.map(layout => layout.id)).toEqual(expect.arrayContaining([
      'cover', 'agenda', 'statement', 'metrics', 'split', 'comparison', 'chart', 'timeline', 'gallery', 'quote', 'closing',
    ]))
  })
})
