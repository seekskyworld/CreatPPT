import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { planDeck } from './planner'
import type { ContentBlock, ContentInput } from './pipeline-types'
import type { DeckSpec, SlideSpec, TemplateId } from './types'

export interface BriefOptions {
  title?: string
  templateId?: TemplateId
  sourcePath?: string
}

export interface BriefDocument {
  title: string
  subtitle?: string
  frontmatter: Record<string, string>
  sections: Array<{ title: string; paragraphs: string[]; bullets: string[] }>
}

/** Read a Markdown/plain-text brief and turn it into a deterministic starter deck. */
export async function deckFromBriefFile(path: string, options: BriefOptions = {}): Promise<DeckSpec> {
  const raw = await readFile(path, 'utf8')
  const content = isHtmlSource(path) ? htmlToBrief(raw) : raw
  return deckFromBrief(content, { ...options, sourcePath: options.sourcePath ?? path })
}

export function deckFromBrief(content: string, options: BriefOptions = {}): DeckSpec {
  const document = parseBrief(content, options.title)
  const templateId = options.templateId ?? parseTemplate(document.frontmatter.template)
  const id = slugify(document.title) || 'creatppt-brief'
  const slides = buildSlides(document, id, templateId)
  const deck: DeckSpec = {
    version: 2,
    id,
    title: document.title,
    subtitle: document.subtitle,
    templateId,
    updatedAt: new Date().toISOString(),
    source: {
      kind: isHtmlSource(options.sourcePath) ? 'html' : 'markdown',
      path: options.sourcePath,
      importedAt: new Date().toISOString(),
    },
    designContext: {
      audience: document.frontmatter.audience,
      purpose: document.frontmatter.purpose,
      decision: document.frontmatter.decision,
      language: document.frontmatter.language ?? inferLanguage(content),
      tone: document.frontmatter.tone,
      fidelity: parseFidelity(document.frontmatter.fidelity),
      scope: document.frontmatter.scope,
      deliveryFormats: parseFormats(document.frontmatter.delivery),
      hardConstraints: splitList(document.frontmatter.constraints),
      references: splitList(document.frontmatter.references),
    },
    slides,
  }
  return planDeck(deck, { sourceKind: deck.source?.kind ?? 'markdown' })
}

