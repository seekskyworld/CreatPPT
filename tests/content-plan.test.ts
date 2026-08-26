import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { contentInputFromBrief } from '@/domain/intake'
import { compileContentPlan, contentPlanFromInput, deckFromContentPlan } from '@/domain/content-plan'
import { safeParseDeck } from '@/domain/schema'

describe('semantic content planning', () => {
  it('maps the layout-free fixture to semantic layouts without authored page fields', async () => {
    const fixture = JSON.parse(await readFile(resolve('tests/fixtures/fast-path-content.json'), 'utf8'))
    const plan = contentPlanFromInput(fixture)

    expect(plan.templateId).toBe('editorial')
    expect(plan.blocks.map(block => block.layout)).toEqual(['statement', 'metrics', 'timeline'])
    expect(plan.blocks.every(block => block.layoutCandidates === undefined)).toBe(true)
  })

  it('converts Markdown sections into a valid DeckSpec without inventing a closing page', () => {
    const input = contentInputFromBrief(`---\naudience: 项目团队\ntemplate: auto\n---\n# 试点方案\n> 先验证，再扩展\n\n## 结果\n- 统一基线\n- 测量影响\n- 复盘扩展\n\n## 下一步\n明确负责人和时间节点。`)
    const plan = contentPlanFromInput(input)
    const deck = deckFromContentPlan(plan)

    expect(plan.templateId).toBe('editorial')
    expect(deck.slides[0].layout).toBe('cover')
    expect(deck.slides.at(-1)?.layout).not.toBe('closing')
    expect(deck.slides.some(slide => slide.layout === 'agenda')).toBe(true)
    expect(safeParseDeck(deck).success).toBe(true)
  })

  it('uses an explicit cover role and carries its metadata into the scene and manifest', () => {
    const plan = contentPlanFromInput({
      id: 'cover-role',
      title: 'Cover role',
      template: 'signal',
      assets: [{
        id: 'custom-cover',
        role: 'cover',
        src: 'assets/custom-cover.jpg',
        alt: '自定义封面照片',
        caption: '自定义封面',
        provenance: { kind: 'stock', source: 'https://example.test/cover', license: 'CC0' },
      }],
      sections: [{ title: '正文' }],
    })
    const deck = deckFromContentPlan(plan)
    const cover = deck.slides[0].images?.[0]
    const manifest = deck.assetManifest?.find(asset => asset.id === 'custom-cover')

    expect(cover).toMatchObject({
      src: 'assets/custom-cover.jpg',
      alt: '自定义封面照片',
      caption: '自定义封面',
      assetId: 'custom-cover',
      provenance: { source: 'https://example.test/cover', license: 'CC0' },
    })
    expect(manifest).toMatchObject({
      src: 'assets/custom-cover.jpg',
      alt: '自定义封面照片',
      provenance: { source: 'https://example.test/cover', license: 'CC0' },
    })
  })

  it('accepts blocks as a convenience alias for sections', () => {
    const plan = contentPlanFromInput({
      title: 'Alias input',
      blocks: [{ title: '对比', columns: [{ title: '现在' }, { title: '未来' }] }],
    })

    expect(plan.blocks[0].layout).toBe('comparison')
    expect(plan.source.kind).toBe('agent')
  })

  it('fills image layouts from the selected template pool without repeating automatic images', () => {
    const plan = contentPlanFromInput({
      title: 'Automatic media',
      template: 'studio',
      sections: [
        { title: 'One', intent: 'split', body: 'A' },
        { title: 'Two', intent: 'split', body: 'B' },
        { title: 'Three', intent: 'gallery', body: 'C' },
      ],
    })
    const deck = deckFromContentPlan(plan)
    const automatic = deck.slides.flatMap(slide => slide.images ?? [])
      .filter(image => image.provenance?.source === 'CreatPPT starter asset')
      .map(image => image.src)

    expect(automatic).toHaveLength(6)
    expect(new Set(automatic).size).toBe(6)
    expect(automatic.every(src => src.includes('studio') || src.includes('team-collaboration'))).toBe(true)
  })

  it('does not rewrite manually supplied duplicate images', () => {
    const plan = contentPlanFromInput({
      title: 'Manual media',
      template: 'signal',
      sections: [{
        title: 'Manual',
        intent: 'split',
        images: [
          { src: 'assets/custom.jpg', alt: 'Custom' },
          { src: 'assets/custom.jpg', alt: 'Custom again' },
        ],
      }],
    })
    const deck = deckFromContentPlan(plan)
    expect(deck.slides[1].images?.map(image => image.src)).toEqual(['assets/custom.jpg', 'assets/custom.jpg'])
  })

  it('derives eight semantic layouts from one annotated brief and preserves candidates', () => {
    const input = contentInputFromBrief(`---\ntemplate: editorial\n---\n# 语义布局验收\n\n## [metrics] 关键结果\n- 32% | 减排空间\n- 18 | 月回收\n\n## [comparison] 两种路径\n- 现状 | 手工整理\n- Fast path | 自动规划\n\n## [chart] 趋势\n- 32 | 2024\n- 45 | 2025\n\n## [timeline] 落地步骤\n- 01 | 建立基线 | 统一口径\n- 02 | 验证试点 | 测量结果\n\n## [gallery] 证据\n![工厂屋顶](assets/one.png)\n![城市能源](assets/two.png)\n\n## [quote] 一句话\n“先测量，再承诺。”\n\n## [agenda] 议程\n- 研究\n- 试点\n- 复制\n\n## [split] 现场\n现场数据说明。\n![现场](assets/three.png)`)
    const plan = contentPlanFromInput(input)
    const deck = compileContentPlan(plan, 2)
    const layouts = new Set(deck.slides.map(slide => slide.layout))

    expect(layouts).toEqual(new Set([
      'cover', 'metrics', 'comparison', 'chart', 'timeline', 'gallery', 'quote', 'agenda', 'split',
    ]))
    expect(deck.slides.every(slide => slide.layout === 'cover' || slide.layoutCandidates?.length === 2)).toBe(true)
    expect(deck.assetManifest?.some(asset => asset.src === 'assets/one.png')).toBe(true)
    expect(safeParseDeck(deck).success).toBe(true)
  })
})
