import JSZip from 'jszip'
import pptxgen from '@jsamuel1/pptxgenjs'
import type { DeckSpec, ImageAsset, SlideElement, SlideSpec, TemplateDefinition, TweakState } from '@/domain/types'
import { getAtPath } from '@/domain/path'
import { getAgendaLayout } from '@/domain/agenda'
import { getTemplate } from '@/domain/templates'
import { resolveAssetUrl } from '@/utils/assets'
import { CANVAS, PPTX_WIDE, canvasToInches } from '@/domain/geometry'

type PptxInstance = InstanceType<typeof pptxgen>
type PptxSlide = ReturnType<PptxInstance['addSlide']>
type TextOptions = pptxgen.TextPropsOptions

const imageCache = new Map<string, Promise<string>>()

export interface PptxValidationIssue {
  code: string
  message: string
}

export interface PptxValidationReport {
  ok: boolean
  expectedSlides: number
  slideCount: number
  requiredParts: string[]
  nativeElements: {
    textShapes: number
    pictures: number
    charts: number
    mediaFiles: number
  }
  issues: PptxValidationIssue[]
}

export async function exportDeckToPptx(deck: DeckSpec): Promise<void> {
  const blob = await buildPptxBlob(deck)
  downloadBlob(blob, `${safeFileName(deck.title)}.pptx`)
}

