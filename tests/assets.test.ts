import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyAssetSource, isSupportedImageSource } from '@/domain/assets'
import { createStarterDeck, STARTER_TEMPLATE_IMAGES } from '@/demo/starter'
import { inspectDeck } from '@/domain/quality'

describe('asset source classification', () => {
  it('accepts supported local and data image sources', () => {
    expect(classifyAssetSource('assets/photo.jpeg')).toMatchObject({ kind: 'local', supported: true })
    expect(classifyAssetSource('data:image/png;base64,AAAA')).toMatchObject({ kind: 'generated', supported: true })
    expect(isSupportedImageSource('assets/photo.webp')).toBe(true)
  })

  it('keeps remote extension checks separate from network availability', () => {
    expect(classifyAssetSource('https://example.com/hero.jpg')).toMatchObject({ kind: 'remote', remote: true, supported: true })
    expect(classifyAssetSource('https://example.com/hero.gif')).toMatchObject({ supported: false })
  })

  it('blocks formats the PPTX exporter cannot reliably embed', () => {
    const deck = createStarterDeck()
    deck.slides[0].images![0].src = 'assets/animated.gif'
    const issue = inspectDeck(deck).find(item => item.code === 'ASSET_FORMAT_UNSUPPORTED')
    expect(issue?.severity).toBe('error')
  })

  it('ships the bundled starter photographs as compressed JPEGs', async () => {
    const assetDir = resolve('starter/assets')
    const files = await readdir(assetDir)
    expect(files.filter(file => file.endsWith('.png'))).toEqual([])

    const sources = new Set(Object.values(STARTER_TEMPLATE_IMAGES).flatMap(template => [
      template.cover.src,
      template.split.src,
      ...template.gallery.map(image => image.src),
      template.quote.src,
    ]))
    expect(sources).toHaveLength(18)
    for (const source of sources) {
      expect(source).toMatch(/\.jpg$/)
      const bytes = await readFile(resolve(assetDir, source.slice('assets/'.length)))
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
      expect(bytes.byteLength).toBeLessThan(512 * 1024)
    }
  })
})
