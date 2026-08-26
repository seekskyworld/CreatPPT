import { z } from 'zod'
import {
  DECK_VERSIONS,
  LAYOUT_IDS,
  TEMPLATE_IDS,
  type DeckSourceKind,
  type DeckVersion,
  type PipelineStage,
} from './types'

const text = z.string().trim().min(1)
const sourceKinds = z.enum(['agent', 'markdown', 'html', 'json', 'imported'])
const templateInput = z.union([z.enum(TEMPLATE_IDS), z.literal('auto')])
const deliveryFormat = z.enum(['web', 'pptx', 'pdf', 'png'])
const assetKind = z.enum(['user', 'local', 'generated', 'remote', 'stock'])

export const contentIntentIds = [
  'section',
  ...LAYOUT_IDS,
] as const

export const contentIntentSchema = z.enum(contentIntentIds)

export const contentAssetSchema = z.object({
  id: text.optional(),
  src: text,
  alt: text.optional(),
  caption: text.optional(),
  role: text.optional(),
  provenance: z.object({
    kind: assetKind.optional(),
    source: text.optional(),
    license: text.optional(),
    attribution: text.optional(),
    checksum: text.optional(),
  }).passthrough().optional(),
}).passthrough()

const statInputSchema = z.object({
  value: text,
  label: text,
  detail: text.optional(),
}).passthrough()

const columnInputSchema = z.object({
  title: text,
  body: text.optional(),
  bullets: z.array(text).max(12).optional(),
}).passthrough()

const stepInputSchema = z.object({
  label: text,
  title: text,
  body: text.optional(),
}).passthrough()

const chartInputSchema = z.object({
  unit: text.optional(),
  points: z.array(z.object({ label: text, value: z.number().finite() }).passthrough()).min(2).max(8),
}).passthrough()

export const sourceSpanSchema = z.object({
  source: text.optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
}).passthrough()

/**
 * Small semantic block accepted from an Agent. Layout details are deliberately
 * absent; the planner chooses them from the available content fields.
 */
const contentBlockBaseSchema = z.object({
  id: text.optional(),
  intent: contentIntentSchema.optional(),
  title: text.optional(),
  subtitle: text.optional(),
  body: text.optional(),
  bullets: z.array(text).max(12).optional(),
  stats: z.array(statInputSchema).max(6).optional(),
  columns: z.array(columnInputSchema).max(4).optional(),
  steps: z.array(stepInputSchema).max(7).optional(),
  chart: chartInputSchema.optional(),
  quote: text.optional(),
  quoteBy: text.optional(),
  images: z.array(contentAssetSchema).max(8).optional(),
  sourceSpan: sourceSpanSchema.optional(),
}).passthrough()

export const contentBlockSchema = contentBlockBaseSchema.refine(block => Boolean(
  block.title || block.subtitle || block.body || block.bullets?.length || block.stats?.length
    || block.columns?.length || block.steps?.length || block.chart || block.quote || block.images?.length,
), { message: 'Content block must contain at least one meaningful field.' })

/**
 * Minimal, layout-free input contract for the Fast path. It is intentionally
 * separate from DeckSpec so existing authored decks remain a stable expert path.
 */
export const contentInputSchema = z.object({
  version: z.number().int().positive().optional(),
  id: text.optional(),
  title: text,
  subtitle: text.optional(),
  audience: text.optional(),
  purpose: text.optional(),
  decision: text.optional(),
  language: text.optional(),
  tone: text.optional(),
  template: templateInput.optional(),
  slides: z.union([z.literal('auto'), z.number().int().min(1).max(60)]).optional(),
  deliveryFormats: z.array(deliveryFormat).max(4).optional(),
  sections: z.array(contentBlockSchema).max(60).optional(),
  assets: z.array(contentAssetSchema).max(100).optional(),
  source: z.object({
    kind: sourceKinds.optional(),
    path: text.optional(),
  }).passthrough().optional(),
}).passthrough()

const plannedBlockSchema = contentBlockBaseSchema.extend({
  id: text,
  intent: contentIntentSchema,
  order: z.number().int().nonnegative(),
  layout: z.enum(LAYOUT_IDS),
}).passthrough().refine(block => Boolean(
  block.title || block.subtitle || block.body || block.bullets?.length || block.stats?.length
    || block.columns?.length || block.steps?.length || block.chart || block.quote || block.images?.length,
), { message: 'Content block must contain at least one meaningful field.' })

export const contentPlanSchema = z.object({
  version: z.literal(1),
  id: text,
  title: text,
  subtitle: text.optional(),
  templateId: z.enum(TEMPLATE_IDS),
  designContext: z.object({
    audience: text.optional(),
    purpose: text.optional(),
    decision: text.optional(),
    language: text.optional(),
    tone: text.optional(),
    deliveryFormats: z.array(deliveryFormat).max(4).optional(),
  }).passthrough(),
  blocks: z.array(plannedBlockSchema).min(1).max(60),
  assets: z.array(contentAssetSchema).max(100),
  source: z.object({
    kind: sourceKinds,
    path: text.optional(),
  }).passthrough(),
}).passthrough()

export const pipelineStageSchema = z.enum(['intake', 'plan', 'validate', 'materialize', 'serve'])

export const qualityIssueSchema = z.object({
  code: text,
  severity: z.enum(['warning', 'error']),
  stage: pipelineStageSchema.optional(),
  slideId: text.optional(),
  field: text.optional(),
  line: z.number().int().positive().optional(),
  message: text,
  fix: text.optional(),
}).passthrough()

export const qualityReportSchema = z.object({
  ok: z.boolean(),
  strict: z.boolean(),
  issues: z.array(qualityIssueSchema),
  summary: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    slides: z.number().int().nonnegative(),
    assets: z.number().int().nonnegative(),
  }).passthrough(),
  stages: z.array(z.object({
    stage: pipelineStageSchema,
    ok: z.boolean(),
    elapsedMs: z.number().finite().nonnegative().optional(),
    issueCount: z.number().int().nonnegative().optional(),
  }).passthrough()).optional(),
}).passthrough()

export const deliveryManifestSchema = z.object({
  version: z.literal(1),
  projectDir: text,
  deckPath: text,
  assetsDir: text,
  schemaVersion: z.union([z.literal(DECK_VERSIONS[0]), z.literal(DECK_VERSIONS[1])]),
  sourceKind: sourceKinds,
  pptxGenerated: z.literal(false),
  quality: qualityReportSchema,
  url: text.optional(),
  pid: z.number().int().positive().optional(),
  elapsedMs: z.number().finite().nonnegative().optional(),
}).passthrough()

export type ContentInput = z.infer<typeof contentInputSchema>
export type ContentBlock = z.infer<typeof contentBlockSchema>
export type ContentPlan = z.infer<typeof contentPlanSchema>
export type QualityReport = z.infer<typeof qualityReportSchema>
export type DeliveryManifest = z.infer<typeof deliveryManifestSchema>
export type PipelineStageId = z.infer<typeof pipelineStageSchema>

export function parseContentInput(input: unknown): ContentInput {
  return contentInputSchema.parse(input)
}

export function safeParseContentInput(input: unknown) {
  return contentInputSchema.safeParse(input)
}

export function parseContentPlan(input: unknown): ContentPlan {
  return contentPlanSchema.parse(input)
}

export function parseQualityReport(input: unknown): QualityReport {
  return qualityReportSchema.parse(input)
}

export function parseDeliveryManifest(input: unknown): DeliveryManifest {
  return deliveryManifestSchema.parse(input)
}

export type PipelineSourceKind = DeckSourceKind
export type PipelineStageName = PipelineStage