export async function buildPptxBlob(deck: DeckSpec): Promise<Blob> {
  // A relative asset path can point to different files in different workspaces.
  // Keep reuse scoped to one export so a previous project cannot leak media into it.
  imageCache.clear()
  const pptx = new pptxgen()
  const template = applyTweaks(getTemplate(deck.templateId), deck.tweaks)
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'CreatPPT'
  pptx.company = 'CreatPPT'
  pptx.subject = 'Web-first presentation exported on demand'
  pptx.title = deck.title
  pptx.theme = {
    headFontFace: template.tokens.displayFont,
    bodyFontFace: template.tokens.bodyFont,
  }

  for (let index = 0; index < deck.slides.length; index += 1) {
    const spec = deck.slides[index]
    const slide = pptx.addSlide()
    slide.background = { color: color(template.tokens.background) }
    await renderSlide(pptx, slide, spec, template, index + 1)
    if (spec.notes) slide.addNotes(spec.notes)
  }

  const output = await pptx.write({ outputType: 'blob', compression: true })
  const blob = output instanceof Blob ? output : new Blob([output as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const validation = await inspectPptxBlob(blob, deck.slides.length)
  if (!validation.ok) {
    throw new Error(`PPTX 结构校验失败：${validation.issues.map(issue => issue.message).join('；')}`)
  }
  return blob
}

async function renderSlide(
  pptx: PptxInstance,
  slide: PptxSlide,
  spec: SlideSpec,
  template: TemplateDefinition,
  slideNumber: number,
) {
  addTemplateMarker(pptx, slide, template)

  if (spec.elements !== undefined) {
    if (spec.layout === 'chart' && spec.chart?.points?.length) addNativeChart(pptx, slide, spec.chart, template)
    await renderElements(pptx, slide, spec, template)
    addFooter(pptx, slide, spec.footer ?? '', slideNumber, template)
    return
  }

  switch (spec.layout) {
    case 'cover':
      await renderCover(pptx, slide, spec, template)
      break
    case 'agenda':
      renderAgenda(pptx, slide, spec, template)
      break
    case 'statement':
      renderStatement(pptx, slide, spec, template)
      break
    case 'metrics':
      renderMetrics(pptx, slide, spec, template)
      break
    case 'split':
      await renderSplit(pptx, slide, spec, template)
      break
    case 'comparison':
      renderComparison(pptx, slide, spec, template)
      break
    case 'chart':
      renderChart(pptx, slide, spec, template)
      break
    case 'timeline':
      renderTimeline(pptx, slide, spec, template)
      break
    case 'gallery':
      await renderGallery(pptx, slide, spec, template)
      break
    case 'quote':
      await renderQuote(pptx, slide, spec, template)
      break
    case 'closing':
      renderClosing(pptx, slide, spec, template)
      break
  }

  addFooter(pptx, slide, spec.footer ?? '', slideNumber, template)
}

async function renderElements(
  pptx: PptxInstance,
  slide: PptxSlide,
  spec: SlideSpec,
  template: TemplateDefinition,
) {
  const visible = (spec.elements ?? [])
    .filter(element => element.visible !== false)
    .filter(element => {
      if (element.type !== 'image' || !element.path) return true
      return Boolean(getAtPath(spec, element.path))
    })
    .filter(element => {
      // Native chart owns untouched generated bars/labels; a user-edited chart
      // element is retained as an overlay so its manual position still wins.
      if (spec.layout !== 'chart' || element.userEdited) return true
      return !/(^|:)chart-(axis|bar-|value-|label-)/.test(element.id)
    })
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  for (const element of visible) {
    const style = element.style ?? {}
    const fill = resolveElementColor(style.fill, template)
    const stroke = resolveElementColor(style.stroke, template)
    const transparency = opacityToTransparency(style.opacity)
    const box = {
      x: px(element.x),
      y: px(element.y),
      w: px(element.width),
      h: px(element.height),
    }

    if (element.type === 'text') {
      if (!element.text) continue
      slide.addText(element.text, {
        ...box,
        margin: 0,
        valign: 'middle',
        fit: 'shrink',
        fontFace: style.fontFamily || template.tokens.bodyFont,
        fontSize: Math.max(8, (style.fontSize ?? 24) * 0.75 * (template.fontScale ?? 1)),
        bold: (style.fontWeight ?? 400) >= 600,
        color: resolveElementColor(style.color, template) || color(template.tokens.ink),
        align: style.textAlign ?? 'left',
        breakLine: true,
        transparency,
        paraSpaceAfter: 0,
        rotate: element.rotation ?? 0,
      })
      continue
    }

    if (element.type === 'image') {
      if (!element.src) continue
      const data = await loadImageData(element.src)
      slide.addImage({
        data,
        ...box,
        sizing: { type: style.objectFit === 'contain' ? 'contain' : 'cover', w: box.w, h: box.h },
        altText: element.alt,
        rotate: element.rotation ?? 0,
        transparency,
      })
      if (stroke) {
        slide.addShape(pptx.ShapeType.rect, {
          ...box,
          rotate: element.rotation ?? 0,
          fill: { transparency: 100 },
          line: { color: stroke, width: Math.max(0.5, style.strokeWidth ?? 1), transparency },
        })
      }
      continue
    }

    if (element.type === 'line' || element.type === 'arrow') {
      slide.addShape('line', {
        x: box.x,
        y: px(element.y + element.height / 2),
        w: box.w,
        h: 0,
        rotate: element.rotation ?? 0,
        line: {
          color: stroke || fill || color(template.tokens.accent),
          width: Math.max(0.5, style.strokeWidth ?? 2),
          transparency,
          endArrowType: element.type === 'arrow' ? 'triangle' : 'none',
        },
      })
      continue
    }

    const shapeType = element.type === 'ellipse' ? pptx.ShapeType.ellipse : (style.radius ?? 0) > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect
    slide.addShape(shapeType, {
      ...box,
      rotate: element.rotation ?? 0,
      fill: fill ? { color: fill, transparency } : { transparency: 100 },
      line: stroke
        ? { color: stroke, width: Math.max(0.5, style.strokeWidth ?? 1), transparency }
        : { transparency: 100 },
    })
  }
}

function resolveElementColor(value: string | undefined, template: TemplateDefinition): string | undefined {
  if (!value) return undefined
  const tokens: Record<string, string> = {
    'var(--slide-bg)': template.tokens.background,
    'var(--slide-bg-alt)': template.tokens.backgroundAlt,
    'var(--slide-ink)': template.tokens.ink,
    'var(--slide-muted)': template.tokens.muted,
    'var(--slide-surface)': template.tokens.surface,
    'var(--slide-line)': template.tokens.line,
    'var(--slide-accent)': template.tokens.accent,
    'var(--slide-accent-alt)': template.tokens.accentAlt,
    'var(--slide-highlight)': template.tokens.highlight,
  }
  const resolved = tokens[value] ?? value
  if (resolved === 'transparent' || resolved === 'none') return undefined
  if (/^#[0-9a-f]{3}$/i.test(resolved)) {
    const [r, g, b] = resolved.slice(1).split('')
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return resolved.replace(/^#/, '').toUpperCase()
}

function opacityToTransparency(opacity: number | undefined): number {
  if (opacity === undefined || !Number.isFinite(opacity)) return 0
  return Math.max(0, Math.min(100, Math.round((1 - opacity) * 100)))
}

function addTemplateMarker(pptx: PptxInstance, slide: PptxSlide, template: TemplateDefinition) {
  if (template.id === 'signal') {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: px(24), h: px(210), line: { transparency: 100 }, fill: { color: color(template.tokens.accent) } })
  }
  else if (template.id === 'editorial') {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PPTX_WIDE.widthIn, h: px(12), line: { transparency: 100 }, fill: { color: color(template.tokens.accent) } })
  }
  else {
    slide.addShape(pptx.ShapeType.rect, { x: px(CANVAS.width - 164), y: px(54), w: px(164), h: px(28), line: { transparency: 100 }, fill: { color: color(template.tokens.accentAlt) } })
  }
}

