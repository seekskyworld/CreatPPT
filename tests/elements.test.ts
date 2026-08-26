import { describe, expect, it } from 'vitest'
import { applyTemplateImages, createStarterDeck } from '@/demo/starter'
import { clampElementGeometry, createSlideElements, rebuildSlideElements, refreshSlideElementBindings } from '@/domain/elements'
import { getElementBounds, getSelectionBounds, snapMove } from '@/domain/alignment'
import { safeParseDeck } from '@/domain/schema'

describe('freeform slide elements', () => {
  it('compiles every starter layout into positioned elements with unique ids', () => {
    const deck = createStarterDeck('Element contract', 'editorial', 11)
    for (const slide of deck.slides) {
      expect(slide.elements?.length).toBeGreaterThan(0)
      const ids = slide.elements?.map(element => element.id) ?? []
      expect(new Set(ids).size).toBe(ids.length)
      expect(slide.elements?.every(element => element.x >= 0 && element.y >= 0 && element.width > 0 && element.height > 0)).toBe(true)
    }
  })

  it('keeps drag and resize geometry inside the logical canvas', () => {
    expect(clampElementGeometry({ x: -100, y: 880, width: 2000, height: 100, rotation: 999 })).toEqual({
      x: 0,
      y: 800,
      width: 1600,
      height: 100,
      rotation: 360,
    })
  })

  it('rejects duplicate element ids and blank text elements', () => {
    const deck = createStarterDeck('Element validation', 'signal', 3)
    const slide = deck.slides[0]
    const first = slide.elements?.[0]
    if (!first) throw new Error('element fixture missing')
    slide.elements = [first, { ...first, type: 'text', text: '   ' }]
    const result = safeParseDeck(deck)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.message.includes('Duplicate element id'))).toBe(true)
      expect(result.error.issues.some(issue => issue.message.includes('cannot be empty'))).toBe(true)
    }
  })

  it('can compile a semantic slide without relying on legacy layout markup', () => {
    const deck = createStarterDeck('Compile contract', 'studio', 3)
    const slide = { ...deck.slides[2], elements: undefined }
    const elements = createSlideElements(slide, deck.templateId)
    expect(elements.some(element => element.type === 'text' && element.path === 'title')).toBe(true)
  })

  it('keeps chart units visible in the editable scene layer', () => {
    const deck = createStarterDeck('Chart unit contract', 'signal', 7)
    const slide = deck.slides.find(item => item.layout === 'chart')
    if (!slide) throw new Error('chart slide missing')
    const unit = slide.elements?.find(element => element.id.endsWith(':chart-unit'))
    expect(unit).toMatchObject({ text: slide.chart?.unit, path: 'chart.unit' })
  })

  it('keeps composition geometry distinct across the three templates', () => {
    const decks = {
      signal: createStarterDeck('Template geometry signal', 'signal', 11),
      editorial: createStarterDeck('Template geometry editorial', 'editorial', 11),
      studio: createStarterDeck('Template geometry studio', 'studio', 11),
    }
    const element = (template: keyof typeof decks, slideIndex: number, suffix: string) => {
      const found = decks[template].slides[slideIndex].elements?.find(item => item.id.endsWith(suffix))
      if (!found) throw new Error(`${template} ${suffix} missing`)
      return found
    }

    expect(element('signal', 0, ':cover-image')).toMatchObject({ x: 980, y: 0, width: 620, height: 900 })
    expect(element('editorial', 0, ':cover-image')).toMatchObject({ x: 978, y: 72, width: 560, height: 580 })
    expect(element('studio', 0, ':cover-image')).toMatchObject({ x: 0, y: 576, width: 1600, height: 324 })

    expect(element('signal', 1, ':agenda-item-0').x).toBe(922)
    expect(element('editorial', 1, ':agenda-item-0').x).toBe(882)
    expect(element('studio', 3, ':metrics-card-0').style?.fill).toBe('var(--slide-surface)')
    expect(element('studio', 5, ':comparison-shadow-0').x).toBe(100)
    expect(element('editorial', 8, ':gallery-image-1').width).toBe(553)
    expect(element('studio', 9, ':quote-image').style?.strokeWidth).toBe(18)

    const switched = createStarterDeck('Template rebuild geometry', 'signal', 11)
    const cover = switched.slides[0]
    rebuildSlideElements(cover, 'studio')
    expect(cover.elements?.find(item => item.id.endsWith(':cover-image'))).toMatchObject({ y: 576, height: 324 })
  })

  it('refreshes untouched image bindings without overwriting human edits', () => {
    const deck = createStarterDeck('Binding contract', 'editorial', 11)
    const slide = deck.slides.find(item => item.layout === 'cover')
    if (!slide?.elements) throw new Error('cover elements missing')
    const image = slide.elements.find(element => element.type === 'image')
    if (!image) throw new Error('cover image element missing')
    applyTemplateImages(deck.slides, 'signal')
    expect(refreshSlideElementBindings(slide)).toBe(true)
    expect(image.src).toBe('assets/cover-hero.jpg')
    image.userEdited = true
    slide.images = [{ src: 'assets/cover-banner.jpg', alt: 'new' }]
    expect(refreshSlideElementBindings(slide)).toBe(false)
    expect(image.src).toBe('assets/cover-hero.jpg')
  })

  it('keeps agenda index decorations separate from bullet bindings', () => {
    const deck = createStarterDeck('Agenda binding contract', 'signal', 11)
    const slide = deck.slides.find(item => item.layout === 'agenda')
    if (!slide?.elements) throw new Error('agenda elements missing')
    const index = slide.elements.find(element => element.id.endsWith(':agenda-index-0'))
    const item = slide.elements.find(element => element.id.endsWith(':agenda-item-0'))
    if (!index || !item) throw new Error('agenda binding elements missing')

    expect(index.text).toBe('01')
    expect(index.path).toBeUndefined()
    expect(item.path).toBe('bullets.0')

    slide.bullets![0] = '一条较长的目录内容不应进入窄序号框'
    expect(refreshSlideElementBindings(slide)).toBe(true)
    expect(index.text).toBe('01')
    expect(item.text).toBe('一条较长的目录内容不应进入窄序号框')
  })

  it('migrates legacy agenda index bindings and geometry on refresh', () => {
    const deck = createStarterDeck('Legacy agenda migration', 'signal', 11)
    const slide = deck.slides.find(item => item.layout === 'agenda')
    if (!slide?.elements) throw new Error('agenda elements missing')
    const index = slide.elements.find(element => element.id.endsWith(':agenda-index-0'))
    if (!index) throw new Error('agenda index missing')
    Object.assign(index, {
      x: 712,
      y: 208,
      width: 200,
      height: 72,
      userEdited: true,
      text: slide.bullets?.[0],
      path: 'bullets.0',
    })

    expect(refreshSlideElementBindings(slide)).toBe(true)
    expect(index).toMatchObject({ x: 856, y: 210, width: 54, height: 36, text: '01', userEdited: false })
    expect(index.path).toBeUndefined()
  })

  it('rebuilds template geometry while retaining edited object properties', () => {
    const deck = createStarterDeck('Template rebuild', 'signal', 3)
    const slide = deck.slides[2]
    const title = slide.elements?.find(element => element.path === 'title')
    if (!title) throw new Error('title element missing')
    title.userEdited = true
    title.x = 140
    title.text = '保留人工标题'
    rebuildSlideElements(slide, 'studio')
    const next = slide.elements?.find(element => element.path === 'title')
    expect(next?.x).toBe(140)
    expect(next?.text).toBe('保留人工标题')
    expect(slide.elements?.some(element => element.id.endsWith(':statement-callout'))).toBe(true)
  })

  it('does not duplicate edited template decorations during a rebuild', () => {
    const deck = createStarterDeck('Template decoration rebuild', 'studio', 3)
    const slide = deck.slides[2]
    const callout = slide.elements?.find(element => element.id.endsWith(':statement-callout'))
    if (!callout) throw new Error('statement callout missing')
    callout.userEdited = true
    rebuildSlideElements(slide, 'studio')
    const ids = slide.elements?.map(element => element.id) ?? []
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id.endsWith(':statement-callout'))).toHaveLength(1)
  })

  it('snaps a moving element to canvas and peer alignment anchors', () => {
    const elements = [
      { id: 'moving', type: 'rect' as const, x: 120, y: 120, width: 160, height: 80 },
      { id: 'peer', type: 'rect' as const, x: 420, y: 200, width: 160, height: 80 },
    ]
    const result = snapMove(elements, ['moving'], 136, 72)
    expect(result.dx).toBe(140)
    // The peer is four pixels away on X but does not overlap the moving
    // object's X range, so its Y guide must not cause an "across the room"
    // snap.
    expect(result.dy).toBe(72)
    expect(result.guides).toHaveLength(1)
  })

  it('computes a stable multi-selection bounds for group movement', () => {
    expect(getSelectionBounds([
      { id: 'a', type: 'rect', x: 40, y: 80, width: 100, height: 60 },
      { id: 'b', type: 'ellipse', x: 220, y: 140, width: 80, height: 120 },
    ])).toEqual({ left: 40, top: 80, width: 260, height: 180 })
  })

  it('uses rotated axis-aligned bounds for selection and snapping', () => {
    const bounds = getElementBounds({ id: 'rotated', type: 'rect', x: 100, y: 100, width: 100, height: 40, rotation: 90 })
    expect(bounds.left).toBeCloseTo(130)
    expect(bounds.top).toBeCloseTo(70)
    expect(bounds.right).toBeCloseTo(170)
    expect(bounds.bottom).toBeCloseTo(170)
    expect(getSelectionBounds([{ id: 'rotated', type: 'rect', x: 100, y: 100, width: 100, height: 40, rotation: 90 }])).toMatchObject({ width: 40, height: 100 })
  })
})
