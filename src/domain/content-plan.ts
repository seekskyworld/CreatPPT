import {
  parseContentInput,
  type ContentBlock,
  type ContentInput,
  type ContentPlan,
} from './pipeline-types'
import { planDeck } from './planner'
import { starterImagePool } from './template-assets'
import type {
  AssetManifestEntry,
  DeckSpec,
  ImageAsset,
  SlideLayout,
  SlideSpec,
  TemplateId,
} from './types'

export interface ContentPlanOptions {
  templateId?: TemplateId | 'auto'
  sourceKind?: ContentPlan['source']['kind']
  sourcePath?: string
  fallbackTitle?: string
}

/** Normalize JSON or Agent-authored input into the stable internal plan shape. */
export function contentPlanFromInput(raw: unknown, options: ContentPlanOptions = {}): ContentPlan {
  const input = normalizeContentInput(raw, options)
  const templateId = chooseTemplate(options.templateId ?? input.template)
  const rawBlocks = input.sections?.length
    ? input.sections
    : [{ title: input.title, subtitle: input.subtitle, body: input.purpose }]
  const blocks = rawBlocks.map((block, index) => normalizeBlock(block, index))
  const sourceKind = options.sourceKind ?? input.source?.kind ?? 'agent'

  return {
    version: 1,
    id: input.id ?? (slugify(input.title) || 'creatppt-content'),
    title: input.title,
    subtitle: input.subtitle,
    templateId,
    designContext: {
      audience: input.audience,
      purpose: input.purpose,
      decision: input.decision,
      language: input.language ?? inferLanguage(input.title),
      tone: input.tone,
      deliveryFormats: input.deliveryFormats ?? ['web', 'pptx'],
    },
    blocks,
    assets: dedupeAssets([
      ...(input.assets ?? []),
      ...blocks.flatMap(block => block.images ?? []),
    ]),
    source: {
      kind: sourceKind,
      path: options.sourcePath ?? input.source?.path,
    },
  }
}

function detectTablePattern(text?: string): { headers: string[]; rows: (string | number)[][] } | null {
  if (!text) return null
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const firstLine = lines[0]
  if (firstLine.includes('|')) {
    const headers = firstLine.split('|').map(s => s.trim()).filter(Boolean)
    if (headers.length >= 2) {
      const rows = lines.slice(1)
        .filter(line => !/^[:|-]+$/.test(line.replace(/\s+/g, '')))
        .map(line => line.split('|').map(s => s.trim()).filter(Boolean))
        .filter(r => r.length > 0)
      if (rows.length >= 1) {
        return {
          headers,
          rows: rows.map(r => r.map(cell => {
            const num = Number(cell)
            return !isNaN(num) && cell !== '' ? num : cell
          })),
        }
      }
    }
  }
  return null
}

