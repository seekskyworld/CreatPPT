import type { DeckSpec, QualityIssue, SlideSpec } from './types'
import { classifyAssetSource } from './assets'

const LIMITS: Partial<Record<keyof SlideSpec, number>> = {
  eyebrow: 28,
  title: 72,
  subtitle: 110,
  body: 320,
  quote: 180,
  footer: 80,
}

export function inspectDeck(deck: DeckSpec): QualityIssue[] {
  const issues: QualityIssue[] = []
  const manifest = deck.assetManifest ?? []
  const manifestById = new Map(manifest.map(asset => [asset.id, asset]))
  const referencedAssetIds = new Set<string>()

  if (deck.slides.length > 24) {
    issues.push({
      code: 'DECK_LONG',
      severity: 'warning',
      message: '页面超过 24 页，建议确认叙事节奏。',
    })
  }

  deck.slides.forEach(slide => {
    for (const [field, limit] of Object.entries(LIMITS)) {
      const value = slide[field as keyof SlideSpec]
      if (typeof value === 'string' && value.length > limit) {
        issues.push({
          code: 'TEXT_DENSE',
          severity: 'warning',
          slideId: slide.id,
          message: `${field} 内容偏长（${value.length}/${limit}）。`,
        })
      }
    }

    if (slide.bullets?.some(item => item.length > 80)) {
      issues.push({
        code: 'BULLET_DENSE',
        severity: 'warning',
        slideId: slide.id,
        message: '列表项超过 80 字，可能影响版面层级。',
      })
    }

    const budget = slide.contentBudget
    if (budget?.title && slide.title.length > budget.title) {
      issues.push({
        code: 'TITLE_OVER_BUDGET',
        severity: 'warning',
        slideId: slide.id,
        message: `标题超过本页预算（${slide.title.length}/${budget.title}）。`,
      })
    }
    if (budget?.body && (slide.body?.length ?? 0) > budget.body) {
      issues.push({
        code: 'BODY_OVER_BUDGET',
        severity: 'warning',
        slideId: slide.id,
        message: `正文超过本页预算（${slide.body?.length ?? 0}/${budget.body}）。`,
      })
    }
    const bulletBudget = budget?.bullet
    const overBudgetBullet = bulletBudget
      ? slide.bullets?.find(item => item.length > bulletBudget)
      : undefined
    if (overBudgetBullet) {
      issues.push({
        code: 'BULLET_OVER_BUDGET',
        severity: 'warning',
        slideId: slide.id,
        message: `列表项超过本页文案预算（${overBudgetBullet.length}/${bulletBudget}）。`,
      })
    }
    const itemBudget = budget?.items
    const itemCount = Math.max(
      slide.bullets?.length ?? 0,
      slide.stats?.length ?? 0,
      slide.columns?.length ?? 0,
      slide.steps?.length ?? 0,
      slide.chart?.points.length ?? 0,
      0,
    )
    if (itemBudget && itemCount > itemBudget) {
      issues.push({
        code: 'ITEMS_OVER_BUDGET',
        severity: 'warning',
        slideId: slide.id,
        message: `页面信息项超过预算（${itemCount}/${itemBudget}）。`,
      })
    }
    if (budget?.media !== undefined && (slide.images?.length ?? 0) > budget.media) {
      issues.push({
        code: 'MEDIA_OVER_BUDGET',
        severity: 'warning',
        slideId: slide.id,
        message: `页面素材数量超过预算（${slide.images?.length ?? 0}/${budget.media}）。`,
      })
    }

    if (['cover', 'split', 'gallery'].includes(slide.layout) && !slide.images?.length) {
      issues.push({
        code: 'IMAGE_MISSING',
        severity: 'error',
        slideId: slide.id,
        message: `${slide.layout} 页面缺少图片。`,
      })
    }

    slide.images?.forEach(image => {
      if (image.assetId) {
        referencedAssetIds.add(image.assetId)
        if (manifest.length && !manifestById.has(image.assetId)) {
          issues.push({
            code: 'ASSET_MANIFEST_ENTRY_MISSING',
            severity: 'warning',
            slideId: slide.id,
            message: `素材 ${image.assetId} 未在 assetManifest 中登记。`,
          })
        }
      }
      else if (deck.version === 2 && manifest.length) {
        issues.push({
          code: 'ASSET_ID_MISSING',
          severity: 'warning',
          slideId: slide.id,
          message: 'v2 图片缺少 assetId，无法稳定追踪来源。',
        })
      }
      if (!image.alt.trim()) {
        issues.push({
          code: 'IMAGE_ALT_MISSING',
          severity: 'warning',
          slideId: slide.id,
          message: '图片缺少替代文本。',
        })
      }
      if (/^(?:https?:)?\/\//i.test(image.src)) {
        issues.push({
          code: 'REMOTE_ASSET_UNSTABLE',
          severity: 'warning',
          slideId: slide.id,
          message: '远程图片可能受 CORS 或网络波动影响，建议归档到 assets。',
        })
      }
      if (/^blob:/i.test(image.src)) {
        issues.push({
          code: 'EPHEMERAL_ASSET_URL',
          severity: 'error',
          slideId: slide.id,
          message: 'blob 图片地址只在当前浏览器会话有效，请上传并保存为 data URL 或项目素材。',
        })
      }
      const sourceInfo = classifyAssetSource(image.src)
      if (!sourceInfo.supported && !/^blob:/i.test(image.src)) {
        issues.push({
          code: 'ASSET_FORMAT_UNSUPPORTED',
          severity: 'error',
          slideId: slide.id,
          field: 'images',
          message: sourceInfo.reason ?? '图片格式不受导出器支持。',
          fix: '请替换为 JPEG、PNG 或 WebP 文件。',
        })
      }
    })

    if (slide.layout === 'metrics' && (slide.stats?.length ?? 0) < 2) {
      issues.push({
        code: 'METRICS_SPARSE',
        severity: 'warning',
        slideId: slide.id,
        message: '关键指标页至少应包含两个指标。',
      })
    }
  })

  if (deck.version === 2 && !deck.designContext) {
    issues.push({
      code: 'DESIGN_CONTEXT_MISSING',
      severity: 'warning',
      message: 'DeckSpec v2 缺少 designContext，无法稳定推断受众和交付取舍。',
    })
  }

  manifest.forEach(asset => {
    if (!asset.provenance?.kind && !asset.provenance?.source) {
      issues.push({
        code: 'ASSET_PROVENANCE_MISSING',
        severity: 'warning',
        message: `素材 ${asset.id} 缺少来源记录。`,
      })
    }
    if (asset.required !== false && !referencedAssetIds.has(asset.id)) {
      issues.push({
        code: 'ASSET_MANIFEST_UNUSED',
        severity: 'warning',
        message: `素材 ${asset.id} 已登记但未被页面引用。`,
      })
    }
  })

  return issues
}
