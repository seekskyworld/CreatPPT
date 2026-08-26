import {
  LAYOUT_IDS,
  type DeckSpec,
  type LayoutCandidate,
  type LayoutFamily,
  type SlideLayout,
  type SlideSpec,
  type DeckSourceKind,
} from './types'

const FAMILY_BY_LAYOUT: Record<SlideLayout, LayoutFamily> = {
  cover: 'hero',
  agenda: 'editorial',
  statement: 'statement',
  metrics: 'metrics',
  split: 'split',
  comparison: 'comparison',
  chart: 'chart',
  timeline: 'timeline',
  gallery: 'gallery',
  quote: 'quote',
  closing: 'closing',
}

const DEFAULT_BUDGET = {
  title: 72,
  subtitle: 110,
  body: 320,
  bullet: 80,
  items: 6,
  media: 3,
}

export interface PlanOptions {
  candidateCount?: number
  sourceKind?: DeckSourceKind
}

/**
 * Add deterministic planning metadata while preserving the existing semantic content.
 * This is deliberately model-free: an Agent can author the story, while the runtime
 * keeps layout selection and migration behavior reproducible.
 */
export function planDeck(input: DeckSpec, options: PlanOptions = {}): DeckSpec {
  const candidateCount = normalizeCandidateCount(options.candidateCount)
  const deck = structuredClone(input)
  deck.version = 2
  if (options.sourceKind) {
    deck.source = { ...(deck.source ?? {}), kind: options.sourceKind }
  }
  else deck.source = deck.source ?? { kind: 'agent' }
  deck.designContext = deck.designContext ?? {
    language: inferLanguage(deck),
    fidelity: 'balanced',
    deliveryFormats: ['web', 'pptx'],
  }
  deck.tweaks = deck.tweaks ?? {
    density: 'balanced',
    fontScale: 1,
    accentMode: 'default',
  }

  const assets = new Map<string, NonNullable<DeckSpec['assetManifest']>[number]>()
  deck.assetManifest?.forEach(asset => assets.set(asset.id, asset))

  deck.slides = deck.slides.map(slide => {
    const planned = planSlide(slide, candidateCount)
    planned.images?.forEach((image, index) => {
      const id = image.assetId ?? `${slide.id}-image-${index + 1}`
      image.assetId = id
      if (!assets.has(id)) {
        assets.set(id, {
          id,
          src: image.src,
          alt: image.alt,
          caption: image.caption,
          role: inferAssetRole(slide.layout),
          required: true,
          provenance: image.provenance ?? {
            kind: inferAssetKind(image.src),
            source: image.src,
          },
        })
      }
    })
    return planned
  })

  deck.assetManifest = [...assets.values()]
  return deck
}

export function planSlide(input: SlideSpec, candidateCount = 3): SlideSpec {
  const candidates = buildLayoutCandidates(input, candidateCount)
  const selected = candidates[0]
  return {
    ...input,
    layoutFamily: FAMILY_BY_LAYOUT[input.layout],
    layoutCandidates: candidates,
    selectedLayoutCandidate: selected?.id,
    contentBudget: input.contentBudget ?? {
      ...DEFAULT_BUDGET,
      items: itemCount(input),
      media: input.images?.length ?? 0,
    },
  }
}

export function buildLayoutCandidates(slide: SlideSpec, candidateCount = 3): LayoutCandidate[] {
  const scored = LAYOUT_IDS.map(layout => ({
    layout,
    family: FAMILY_BY_LAYOUT[layout],
    score: scoreLayout(slide, layout),
  }))
    .sort((left, right) => right.score - left.score || left.layout.localeCompare(right.layout))

  // Keep the authored layout as the first option. An Agent may have chosen it
  // intentionally, and changing it silently would make migration imports surprising.
  const authored = scored.find(candidate => candidate.layout === slide.layout)
  const rest = scored.filter(candidate => candidate.layout !== slide.layout)
  const selected = authored ? [authored, ...rest] : scored

  return selected.slice(0, normalizeCandidateCount(candidateCount)).map((candidate, index) => ({
    id: `${slide.id}:layout-${index + 1}`,
    layout: candidate.layout,
    family: candidate.family,
    score: candidate.score,
    rationale: rationaleFor(candidate.layout, slide),
  }))
}

function normalizeCandidateCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(3, Math.max(1, Math.trunc(value as number)))
}

export function layoutFamily(layout: SlideLayout): LayoutFamily {
  return FAMILY_BY_LAYOUT[layout]
}

function scoreLayout(slide: SlideSpec, layout: SlideLayout): number {
  let score = layout === slide.layout ? 12 : 0
  const imageCount = slide.images?.length ?? 0
  const bulletCount = slide.bullets?.length ?? 0
  const statCount = slide.stats?.length ?? 0
  const columnCount = slide.columns?.length ?? 0
  const stepCount = slide.steps?.length ?? 0
  const chartCount = slide.chart?.points.length ?? 0

  if (layout === 'cover') score += imageCount ? 5 : -2
  if (layout === 'split') score += imageCount ? 7 : -4
  if (layout === 'gallery') score += imageCount >= 2 ? 8 : -5
  if (layout === 'quote') score += slide.quote ? 8 : -4
  if (layout === 'metrics') score += statCount ? 8 + Math.min(4, statCount) : -4
  if (layout === 'comparison') score += columnCount ? 7 + Math.min(3, columnCount) : -3
  if (layout === 'timeline') score += stepCount ? 7 + Math.min(3, stepCount) : -3
  if (layout === 'chart') score += chartCount ? 9 : -5
  if (layout === 'agenda') score += bulletCount >= 3 ? 5 : 0
  if (layout === 'statement') score += slide.title && !bulletCount && !statCount ? 5 : 1
  if (layout === 'closing') score += slide.layout === 'closing' ? 4 : 0

  return score
}

function rationaleFor(layout: SlideLayout, slide: SlideSpec): string {
  if (layout === slide.layout) return 'Keep the authored page intent.'
  if (layout === 'chart' && slide.chart) return 'Structured data works best as a chart.'
  if (layout === 'metrics' && slide.stats?.length) return 'The metric count suits a focused number layout.'
  if (layout === 'split' && slide.images?.length) return 'Image and explanation create a left-right narrative.'
  if (layout === 'gallery' && (slide.images?.length ?? 0) >= 2) return 'Multiple real assets work as an evidence gallery.'
  if (layout === 'timeline' && slide.steps?.length) return 'Stage data fits a directional timeline.'
  return 'Compare this fallback composition in the workspace.'
}

function inferLanguage(deck: DeckSpec): string {
  const text = [deck.title, deck.subtitle, ...deck.slides.map(slide => `${slide.title} ${slide.body ?? ''}`)].join('')
  return /[\u4e00-\u9fff]/.test(text) ? 'zh-CN' : 'en'
}

function itemCount(slide: SlideSpec): number {
  return Math.max(
    slide.bullets?.length ?? 0,
    slide.stats?.length ?? 0,
    slide.columns?.length ?? 0,
    slide.steps?.length ?? 0,
    slide.chart?.points.length ?? 0,
    slide.images?.length ?? 0,
    1,
  )
}

function inferAssetRole(layout: SlideLayout): string {
  if (layout === 'cover') return 'hero'
  if (layout === 'quote') return 'portrait'
  if (layout === 'gallery') return 'evidence'
  return 'supporting'
}

function inferAssetKind(source: string): 'local' | 'remote' | 'generated' | 'user' {
  if (/^(?:https?:)?\/\//i.test(source)) return 'remote'
  if (/^(?:data:|blob:)/i.test(source)) return 'generated'
  if (source.startsWith('assets/')) return 'local'
  return 'user'
}
