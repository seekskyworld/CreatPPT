import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { inspectDeck } from '@/domain/quality'

describe('quality inspection', () => {
  it('keeps the demo deck free of blocking issues', () => {
    const issues = inspectDeck(createStarterDeck())
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([])
  })

  it('reports missing required visual assets and dense copy', () => {
    const deck = createStarterDeck()
    deck.slides[0].images = []
    deck.slides[0].title = '很长'.repeat(50)
    const issues = inspectDeck(deck)
    expect(issues.map(issue => issue.code)).toContain('IMAGE_MISSING')
    expect(issues.map(issue => issue.code)).toContain('TEXT_DENSE')
  })

  it('warns about unstable remote media and missing manifest provenance', () => {
    const deck = createStarterDeck()
    const image = deck.slides[0].images?.[0]
    if (!image) throw new Error('starter image missing')
    image.src = 'https://example.com/hero.jpg'
    image.assetId = 'remote-hero'
    deck.assetManifest = [{
      id: 'unused',
      src: 'assets/unused.jpg',
      alt: 'unused',
      required: true,
      provenance: { kind: 'local', source: 'fixture' },
    }]
    const codes = inspectDeck(deck).map(issue => issue.code)
    expect(codes).toContain('REMOTE_ASSET_UNSTABLE')
    expect(codes).toContain('ASSET_MANIFEST_ENTRY_MISSING')
    expect(codes).toContain('ASSET_MANIFEST_UNUSED')
  })

  it('blocks browser-only blob URLs from delivery', () => {
    const deck = createStarterDeck()
    deck.slides[0].images![0].src = 'blob:https://example.test/session-image'
    expect(inspectDeck(deck).some(issue => issue.code === 'EPHEMERAL_ASSET_URL' && issue.severity === 'error')).toBe(true)
  })
})