export function parseBrief(content: string, fallbackTitle?: string): BriefDocument {
  const normalized = content.replace(/\r\n?/g, '\n').trim()
  const { frontmatter, body } = parseFrontmatter(normalized)
  const lines = body.split('\n')
  const h1 = lines.find(line => /^#\s+/.test(line))
  const title = h1?.replace(/^#\s+/, '').trim() || fallbackTitle || 'Untitled presentation'
  const subtitleLine = lines.find(line => /^>\s+/.test(line))
  const subtitle = subtitleLine?.replace(/^>\s+/, '').trim()

  const sections: BriefDocument['sections'] = []
  let current: BriefDocument['sections'][number] = { title: title, paragraphs: [], bullets: [] }
  const flush = () => {
    if (current.title !== title || current.paragraphs.length || current.bullets.length) sections.push(current)
    current = { title: title, paragraphs: [], bullets: [] }
  }

  for (const line of lines) {
    if (/^#\s+/.test(line) || /^>\s+/.test(line)) continue
    const heading = line.match(/^##+\s+(.+)/)
    if (heading) {
      flush()
      current = { title: heading[1].trim(), paragraphs: [], bullets: [] }
      continue
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)/)
    if (bullet) {
      current.bullets.push(bullet[1].trim())
      continue
    }
    const paragraph = line.trim()
    if (paragraph) current.paragraphs.push(paragraph)
  }
  flush()

  if (!sections.length && body.trim()) sections.push({ title: inferLanguage(content) === 'en' ? 'Core content' : '核心内容', paragraphs: [body], bullets: [] })
  return { title, subtitle, frontmatter, sections }
}

/** Convert a brief into the layout-free input used by the Fast path planner. */
export function contentInputFromBrief(content: string, options: BriefOptions = {}): ContentInput {
  const document = parseBrief(content, options.title)
  const sourceKind = isHtmlSource(options.sourcePath) ? 'html' : 'markdown'
  const templateValue = document.frontmatter.template?.trim().toLowerCase()
  const template = templateValue === 'auto'
    ? 'auto' as const
    : parseTemplate(templateValue)
  const sections = document.sections.map((section, index) => semanticBlockFromSection(section, index))

  return {
    version: 1,
    id: slugify(document.title) || 'creatppt-brief',
    title: document.title,
    subtitle: document.subtitle,
    audience: document.frontmatter.audience,
    purpose: document.frontmatter.purpose,
    decision: document.frontmatter.decision,
    language: document.frontmatter.language ?? inferLanguage(content),
    tone: document.frontmatter.tone,
    template,
    slides: parseSlideCount(document.frontmatter.slides),
    deliveryFormats: parseFormats(document.frontmatter.delivery),
    sections,
    source: {
      kind: sourceKind,
      path: options.sourcePath,
    },
  }
}

/** Read a brief file without creating a DeckSpec, for the Fast path pipeline. */
export async function contentInputFromBriefFile(path: string, options: BriefOptions = {}): Promise<ContentInput> {
  const raw = await readFile(path, 'utf8')
  const content = isHtmlSource(path) ? htmlToBrief(raw) : raw
  return contentInputFromBrief(content, { ...options, sourcePath: options.sourcePath ?? path })
}

function buildSlides(document: BriefDocument, deckId: string, templateId: TemplateId): SlideSpec[] {
  const english = inferLanguage(document.title) === 'en'
  const heroImage = {
    src: templateId === 'studio'
      ? 'assets/studio-wide-workspace.jpg'
      : templateId === 'editorial'
        ? 'assets/cover-banner.jpg'
        : 'assets/cover-hero.jpg',
    alt: templateId === 'studio'
      ? (english ? 'Wide creative studio and collaboration space' : '开放创意工作室与协作空间的横向场景')
      : templateId === 'editorial'
        ? (english ? 'Editorial workspace and inspiration wall' : '编辑工作台与灵感墙的横向场景')
        : (english ? 'Circuit board and chip under directional light' : '深色灯光下的电路板与芯片'),
    provenance: { kind: 'local' as const, source: 'CreatPPT starter asset' },
  }
  const sectionImage = templateId === 'studio'
    ? { src: 'assets/studio-prototype-hands.jpg', alt: english ? 'Hands building a product prototype' : '产品原型制作过程', provenance: heroImage.provenance }
    : templateId === 'editorial'
      ? { src: 'assets/editorial-research-desk.jpg', alt: english ? 'Research desk with editorial materials' : '研究桌面与编辑素材', provenance: heroImage.provenance }
      : { src: 'assets/signal-server-room.jpg', alt: english ? 'Data center and server racks' : '数据中心与服务器机架', provenance: heroImage.provenance }
  const slides: SlideSpec[] = [{
    id: `${deckId}-cover`,
    layout: 'cover',
    eyebrow: 'CREATPPT / BRIEF',
    title: document.title,
    subtitle: document.subtitle ?? document.frontmatter.purpose,
    images: [heroImage],
    footer: 'CreatPPT / Web-first',
  }]

  document.sections.slice(0, 22).forEach((section, index) => {
    const body = section.paragraphs.join('\n\n')
    const base = {
      id: `${deckId}-section-${index + 1}`,
      eyebrow: `SECTION ${String(index + 1).padStart(2, '0')}`,
      title: section.title,
      body: body || undefined,
      bullets: section.bullets.length ? section.bullets.slice(0, 8) : undefined,
      footer: `${String(index + 1).padStart(2, '0')} / ${document.title}`,
    }
    if (section.bullets.length >= 3 && section.bullets.length <= 6) {
      slides.push({ ...base, layout: 'agenda' })
    }
    else if (section.bullets.length >= 2 && body) {
      slides.push({ ...base, layout: 'split', images: [{ ...sectionImage, alt: english ? `${section.title} image` : `${section.title} 配图` }] })
    }
    else {
      slides.push({ ...base, layout: 'statement' })
    }
  })

  const decision = document.frontmatter.decision?.trim()
  if (decision) {
    slides.push({
      id: `${deckId}-closing`,
      layout: 'closing',
      eyebrow: 'NEXT',
      title: document.title,
      body: decision,
      footer: `${document.title} / Closing`,
    })
  }
  return slides
}

function parseFrontmatter(input: string): { frontmatter: Record<string, string>; body: string } {
  if (!input.startsWith('---\n')) return { frontmatter: {}, body: input }
  const end = input.indexOf('\n---', 4)
  if (end < 0) return { frontmatter: {}, body: input }
  const block = input.slice(4, end)
  const body = input.slice(end + 4).replace(/^\n+/, '')
  const frontmatter: Record<string, string> = {}
  block.split('\n').forEach(line => {
    const separator = line.indexOf(':')
    if (separator <= 0) return
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && value) frontmatter[key] = value
  })
  return { frontmatter, body }
}

function parseTemplate(value?: string): TemplateId {
  return value === 'signal' || value === 'studio' ? value : 'editorial'
}

function semanticBlockFromSection(
  section: BriefDocument['sections'][number],
  index: number,
) {
  const rawTitle = section.title.trim()
  const intent = inferSectionIntent(rawTitle)
  const title = cleanIntentMarker(rawTitle)
  const body = section.paragraphs.join('\n\n') || undefined
  const sourceText = [...section.paragraphs, ...section.bullets]
  const images = extractMarkdownImages(sourceText)
  const base = {
    id: `${slugify(title) || 'section'}-${index + 1}`,
    intent,
    title,
    body,
    bullets: section.bullets.length ? section.bullets.slice(0, 12) : undefined,
    images: images.length ? images : undefined,
  }

  if (intent === 'metrics') {
    const stats = parseStats(section.bullets)
    if (stats.length >= 2) return { ...base, stats, bullets: undefined }
    return { ...base, intent: undefined }
  }
  if (intent === 'chart') {
    const points = parseChartPoints(section.bullets)
    if (points.length >= 2) return { ...base, chart: { points }, bullets: undefined }
    return { ...base, intent: undefined }
  }
  if (intent === 'timeline') {
    const steps = parseSteps(section.bullets)
    if (steps.length >= 2) return { ...base, steps, bullets: undefined }
    return { ...base, intent: undefined }
  }
  if (intent === 'comparison') {
    const columns = parseColumns(section.bullets)
    if (columns.length >= 2) return { ...base, columns, bullets: undefined }
    return { ...base, intent: undefined }
  }
  if (intent === 'quote') {
    const quote = body || section.bullets[0]
    if (quote) return { ...base, quote, quoteBy: section.bullets[1], bullets: undefined }
  }
  return base
}

function inferSectionIntent(title: string): ContentBlock['intent'] {
  const normalized = title.toLowerCase()
  const marker = normalized.match(/^\[([^\]]+)\]/)?.[1] ?? normalized.split(':')[0]
  const value = marker.trim()
  if (/metrics?|指标|数字|数据|结果/.test(value)) return 'metrics'
  if (/comparison|compare|对比|方案|取舍/.test(value)) return 'comparison'
  if (/chart|趋势|图表|曲线/.test(value)) return 'chart'
  if (/timeline|路线|阶段|里程碑|计划/.test(value)) return 'timeline'
  if (/gallery|画廊|图片|证据|案例/.test(value)) return 'gallery'
  if (/quote|引语|引用|原话/.test(value)) return 'quote'
  if (/agenda|目录|要点|清单/.test(value)) return 'agenda'
  if (/split|图文/.test(value)) return 'split'
  return undefined
}

function cleanIntentMarker(title: string): string {
  return title
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^(metrics?|指标|数字|数据|结果|comparison|compare|对比|方案|chart|趋势|图表|timeline|路线|阶段|里程碑|gallery|画廊|图片|证据|quote|引语|agenda|目录)\s*[:：-]\s*/i, '')
    .trim() || title
}