/** Convert a semantic plan into a DeckSpec while keeping layout decisions explicit. */
export function deckFromContentPlan(plan: ContentPlan): DeckSpec {
  const english = !/^zh/i.test(plan.designContext.language ?? '')
  const canonicalBySource = new Map(plan.assets.map(asset => [asset.src, asset.id]))
  const fallbackHero = fallbackImage(plan.templateId, true, `${plan.id}-cover-hero`, english)
  const starterPool = starterImagePool(plan.templateId)
  const usedAutomaticSources = new Set<string>()
  const heroAsset = findRoleAsset(plan.assets, 'cover') ?? plan.assets.find(asset => asset.src === fallbackHero.src)
  const heroImage = heroAsset ? mergePlanAsset(fallbackHero, heroAsset) : fallbackHero
  if (!heroAsset) usedAutomaticSources.add(heroImage.src)

  const slides: SlideSpec[] = [{
    id: `${plan.id}-cover`,
    layout: 'cover',
    eyebrow: 'CREATPPT / FAST PATH',
    title: plan.title,
    subtitle: plan.subtitle ?? plan.designContext.purpose,
    images: [heroImage],
    footer: 'CreatPPT / Web-first',
  }]

  plan.blocks.slice(0, 58).forEach((block, index) => {
    const images = block.images?.map((image, imageIndex) => normalizeImage(
      image,
      `${block.title ?? plan.title} ${english ? 'image' : '配图'}`,
      canonicalBySource.get(image.src) ?? `${plan.id}-${block.id}-image-${imageIndex + 1}`,
    ))
    const base: SlideSpec = {
      id: `${plan.id}-${block.id}`,
      layout: block.layout,
      eyebrow: `SECTION ${String(index + 1).padStart(2, '0')}`,
      title: block.title ?? `${plan.title} · ${index + 1}`,
      subtitle: block.subtitle,
      body: block.body,
      bullets: block.bullets,
      stats: block.stats,
      columns: block.columns,
      steps: block.steps,
      chart: block.chart,
      quote: block.quote,
      quoteBy: block.quoteBy,
      images: images?.length ? images : undefined,
      footer: `${String(index + 1).padStart(2, '0')} / ${plan.title}`,
    }
    if (['split', 'gallery'].includes(base.layout) && !base.images?.length) {
      const count = base.layout === 'gallery' ? 3 : 1
      const automaticImages = takeAutomaticImages(starterPool, usedAutomaticSources, count, `${block.title ?? plan.title} ${english ? 'image' : '配图'}`)
      if (automaticImages.length) base.images = automaticImages
    }

    // Data-aware pattern detection: detect table data in block body
    const tablePattern = detectTablePattern(block.body)
    if (tablePattern) {
      base.elements ||= []
      base.elements.push({
        id: `${base.id}-table-1`,
        type: 'table',
        x: 100,
        y: 250,
        width: 1400,
        height: 450,
        table: tablePattern,
        userEdited: false,
      })
    }

    slides.push(base)
  })

  const decision = plan.designContext.decision?.trim()
  if (decision) {
    slides.push({
      id: `${plan.id}-closing`,
      layout: 'closing',
      eyebrow: 'NEXT',
      title: plan.title,
      body: decision,
      footer: `${plan.title} / Closing`,
    })
  }

  const materializedSlides = slides.map(slide => ({
    ...slide,
    images: slide.images?.map((image, index) => ({
      ...image,
      assetId: canonicalBySource.get(image.src) ?? image.assetId ?? `${slide.id}-image-${index + 1}`,
    })),
  }))

  return {
    version: 2,
    id: plan.id,
    title: plan.title,
    subtitle: plan.subtitle,
    templateId: plan.templateId,
    updatedAt: new Date().toISOString(),
    source: { kind: plan.source.kind, path: plan.source.path, importedAt: new Date().toISOString() },
    designContext: plan.designContext,
    slides: materializedSlides,
    assetManifest: buildAssetManifest(plan.assets, materializedSlides),
  }
}

function takeAutomaticImages(
  pool: ImageAsset[],
  usedSources: Set<string>,
  count: number,
  fallbackAlt: string,
): ImageAsset[] {
  const selected: ImageAsset[] = []
  for (const image of pool) {
    if (selected.length >= count || usedSources.has(image.src)) continue
    usedSources.add(image.src)
    selected.push({
      ...image,
      alt: image.alt || fallbackAlt,
      provenance: image.provenance ?? { kind: 'local', source: 'CreatPPT starter asset' },
    })
  }
  return selected
}

/** Compile the internal plan into the persisted DeckSpec and deterministic candidates. */
export function compileContentPlan(plan: ContentPlan, candidateCount = 3): DeckSpec {
  return planDeck(deckFromContentPlan(plan), {
    candidateCount,
    sourceKind: plan.source.kind,
  })
}

function normalizeContentInput(raw: unknown, options: ContentPlanOptions): ContentInput {
  const value: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : { title: options.fallbackTitle ?? 'Untitled presentation' }
  const sections = value.sections ?? value.blocks
  if (!value.sections && Array.isArray(sections)) value.sections = sections
  if (!value.title && options.fallbackTitle) value.title = options.fallbackTitle
  return parseContentInput(value)
}

function normalizeBlock(input: ContentBlock, index: number): ContentPlan['blocks'][number] {
  const inferred = inferLayout(input)
  const intent = input.intent && input.intent !== 'section' ? input.intent : inferred
  return {
    ...input,
    id: input.id ?? `${slugify(input.title ?? 'section') || 'section'}-${index + 1}`,
    intent,
    order: index,
    layout: intent,
  }
}

