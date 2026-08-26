import type { SlideLayout } from './types'

export interface LayoutDefinition {
  id: SlideLayout
  name: string
  description: string
}

export const LAYOUTS: LayoutDefinition[] = [
  { id: 'cover', name: '封面', description: '标题、摘要与主视觉' },
  { id: 'agenda', name: '目录', description: '章节或议程列表' },
  { id: 'statement', name: '核心观点', description: '一个主结论与解释' },
  { id: 'metrics', name: '关键指标', description: '突出 3-4 个数字' },
  { id: 'split', name: '图文拆分', description: '图片与正文并置' },
  { id: 'comparison', name: '对比', description: '两到三组方案对照' },
  { id: 'chart', name: '数据图表', description: '柱状数据与解读' },
  { id: 'timeline', name: '时间线', description: '阶段和里程碑' },
  { id: 'gallery', name: '图片画廊', description: '多张素材与说明' },
  { id: 'quote', name: '引语', description: '引用与人物信息' },
  { id: 'closing', name: '结尾', description: '结论与行动号召' },
]

export function getLayout(id: SlideLayout) {
  return LAYOUTS.find(layout => layout.id === id) ?? LAYOUTS[0]
}
