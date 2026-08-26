import type { TemplateDefinition, TemplateId } from './types'

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'signal',
    name: 'Signal / 信号场',
    description: '高对比深色系统，适合产品发布、技术提案与战略叙事。',
    swatches: ['#111210', '#D8FF3E', '#FF6846', '#F4F1E8'],
    dark: true,
    tokens: {
      background: '#111210',
      backgroundAlt: '#1B1D19',
      ink: '#F4F1E8',
      muted: '#A9ADA3',
      surface: '#242721',
      line: '#3A3E35',
      accent: '#D8FF3E',
      accentAlt: '#FF6846',
      highlight: '#5DA9FF',
      displayFont: 'Arial',
      bodyFont: 'Arial',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial / 编辑部',
    description: '清晰的杂志式节奏，适合研究报告、复盘与观点表达。',
    swatches: ['#F8F7F2', '#151515', '#C9362B', '#2457D6'],
    dark: false,
    tokens: {
      background: '#F8F7F2',
      backgroundAlt: '#EEEDE7',
      ink: '#151515',
      muted: '#64645F',
      surface: '#FFFFFF',
      line: '#C9C8C1',
      accent: '#C9362B',
      accentAlt: '#2457D6',
      highlight: '#F1C84B',
      displayFont: 'Georgia',
      bodyFont: 'Arial',
    },
  },
  {
    id: 'studio',
    name: 'Studio / 创意工场',
    description: '明亮、开放、具有制作感，适合品牌方案与创意展示。',
    swatches: ['#EAF5FF', '#101820', '#FF5A4E', '#2E8B67'],
    dark: false,
    tokens: {
      background: '#EAF5FF',
      backgroundAlt: '#FFFFFF',
      ink: '#101820',
      muted: '#52606A',
      surface: '#FFFFFF',
      line: '#A8C2D2',
      accent: '#FF5A4E',
      accentAlt: '#2E8B67',
      highlight: '#FFD447',
      displayFont: 'Arial',
      bodyFont: 'Arial',
    },
  },
]

export function getTemplate(id: TemplateId): TemplateDefinition {
  return TEMPLATES.find(template => template.id === id) ?? TEMPLATES[0]
}
