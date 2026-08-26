import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { safeParseDeck } from '@/domain/schema'

describe('DeckSpec', () => {
  it('accepts the official starter deck', () => {
    const result = safeParseDeck(createStarterDeck('Schema test', 'editorial', 11))
    expect(result.success).toBe(true)
  })

  it('rejects duplicate slide ids', () => {
    const deck = createStarterDeck('Duplicate test', 'signal', 3)
    deck.slides[1].id = deck.slides[0].id
    const result = safeParseDeck(deck)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('Duplicate slide id'))).toBe(true)
  })

  it('enforces layout-specific data', () => {
    const deck = createStarterDeck('Layout test', 'studio', 4)
    deck.slides[3].layout = 'metrics'
    delete deck.slides[3].stats
    const result = safeParseDeck(deck)
    expect(result.success).toBe(false)
  })

  it('keeps the selected candidate aligned with the rendered layout', () => {
    const deck = createStarterDeck('Candidate consistency', 'signal', 3)
    const slide = deck.slides[1]
    const candidate = slide.layoutCandidates?.find(item => item.layout !== slide.layout)
    if (!candidate) throw new Error('candidate fixture missing')
    slide.selectedLayoutCandidate = candidate.id
    const result = safeParseDeck(deck)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('must match'))).toBe(true)
  })
})