function parseStats(items: string[]) {
  return items.flatMap(item => {
    const parts = splitSemanticItem(item)
    if (parts.length < 2 || !looksLikeMetric(parts[0]) && !looksLikeMetric(parts[1])) return []
    const valueIndex = looksLikeMetric(parts[0]) ? 0 : 1
    const labelIndex = valueIndex === 0 ? 1 : 0
    return [{ value: parts[valueIndex], label: parts[labelIndex], detail: parts[2] }]
  }).slice(0, 6)
}

function parseChartPoints(items: string[]) {
  return items.flatMap(item => {
    const parts = splitSemanticItem(item)
    const valuePart = parts.find(part => /^[-+]?\d+(?:\.\d+)?%?$/.test(part.replace(/,/g, '')))
    if (!valuePart) return []
    const value = Number.parseFloat(valuePart.replace(/,/g, '').replace(/%$/, ''))
    const label = parts.find(part => part !== valuePart) ?? '数据'
    return Number.isFinite(value) ? [{ label, value }] : []
  }).slice(0, 8)
}

function parseSteps(items: string[]) {
  return items.flatMap((item, index) => {
    const parts = splitSemanticItem(item)
    if (!parts.length) return []
    return [{ label: parts[0] || String(index + 1).padStart(2, '0'), title: parts[1] || parts[0], body: parts[2] }]
  }).slice(0, 7)
}