function inferLayout(block: ContentBlock): Exclude<SlideLayout, 'cover' | 'closing'> {
  if (block.chart) return 'chart'
  if (block.stats?.length) return 'metrics'
  if (block.steps?.length) return 'timeline'
  if (block.columns?.length) return 'comparison'
  if (block.quote) return 'quote'
  if ((block.images?.length ?? 0) >= 2) return 'gallery'
  if (block.images?.length) return 'split'
  if ((block.bullets?.length ?? 0) >= 3) return 'agenda'
  return 'statement'
}

function chooseTemplate(value?: TemplateId | 'auto'): TemplateId {
  if (value === 'signal' || value === 'studio') return value
  return 'editorial'
}

function normalizeImage(
  image: NonNullable<ContentBlock['images']>[number],
  fallbackAlt: string,
  fallbackId: string,
): ImageAsset {
  return {
    src: image.src,
    alt: image.alt ?? fallbackAlt,
    caption: image.caption,
    assetId: image.id ?? fallbackId,
    provenance: image.provenance,
  }
}

function findRoleAsset(assets: ContentPlan['assets'], role: string) {
  return assets.find(asset => asset.role?.trim().toLowerCase() === role)
}

function mergePlanAsset(fallback: ImageAsset, asset: ContentPlan['assets'][number]): ImageAsset {
  return {
    ...fallback,
    src: asset.src,
    alt: asset.alt ?? fallback.alt,
    caption: asset.caption ?? fallback.caption,
    assetId: asset.id ?? fallback.assetId,
    provenance: asset.provenance ?? fallback.provenance,
  }
}

function dedupeAssets(assets: NonNullable<ContentInput['assets']>): ContentPlan['assets'] {
  const seen = new Set<string>()
  return assets.flatMap((asset, index) => {
    const key = asset.src
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...asset, id: asset.id ?? `asset-${index + 1}` }]
  })
}

function fallbackImage(templateId: TemplateId, hero: boolean, assetId: string, english = false): ImageAsset {
  const src = templateId === 'studio'
    ? (hero ? 'assets/studio-wide-workspace.jpg' : 'assets/studio-prototype-hands.jpg')
    : templateId === 'editorial'
      ? (hero ? 'assets/cover-banner.jpg' : 'assets/editorial-research-desk.jpg')
      : (hero ? 'assets/cover-hero.jpg' : 'assets/signal-server-room.jpg')
  const alt = templateId === 'studio'
    ? (english ? (hero ? 'Wide creative studio and collaboration space' : 'Hands building a product prototype') : (hero ? '开放创意工作室与协作空间' : '产品原型制作过程'))
    : templateId === 'editorial'
      ? (english ? (hero ? 'Editorial workspace and inspiration wall' : 'Research desk with editorial materials') : (hero ? '编辑工作台与灵感墙' : '研究桌面与编辑素材'))
      : (english ? (hero ? 'Circuit board and chip under directional light' : 'Data center and server racks') : (hero ? '深色灯光下的电路板与芯片' : '数据中心与服务器机架'))
  return { src, alt, assetId, provenance: { kind: 'local', source: 'CreatPPT starter asset' } }
}

function buildAssetManifest(
  planAssets: ContentPlan['assets'],
  slides: SlideSpec[],
): AssetManifestEntry[] {
  const referenced = new Set(slides.flatMap(slide => slide.images?.map(image => image.assetId).filter(Boolean) ?? []))
  const entries = new Map<string, AssetManifestEntry>()
  const sourceIds = new Map<string, string>()
  const add = (asset: { id?: string; assetId?: string; src: string; alt?: string; caption?: string; role?: string; provenance?: ImageAsset['provenance'] }, required: boolean) => {
    const existingId = sourceIds.get(asset.src)
    const id = existingId ?? asset.id ?? asset.assetId ?? `asset-${entries.size + 1}`
    const existing = entries.get(id)
    if (existing) {
      existing.required = existing.required || required
      return
    }
    sourceIds.set(asset.src, id)
    entries.set(id, {
      id,
      src: asset.src,
      alt: asset.alt ?? id,
      caption: asset.caption,
      role: asset.role,
      required,
      provenance: asset.provenance,
    })
  }

  planAssets.forEach(asset => add(asset, referenced.has(asset.id)))
  slides.forEach(slide => slide.images?.forEach(image => add(image, true)))
  return [...entries.values()]
}

function inferLanguage(input: string): string {
  return /[\u4e00-\u9fff]/.test(input) ? 'zh-CN' : 'en'
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
}