async function renderCover(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  if (template.id === 'studio') {
    await addImage(slide, spec.images?.[0], 0, 576, 1600, 324)
    shape(pptx, slide, 1080, 548, 520, 28, template.tokens.accent)
    eyebrow(slide, spec.eyebrow, 88, 78, 700, template)
    text(slide, spec.title, 88, 152, 1320, 270, template, { fontSize: 48, bold: true, breakLine: false })
    text(slide, spec.subtitle, 88, 438, 1160, 86, template, { fontSize: 21, color: color(template.tokens.muted) })
    return
  }

  const imageX = template.id === 'editorial' ? 978 : 980
  const imageY = template.id === 'editorial' ? 72 : 0
  const imageW = template.id === 'editorial' ? 560 : 620
  const imageH = template.id === 'editorial' ? 580 : 900
  await addImage(slide, spec.images?.[0], imageX, imageY, imageW, imageH)
  if (template.id === 'editorial') shape(pptx, slide, 978, 652, 560, 42, template.tokens.accent)
  else shape(pptx, slide, 940, 0, 40, 900, template.tokens.accentAlt)
  eyebrow(slide, spec.eyebrow, 88, 78, 720, template)
  text(slide, spec.title, 88, 174, template.id === 'editorial' ? 820 : 800, 420, template, {
    fontSize: template.id === 'editorial' ? 50 : 55,
    bold: true,
  })
  text(slide, spec.subtitle, 88, 628, 760, 126, template, { fontSize: 20, color: color(template.tokens.muted) })
}

function renderAgenda(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  eyebrow(slide, spec.eyebrow, 88, 64, 600, template)
  text(slide, spec.title, 88, 132, 720, 220, template, { fontSize: 43, bold: true })
  const items = spec.bullets ?? []
  const agenda = getAgendaLayout(items, template.id)
  agenda.rows.forEach((row, index) => {
    line(slide, agenda.x, row.lineY, agenda.width, template.tokens.line, 1.5)
    text(slide, String(index + 1).padStart(2, '0'), row.indexBox.x, row.indexBox.y, row.indexBox.width, row.indexBox.height, template, { fontSize: 13, bold: true, color: color(template.tokens.accent) })
    text(slide, items[index], row.textBox.x, row.textBox.y, row.textBox.width, row.textBox.height, template, { fontSize: agenda.fontSize * 0.67, bold: true })
  })
  if (agenda.rows.length) line(slide, agenda.x, agenda.endY, agenda.width, template.tokens.line, 1.5)
}

