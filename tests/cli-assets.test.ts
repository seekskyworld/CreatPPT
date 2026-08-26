import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createStarterDeck } from '@/demo/starter'
import { copyProjectAssets, inspectProjectAssets } from '@/cli-assets'

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

describe('materialized asset checks', () => {
  it('checks local files and returns checksums', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-assets-'))
    await mkdir(resolve(root, 'assets'))
    await writeFile(resolve(root, 'assets/hero.png'), PNG_HEADER)
    const deck = createStarterDeck('asset check', 'editorial', 3)
    deck.slides[0].images = [{ src: 'assets/hero.png', alt: 'hero', assetId: 'hero' }]
    // Keep the freeform scene consistent with the intentionally replaced
    // semantic image for this focused asset check.
    deck.slides[0].elements = []

    const result = await inspectProjectAssets(deck, root)
    expect(result.issues).toEqual([])
    expect(result.checksums.get('hero')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('reports missing and outside-project references', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-assets-'))
    const deck = createStarterDeck('asset check', 'editorial', 3)
    deck.slides[0].images = [
      { src: 'assets/missing.png', alt: 'missing', assetId: 'missing' },
      { src: '../secret.png', alt: 'outside', assetId: 'outside' },
    ]

    const result = await inspectProjectAssets(deck, root)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'ASSET_FILE_MISSING',
      'ASSET_PATH_OUTSIDE_PROJECT',
    ]))
  })

  it('treats an empty explicit directory as absent and falls back to starter assets', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-assets-'))
    const empty = resolve(root, 'empty')
    const starter = resolve(root, 'starter')
    const output = resolve(root, 'out')
    await mkdir(empty)
    await mkdir(starter)
    await writeFile(resolve(starter, 'starter.png'), PNG_HEADER)

    const result = await copyProjectAssets({
      explicitInputDir: empty,
      starterDir: starter,
      outputDir: resolve(output, 'assets'),
    })
    expect(result.usedFallback).toBe(true)
    expect(await readdir(resolve(output, 'assets'))).toEqual(['starter.png'])
  })

  it('copies only referenced files and falls back per file to starter assets', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-assets-'))
    const explicit = resolve(root, 'input-assets')
    const starter = resolve(root, 'starter')
    const output = resolve(root, 'out')
    await mkdir(explicit)
    await mkdir(starter)
    await writeFile(resolve(explicit, 'used.jpg'), Buffer.from('user'))
    await writeFile(resolve(explicit, 'unused.jpg'), Buffer.from('unused'))
    await writeFile(resolve(starter, 'fallback.jpg'), Buffer.from('starter'))

    const result = await copyProjectAssets({
      explicitInputDir: explicit,
      starterDir: starter,
      outputDir: resolve(output, 'assets'),
      includeFiles: ['assets/used.jpg', 'assets/fallback.jpg'],
    })

    expect(result.usedFallback).toBe(true)
    expect(result.copiedFiles).toEqual(['fallback.jpg', 'used.jpg'])
    expect(await readdir(resolve(output, 'assets'))).toEqual(['fallback.jpg', 'used.jpg'])
  })

  it('validates images that exist only in the freeform scene layer', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-assets-'))
    await mkdir(resolve(root, 'assets'))
    await writeFile(resolve(root, 'assets/scene.jpg'), JPEG_HEADER)
    const deck = createStarterDeck('scene asset check', 'editorial', 3)
    deck.slides[0].images = []
    deck.slides[0].elements = [{
      id: 'scene-image',
      type: 'image',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      src: 'assets/scene.jpg',
      alt: 'scene image',
    }]

    const result = await inspectProjectAssets(deck, root)
    expect(result.issues).toEqual([])
    expect(result.checksums.get('assets/scene.jpg')).toMatch(/^[a-f0-9]{64}$/)
  })
})
