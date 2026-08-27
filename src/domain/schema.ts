import { z } from 'zod'
import {
  DECK_VERSIONS,
  LAYOUT_FAMILIES,
  LAYOUT_IDS,
  TEMPLATE_IDS,
  SLIDE_ELEMENT_TYPES,
  type DeckSpec,
} from './types'

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  assetId: z.string().min(1).optional(),
  provenance: z.object({
    kind: z.enum(['user', 'local', 'generated', 'remote', 'stock']).optional(),
    source: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
    attribution: z.string().min(1).optional(),
    checksum: z.string().min(1).optional(),
  }).optional(),
})

const contentBudgetSchema = z.object({
  title: z.number().int().positive().max(500).optional(),
  subtitle: z.number().int().positive().max(800).optional(),
  body: z.number().int().positive().max(2000).optional(),
  bullet: z.number().int().positive().max(500).optional(),
  items: z.number().int().positive().max(30).optional(),
  media: z.number().int().min(0).max(20).optional(),
}).partial()

const layoutCandidateSchema = z.object({
  id: z.string().min(1),
  layout: z.enum(LAYOUT_IDS),
  family: z.enum(LAYOUT_FAMILIES),
  score: z.number().finite(),
  rationale: z.string().optional(),
})

const statSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().optional(),
})

const columnSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
})

const stepSchema = z.object({
  label: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
})

export const chartSchema = z.object({
  unit: z.string().optional(),
  points: z.array(z.object({
    label: z.string().min(1),
    value: z.number().finite(),
  })).min(1).max(20),
  type: z.enum(['bar', 'pie', 'line', 'scatter', 'area']).optional(),
  chartType: z.enum(['bar', 'pie', 'line', 'scatter', 'area']).optional(),
})

export const tableMergeCellSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  rowspan: z.number().int().min(1).optional(),
  colspan: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).optional(),
  colSpan: z.number().int().min(1).optional(),
})

export const tableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
  formulas: z.record(z.string()).optional(),
  mergeCells: z.array(tableMergeCellSchema).optional(),
})

export const formFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string(),
  label: z.string().min(1),
  options: z.array(z.string()).optional(),
  value: z.any().optional(),
})

export const actionSchema = z.object({
  type: z.enum(['slideJump', 'url', 'hyperlink']),
  target: z.union([z.string(), z.number()]),
})

export const formSchema = z.object({
  fields: z.array(formFieldSchema),
  submitAction: z.union([z.string(), actionSchema]).optional(),
})

export const embedSchema = z.object({
  url: z.string().min(1),
  sandbox: z.union([z.string(), z.boolean()]).optional(),
  fallbackImage: z.string().optional(),
})

export const animationSchema = z.object({
  id: z.string().optional(),
  targetElementId: z.string().optional(),
  trigger: z.enum(['onClick', 'afterPrevious', 'withPrevious']),
  effect: z.enum(['appear', 'fade', 'flyIn']),
  delay: z.number().finite().optional(),
  duration: z.number().finite().optional(),
})

const elementStyleSchema = z.object({
  color: z.string().min(1).optional(),
  fill: z.string().min(1).optional(),
  stroke: z.string().min(1).optional(),
  strokeWidth: z.number().finite().min(0).max(40).optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  fontSize: z.number().finite().min(6).max(240).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontFamily: z.string().min(1).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  lineHeight: z.number().finite().min(0.7).max(3).optional(),
  radius: z.number().finite().min(0).max(200).optional(),
  objectFit: z.enum(['cover', 'contain']).optional(),
}).partial()

export const slideElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SLIDE_ELEMENT_TYPES),
  x: z.number().finite().min(0).max(1600),
  y: z.number().finite().min(0).max(900),
  width: z.number().finite().min(1).max(1600),
  height: z.number().finite().min(1).max(900),
  rotation: z.number().finite().min(-360).max(360).optional(),
  zIndex: z.number().int().min(0).max(10000).optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  userEdited: z.boolean().optional(),
  text: z.string().optional(),
  src: z.string().min(1).optional(),
  alt: z.string().optional(),
  path: z.string().min(1).optional(),
  style: elementStyleSchema.optional(),
  table: tableSchema.optional(),
  chart: chartSchema.optional(),
  form: formSchema.optional(),
  embed: embedSchema.optional(),
  animation: animationSchema.optional(),
  action: actionSchema.optional(),
}).passthrough().superRefine((element, context) => {
  if (element.type === 'text' && !element.text) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['text'], message: 'Text element requires text.' })
  }
  if (element.type === 'image' && !element.src) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['src'], message: 'Image element requires src.' })
  }
})