function renderStatement(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  eyebrow(slide, spec.eyebrow, 88, 64, 600, template)
  shape(pptx, slide, 88, 166, template.id === 'editorial' ? 300 : 150, template.id === 'editorial' ? 8 : 18, template.id === 'editorial' ? template.tokens.accent : template.tokens.accentAlt)
  text(slide, spec.title, 88, 226, template.id === 'studio' ? 1180 : 1360, 350, template, { fontSize: 54, bold: true })
  if (template.id === 'studio') {
    shape(pptx, slide, 88, 560, 1040, 180, template.tokens.accentAlt)
    text(slide, spec.body, 120, 586, 976, 132, template, { fontSize: 17, color: 'FFFFFF' })
  }
  else text(slide, spec.body, 760, 620, 700, 134, template, { fontSize: 17, color: color(template.tokens.muted) })
}

function renderMetrics(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  standardTitle(slide, spec, template)
  const stats = spec.stats ?? []
  const areaX = 88
  const areaW = 1432
  const cellW = areaW / Math.max(1, stats.length)
  line(slide, areaX, 350, areaW, template.tokens.line, 1.5)
  line(slide, areaX, 700, areaW, template.tokens.line, 1.5)
  stats.forEach((stat, index) => {
    const x = areaX + index * cellW
    if (template.id === 'studio') {
      slide.addShape(pptx.ShapeType.rect, {
        x: px(x + 8), y: px(350), w: px(cellW - 16), h: px(350),
        line: { color: color(template.tokens.line), width: 1.5 }, fill: { color: color(template.tokens.surface) },
      })
    }
    else if (index > 0) lineVertical(slide, x, 350, 350, template.tokens.line, 1.5)
    text(slide, String(index + 1).padStart(2, '0'), x + 28, 382, cellW - 56, 24, template, { fontSize: 11, bold: true, color: color(template.tokens.accentAlt) })
    text(slide, stat.value, x + 28, 448, cellW - 56, 86, template, { fontSize: 43, bold: true, color: color(template.id === 'studio' ? template.tokens.accentAlt : template.tokens.accent) })
    text(slide, stat.label, x + 28, 564, cellW - 56, 58, template, { fontSize: 17, bold: true })
    text(slide, stat.detail, x + 28, 632, cellW - 56, 44, template, { fontSize: 12, color: color(template.tokens.muted) })
  })
}

async function renderSplit(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  const imageX = template.id === 'signal' ? 0 : template.id === 'editorial' ? 62 : 88
  const imageY = template.id === 'signal' ? 0 : template.id === 'editorial' ? 74 : 104
  const imageW = template.id === 'signal' ? 700 : template.id === 'editorial' ? 650 : 630
  const imageH = template.id === 'signal' ? 900 : template.id === 'editorial' ? 700 : 670
  if (template.id === 'studio') shape(pptx, slide, imageX - 18, imageY - 18, imageW + 36, imageH + 36, template.tokens.surface)
  await addImage(slide, spec.images?.[0], imageX, imageY, imageW, imageH)
  const offset = template.id === 'signal' ? 700 : template.id === 'editorial' ? 750 : 760
  eyebrow(slide, spec.eyebrow, offset + 80, 70, 690, template)
  text(slide, spec.title, offset + 80, 146, 700, 210, template, { fontSize: 40, bold: true })
  text(slide, spec.body, offset + 80, 390, 700, 150, template, { fontSize: 16, color: color(template.tokens.muted) })
  ;(spec.bullets ?? []).slice(0, 5).forEach((item, index) => {
    shape(pptx, slide, offset + 80, 594 + index * 44, 12, 12, template.tokens.accent)
    text(slide, item, offset + 112, 582 + index * 44, 660, 38, template, { fontSize: 14, bold: true })
  })
}

