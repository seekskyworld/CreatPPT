import { describe, expect, it } from 'vitest'
import { getAgendaLayout } from '@/domain/agenda'
import { createStarterDeck } from '@/demo/starter'
import { refreshSlideElementBindings } from '@/domain/elements'

describe('agenda row geometry', () => {
  it('gives wrapped Chinese bullets enough height for both lines', () => {
    const items = [
      '先按工作负载选择芯片与内存，再按接口、存储和散热做决定',
      '需要长期运行的团队，应优先考虑散热空间、备份策略和统一部署',
      '不把“最高配置”当作默认答案：适合自己的配置，才是更高效的配置',
    ]
    const layout = getAgendaLayout(items, 'signal')

    expect(layout.fontSize).toBe(30)
    expect(layout.rows).toHaveLength(3)
    expect(layout.rows.every(row => row.lines >= 2)).toBe(true)
    expect(layout.rows.every(row => row.textBox.height >= 75)).toBe(true)
    expect(layout.rows.every(row => row.height >= 123)).toBe(true)
    expect(layout.rows[1].y).toBe(layout.rows[0].y + layout.rows[0].height)
    expect(layout.endY).toBe(layout.rows[2].y + layout.rows[2].height)
    expect(layout.rows[2].lineY).toBe(layout.endY - layout.rows[2].height)
  })

  it('scales dense lists while keeping each row inside the slide safe area', () => {
    const layout = getAgendaLayout(Array.from({ length: 8 }, (_, index) => `第 ${index + 1} 项：需要长期运行与稳定维护的工作内容`), 'editorial')
    expect(layout.fontSize).toBeLessThan(30)
    expect(layout.endY).toBeLessThanOrEqual(790)
    expect(layout.rows.every(row => row.textBox.height <= row.height - 20)).toBe(true)
  })

  it('refreshes generated agenda boxes after a bullet becomes two lines', () => {
    const deck = createStarterDeck('Agenda geometry refresh', 'studio', 3)
    const slide = deck.slides.find(item => item.layout === 'agenda')
    if (!slide?.elements) throw new Error('agenda elements missing')
    const item = slide.elements.find(element => element.id.endsWith(':agenda-item-0'))
    if (!item) throw new Error('agenda item missing')
    const before = item.height
    slide.bullets![0] = '一条需要在页面上完整显示两行的较长目录内容，不应再被固定高度裁切'

    expect(refreshSlideElementBindings(slide, 'studio')).toBe(true)
    expect(item.height).toBeGreaterThan(before)
    expect(item.height).toBeGreaterThanOrEqual(75)
    const firstLine = slide.elements.find(element => element.id.endsWith(':agenda-line-0'))
    const secondLine = slide.elements.find(element => element.id.endsWith(':agenda-line-1'))
    const expected = getAgendaLayout(slide.bullets, 'studio')
    expect(firstLine?.y).toBe(expected.rows[0].lineY)
    expect(secondLine?.y).toBe(expected.rows[1].lineY)
    expect(item.height).toBe(expected.rows[0].textBox.height)
  })
})
