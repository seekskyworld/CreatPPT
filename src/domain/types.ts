export const LAYOUT_IDS = [
  'cover',
  'agenda',
  'statement',
  'metrics',
  'split',
  'comparison',
  'chart',
  'timeline',
  'gallery',
  'quote',
  'closing',
] as const

export const TEMPLATE_IDS = ['signal', 'editorial', 'studio'] as const
export const DECK_VERSIONS = [1, 2] as const
export const LAYOUT_FAMILIES = [
  'hero',
  'editorial',
  'statement',
  'metrics',
  'split',
  'comparison',
  'chart',
  'timeline',
  'gallery',
  'quote',
  'closing',
] as const

export type SlideLayout = (typeof LAYOUT_IDS)[number]
export type TemplateId = (typeof TEMPLATE_IDS)[number]
export type DeckVersion = (typeof DECK_VERSIONS)[number]
export type LayoutFamily = (typeof LAYOUT_FAMILIES)[number]
export type Fidelity = 'editable' | 'high-fidelity' | 'balanced'
export type DeliveryFormat = 'web' | 'pptx' | 'pdf' | 'png'
export type AssetKind = 'user' | 'local' | 'generated' | 'remote' | 'stock'
export type Density = 'airy' | 'balanced' | 'dense'
export type AccentMode = 'default' | 'warm' | 'cool'
export type DeckSourceKind = 'agent' | 'markdown' | 'html' | 'json' | 'imported'
export type PipelineStage = 'intake' | 'plan' | 'validate' | 'materialize' | 'serve'

export interface ImageAsset {
  src: string
  alt: string
  caption?: string
  assetId?: string
  provenance?: AssetProvenance
}

export interface AssetProvenance {
  kind?: AssetKind
  source?: string
  license?: string
  attribution?: string
  checksum?: string
}

export interface AssetManifestEntry extends ImageAsset {
  id: string
  role?: string
  required?: boolean
}

export interface BrandContext {
  name?: string
  primaryColor?: string
  secondaryColor?: string
  fonts?: string[]
  logoAssetId?: string
  forbiddenPatterns?: string[]
}

export interface DesignContext {
  audience?: string
  purpose?: string
  decision?: string
  language?: string
  tone?: string
  fidelity?: Fidelity
  scope?: string
  deliveryFormats?: DeliveryFormat[]
  brand?: BrandContext
  hardConstraints?: string[]
  references?: string[]
}

export interface ContentBudget {
  title?: number
  subtitle?: number
  body?: number
  bullet?: number
  items?: number
  media?: number
}

export interface LayoutCandidate {
  id: string
  layout: SlideLayout
  family: LayoutFamily
  score: number
  rationale?: string
}

export interface TweakState {
  density: Density
  fontScale: number
  accentMode: AccentMode
}

export interface StatItem {
  value: string
  label: string
  detail?: string
}

export interface ContentColumn {
  title: string
  body?: string
  bullets?: string[]
}

export interface TimelineStep {
  label: string
  title: string
  body?: string
}

export interface ChartPoint {
  label: string
  value: number
}

export type ChartType = 'bar' | 'pie' | 'line' | 'scatter' | 'area'

export interface ChartSpec {
  unit?: string
  points: ChartPoint[]
  type?: ChartType
  chartType?: ChartType
}

export interface TableMergeCell {
  row: number
  col: number
  rowspan?: number
  colspan?: number
  rowSpan?: number
  colSpan?: number
}

export interface TableSpec {
  headers: string[]
  rows: (string | number)[][]
  formulas?: Record<string, string>
  mergeCells?: TableMergeCell[]
}

export interface FormField {
  id?: string
  name?: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | string
  label: string
  options?: string[]
  value?: any
}

export interface FormSpec {
  fields: FormField[]
  submitAction?: string | ActionSpec
}

export interface EmbedSpec {
  url: string
  sandbox?: string | boolean
  fallbackImage?: string
}

export interface AnimationSpec {
  id?: string
  targetElementId?: string
  trigger: 'onClick' | 'afterPrevious' | 'withPrevious'
  effect: 'appear' | 'fade' | 'flyIn'
  delay?: number
  duration?: number
}

export interface ActionSpec {
  type: 'slideJump' | 'url' | 'hyperlink'
  target: string | number
}

export const SLIDE_ELEMENT_TYPES = [
  'text',
  'image',
  'rect',
  'ellipse',
  'line',
  'arrow',
  'table',
  'chart',
  'form',
  'embed',
  'animation',
  'action',
] as const
export type SlideElementType = (typeof SLIDE_ELEMENT_TYPES)[number]
export type ElementTextAlign = 'left' | 'center' | 'right'

export interface ElementStyle {
  color?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textAlign?: ElementTextAlign
  lineHeight?: number
  radius?: number
  objectFit?: 'cover' | 'contain'
}

/** 画布上的最小可编辑对象，坐标统一使用 1600x900 逻辑画布。 */
export interface SlideElement {
  id: string
  type: SlideElementType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zIndex?: number
  locked?: boolean
  visible?: boolean
  userEdited?: boolean
  text?: string
  src?: string
  alt?: string
  path?: string
  style?: ElementStyle
  table?: TableSpec
  chart?: ChartSpec
  form?: FormSpec
  embed?: EmbedSpec
  animation?: AnimationSpec
  action?: ActionSpec
}

export interface AlignmentGuide {
  axis: 'x' | 'y'
  position: number
  start: number
  end: number
}

export interface SlideSpec {
  id: string
  layout: SlideLayout
  layoutFamily?: LayoutFamily
  layoutCandidates?: LayoutCandidate[]
  selectedLayoutCandidate?: string
  contentBudget?: ContentBudget
  eyebrow?: string
  title: string
  subtitle?: string
  body?: string
  bullets?: string[]
  stats?: StatItem[]
  columns?: ContentColumn[]
  steps?: TimelineStep[]
  images?: ImageAsset[]
  chart?: ChartSpec
  quote?: string
  quoteBy?: string
  footer?: string
  notes?: string
  elements?: SlideElement[]
  animations?: AnimationSpec[]
  actions?: ActionSpec[]
}

export interface DeckSpec {
  version: DeckVersion
  id: string
  title: string
  subtitle?: string
  templateId: TemplateId
  updatedAt: string
  slides: SlideSpec[]
  designContext?: DesignContext
  assetManifest?: AssetManifestEntry[]
  tweaks?: TweakState
  source?: {
    kind: DeckSourceKind
    path?: string
    importedAt?: string
  }
}

export interface TemplateTokens {
  background: string
  backgroundAlt: string
  ink: string
  muted: string
  surface: string
  line: string
  accent: string
  accentAlt: string
  highlight: string
  displayFont: string
  bodyFont: string
}

export interface TemplateDefinition {
  id: TemplateId
  name: string
  description: string
  swatches: string[]
  dark: boolean
  tokens: TemplateTokens
  fontScale?: number
}

export type SelectionKind = 'text' | 'image' | 'element'

export interface EditorSelection {
  slideId: string
  kind: SelectionKind
  path: string
  label: string
  elementId?: string
  elementIds?: string[]
}

export interface QualityIssue {
  code: string
  severity: 'warning' | 'error'
  stage?: PipelineStage
  slideId?: string
  field?: string
  line?: number
  message: string
  fix?: string
}
