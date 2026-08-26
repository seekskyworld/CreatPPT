import { describe, expect, it } from 'vitest'
import { adaptDashiGoal, looksLikeDashiGoal } from '@/domain/adapters'
import { safeParseDeck } from '@/domain/schema'

describe('reference format adapters', () => {
  it('adapts Dashi semantic content without importing its runtime', () => {
    const input = {
      schemaVersion: 2,
      title: '迁移演示',
      goal: '让团队快速理解迁移收益',
      audience: '产品团队',
      slides: [
        {
          id: 's1',
          content: {
            presentation: { title: '迁移演示', summary: '一份可编辑的结果', items: [] },
            meta: { panelTitle: 'INTRO' },
          },
        },
        {
          id: 's2',
          content: {
            presentation: {
              title: '三个收益',
              summary: '更快、更稳、更容易修改',
              items: [
                { id: 'a', label: '速度', value: 90, displayValue: '90%', detail: '首轮生成' },
                { id: 'b', label: '稳定', value: 95, displayValue: '95%', detail: '结构校验' },
              ],
            },
          },
        },
      ],
    }
    expect(looksLikeDashiGoal(input)).toBe(true)
    const deck = adaptDashiGoal(input)
    expect(deck.source?.kind).toBe('imported')
    expect(deck.slides[1].layout).toBe('metrics')
    expect(deck.slides[1].stats).toHaveLength(2)
    expect(safeParseDeck(deck).success).toBe(true)
  })

  it('keeps remote media visible and marks it for export warning', () => {
    const deck = adaptDashiGoal({
      title: '媒体迁移',
      slides: [{
        content: {
          presentation: { title: '封面', items: [] },
          media: { images: [{ url: 'https://example.com/hero.jpg', alt: '远程主视觉' }] },
        },
      }],
    })
    expect(deck.slides[0].images?.[0].src).toBe('https://example.com/hero.jpg')
    expect(deck.slides[0].images?.[0].provenance?.kind).toBe('remote')
  })
})