function renderComparison(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  standardTitle(slide, spec, template)
  const columns = spec.columns ?? []
  const gap = 38
  const width = (1432 - gap * Math.max(0, columns.length - 1)) / Math.max(1, columns.length)
  columns.forEach((column, index) => {
    const x = 88 + index * (width + gap)
    slide.addShape(pptx.ShapeType.rect, {
      x: px(x), y: px(350), w: px(width), h: px(360),
      line: { color: color(template.id === 'studio' ? template.tokens.ink : template.tokens.line), width: template.id === 'studio' ? 2 : 1 },
      fill: { color: color(template.id === 'editorial' ? template.tokens.background : template.tokens.backgroundAlt) },
    })
    shape(pptx, slide, x, 350, width, 8, index % 2 ? template.tokens.accentAlt : template.tokens.accent)
    text(slide, String(index + 1).padStart(2, '0'), x + 34, 382, width - 68, 24, template, { fontSize: 11, bold: true, color: color(template.tokens.muted) })
    text(slide, column.title, x + 34, 438, width - 68, 62, template, { fontSize: 26, bold: true })
    text(slide, column.body, x + 34, 520, width - 68, 74, template, { fontSize: 14, color: color(template.tokens.muted) })
    line(slide, x + 34, 614, width - 68, template.tokens.line, 1)
    text(slide, (column.bullets ?? []).map(item => `+ ${item}`).join('\n'), x + 34, 632, width - 68, 68, template, { fontSize: 13, bold: true, breakLine: true })
  })
}

function renderChart(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  eyebrow(slide, spec.eyebrow, 88, 64, 500, template)
  text(slide, spec.title, 88, 148, 490, 258, template, { fontSize: 37, bold: true })
  text(slide, spec.body, 88, 492, 470, 184, template, { fontSize: 15, color: color(template.tokens.muted) })
  lineVertical(slide, 680, 140, 630, template.tokens.line, 1.5)
  if (!spec.chart?.points.length) return
  addNativeChart(pptx, slide, spec.chart, template)
}

function addNativeChart(pptx: PptxInstance, slide: PptxSlide, chart: NonNullable<SlideSpec['chart']>, template: TemplateDefinition) {
  const points = chart.points
  slide.addChart(pptx.ChartType.bar, [{
    name: chart.unit || 'Value',
    labels: points.map(point => point.label),
    values: points.map(point => point.value),
  }], {
    x: px(730), y: px(160), w: px(760), h: px(540),
    catAxisLabelFontFace: template.tokens.bodyFont,
    catAxisLabelFontSize: 12,
    catAxisLabelColor: color(template.tokens.muted),
    valAxisLabelFontFace: template.tokens.bodyFont,
    valAxisLabelFontSize: 10,
    valAxisLabelColor: color(template.tokens.muted),
    showLegend: false,
    showTitle: false,
    showValue: true,
    chartColors: [color(template.tokens.accent), color(template.tokens.accentAlt)],
    showValAxisTitle: false,
    showCatAxisTitle: false,
    showPercent: false,
    showSerName: false,
    valGridLine: { color: color(template.tokens.line), size: 1 },
    chartArea: { border: { color: color(template.tokens.line), pt: 1 } },
  })
}

function renderTimeline(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  standardTitle(slide, spec, template)
  const steps = spec.steps ?? []
  line(slide, 88, 480, 1432, template.tokens.line, 2)
  const width = 1432 / Math.max(1, steps.length)
  steps.forEach((step, index) => {
    const x = 88 + index * width
    text(slide, step.label, x, 390, width - 24, 32, template, { fontSize: 14, bold: true, color: color(template.tokens.accent) })
    slide.addShape(pptx.ShapeType.ellipse, {
      x: px(x), y: px(469), w: px(22), h: px(22),
      line: { color: color(template.tokens.line), width: 1 }, fill: { color: color(template.tokens.accentAlt) },
    })
    text(slide, step.title, x, 538, width - 24, 62, template, { fontSize: 18, bold: true })
    text(slide, step.body, x, 616, width - 24, 70, template, { fontSize: 12, color: color(template.tokens.muted) })
  })
}

