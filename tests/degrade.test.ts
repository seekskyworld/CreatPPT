import { describe, expect, it } from 'vitest'
import { SLIDE_ELEMENT_TYPES, type DeckSpec, type SlideElementType } from '@/domain/types'
import { defaultDegradeStrategy } from '@/export/degrade'
import { buildPptxBlob } from '@/export/pptx'
import { buildHtmlBlob } from '@/export/html'
import { buildPdfBlob } from '@/export/pdf'
import { buildPngZipBlob } from '@/export/png'

function makeMockDeckWithElement(type: SlideElementType): DeckSpec {
  return {
    version: 2,
    id: `test-degrade-${type}`,
    title: `Degrade Test ${type}`,
    templateId: 'signal',
    updatedAt: new Date().toISOString(),
    slides: [{
      id: `slide-1`,
      layout: 'statement',
      title: `Slide ${type}`,
      elements: [{
        id: `elem-${type}`,
        type,
        x: 100,
        y: 100,
        width: 400,
        height: 200,
        text: type === 'text' ? 'Sample text' : undefined,
        src: type === 'image' ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : undefined,
        table: type === 'table' ? { headers: ['Col 1', 'Col 2'], rows: [['A', 10], ['B', 20]] } : undefined,
        chart: type === 'chart' ? { unit: '%', type: 'pie', points: [{ label: 'P1', value: 50 }, { label: 'P2', value: 50 }] } : undefined,
        form: type === 'form' ? { fields: [{ type: 'text', label: 'Name' }] } : undefined,
        embed: type === 'embed' ? { url: 'https://example.com' } : undefined,
        animation: type === 'animation' ? { trigger: 'onClick', effect: 'fade' } : undefined,
        action: type === 'action' ? { type: 'url', target: 'https://example.com' } : undefined,
      }],
    }],
  }
}

describe('Degrade Strategy Matrix', () => {
  it('defines a degrade handler for every slide element type', () => {
    SLIDE_ELEMENT_TYPES.forEach(type => {
      expect(defaultDegradeStrategy[type]).toBeDefined()
      expect(typeof defaultDegradeStrategy[type]).toBe('function')
    })
  })

  SLIDE_ELEMENT_TYPES.forEach(type => {
    it(`degrades element type '${type}' across all exporters (pptx, html, pdf, png)`, async () => {
      const deck = makeMockDeckWithElement(type)

      // PPTX export
      const pptxBlob = await buildPptxBlob(deck)
      expect(pptxBlob).toBeInstanceOf(Blob)
      expect(pptxBlob.size).toBeGreaterThan(0)

      // HTML export
      const htmlBlob = await buildHtmlBlob(deck)
      expect(htmlBlob).toBeInstanceOf(Blob)
      const htmlText = await htmlBlob.text()
      expect(htmlText).toContain('<!DOCTYPE html>')
      expect(htmlText).toContain(type)

      // PDF export
      const pdfBlob = await buildPdfBlob(deck)
      expect(pdfBlob).toBeInstanceOf(Blob)
      expect(pdfBlob.size).toBeGreaterThan(0)

      // PNG Zip export
      const pngZipBlob = await buildPngZipBlob(deck)
      expect(pngZipBlob).toBeInstanceOf(Blob)
      expect(pngZipBlob.size).toBeGreaterThan(0)
    })
  })
})
