import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { buildPptxBlob, inspectPptxBlob } from '@/export/pptx'

const ONE_PIXEL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99,
  0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('on-demand PPTX export', () => {
  it('builds a structurally complete editable deck after invocation', async () => {
    const deck = createStarterDeck('Export contract', 'editorial', 3)
    deck.slides = deck.slides.map(slide => ({ ...slide, layout: 'statement', images: undefined }))
    const blob = await buildPptxBlob(deck)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('[Content_Types].xml')).toBeTruthy()
    expect(zip.file('ppt/presentation.xml')).toBeTruthy()
    expect(Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))).toHaveLength(3)
    const report = await inspectPptxBlob(blob, 3)
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
    expect(report.nativeElements.textShapes).toBeGreaterThan(0)
  }, 20_000)

  it('reports a page-count mismatch without throwing', async () => {
    const deck = createStarterDeck('Mismatch', 'signal', 3)
    deck.slides = deck.slides.map(slide => ({ ...slide, layout: 'statement', images: undefined }))
    const blob = await buildPptxBlob(deck)
    const report = await inspectPptxBlob(blob, 4)
    expect(report.ok).toBe(false)
    expect(report.issues.map(issue => issue.code)).toContain('PPTX_SLIDE_COUNT')
  }, 20_000)

  it('detects a dangling package relationship', async () => {
    const deck = createStarterDeck('Relationship contract', 'signal', 3)
    deck.slides = deck.slides.map(slide => ({ ...slide, layout: 'statement', images: undefined }))
    const blob = await buildPptxBlob(deck)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    zip.remove('ppt/theme/theme1.xml')
    const broken = await zip.generateAsync({ type: 'blob' })
    const report = await inspectPptxBlob(broken, 3)
    expect(report.ok).toBe(false)
    expect(report.issues.map(issue => issue.code)).toContain('PPTX_RELATIONSHIP_DANGLING')
  }, 20_000)

  it('keeps native text, media, and chart parts for the full layout catalogue', async () => {
    const deck = createStarterDeck('Native element contract', 'editorial', 11)
    const image = { src: 'data:image/png;base64,fixture', alt: 'fixture image' }
    deck.slides = deck.slides.map(slide => ({
      ...slide,
      images: slide.images?.map(current => ({ ...current, ...image })),
    }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(ONE_PIXEL_PNG, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })))
    const blob = await buildPptxBlob(deck)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const files = Object.keys(zip.files).filter(path => !zip.files[path].dir)
    const slideXml = await Promise.all(files
      .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .map(path => zip.file(path)?.async('text') ?? Promise.resolve('')))
    const joinedSlides = slideXml.join('\n')

    expect(joinedSlides).toMatch(/<p:sp\b/)
    expect(joinedSlides).toMatch(/<p:txBody\b/)
    expect(joinedSlides).toMatch(/<p:pic\b/)
    expect(files.some(path => /^ppt\/media\//.test(path))).toBe(true)
    expect(files.some(path => /^ppt\/charts\/chart\d+\.xml$/.test(path))).toBe(true)
    const report = await inspectPptxBlob(blob, 11)
    expect(report.nativeElements.pictures).toBeGreaterThan(0)
    expect(report.nativeElements.charts).toBeGreaterThan(0)
    expect(report.nativeElements.mediaFiles).toBeGreaterThan(0)
  }, 20_000)

  it('exports edited scene elements as native PPTX objects', async () => {
    const deck = createStarterDeck('Edited scene contract', 'signal', 3)
    deck.slides = deck.slides.slice(0, 1).map(slide => ({
      ...slide,
      images: undefined,
      elements: [
        { id: `${slide.id}:custom-text`, type: 'text' as const, x: 120, y: 140, width: 520, height: 100, text: '可编辑文本', style: { fontSize: 32, color: 'var(--slide-ink)' } },
        { id: `${slide.id}:custom-rect`, type: 'rect' as const, x: 120, y: 300, width: 260, height: 180, style: { fill: 'var(--slide-accent)', stroke: 'var(--slide-line)', strokeWidth: 2 } },
        { id: `${slide.id}:custom-image`, type: 'image' as const, x: 480, y: 300, width: 260, height: 180, src: 'data:image/png;base64,fixture', alt: 'fixture' },
      ],
    }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(ONE_PIXEL_PNG, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })))
    const blob = await buildPptxBlob(deck)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text')
    expect(slideXml).toMatch(/<p:sp\b/)
    expect(slideXml).toMatch(/<p:pic\b/)
    expect((await inspectPptxBlob(blob, 1)).ok).toBe(true)
  }, 20_000)

  it('injects <p:timing> nodes when animations are present in the deck', async () => {
    const deck = createStarterDeck('Animation PPTX contract', 'signal', 1)
    deck.slides = deck.slides.slice(0, 1).map(slide => ({ ...slide, layout: 'statement', images: undefined }))
    deck.slides[0].animations = [{ trigger: 'onClick', effect: 'fade' }]
    const blob = await buildPptxBlob(deck)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text')
    expect(slideXml).toContain('<p:timing>')
    expect(slideXml).toContain('</p:timing>')
    const report = await inspectPptxBlob(blob, 1)
    expect(report.ok).toBe(true)
  }, 20_000)
})