async function renderGallery(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  standardTitle(slide, spec, template)
  const images = (spec.images ?? []).slice(0, 3)
  const geometries = template.id === 'editorial'
    ? [[88, 326, 414, 372], [520, 326, 538, 372], [1076, 326, 444, 372]]
    : [[88, 326, 548, 372], [654, 326, 424, 372], [1096, 326, 424, 372]]
  for (let index = 0; index < images.length; index += 1) {
    const [x, y, w, h] = geometries[index]
    if (template.id === 'studio') shape(pptx, slide, x - 10, y - 10, w + 20, h + 20, template.tokens.surface)
    await addImage(slide, images[index], x, y, w, h)
    line(slide, x, y + h + 18, w, template.tokens.line, 1.5)
    text(slide, images[index].caption, x, y + h + 30, w, 38, template, { fontSize: 12, bold: true })
  }
}

async function renderQuote(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  const x = template.id === 'signal' ? 1080 : template.id === 'editorial' ? 1060 : 1038
  const y = template.id === 'signal' ? 0 : template.id === 'editorial' ? 70 : 120
  const w = template.id === 'signal' ? 520 : template.id === 'editorial' ? 470 : 480
  const h = template.id === 'signal' ? 900 : template.id === 'editorial' ? 690 : 640
  if (template.id === 'studio') shape(pptx, slide, x - 18, y - 18, w + 36, h + 36, template.tokens.surface)
  await addImage(slide, spec.images?.[0], x, y, w, h)
  eyebrow(slide, spec.eyebrow, 88, 64, 700, template)
  text(slide, '“', 78, 132, 140, 160, template, { fontSize: 100, bold: true, color: color(template.tokens.accent), fontFace: 'Georgia' })
  text(slide, spec.quote, 88, 270, 850, 340, template, { fontSize: 40, bold: true })
  text(slide, `— ${spec.quoteBy ?? ''}`, 88, 666, 700, 46, template, { fontSize: 14, bold: true, color: color(template.tokens.muted) })
}

function renderClosing(pptx: PptxInstance, slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  eyebrow(slide, spec.eyebrow, 88, 64, 600, template)
  text(slide, 'END', 780, 560, 520, 230, template, { fontSize: 130, bold: true, color: color(template.tokens.backgroundAlt), align: 'right' })
  text(slide, spec.title, 88, 246, 1180, 260, template, { fontSize: 52, bold: true })
  text(slide, spec.body, 88, 590, 900, 82, template, { fontSize: 23, bold: true, color: color(template.tokens.accent) })
}

function standardTitle(slide: PptxSlide, spec: SlideSpec, template: TemplateDefinition) {
  eyebrow(slide, spec.eyebrow, 88, 64, 680, template)
  text(slide, spec.title, 88, 124, 1320, 170, template, { fontSize: 39, bold: true })
}

function eyebrow(slide: PptxSlide, value: string | undefined, x: number, y: number, w: number, template: TemplateDefinition) {
  text(slide, value, x, y, w, 34, template, { fontSize: 13, bold: true, color: color(template.tokens.accent), charSpacing: 0 })
}

function addFooter(pptx: PptxInstance, slide: PptxSlide, footer: string, number: number, template: TemplateDefinition) {
  line(slide, 88, 824, 1452, template.tokens.line, 0.8)
  text(slide, footer, 88, 842, 900, 28, template, { fontSize: 10, bold: true, color: color(template.tokens.muted) })
  text(slide, String(number).padStart(2, '0'), 1450, 842, 90, 28, template, { fontSize: 10, bold: true, color: color(template.tokens.muted), align: 'right' })
}

function text(
  slide: PptxSlide,
  value: string | number | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  template: TemplateDefinition,
  options: TextOptions = {},
) {
  if (value === undefined || value === '') return
  const fontScale = template.fontScale ?? 1
  const requestedFontSize = Number(options.fontSize ?? 18)
  slide.addText(String(value), {
    x: px(x), y: px(y), w: px(w), h: px(h),
    margin: 0,
    valign: 'middle',
    fit: 'shrink',
    fontFace: template.tokens.bodyFont,
    color: color(template.tokens.ink),
    breakLine: false,
    ...options,
    fontSize: requestedFontSize * fontScale,
  })
}

