import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { inspectShowcase } from '@/domain/showcase'

describe('internal showcase gate', () => {
  it('accepts the planned starter deck', () => {
    const report = inspectShowcase(createStarterDeck('Showcase test'))
    expect(report.ok).toBe(true)
    expect(report.checkedSlideIds).toHaveLength(2)
  })

  it('reports a missing cover without creating a user approval gate', () => {
    const deck = createStarterDeck('Showcase failure')
    deck.slides[0].layout = 'statement'
    const report = inspectShowcase(deck)
    expect(report.issues.map(issue => issue.code)).toContain('SHOWCASE_COVER_LAYOUT')
    expect(report.ok).toBe(true)
  })
})
