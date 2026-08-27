import { TEMPLATE_IDS, type DeckSpec, type TemplateId } from '../domain/types'

export type TemplateOption = TemplateId | 'auto'
export type CountOption = number | 'auto'
export type PortOption = number | 'auto'

export function parseTemplateOption(value?: string): TemplateOption {
  if (value === 'signal' || value === 'studio' || value === 'editorial') return value
  if (!value || value === 'auto') return 'auto'
  throw new Error(`Unknown template '${value}'. Use: auto, ${TEMPLATE_IDS.join(', ')}.`)
}

export function resolveConcreteTemplate(value: TemplateOption): TemplateId {
  return value === 'signal' || value === 'studio' ? value : 'editorial'
}

export function parseCountOption(value: string): CountOption {
  if (value === 'auto') return 'auto'
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`Invalid count: ${value}`)
  return parsed
}

export function parsePortOption(value: string): PortOption {
  if (value === 'auto') return 'auto'
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) throw new Error(`Invalid port: ${value}`)
  return parsed
}

export function normalizeVariants(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 2
  return Math.min(3, Math.max(1, Math.trunc(parsed)))
}

export function normalizeSlides(value: unknown): CountOption {
  if (value === 'auto' || value === undefined) return 'auto'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'auto'
  return Math.min(60, Math.max(2, Math.trunc(parsed)))
}

export function limitDeckSlides(deck: DeckSpec, count: CountOption): DeckSpec {
  if (count === 'auto' || deck.slides.length <= count) return deck
  const middleCount = Math.max(0, count - 2)
  const cover = deck.slides[0]
  const closing = deck.slides.at(-1)
  if (!cover || !closing || count < 2) return deck
  return { ...deck, slides: [cover, ...deck.slides.slice(1, -1).slice(0, middleCount), closing] }
}

export function looksLikeDeckSpec(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input)
    && Array.isArray((input as Record<string, unknown>).slides)
    && typeof (input as Record<string, unknown>).templateId === 'string'
    && typeof (input as Record<string, unknown>).version === 'number')
}