function applyTweaks(template: TemplateDefinition, tweaks?: TweakState): TemplateDefinition {
  if (!tweaks) return template
  const tokens = template.tokens
  let accent = tokens.accent
  let accentAlt = tokens.accentAlt
  if (tweaks.accentMode === 'warm') {
    accent = tokens.accentAlt
    accentAlt = tokens.accent
  }
  else if (tweaks.accentMode === 'cool') {
    accent = tokens.highlight
    accentAlt = tokens.accent
  }
  return {
    ...template,
    fontScale: tweaks.fontScale,
    tokens: { ...tokens, accent, accentAlt },
  }
}

function shape(pptx: PptxInstance, slide: PptxSlide, x: number, y: number, w: number, h: number, fill: string) {
  slide.addShape(pptx.ShapeType.rect, {
    x: px(x), y: px(y), w: px(w), h: px(h),
    line: { transparency: 100 }, fill: { color: color(fill) },
  })
}

function line(slide: PptxSlide, x: number, y: number, w: number, stroke: string, width: number) {
  slide.addShape('line', { x: px(x), y: px(y), w: px(w), h: 0, line: { color: color(stroke), width } })
}

function lineVertical(slide: PptxSlide, x: number, y: number, h: number, stroke: string, width: number) {
  slide.addShape('line', { x: px(x), y: px(y), w: 0, h: px(h), line: { color: color(stroke), width } })
}

async function addImage(slide: PptxSlide, image: ImageAsset | undefined, x: number, y: number, w: number, h: number) {
  if (!image?.src) return
  const data = await loadImageData(image.src)
  slide.addImage({
    data,
    x: px(x), y: px(y), w: px(w), h: px(h),
    sizing: { type: 'cover', w: px(w), h: px(h) },
    altText: image.alt,
  })
}

function loadImageData(source: string): Promise<string> {
  const cached = imageCache.get(source)
  if (cached) return cached
  const promise = fetchImageData(source)
  imageCache.set(source, promise)
  return promise
}

async function fetchImageData(source: string): Promise<string> {
  const response = await fetch(resolveAssetUrl(source))
  if (!response.ok) throw new Error(`无法读取导出图片：${source}`)
  const blob = await response.blob()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
    throw new Error(`不支持的图片格式：${blob.type || 'unknown'}`)
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!isAllowedImage(bytes, blob.type)) throw new Error('图片内容与声明格式不一致。')
  return blobToDataUrl(new Blob([bytes], { type: blob.type }))
}

function isAllowedImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/webp') return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片。'))
    reader.readAsDataURL(blob)
  })
}

