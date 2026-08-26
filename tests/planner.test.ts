import { describe, expect, it } from 'vitest'
import { applyTemplateImages, createStarterDeck, STARTER_TEMPLATE_IMAGES } from '@/demo/starter'
import { planDeck, buildLayoutCandidates } from '@/domain/planner'
import { upgradeDeck, safeParseDeck } from '@/domain/schema'

describe('DeckSpec planning metadata', () => {
  it('adds deterministic candidates, budgets, and asset provenance', () => {
    const deck = planDeck(createStarterDeck('Planning test', 'signal', 5))
    expect(deck.version).toBe(2)
    expect(deck.designContext?.deliveryFormats).toContain('pptx')
    expect(deck.slides.every(slide => (slide.layoutCandidates?.length ?? 0) === 3)).toBe(true)
    expect(deck.slides.every(slide => slide.contentBudget?.title)).toBe(true)
    expect(deck.assetManifest?.every(asset => asset.provenance?.kind)).toBe(true)
    expect(safeParseDeck(deck).success).toBe(true)
  })

  it('keeps an authored layout as the first candidate', () => {
    const slide = createStarterDeck('Candidate test', 'editorial', 3).slides[1]
    const candidates = buildLayoutCandidates(slide, 3)
    expect(candidates[0].layout).toBe(slide.layout)
    expect(new Set(candidates.map(candidate => candidate.id)).size).toBe(candidates.length)
  })

  it('falls back to three candidates for invalid counts', () => {
    const slide = createStarterDeck('Candidate count', 'signal', 3).slides[1]
    expect(buildLayoutCandidates(slide, Number.NaN)).toHaveLength(3)
  })

  it('selects the curated local image set for each template', () => {
    const signal = createStarterDeck('Signal assets', 'signal', 11)
    const editorial = createStarterDeck('Editorial assets')
    const studio = createStarterDeck('Studio assets', 'studio', 11)
    expect(signal.slides[0].images?.[0].src).toBe('assets/cover-hero.jpg')
    expect(signal.slides[4].images?.[0].src).toBe('assets/signal-server-room.jpg')
    expect(signal.slides[8].images?.map(image => image.src)).toEqual([
      'assets/signal-night-infrastructure.jpg',
      'assets/signal-hardware-macro.jpg',
      'assets/architecture.jpg',
    ])
    expect(signal.slides[9].images?.[0].src).toBe('assets/portrait.jpg')
    expect(editorial.templateId).toBe('editorial')
    expect(editorial.slides[0].images?.[0].src).toBe('assets/cover-banner.jpg')
    expect(editorial.slides[4].images?.[0].src).toBe('assets/editorial-research-desk.jpg')
    expect(editorial.slides[8].images?.map(image => image.src)).toEqual([
      'assets/editorial-still-life.jpg',
      'assets/editorial-library.jpg',
      'assets/workshop.jpg',
    ])
    expect(editorial.slides[9].images?.[0].src).toBe('assets/editorial-portrait.jpg')
    expect(studio.slides[0].images?.[0].src).toBe('assets/studio-wide-workspace.jpg')
    expect(studio.slides[4].images?.[0].src).toBe('assets/studio-prototype-hands.jpg')
    expect(studio.slides[8].images?.map(image => image.src)).toEqual([
      'assets/studio-materials-flatlay.jpg',
      'assets/studio-product-still-life.jpg',
      'assets/studio.jpg',
    ])
    expect(studio.slides[9].images?.[0].src).toBe('assets/team-collaboration.jpg')
    const allStarterImages = Object.values(STARTER_TEMPLATE_IMAGES).flatMap(template => [
      template.cover.src,
      template.split.src,
      ...template.gallery.map(image => image.src),
      template.quote.src,
    ])
    expect(allStarterImages).toHaveLength(18)
    expect(new Set(allStarterImages).size).toBe(18)
  })

  it('upgrades a v1 deck at an explicit boundary', () => {
    const deck = createStarterDeck('Upgrade test')
    deck.version = 1
    delete deck.designContext
    delete deck.source
    const upgraded = upgradeDeck(deck)
    expect(upgraded.version).toBe(2)
    expect(upgraded.source?.kind).toBe('json')
  })

  it('switches built-in imagery without replacing a user asset', () => {
    const deck = createStarterDeck('Template switch', 'editorial', 11)
    const split = deck.slides[4]
    split.images = [{ src: 'data:image/png;base64,user', alt: '用户上传的产品图', assetId: 'custom-image' }]

    applyTemplateImages(deck.slides, 'studio', true)

    expect(deck.slides[0].images?.[0].src).toBe('assets/studio-wide-workspace.jpg')
    expect(deck.slides[4].images?.[0].src).toBe('data:image/png;base64,user')
    expect(deck.slides[8].images?.map(image => image.src)).toEqual([
      'assets/studio-materials-flatlay.jpg',
      'assets/studio-product-still-life.jpg',
      'assets/studio.jpg',
    ])
    expect(deck.slides[9].images?.[0].src).toBe('assets/team-collaboration.jpg')
  })

  it('finds image-bearing starter layouts even when imported IDs differ', () => {
    const deck = createStarterDeck('Imported IDs', 'editorial', 11)
    deck.slides = deck.slides.map(slide => ({ ...slide, id: `imported-${slide.id}` }))

    applyTemplateImages(deck.slides, 'signal')

    expect(deck.slides.find(slide => slide.layout === 'cover')?.images?.[0].src).toBe('assets/cover-hero.jpg')
    expect(deck.slides.find(slide => slide.layout === 'split')?.images?.[0].src).toBe('assets/signal-server-room.jpg')
  })
})
