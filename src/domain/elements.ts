import type {
  DeckSpec,
  ElementStyle,
  ImageAsset,
  SlideElement,
  SlideLayout,
  SlideSpec,
  TemplateId,
} from './types'
import { getAtPath } from './path'
import { getAgendaLayout } from './agenda'

const INK = 'var(--slide-ink)'
const MUTED = 'var(--slide-muted)'
const ACCENT = 'var(--slide-accent)'
const ACCENT_ALT = 'var(--slide-accent-alt)'
const LINE = 'var(--slide-line)'
const SURFACE = 'var(--slide-surface)'
const BG_ALT = 'var(--slide-bg-alt)'
const HIGHLIGHT = 'var(--slide-highlight)'

/**
 * 将语义页编译成可编辑场景。元素使用逻辑画布坐标，模板颜色通过 CSS token
 * 解析，这样拖拽后的对象仍能在模板切换时保持可读性。
 */
export function createSlideElements(slide: SlideSpec, templateId: TemplateId): SlideElement[] {
  const elements: SlideElement[] = []
  const add = (element: SlideElement) => elements.push({ visible: true, zIndex: elements.length + 1, ...element })
  const text = (id: string, value: string | number | undefined, box: Box, style: ElementStyle = {}, path?: string) => {
    if (value === undefined || value === '') return
    add({ id: `${slide.id}:${id}`, type: 'text', ...box, text: String(value), path, style })
  }
  const rect = (id: string, box: Box, style: ElementStyle = {}) => add({ id: `${slide.id}:${id}`, type: 'rect', ...box, style })
  const line = (id: string, box: Box, style: ElementStyle = {}) => add({ id: `${slide.id}:${id}`, type: 'line', ...box, style })
  const image = (id: string, asset: ImageAsset | undefined, box: Box, path?: string, style: ElementStyle = {}) => {
    if (!asset?.src) return
    add({ id: `${slide.id}:${id}`, type: 'image', ...box, src: asset.src, alt: asset.alt, path, style: { objectFit: 'cover', ...style } })
  }
  const eyebrow = () => text('eyebrow', slide.eyebrow, { x: 88, y: 64, width: 660, height: 34 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, 'eyebrow')
  const title = (box: Box = { x: 88, y: 124, width: 1320, height: 164 }, size = 64) => text('title', slide.title, box, { color: INK, fontSize: size, fontWeight: 700, lineHeight: 1.08 }, 'title')
  const body = (box: Box, style: ElementStyle = {}) => text('body', slide.body, box, { color: MUTED, fontSize: 26, lineHeight: 1.5, ...style }, 'body')

  switch (slide.layout) {
    case 'cover': {
      const cover = templateId === 'studio'
        ? { image: { x: 0, y: 576, width: 1600, height: 324 }, accent: { x: 1080, y: 548, width: 520, height: 28 }, title: { x: 88, y: 152, width: 1320, height: 260 }, titleSize: 80, subtitle: { x: 88, y: 438, width: 1160, height: 78 } }
        : templateId === 'editorial'
          ? { image: { x: 978, y: 72, width: 560, height: 580 }, accent: { x: 978, y: 652, width: 560, height: 42 }, title: { x: 88, y: 174, width: 820, height: 420 }, titleSize: 84, subtitle: { x: 88, y: 628, width: 760, height: 126 } }
          : { image: { x: 980, y: 0, width: 620, height: 900 }, accent: { x: 940, y: 0, width: 40, height: 900 }, title: { x: 88, y: 174, width: 800, height: 420 }, titleSize: 92, subtitle: { x: 88, y: 628, width: 760, height: 126 } }
      image('cover-image', slide.images?.[0], cover.image, 'images.0')
      rect('cover-accent', cover.accent, { fill: templateId === 'editorial' ? ACCENT : templateId === 'studio' ? ACCENT : ACCENT_ALT })
      text('eyebrow', slide.eyebrow, { x: 88, y: 78, width: 720, height: 34 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, 'eyebrow')
      text('title', slide.title, cover.title, { color: INK, fontSize: cover.titleSize, fontWeight: 700, lineHeight: 1.08 }, 'title')
      text('subtitle', slide.subtitle, cover.subtitle, { color: MUTED, fontSize: 30, lineHeight: 1.5 }, 'subtitle')
      break
    }
    case 'agenda':
      eyebrow()
      title({ x: 88, y: 132, width: 720, height: 220 }, 76)
      {
        const agenda = getAgendaLayout(slide.bullets, templateId)
        agenda.rows.forEach((row, index) => {
          const item = slide.bullets?.[index] ?? ''
          if (templateId === 'studio' && index % 2 === 0) rect(`agenda-row-bg-${index}`, row.backgroundBox, { fill: SURFACE })
          line(`agenda-line-${index}`, { x: agenda.x, y: row.lineY, width: agenda.width, height: 2 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        // 窄序号只是装饰；语义 bullets 只绑定相邻正文，避免刷新时把长文写入窄框。
          text(`agenda-index-${index}`, String(index + 1).padStart(2, '0'), row.indexBox, { color: ACCENT, fontSize: 20, fontWeight: 800 })
          text(`agenda-item-${index}`, item, row.textBox, { color: INK, fontSize: agenda.fontSize, fontWeight: 600, lineHeight: agenda.lineHeight }, `bullets.${index}`)
        })
        if (agenda.rows.length) {
          line('agenda-end', { x: agenda.x, y: agenda.endY, width: agenda.width, height: 2 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        }
      }
      break
    case 'statement':
      eyebrow()
      rect('statement-rule', { x: 88, y: 166, width: templateId === 'editorial' ? 300 : 150, height: templateId === 'editorial' ? 8 : 18 }, { fill: templateId === 'editorial' ? ACCENT : ACCENT_ALT })
      title({ x: 88, y: templateId === 'studio' ? 206 : 226, width: templateId === 'studio' ? 1180 : templateId === 'editorial' ? 1260 : 1360, height: 350 }, templateId === 'editorial' ? 86 : 90)
      if (templateId === 'studio') {
        rect('statement-callout', { x: 88, y: 560, width: 1040, height: 180 }, { fill: ACCENT_ALT, radius: 0 })
        body({ x: 120, y: 586, width: 976, height: 132 }, { color: '#FFFFFF', fontSize: 26, lineHeight: 1.35 })
      }
      else body({ x: 760, y: 620, width: 700, height: 134 })
      break
    case 'metrics': {
      eyebrow()
      title(undefined, 64)
      const stats = slide.stats ?? []
      const studioGap = templateId === 'studio' ? 16 : 0
      const cellWidth = (1432 - studioGap * Math.max(0, stats.length - 1)) / Math.max(1, stats.length)
      if (templateId === 'studio') {
        stats.forEach((_, index) => {
          const x = 88 + index * (cellWidth + studioGap)
          rect(`metrics-card-${index}`, { x, y: 350, width: cellWidth, height: 350 }, { fill: SURFACE, stroke: LINE, strokeWidth: 2 })
        })
      }
      else {
        line('metrics-top', { x: 88, y: 350, width: 1432, height: 2 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        line('metrics-bottom', { x: 88, y: 700, width: 1432, height: 2 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
      }
      stats.forEach((stat, index) => {
        const x = 88 + index * (cellWidth + studioGap)
        const inset = templateId === 'studio' ? 34 : 28
        if (templateId !== 'studio' && index > 0) line(`metrics-divider-${index}`, { x, y: 350, width: 2, height: 350 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        text(`metric-index-${index}`, String(index + 1).padStart(2, '0'), { x: x + inset, y: 382, width: cellWidth - inset * 2, height: 24 }, { color: ACCENT_ALT, fontSize: 18, fontWeight: 800 })
        text(`metric-value-${index}`, stat.value, { x: x + inset, y: 448, width: cellWidth - inset * 2, height: 86 }, { color: templateId === 'studio' ? ACCENT_ALT : ACCENT, fontSize: 76, fontWeight: 700 }, `stats.${index}.value`)
        text(`metric-label-${index}`, stat.label, { x: x + inset, y: 564, width: cellWidth - inset * 2, height: 58 }, { color: INK, fontSize: 26, fontWeight: 700, lineHeight: 1.25 }, `stats.${index}.label`)
        text(`metric-detail-${index}`, stat.detail, { x: x + inset, y: 632, width: cellWidth - inset * 2, height: 44 }, { color: MUTED, fontSize: 19, lineHeight: 1.4 }, `stats.${index}.detail`)
      })
      break
    }
    case 'split': {
      const split = templateId === 'studio'
        ? { image: { x: 88, y: 104, width: 630, height: 670 }, copyX: 760 }
        : templateId === 'editorial'
          ? { image: { x: 62, y: 74, width: 650, height: 700 }, copyX: 750 }
          : { image: { x: 0, y: 0, width: 700, height: 900 }, copyX: 700 }
      const copyPadding = 80
      const textX = split.copyX + copyPadding
      image('split-image', slide.images?.[0], split.image, 'images.0', templateId === 'studio' ? { stroke: SURFACE, strokeWidth: 18 } : {})
      text('eyebrow', slide.eyebrow, { x: textX, y: 70, width: 690, height: 34 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, 'eyebrow')
      text('title', slide.title, { x: textX, y: 146, width: 700, height: 210 }, { color: INK, fontSize: 66, fontWeight: 700, lineHeight: 1.08 }, 'title')
      body({ x: textX, y: 390, width: 700, height: 150 }, { fontSize: 25 })
      ;(slide.bullets ?? []).forEach((item, index) => {
        const y = 588 + index * 54
        rect(`split-bullet-${index}`, { x: textX, y: y + 9, width: 12, height: 12 }, { fill: ACCENT })
        text(`split-item-${index}`, item, { x: textX + 30, y, width: 670, height: 42 }, { color: INK, fontSize: 23, fontWeight: 600, lineHeight: 1.35 }, `bullets.${index}`)
      })
      break
    }
    case 'comparison': {
      eyebrow()
      title(undefined, 64)
      const columns = slide.columns ?? []
      const gap = columns.length >= 3 ? 24 : 38
      const width = (1432 - gap * Math.max(0, columns.length - 1)) / Math.max(1, columns.length)
      const cardHeight = 390
      columns.forEach((column, index) => {
        const x = 88 + index * (width + gap)
        if (templateId === 'studio') {
          rect(`comparison-shadow-${index}`, { x: x + 12, y: 362, width, height: cardHeight }, { fill: index % 2 ? ACCENT : HIGHLIGHT })
        }
        rect(`comparison-card-${index}`, { x, y: 350, width, height: cardHeight }, {
          fill: templateId === 'editorial' ? 'transparent' : SURFACE,
          stroke: templateId === 'studio' ? INK : LINE,
          strokeWidth: templateId === 'studio' ? 3 : 1,
          radius: 0,
        })
        rect(`comparison-rule-${index}`, { x, y: 350, width, height: 8 }, { fill: index % 2 ? ACCENT_ALT : ACCENT })
        const inset = templateId === 'studio' ? 38 : 34
        text(`comparison-index-${index}`, String(index + 1).padStart(2, '0'), { x: x + inset, y: 382, width: width - inset * 2, height: 24 }, { color: MUTED, fontSize: 18, fontWeight: 800 })
        text(`comparison-title-${index}`, column.title, { x: x + inset, y: 438, width: width - inset * 2, height: 62 }, { color: INK, fontSize: columns.length >= 3 ? 34 : 42, fontWeight: 700, lineHeight: 1.15 }, `columns.${index}.title`)
        text(`comparison-body-${index}`, column.body, { x: x + inset, y: 520, width: width - inset * 2, height: 74 }, { color: MUTED, fontSize: columns.length >= 3 ? 20 : 22, lineHeight: 1.45 }, `columns.${index}.body`)
        line(`comparison-divider-${index}`, { x: x + inset, y: 614, width: width - inset * 2, height: 1 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        ;(column.bullets ?? []).forEach((item, bulletIndex) => text(`comparison-bullet-${index}-${bulletIndex}`, `+ ${item}`, { x: x + inset, y: 632 + bulletIndex * 28, width: width - inset * 2, height: 26 }, { color: INK, fontSize: 20, fontWeight: 700 }, `columns.${index}.bullets.${bulletIndex}`))
      })
      break
    }
    case 'chart': {
      text('eyebrow', slide.eyebrow, { x: 88, y: 64, width: 500, height: 34 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, 'eyebrow')
      text('title', slide.title, { x: 88, y: 148, width: 490, height: 258 }, { color: INK, fontSize: 62, fontWeight: 700, lineHeight: 1.08 }, 'title')
      body({ x: 88, y: 492, width: 470, height: 184 }, { fontSize: 24 })
      if (templateId !== 'signal') {
        rect('chart-panel', { x: 680, y: 140, width: 834, height: 630 }, { fill: SURFACE, stroke: templateId === 'studio' ? INK : undefined, strokeWidth: templateId === 'studio' ? 3 : undefined })
      }
      line('chart-axis', { x: 680, y: 140, width: 2, height: 630 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
      line('chart-baseline', { x: 680, y: 770, width: 834, height: 2 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
      text('chart-unit', slide.chart?.unit, { x: 1400, y: 158, width: 100, height: 32 }, { color: MUTED, fontSize: 18, fontWeight: 700, textAlign: 'right' }, 'chart.unit')
      const points = slide.chart?.points ?? []
      const max = Math.max(1, ...points.map(point => Math.abs(point.value)))
      points.forEach((point, index) => {
        const x = 730 + index * (730 / Math.max(1, points.length))
        const width = Math.max(32, 600 / Math.max(1, points.length))
        const height = Math.max(10, (Math.abs(point.value) / max) * 360)
        rect(`chart-bar-${index}`, { x, y: 650 - height, width, height }, { fill: index % 2 ? ACCENT_ALT : ACCENT })
        text(`chart-value-${index}`, point.value, { x, y: 610 - height, width, height: 32 }, { color: INK, fontSize: 24, fontWeight: 800, textAlign: 'center' }, `chart.points.${index}.value`)
        text(`chart-label-${index}`, point.label, { x: x - 12, y: 680, width: width + 24, height: 42 }, { color: MUTED, fontSize: 18, fontWeight: 700, textAlign: 'center' }, `chart.points.${index}.label`)
      })
      break
    }
    case 'timeline': {
      eyebrow()
      title(undefined, 64)
      const steps = slide.steps ?? []
      line('timeline-track', { x: 88, y: 480, width: 1432, height: 3 }, { fill: LINE, stroke: LINE, strokeWidth: 2 })
      const width = 1432 / Math.max(1, steps.length)
      steps.forEach((step, index) => {
        const x = 88 + index * width
        text(`timeline-label-${index}`, step.label, { x, y: 390, width: width - 24, height: 32 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, `steps.${index}.label`)
        add({ id: `${slide.id}:timeline-dot-${index}`, type: 'ellipse', x, y: 469, width: 22, height: 22, style: { fill: ACCENT_ALT, stroke: LINE, strokeWidth: 2, radius: templateId === 'studio' ? 11 : 0 } })
        text(`timeline-title-${index}`, step.title, { x, y: 538, width: width - 24, height: 62 }, { color: INK, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }, `steps.${index}.title`)
        text(`timeline-body-${index}`, step.body, { x, y: 616, width: width - 24, height: 70 }, { color: MUTED, fontSize: 19, lineHeight: 1.4 }, `steps.${index}.body`)
      })
      break
    }
    case 'gallery':
      eyebrow()
      title(undefined, 64)
      ;(slide.images ?? []).slice(0, 3).forEach((asset, index) => {
        const geometry: Box[] = templateId === 'editorial'
          ? [{ x: 88, y: 326, width: 425, height: 372 }, { x: 531, y: 326, width: 553, height: 372 }, { x: 1102, y: 326, width: 425, height: 372 }]
          : [{ x: 88, y: 326, width: 548, height: 372 }, { x: 654, y: 326, width: 424, height: 372 }, { x: 1096, y: 326, width: 424, height: 372 }]
        const box = geometry[index]
        if (!box) return
        image(`gallery-image-${index}`, asset, box, `images.${index}`, templateId === 'studio' ? { stroke: SURFACE, strokeWidth: 10 } : {})
        line(`gallery-line-${index}`, { x: box.x, y: box.y + box.height + 18, width: box.width, height: 1 }, { fill: LINE, stroke: LINE, strokeWidth: 1 })
        text(`gallery-caption-${index}`, asset.caption, { x: box.x, y: box.y + box.height + 30, width: box.width, height: 38 }, { color: INK, fontSize: 19, fontWeight: 700 }, `images.${index}.caption`)
      })
      break
    case 'quote':
      image('quote-image', slide.images?.[0], templateId === 'studio'
        ? { x: 1038, y: 120, width: 480, height: 640 }
        : templateId === 'editorial'
          ? { x: 1060, y: 70, width: 470, height: 690 }
          : { x: 1080, y: 0, width: 520, height: 900 }, 'images.0', templateId === 'studio' ? { stroke: SURFACE, strokeWidth: 18 } : {})
      text('eyebrow', slide.eyebrow, { x: 88, y: 64, width: 700, height: 34 }, { color: ACCENT, fontSize: 22, fontWeight: 800 }, 'eyebrow')
      text('quote-mark', '“', { x: 78, y: 132, width: 140, height: 160 }, { color: ACCENT, fontSize: 180, fontWeight: 700, fontFamily: 'Georgia' })
      text('quote', slide.quote, { x: 88, y: 270, width: 850, height: 340 }, { color: INK, fontSize: 66, fontWeight: 700, lineHeight: 1.18 }, 'quote')
      text('quote-by', `— ${slide.quoteBy ?? ''}`, { x: 88, y: 666, width: 700, height: 46 }, { color: MUTED, fontSize: 22, fontWeight: 700 }, 'quoteBy')
      break
    case 'closing':
      eyebrow()
      text('closing-number', 'END', { x: 780, y: 560, width: 520, height: 230 }, { color: BG_ALT, fontSize: 130, fontWeight: 900, textAlign: 'right' })
      text('title', slide.title, { x: 88, y: 246, width: 1180, height: 260 }, { color: INK, fontSize: 88, fontWeight: 700 }, 'title')
      text('body', slide.body, { x: 88, y: 590, width: 900, height: 82 }, { color: ACCENT, fontSize: 34, fontWeight: 700 }, 'body')
      break
  }

  return elements
}

export function ensureSlideElements(slide: SlideSpec, templateId: TemplateId): boolean {
  if (slide.elements !== undefined) return false
  slide.elements = createSlideElements(slide, templateId)
  return true
}

export function ensureDeckElements(deck: DeckSpec): boolean {
  let changed = false
  deck.slides.forEach(slide => { changed = ensureSlideElements(slide, deck.templateId) || changed })
  return changed
}

/** Refresh untouched generated bindings after semantic content or template assets change. */
export function refreshSlideElementBindings(slide: SlideSpec, templateId: TemplateId = 'signal'): boolean {
  if (!slide.elements?.length) return false
  let changed = false
  const agenda = slide.layout === 'agenda' ? getAgendaLayout(slide.bullets, templateId) : undefined
  slide.elements.forEach(element => {
    const agendaIndex = slide.layout === 'agenda' ? element.id.match(/:agenda-index-(\d+)$/) : null
    if (agendaIndex?.[1] !== undefined && element.path === `bullets.${agendaIndex[1]}`) {
      const index = Number(agendaIndex[1])
      const expectedText = String(index + 1).padStart(2, '0')
      const generatedText = slide.bullets?.[index]
      const looksGenerated = !element.userEdited || element.text === generatedText
      delete element.path
      changed = true
      if (looksGenerated) {
        const row = agenda?.rows[index]
        if (!row) return
        Object.assign(element, {
          ...row.indexBox,
          text: expectedText,
          userEdited: false,
        })
      }
    }
    if (element.userEdited || !element.path) return
    const value = getAtPath(slide, element.path)
    if (element.type === 'text' && (typeof value === 'string' || typeof value === 'number')) {
      const next = String(value)
      if (element.text !== next) {
        element.text = next
        changed = true
      }
    }
    if (element.type === 'image' && value && typeof value === 'object' && 'src' in value) {
      const image = value as { src?: unknown; alt?: unknown }
      if (typeof image.src === 'string' && element.src !== image.src) {
        element.src = image.src
        changed = true
      }
      if (typeof image.alt === 'string' && element.alt !== image.alt) {
        element.alt = image.alt
        changed = true
      }
    }
  })
  if (agenda) changed = refreshAgendaGeometry(slide, agenda) || changed
  return changed
}

function refreshAgendaGeometry(slide: SlideSpec, agenda: ReturnType<typeof getAgendaLayout>): boolean {
  if (!slide.elements?.length) return false
  let changed = false
  const update = (element: SlideElement | undefined, box: { x: number; y: number; width: number; height: number }, style?: ElementStyle) => {
    if (!element || element.userEdited) return
    if (element.x !== box.x || element.y !== box.y || element.width !== box.width || element.height !== box.height) {
      Object.assign(element, box)
      changed = true
    }
    if (style) {
      const nextStyle = { ...(element.style ?? {}), ...style }
      if (JSON.stringify(element.style ?? {}) !== JSON.stringify(nextStyle)) {
        element.style = nextStyle
        changed = true
      }
    }
  }
  agenda.rows.forEach((row, index) => {
    const prefix = `${slide.id}:agenda-`
    update(slide.elements?.find(element => element.id === `${prefix}row-bg-${index}`), row.backgroundBox)
    update(slide.elements?.find(element => element.id === `${prefix}line-${index}`), { x: agenda.x, y: row.lineY, width: agenda.width, height: 2 })
    update(slide.elements?.find(element => element.id === `${prefix}index-${index}`), row.indexBox, { fontSize: 20, fontWeight: 800 })
    update(slide.elements?.find(element => element.id === `${prefix}item-${index}`), row.textBox, { fontSize: agenda.fontSize, lineHeight: agenda.lineHeight })
  })
  update(slide.elements?.find(element => element.id === `${slide.id}:agenda-end`), { x: agenda.x, y: agenda.endY, width: agenda.width, height: 2 })
  return changed
}

/** Rebuild the generated portion when a user explicitly changes page layout. */
export function rebuildSlideElements(slide: SlideSpec, templateId: TemplateId): void {
  const previous = new Map((slide.elements ?? []).map(element => [element.id, element]))
  const generated = createSlideElements(slide, templateId).map(element => {
    const edited = previous.get(element.id)
    return edited?.userEdited ? { ...element, ...edited, path: element.path } : element
  })
  // Template-specific decorations (for example the Studio statement callout)
  // intentionally have no semantic path. They are still generated elements,
  // so do not append them a second time as custom objects after a rebuild.
  const generatedIds = new Set(generated.map(element => element.id))
  const custom = (slide.elements ?? []).filter(element => element.userEdited && !element.path && !generatedIds.has(element.id))
  slide.elements = [...generated, ...custom]
}

export interface ElementGeometry {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export function clampElementGeometry(geometry: ElementGeometry, minSize = 24): ElementGeometry {
  const width = Math.max(minSize, Math.min(1600, geometry.width))
  const height = Math.max(minSize, Math.min(900, geometry.height))
  return {
    ...geometry,
    width,
    height,
    x: Math.max(0, Math.min(1600 - width, geometry.x)),
    y: Math.max(0, Math.min(900 - height, geometry.y)),
    rotation: geometry.rotation === undefined ? 0 : Math.max(-360, Math.min(360, geometry.rotation)),
  }
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}