export async function inspectPptxBlob(blob: Blob, expectedSlides: number): Promise<PptxValidationReport> {
  const required = ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels']
  const issues: PptxValidationIssue[] = []
  const nativeElements = { textShapes: 0, pictures: 0, charts: 0, mediaFiles: 0 }
  try {
    const zip = await JSZip.loadAsync(blob)
    const files = new Set(Object.keys(zip.files).filter(path => !zip.files[path].dir))
    const missing = required.filter(path => !files.has(path))
    missing.forEach(path => issues.push({ code: 'PPTX_PART_MISSING', message: `导出文件缺少 ${path}。` }))

    const slides = [...files].filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    if (slides.length !== expectedSlides) {
      issues.push({ code: 'PPTX_SLIDE_COUNT', message: `导出页数异常：${slides.length}/${expectedSlides}。` })
    }

    const contentTypes = await readZipText(zip, '[Content_Types].xml')
    if (contentTypes && !/<Types\b/i.test(contentTypes)) {
      issues.push({ code: 'PPTX_CONTENT_TYPES_INVALID', message: '[Content_Types].xml 缺少 Types 根节点。' })
    }
    if (contentTypes) {
      const declaredSlides = [...contentTypes.matchAll(/PartName="\/ppt\/slides\/slide\d+\.xml"/g)].length
      if (declaredSlides !== slides.length) {
        issues.push({ code: 'PPTX_CONTENT_TYPES_DRIFT', message: `Content Types 页面声明与实际文件不一致：${declaredSlides}/${slides.length}。` })
      }
    }

    const media = [...files].filter(path => /^ppt\/media\//.test(path))
    nativeElements.mediaFiles = media.length
    for (const mediaPath of media) {
      const file = zip.file(mediaPath)
      if (!file) continue
      const bytes = await file.async('uint8array')
      if (!validMediaSignature(mediaPath, bytes)) {
        issues.push({ code: 'PPTX_MEDIA_SIGNATURE_INVALID', message: `媒体文件内容与扩展名不匹配：${mediaPath}。` })
      }
    }

    const slideXml = await Promise.all(slides.map(path => readZipText(zip, path)))
    const joinedSlides = slideXml.filter((value): value is string => Boolean(value)).join('\n')
    nativeElements.textShapes = countXmlElements(joinedSlides, 'p:sp')
    nativeElements.pictures = countXmlElements(joinedSlides, 'p:pic')
    nativeElements.charts = countXmlElements(joinedSlides, 'c:chart')

    const presentation = await readZipText(zip, 'ppt/presentation.xml')
    if (presentation && !/<p:presentation\b/i.test(presentation)) {
      issues.push({ code: 'PPTX_PRESENTATION_INVALID', message: 'ppt/presentation.xml 缺少 presentation 根节点。' })
    }
    const presentationRels = await readZipText(zip, 'ppt/_rels/presentation.xml.rels')
    if (presentationRels) {
      for (const match of presentationRels.matchAll(/Target="([^"]+)"/g)) {
        if (/^(?:https?:|mailto:)/i.test(match[1])) continue
        const target = resolveZipTarget('ppt', match[1])
        if (!files.has(target) && !target.startsWith('ppt/slideMasters/')) {
          issues.push({ code: 'PPTX_RELATIONSHIP_DANGLING', message: `关系目标不存在：${target}。` })
        }
      }
    }

    for (const slidePath of slides) {
      const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/'))
      const slideName = slidePath.slice(slidePath.lastIndexOf('/') + 1, -'.xml'.length)
      const slideRels = `${slideDir}/_rels/${slideName}.xml.rels`
      if (!files.has(slideRels)) continue
      const relationships = await readZipText(zip, slideRels)
      if (!relationships) continue
      for (const match of relationships.matchAll(/Target="([^"]+)"/g)) {
        if (/^(?:https?:|mailto:)/i.test(match[1])) continue
        const target = resolveZipTarget(slidePath.slice(0, slidePath.lastIndexOf('/')), match[1])
        if (!files.has(target)) {
          issues.push({ code: 'PPTX_SLIDE_RELATIONSHIP_DANGLING', message: `页面关系目标不存在：${target}。` })
        }
      }
    }

    return { ok: issues.length === 0, expectedSlides, slideCount: slides.length, requiredParts: required, nativeElements, issues }
  }
  catch (error) {
    issues.push({ code: 'PPTX_ZIP_INVALID', message: error instanceof Error ? error.message : '无法读取 PPTX 压缩包。' })
    return { ok: false, expectedSlides, slideCount: 0, requiredParts: required, nativeElements, issues }
  }
}

function countXmlElements(xml: string, name: string): number {
  return [...xml.matchAll(new RegExp(`<${name}\\b`, 'g'))].length
}

function validMediaSignature(path: string, bytes: Uint8Array): boolean {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (extension === '.png') return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (extension === '.jpg' || extension === '.jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (extension === '.webp') return bytes.length > 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return true
}

async function readZipText(zip: JSZip, path: string): Promise<string | undefined> {
  const file = zip.file(path)
  return file ? file.async('text') : undefined
}

function resolveZipTarget(baseDir: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : `${baseDir}/${target}`).split('/')
  const normalized: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') normalized.pop()
    else normalized.push(part)
  }
  return normalized.join('/')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function safeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) || 'presentation'
}

function color(value: string): string {
  return value.replace(/^#/, '').toUpperCase()
}

function px(value: number): number {
  return canvasToInches(value)
}
