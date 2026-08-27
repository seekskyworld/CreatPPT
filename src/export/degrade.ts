import pptxgen from '@jsamuel1/pptxgenjs'
import type { SlideElement, SlideElementType, TemplateDefinition } from '@/domain/types'
import { computeTableMatrix } from '@/utils/formula'
import { loadImageData } from './media'

export type PptxInstance = InstanceType<typeof pptxgen>
export type PptxSlide = ReturnType<PptxInstance['addSlide']>

export interface BoxInches {
  x: number
  y: number
  w: number
  h: number
}

export type DegradeFunction = (
  pptx: PptxInstance,
  slide: PptxSlide,
  element: SlideElement,
  template: TemplateDefinition,
  box: BoxInches,
) => Promise<void> | void

export function resolveColor(value: string | undefined, template: TemplateDefinition): string | undefined {
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

export function opacityToTransparency(opacity: number | undefined): number {
  if (opacity === undefined || !Number.isFinite(opacity)) return 0
  return Math.max(0, Math.min(100, Math.round((1 - opacity) * 100)))
}

export const defaultDegradeStrategy: Record<SlideElementType, DegradeFunction> = {
  text: (_pptx, slide, element, template, box) => {
    if (!element.text) return
    const style = element.style ?? {}
    const colorVal = resolveColor(style.color, template) || template.tokens.ink.replace(/^#/, '').toUpperCase()
    const transparency = opacityToTransparency(style.opacity)

    const hyperlink = element.action
      ? element.action.type === 'slideJump'
        ? { slide: Number(element.action.target) || 1 }
        : { url: String(element.action.target) }
      : undefined

    slide.addText(element.text, {
      ...box,
      margin: 0,
      valign: 'middle',
      fit: 'shrink',
      fontFace: style.fontFamily || template.tokens.bodyFont,
      fontSize: Math.max(8, (style.fontSize ?? 24) * 0.75 * (template.fontScale ?? 1)),
      bold: (style.fontWeight ?? 400) >= 600,
      color: colorVal,
      align: style.textAlign ?? 'left',
      breakLine: true,
      transparency,
      rotate: element.rotation ?? 0,
      hyperlink,
    })
  },

  image: async (_pptx, slide, element, template, box) => {
    if (!element.src) return
    const transparency = opacityToTransparency(element.style?.opacity)
    const stroke = resolveColor(element.style?.stroke, template)
    try {
      const data = await loadImageData(element.src)
      const hyperlink = element.action
        ? element.action.type === 'slideJump'
          ? { slide: Number(element.action.target) || 1 }
          : { url: String(element.action.target) }
        : undefined

      slide.addImage({
        data,
        ...box,
        sizing: { type: element.style?.objectFit === 'contain' ? 'contain' : 'cover', w: box.w, h: box.h },
        altText: element.alt,
        rotate: element.rotation ?? 0,
        transparency,
        hyperlink,
      })
    } catch {
      // Fallback placeholder shape
      slide.addShape(_pptx.ShapeType.rect, {
        ...box,
        fill: { color: resolveColor('var(--slide-surface)', template) || 'F0F0F0' },
        line: { color: resolveColor('var(--slide-line)', template) || 'CCCCCC', width: 1 },
      })
    }
  },

  rect: (_pptx, slide, element, template, box) => {
    const style = element.style ?? {}
    const fill = resolveColor(style.fill, template)
    const stroke = resolveColor(style.stroke, template)
    const transparency = opacityToTransparency(style.opacity)
    const shapeType = (style.radius ?? 0) > 0 ? _pptx.ShapeType.roundRect : _pptx.ShapeType.rect

    const hyperlink = element.action
      ? element.action.type === 'slideJump'
        ? { slide: Number(element.action.target) || 1 }
        : { url: String(element.action.target) }
      : undefined

    slide.addShape(shapeType, {
      ...box,
      rotate: element.rotation ?? 0,
      fill: fill ? { color: fill, transparency } : { transparency: 100 },
      line: stroke
        ? { color: stroke, width: Math.max(0.5, style.strokeWidth ?? 1), transparency }
        : { transparency: 100 },
      hyperlink,
    })
  },

  ellipse: (_pptx, slide, element, template, box) => {
    const style = element.style ?? {}
    const fill = resolveColor(style.fill, template)
    const stroke = resolveColor(style.stroke, template)
    const transparency = opacityToTransparency(style.opacity)

    const hyperlink = element.action
      ? element.action.type === 'slideJump'
        ? { slide: Number(element.action.target) || 1 }
        : { url: String(element.action.target) }
      : undefined

    slide.addShape(_pptx.ShapeType.ellipse, {
      ...box,
      rotate: element.rotation ?? 0,
      fill: fill ? { color: fill, transparency } : { transparency: 100 },
      line: stroke
        ? { color: stroke, width: Math.max(0.5, style.strokeWidth ?? 1), transparency }
        : { transparency: 100 },
      hyperlink,
    })
  },

  line: (_pptx, slide, element, template, box) => {
    const style = element.style ?? {}
    const fill = resolveColor(style.fill, template)
    const stroke = resolveColor(style.stroke, template)
    const transparency = opacityToTransparency(style.opacity)

    slide.addShape('line', {
      x: box.x,
      y: box.y + box.h / 2,
      w: box.w,
      h: 0,
      rotate: element.rotation ?? 0,
      line: {
        color: stroke || fill || resolveColor('var(--slide-accent)', template) || '0066FF',
        width: Math.max(0.5, style.strokeWidth ?? 2),
        transparency,
      },
    })
  },

  arrow: (_pptx, slide, element, template, box) => {
    const style = element.style ?? {}
    const fill = resolveColor(style.fill, template)
    const stroke = resolveColor(style.stroke, template)
    const transparency = opacityToTransparency(style.opacity)

    slide.addShape('line', {
      x: box.x,
      y: box.y + box.h / 2,
      w: box.w,
      h: 0,
      rotate: element.rotation ?? 0,
      line: {
        color: stroke || fill || resolveColor('var(--slide-accent)', template) || '0066FF',
        width: Math.max(0.5, style.strokeWidth ?? 2),
        transparency,
        endArrowType: 'triangle',
      },
    })
  },

  table: (_pptx, slide, element, template, box) => {
    if (!element.table) return
    const { headers, rows, formulas } = element.table
    const computedMatrix = computeTableMatrix(headers || [], rows || [], formulas)

    const tableRows: pptxgen.TableCell[][] = []

    if (headers && headers.length > 0) {
      const headerRow: pptxgen.TableCell[] = headers.map(h => ({
        text: h,
        options: {
          bold: true,
          fill: { color: resolveColor('var(--slide-bg-alt)', template) || 'F0F0F0' },
          color: resolveColor('var(--slide-ink)', template) || '000000',
          fontFace: template.tokens.bodyFont,
          fontSize: 11,
        },
      }))
      tableRows.push(headerRow)
    }

    computedMatrix.forEach(row => {
      const rowCells: pptxgen.TableCell[] = row.map(cellVal => ({
        text: String(cellVal ?? ''),
        options: {
          fontFace: template.tokens.bodyFont,
          fontSize: 10,
          color: resolveColor('var(--slide-ink)', template) || '000000',
        },
      }))
      tableRows.push(rowCells)
    })

    if (tableRows.length > 0) {
      slide.addTable(tableRows, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        border: { pt: 1, color: resolveColor('var(--slide-line)', template) || 'CCCCCC' },
      })
    }
  },

  chart: (_pptx, slide, element, template, box) => {
    if (!element.chart || !element.chart.points.length) return
    const chart = element.chart
    const points = chart.points
    const typeStr = chart.chartType || chart.type || 'bar'

    let chartTypeEnum: pptxgen.CHART_NAME = _pptx.ChartType.bar
    if (typeStr === 'pie') chartTypeEnum = _pptx.ChartType.pie
    else if (typeStr === 'line') chartTypeEnum = _pptx.ChartType.line
    else if (typeStr === 'scatter') chartTypeEnum = _pptx.ChartType.scatter
    else if (typeStr === 'area') chartTypeEnum = _pptx.ChartType.area

    slide.addChart(chartTypeEnum, [{
      name: chart.unit || 'Value',
      labels: points.map(p => p.label),
      values: points.map(p => p.value),
    }], {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      catAxisLabelFontFace: template.tokens.bodyFont,
      catAxisLabelFontSize: 10,
      catAxisLabelColor: resolveColor('var(--slide-muted)', template) || '666666',
      valAxisLabelFontFace: template.tokens.bodyFont,
      valAxisLabelFontSize: 9,
      valAxisLabelColor: resolveColor('var(--slide-muted)', template) || '666666',
      showLegend: false,
      showTitle: false,
      showValue: true,
      chartColors: [
        resolveColor('var(--slide-accent)', template) || '0066FF',
        resolveColor('var(--slide-accent-alt)', template) || 'FF6600',
      ],
    })
  },

  form: (_pptx, slide, element, template, box) => {
    if (!element.form) return
    const fields = element.form.fields || []
    const lines = fields.map(f => `${f.label}: [________________]`)
    const textContent = `[FORM]\n${lines.join('\n')}`

    slide.addText(textContent, {
      ...box,
      margin: 8,
      valign: 'top',
      fontFace: template.tokens.bodyFont,
      fontSize: 10,
      color: resolveColor('var(--slide-ink)', template) || '000000',
      fill: { color: resolveColor('var(--slide-surface)', template) || 'FAFAFA' },
      line: { color: resolveColor('var(--slide-line)', template) || 'CCCCCC', width: 1 },
    })
  },

  embed: async (_pptx, slide, element, template, box) => {
    if (!element.embed) return
    const { url, fallbackImage } = element.embed
    if (fallbackImage) {
      try {
        const data = await loadImageData(fallbackImage)
        slide.addImage({
          data,
          ...box,
          sizing: { type: 'cover', w: box.w, h: box.h },
          hyperlink: url ? { url } : undefined,
        })
        return
      } catch {
        // Fall back to text link
      }
    }

    slide.addText(`🔗 Embed: ${url}`, {
      ...box,
      margin: 8,
      valign: 'middle',
      align: 'center',
      fontFace: template.tokens.bodyFont,
      fontSize: 11,
      color: resolveColor('var(--slide-accent)', template) || '0066FF',
      fill: { color: resolveColor('var(--slide-surface)', template) || 'F0F0F0' },
      line: { color: resolveColor('var(--slide-line)', template) || 'CCCCCC', width: 1 },
      hyperlink: url ? { url } : undefined,
    })
  },

  animation: (_pptx, _slide, _element, _template, _box) => {
    // Animation elements are handled via PPTX post-processing XML injection (<p:timing>)
  },

  action: (_pptx, slide, element, template, box) => {
    if (!element.action) return
    const target = String(element.action.target)
    const textVal = element.text || `Action -> ${target}`

    const hyperlink = element.action.type === 'slideJump'
      ? { slide: Number(target) || 1 }
      : { url: target }

    slide.addText(textVal, {
      ...box,
      valign: 'middle',
      align: 'center',
      fontFace: template.tokens.bodyFont,
      fontSize: 12,
      bold: true,
      color: resolveColor('var(--slide-accent)', template) || '0066FF',
      fill: { color: resolveColor('var(--slide-bg-alt)', template) || 'E0E0E0' },
      hyperlink,
    })
  },
}
