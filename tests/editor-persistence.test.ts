import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '../src/demo/starter'
import { normalizeImageAssetIds, normalizeSelectedLayoutCandidates } from '../src/editor/persistence'

describe('editor persistence helpers', () => {
  it('repairs conflicting image IDs without changing sources', () => {
    const deck = createStarterDeck('Persistence test')
    const images = deck.slides[0].images ?? []
    images[0].assetId = 'shared'
    images[0].src = 'assets/a.jpg'
    deck.slides[1].images = [{ ...images[0], src: 'assets/b.jpg' }]
    normalizeImageAssetIds(deck)
    expect(deck.slides[0].images?.[0].src).toBe('assets/a.jpg')
    expect(deck.slides[1].images?.[0].src).toBe('assets/b.jpg')
    expect(deck.slides[0].images?.[0].assetId).not.toBe(deck.slides[1].images?.[0].assetId)
  })

  it('aligns a stale candidate with the active layout', () => {
    const deck = createStarterDeck('Candidate test')
    const slide = deck.slides[0]
    slide.layoutCandidates = [{ id: 'cover-candidate', layout: 'cover', family: 'hero', score: 1 }]
    slide.layout = 'cover'
    slide.selectedLayoutCandidate = 'missing'
    normalizeSelectedLayoutCandidates(deck)
    expect(slide.selectedLayoutCandidate).toBe('cover-candidate')
  })
})
