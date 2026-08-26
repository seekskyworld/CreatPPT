import type { SlideLayout } from './types'

export type CapabilitySupport = 'native' | 'semantic' | 'not-supported'
export type CompatibilityRisk = 'low' | 'medium' | 'high'

/**
 * The layout contract shared by the Web renderer and the on-demand exporter.
 * Keeping this table next to the semantic layout catalogue makes a newly added
 * page type fail review until both output paths and its compatibility notes are
 * accounted for.
 */
export interface LayoutCapability {
  layout: SlideLayout
  web: CapabilitySupport
  pptx: CapabilitySupport
  editableText: boolean
  editableMedia: boolean
  editableChart: boolean
  requiresMedia: boolean
  officeRisk: CompatibilityRisk
  notes: string
}

export const LAYOUT_CAPABILITIES: readonly LayoutCapability[] = [
  { layout: 'cover', web: 'native', pptx: 'native', editableText: true, editableMedia: true, editableChart: false, requiresMedia: true, officeRisk: 'low', notes: 'Hero image and title remain separate editable elements.' },
  { layout: 'agenda', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'low', notes: 'Numbered agenda rows are native text and line shapes.' },
  { layout: 'statement', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'low', notes: 'Statement text is exported as native text boxes.' },
  { layout: 'metrics', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'low', notes: 'Metric values and labels are independent text boxes.' },
  { layout: 'split', web: 'native', pptx: 'native', editableText: true, editableMedia: true, editableChart: false, requiresMedia: true, officeRisk: 'low', notes: 'Image and explanatory copy use separate editable elements.' },
  { layout: 'comparison', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'low', notes: 'Columns use native shapes and text; line wrapping may vary by font.' },
  { layout: 'chart', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: true, requiresMedia: false, officeRisk: 'medium', notes: 'Bar chart is an Office chart object; labels can reflow by application.' },
  { layout: 'timeline', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'medium', notes: 'Timeline uses native lines, dots, and text; font metrics affect wrapping.' },
  { layout: 'gallery', web: 'native', pptx: 'native', editableText: true, editableMedia: true, editableChart: false, requiresMedia: true, officeRisk: 'low', notes: 'Each image and caption remains a separate element.' },
  { layout: 'quote', web: 'native', pptx: 'native', editableText: true, editableMedia: true, editableChart: false, requiresMedia: true, officeRisk: 'medium', notes: 'Quote typography is native; font fallback can change line breaks.' },
  { layout: 'closing', web: 'native', pptx: 'native', editableText: true, editableMedia: false, editableChart: false, requiresMedia: false, officeRisk: 'low', notes: 'Closing title and action line remain editable text.' },
]

export function getLayoutCapability(layout: SlideLayout): LayoutCapability {
  const capability = LAYOUT_CAPABILITIES.find(candidate => candidate.layout === layout)
  if (!capability) throw new Error(`No output capability registered for layout: ${layout}`)
  return capability
}
