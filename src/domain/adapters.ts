import { planDeck } from './planner'
import type { DeckSpec, ImageAsset, SlideSpec, TemplateId } from './types'

interface DashiItem {
  id?: string
  label?: string
  value?: number
  displayValue?: string
  unit?: string
  detail?: string
}

interface DashiPresentation {
  title?: string
  summary?: string
  takeaway?: string
  items?: DashiItem[]
}

/**
 * Adapt the public semantic portion of a Dashi goal JSON. Layout/runtime props are
 * intentionally ignored; only content and media references cross the boundary.
 */
export function adaptDashiGoal(input: unknown, options: { templateId?: TemplateId; sourcePath?: string } = {}): DeckSpec {
  const raw = asRecord(input)
  const title = stringValue(raw.title) || 'Imported Dashi deck'
  const english = !/^zh/i.test(stringValue(raw.language) ?? inferLanguage(title))
  const templateId = options.templateId ?? 'editorial'
  const rawSlides = Array.isArray(raw.slides) ? raw.slides : []
  const slides: SlideSpec[] = rawSlides.length
    ? rawSlides.map((rawSlide, index) => adaptDashiSlide(asRecord(rawSlide), index, title, templateId, english))
    : [fallbackSlide(title, templateId)]

  const deck: DeckSpec = {
    version: 2,
    id: slugify(title) || 'dashi-import',
    title,
    subtitle: stringValue(raw.goal),
    templateId,
    updatedAt: new Date().toISOString(),
    source: { kind: 'imported', path: options.sourcePath, importedAt: new Date().toISOString() },
    designContext: {
      audience: stringValue(raw.audience),
      purpose: stringValue(raw.goal),
      language: stringValue(raw.language) ?? inferLanguage(title),
      fidelity: 'balanced',
      deliveryFormats: ['web', 'pptx'],
    },
    slides,
  }
  return planDeck(deck, { sourceKind: 'imported' })
}

export function looksLikeDashiGoal(input: unknown): boolean {
  const raw = asRecord(input)
  return Array.isArray(raw.slides) && raw.slides.some(slide => {
    const content = asRecord(asRecord(slide).content)
    return Boolean(asRecord(content.presentation).title || asRecord(content.presentation).items)
  })
}

function adaptDashiSlide(rawSlide: Record<string, unknown>, index: number, deckTitle: string, templateId: TemplateId, english: boolean): SlideSpec {
  const content = asRecord(rawSlide.content)
  const presentation = asRecord(content.presentation) as DashiPresentation
  const items = Array.isArray(presentation.items) ? presentation.items : []
  const title = stringValue(presentation.title) || `${deckTitle} · ${index + 1}`
  const summary = stringValue(presentation.summary) || stringValue(presentation.takeaway)
  const images = extractMedia(content.media, english)
  const base = {
    id: stringValue(rawSlide.id) || `imported-slide-${index + 1}`,
    eyebrow: stringValue(asRecord(content.meta).panelTitle) || `IMPORTED / ${String(index + 1).padStart(2, '0')}`,
    title,
    subtitle: summary,
    body: summary,
    images: images.length ? images : undefined,
    footer: stringValue(asRecord(content.meta).pageLabel) || `${index + 1} / ${deckTitle}`,
  }

  if (index === 0) return { ...base, layout: 'cover', subtitle: summary ?? deckTitle, images: images.length ? images : [fallbackImage(templateId, english)] }
  if (items.length >= 2 && items.every(item => typeof item.value === 'number' || item.displayValue)) {
    return {
      ...base,
      layout: 'metrics',
      stats: items.slice(0, 6).map(item => ({
        value: item.displayValue || String(item.value ?? ''),
        label: item.label || item.id || (english ? 'Metric' : '指标'),
        detail: item.detail || item.unit,
      })),
    }
  }
  if (items.length >= 3) {
    return { ...base, layout: 'agenda', bullets: items.slice(0, 8).map(item => item.detail || item.label || item.displayValue || '') }
  }
  return { ...base, layout: 'statement' }
}

function extractMedia(value: unknown, english = false): ImageAsset[] {
  const entries: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(asRecord(value).images)
      ? asRecord(value).images
      : []
  return entries.flatMap((item, index) => {
    const record = asRecord(item)
    const src = stringValue(record.src) || stringValue(record.path) || stringValue(record.url)
    if (!src) return []
    return [{
      src,
      alt: stringValue(record.alt) || (english ? `Imported asset ${index + 1}` : `导入素材 ${index + 1}`),
      caption: stringValue(record.caption),
      provenance: { kind: /^(?:https?:)?\/\//i.test(src) ? 'remote' as const : 'local' as const, source: src },
    }]
  })
}

function fallbackSlide(title: string, templateId: TemplateId): SlideSpec {
  return { id: 'imported-slide-1', layout: 'cover', title, images: [fallbackImage(templateId)] }
}

function fallbackImage(templateId: TemplateId, english = false): ImageAsset {
  const source = templateId === 'studio'
    ? 'assets/studio-wide-workspace.jpg'
    : templateId === 'editorial'
      ? 'assets/cover-banner.jpg'
      : 'assets/cover-hero.jpg'
  return { src: source, alt: english ? 'Imported presentation hero image' : '导入演示默认主视觉', provenance: { kind: 'local', source: 'CreatPPT starter asset' } }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function inferLanguage(input: string): string {
  return /[\u4e00-\u9fff]/.test(input) ? 'zh-CN' : 'en'
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
}