export const slideSchema = z.object({
  id: z.string().min(1),
  layout: z.enum(LAYOUT_IDS),
  layoutFamily: z.enum(LAYOUT_FAMILIES).optional(),
  layoutCandidates: z.array(layoutCandidateSchema).max(6).optional(),
  selectedLayoutCandidate: z.string().min(1).optional(),
  contentBudget: contentBudgetSchema.optional(),
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).max(12).optional(),
  stats: z.array(statSchema).max(6).optional(),
  columns: z.array(columnSchema).max(4).optional(),
  steps: z.array(stepSchema).max(7).optional(),
  images: z.array(imageSchema).max(8).optional(),
  chart: chartSchema.optional(),
  quote: z.string().optional(),
  quoteBy: z.string().optional(),
  footer: z.string().optional(),
  notes: z.string().optional(),
  elements: z.array(slideElementSchema).max(300).optional(),
}).superRefine((slide, context) => {
  const required: Partial<Record<(typeof LAYOUT_IDS)[number], keyof typeof slide>> = {
    metrics: 'stats',
    comparison: 'columns',
    timeline: 'steps',
    gallery: 'images',
    chart: 'chart',
    quote: 'quote',
  }
  const field = required[slide.layout]
  if (field && !slide[field]) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${slide.layout} layout requires ${field}`,
    })
  }

  const candidates = slide.layoutCandidates ?? []
  const candidateIds = new Set<string>()
  candidates.forEach((candidate, index) => {
    if (candidateIds.has(candidate.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['layoutCandidates', index, 'id'],
        message: `Duplicate layout candidate id: ${candidate.id}`,
      })
    }
    candidateIds.add(candidate.id)
  })
  if (slide.selectedLayoutCandidate && !candidateIds.has(slide.selectedLayoutCandidate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selectedLayoutCandidate'],
      message: `Selected layout candidate does not exist: ${slide.selectedLayoutCandidate}`,
    })
  }
  if (slide.selectedLayoutCandidate) {
    const selected = candidates.find(candidate => candidate.id === slide.selectedLayoutCandidate)
    if (selected && selected.layout !== slide.layout) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedLayoutCandidate'],
        message: 'Selected layout candidate must match the slide layout.',
      })
    }
  }
})

export const deckSchema = z.object({
  version: z.union([z.literal(DECK_VERSIONS[0]), z.literal(DECK_VERSIONS[1])]),
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  templateId: z.enum(TEMPLATE_IDS),
  updatedAt: z.string().datetime(),
  slides: z.array(slideSchema).min(1).max(60),
  designContext: z.object({
    audience: z.string().min(1).optional(),
    purpose: z.string().min(1).optional(),
    decision: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    tone: z.string().min(1).optional(),
    fidelity: z.enum(['editable', 'high-fidelity', 'balanced']).optional(),
    scope: z.string().min(1).optional(),
    deliveryFormats: z.array(z.enum(['web', 'pptx', 'pdf', 'png'])).max(4).optional(),
    brand: z.object({
      name: z.string().min(1).optional(),
      primaryColor: z.string().min(1).optional(),
      secondaryColor: z.string().min(1).optional(),
      fonts: z.array(z.string().min(1)).max(8).optional(),
      logoAssetId: z.string().min(1).optional(),
      forbiddenPatterns: z.array(z.string().min(1)).max(20).optional(),
    }).optional(),
    hardConstraints: z.array(z.string().min(1)).max(30).optional(),
    references: z.array(z.string().min(1)).max(30).optional(),
  }).optional(),
  assetManifest: z.array(z.object({
    id: z.string().min(1),
    src: z.string().min(1),
    alt: z.string().min(1),
    caption: z.string().optional(),
    assetId: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    required: z.boolean().optional(),
    provenance: imageSchema.shape.provenance,
  })).max(100).optional(),
  tweaks: z.object({
    density: z.enum(['airy', 'balanced', 'dense']),
    fontScale: z.number().finite().min(0.85).max(1.2),
    accentMode: z.enum(['default', 'warm', 'cool']),
  }).optional(),
  source: z.object({
    kind: z.enum(['agent', 'markdown', 'html', 'json', 'imported']),
    path: z.string().min(1).optional(),
    importedAt: z.string().datetime().optional(),
  }).optional(),
}).superRefine((deck, context) => {
  const ids = new Set<string>()
  deck.slides.forEach((slide, index) => {
    if (ids.has(slide.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slides', index, 'id'],
        message: `Duplicate slide id: ${slide.id}`,
      })
    }
    ids.add(slide.id)
  })

  const assetIds = new Set<string>()
  const assetSources = new Map<string, string>()
  deck.assetManifest?.forEach((asset, index) => {
    if (assetIds.has(asset.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assetManifest', index, 'id'],
        message: `Duplicate asset id: ${asset.id}`,
      })
    }
    assetIds.add(asset.id)
  })
  deck.slides.forEach((slide, slideIndex) => {
    slide.images?.forEach((image, imageIndex) => {
      if (!image.assetId) return
      const previous = assetSources.get(image.assetId)
      if (previous && previous !== image.src) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slides', slideIndex, 'images', imageIndex, 'assetId'],
          message: `Asset id ${image.assetId} is used with multiple sources.`,
        })
      }
      assetSources.set(image.assetId, image.src)
    })
    const elementIds = new Set<string>()
    slide.elements?.forEach((element, elementIndex) => {
      if (elementIds.has(element.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slides', slideIndex, 'elements', elementIndex, 'id'],
          message: `Duplicate element id: ${element.id}`,
        })
      }
      elementIds.add(element.id)
      if (element.type === 'text' && !element.text?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slides', slideIndex, 'elements', elementIndex, 'text'],
          message: 'Text element cannot be empty.',
        })
      }
    })
  })
})

export function parseDeck(input: unknown): DeckSpec {
  return deckSchema.parse(input) as DeckSpec
}

/** Upgrade a validated v1 deck at an explicit boundary without changing parse semantics. */
export function upgradeDeck(input: unknown): DeckSpec {
  const deck = parseDeck(input)
  if (deck.version === 2) return deck
  return {
    ...deck,
    version: 2,
    source: deck.source ?? { kind: 'json' },
  }
}

export function safeParseDeck(input: unknown) {
  return deckSchema.safeParse(input)
}