function parseColumns(items: string[]) {
  return items.flatMap(item => {
    const parts = splitSemanticItem(item)
    if (!parts.length) return []
    return [{ title: parts[0], body: parts.slice(1).join(' · ') || undefined }]
  }).slice(0, 4)
}

function splitSemanticItem(item: string): string[] {
  return item.split(/\s*[|｜]\s*|\s*[:：]\s*/).map(part => part.trim()).filter(Boolean)
}

function looksLikeMetric(value: string): boolean {
  return /^[-+]?\d[\d,.]*(?:\.\d+)?\s*(?:%|％|倍|万|亿|天|月|年)?$/i.test(value)
}

function extractMarkdownImages(values: string[]) {
  return values.flatMap(value => [...value.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(match => ({
    src: match[2].trim(),
    alt: match[1].trim() || 'brief 图片',
    provenance: {
      kind: /^(?:https?:)?\/\//i.test(match[2]) ? 'remote' as const : 'local' as const,
      source: match[2].trim(),
    },
  })))
}

function parseSlideCount(value?: string): number | 'auto' | undefined {
  if (!value || value.toLowerCase() === 'auto') return value ? 'auto' : undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(60, parsed) : undefined
}

function parseFidelity(value?: string): 'editable' | 'high-fidelity' | 'balanced' {
  if (value === 'editable' || value === 'high-fidelity') return value
  return 'balanced'
}

function parseFormats(value?: string): Array<'web' | 'pptx' | 'pdf' | 'png'> {
  const values = splitList(value) ?? []
  const allowed = new Set(['web', 'pptx', 'pdf', 'png'])
  const formats = values.filter(item => allowed.has(item)) as Array<'web' | 'pptx' | 'pdf' | 'png'>
  return formats.length ? formats : ['web', 'pptx']
}

function splitList(value?: string): string[] | undefined {
  if (!value) return undefined
  const values = value.split(/[,，|]/).map(item => item.trim()).filter(Boolean)
  return values.length ? values : undefined
}

function inferLanguage(input: string): string {
  return /[\u4e00-\u9fff]/.test(input) ? 'zh-CN' : 'en'
}

function isHtmlSource(path?: string): boolean {
  return extname(path ?? '').toLowerCase() === '.html'
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export function briefTitleFromPath(path: string): string {
  return basename(path, extname(path)).replace(/[-_]+/g, ' ').trim()
}

/** Convert a simple static HTML deck/brief to the same bounded Markdown intake format. */
export function htmlToBrief(input: string): string {
  return decodeEntities(input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n## $1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1\n')
    .replace(/<br\s*\/?>(?=\S)/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<section[^>]*>/gi, '\n')
    .replace(/<\/section>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}
