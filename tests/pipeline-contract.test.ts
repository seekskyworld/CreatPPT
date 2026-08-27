import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  deliveryManifestSchema,
  parseContentInput,
  parseContentPlan,
  parseQualityReport,
  safeParseContentInput,
} from '@/domain/pipeline-types'
import { createStarterDeck } from '@/demo/starter'
import { safeParseDeck } from '@/domain/schema'

describe('Fast path pipeline contracts', () => {
  it('accepts the minimal layout-free Agent fixture', async () => {
    const fixture = JSON.parse(await readFile(resolve('tests/fixtures/fast-path-content.json'), 'utf8'))
    const input = parseContentInput(fixture)

    expect(input.title).toBe('环境保护行动方案')
    expect(input.sections).toHaveLength(3)
    expect(input.sections?.[1].intent).toBe('metrics')
  })

  it('rejects a content block with no semantic payload', () => {
    const result = safeParseContentInput({ title: '空输入', sections: [{ id: 'empty' }] })
    expect(result.success).toBe(false)
  })

  it('validates planned content, quality reports, and delivery manifests', () => {
    const plan = parseContentPlan({
      version: 1,
      id: 'fixture',
      title: 'Fixture',
      templateId: 'editorial',
      designContext: { language: 'zh-CN' },
      blocks: [{ id: 'b1', intent: 'metrics', order: 0, layout: 'metrics', title: '结果', stats: [
        { value: '3', label: '指标' },
      ] }],
      assets: [],
      source: { kind: 'agent' },
    })
    const report = parseQualityReport({
      ok: true,
      strict: false,
      issues: [],
      summary: { errors: 0, warnings: 0, slides: 1, assets: 0 },
      stages: [{ stage: 'plan', ok: true, elapsedMs: 1, issueCount: 0 }],
    })
    const manifest = deliveryManifestSchema.parse({
      version: 1,
      projectDir: '/tmp/delivery',
      deckPath: '/tmp/delivery/deck.json',
      assetsDir: '/tmp/delivery/assets',
      schemaVersion: 2,
      sourceKind: 'agent',
      pptxGenerated: false,
      quality: report,
    })

    expect(plan.blocks[0].layout).toBe('metrics')
    expect(report.ok).toBe(true)
    expect(manifest.pptxGenerated).toBe(false)
  })

  it('keeps the existing DeckSpec v2 contract valid', () => {
    expect(safeParseDeck(createStarterDeck('M0 compatibility', 'editorial', 3)).success).toBe(true)
  })

  it('allows new element types (table, chart, form, embed, animation, action) to flow through pipeline schema validation', () => {
    const deck = createStarterDeck('Extended Elements Pipeline', 'signal', 1)
    deck.slides[0].elements = [
      { id: 'el-table', type: 'table', x: 10, y: 10, width: 400, height: 200, table: { headers: ['H1', 'H2'], rows: [['R1C1', 100]] } },
      { id: 'el-chart', type: 'chart', x: 10, y: 220, width: 400, height: 200, chart: { type: 'pie', points: [{ label: 'A', value: 30 }] } },
      { id: 'el-form', type: 'form', x: 10, y: 430, width: 400, height: 200, form: { fields: [{ type: 'text', label: 'Email' }] } },
      { id: 'el-embed', type: 'embed', x: 420, y: 10, width: 400, height: 200, embed: { url: 'https://example.com' } },
      { id: 'el-anim', type: 'animation', x: 420, y: 220, width: 100, height: 100, animation: { trigger: 'onClick', effect: 'fade' } },
      { id: 'el-action', type: 'action', x: 420, y: 330, width: 200, height: 50, action: { type: 'url', target: 'https://example.com' } },
    ]
    deck.slides[0].animations = [{ trigger: 'onClick', effect: 'appear' }]
    deck.slides[0].actions = [{ type: 'slideJump', target: 'slide-1' }]

    const parsed = safeParseDeck(deck)
    expect(parsed.success).toBe(true)
  })
})
