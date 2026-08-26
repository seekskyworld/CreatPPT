import { describe, expect, it } from 'vitest'
import { deckFromBrief, htmlToBrief, parseBrief } from '@/domain/intake'
import { safeParseDeck } from '@/domain/schema'

describe('brief intake', () => {
  it('turns Markdown sections into a planned Web deck', () => {
    const brief = `---
audience: 产品团队
purpose: 对齐发布计划
template: editorial
delivery: web,pptx,pdf
---
# 发布计划
> 面向产品团队的季度版本节奏

## 背景
当前流程分散，需要统一入口。

## 方案
- 统一内容入口
- 自动生成版式
- 用户按需导出
`
    const parsed = parseBrief(brief)
    expect(parsed.title).toBe('发布计划')
    expect(parsed.sections).toHaveLength(2)
    const deck = deckFromBrief(brief)
    expect(deck.templateId).toBe('editorial')
    expect(deck.designContext?.audience).toBe('产品团队')
    expect(deck.source?.kind).toBe('markdown')
    expect(deck.slides.some(slide => slide.layout === 'agenda')).toBe(true)
    expect(safeParseDeck(deck).success).toBe(true)
  })

  it('converts a bounded HTML brief and preserves visible structure', () => {
    const brief = htmlToBrief('<h1>发布路线</h1><p>给团队一个清晰方向。</p><h2>阶段</h2><ul><li>研究</li><li>验证</li><li>发布</li></ul>')
    const deck = deckFromBrief(brief, { sourcePath: 'brief.html' })
    expect(deck.title).toBe('发布路线')
    expect(deck.source?.kind).toBe('html')
    expect(deck.slides.some(slide => slide.layout === 'agenda')).toBe(true)
    expect(safeParseDeck(deck).success).toBe(true)
  })

  it('turns plain text into a safe minimum deck', () => {
    const deck = deckFromBrief('第一段说明。\n第二段说明。', { title: '纯文本输入', sourcePath: 'brief.txt' })
    expect(deck.title).toBe('纯文本输入')
    expect(deck.templateId).toBe('editorial')
    expect(deck.slides.length).toBeGreaterThanOrEqual(2)
    expect(deck.source?.kind).toBe('markdown')
    expect(safeParseDeck(deck).success).toBe(true)
  })
})
