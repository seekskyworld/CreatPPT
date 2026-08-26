import type { DeckSpec, QualityIssue } from './types'

export interface ShowcaseReport {
  ok: boolean
  issues: QualityIssue[]
  checkedSlideIds: string[]
}

/**
 * Internal quality gate inspired by a two-page showcase: it validates a cover and
 * one representative content page before a long deck is delivered. It never forces
 * a user-facing approval step.
 */
export function inspectShowcase(deck: DeckSpec): ShowcaseReport {
  const issues: QualityIssue[] = []
  const checked = deck.slides.slice(0, 2)
  const cover = checked[0]
  const representative = checked[1]

  if (!cover) {
    issues.push({
      code: 'SHOWCASE_EMPTY',
      severity: 'error',
      message: '演示稿没有可用于 showcase 的页面。',
    })
  }
  else {
    if (cover.layout !== 'cover') {
      issues.push({
        code: 'SHOWCASE_COVER_LAYOUT',
        severity: 'warning',
        slideId: cover.id,
        message: 'showcase 首页建议使用 cover 布局。',
      })
    }
    if (!cover.title.trim()) {
      issues.push({
        code: 'SHOWCASE_COVER_TITLE',
        severity: 'error',
        slideId: cover.id,
        message: 'showcase 封面缺少标题。',
      })
    }
    if (!cover.images?.length) {
      issues.push({
        code: 'SHOWCASE_COVER_IMAGE',
        severity: 'warning',
        slideId: cover.id,
        message: 'showcase 封面没有主视觉素材。',
      })
    }
  }

  if (!representative) {
    issues.push({
      code: 'SHOWCASE_REPRESENTATIVE_MISSING',
      severity: 'warning',
      message: '演示稿缺少代表正文页，无法验证批量构图一致性。',
    })
  }
  else {
    if (representative.layout === 'cover') {
      issues.push({
        code: 'SHOWCASE_REPRESENTATIVE_COVER',
        severity: 'warning',
        slideId: representative.id,
        message: 'showcase 第二页不应重复使用 cover 布局。',
      })
    }
    if (!representative.title.trim()) {
      issues.push({
        code: 'SHOWCASE_REPRESENTATIVE_TITLE',
        severity: 'error',
        slideId: representative.id,
        message: 'showcase 代表正文页缺少标题。',
      })
    }
    if (deck.version === 2 && (representative.layoutCandidates?.length ?? 0) < 2) {
      issues.push({
        code: 'SHOWCASE_CANDIDATES_MISSING',
        severity: 'warning',
        slideId: representative.id,
        message: '代表正文页缺少备用布局候选。',
      })
    }
  }

  return {
    ok: issues.every(issue => issue.severity !== 'error'),
    issues,
    checkedSlideIds: checked.map(slide => slide.id),
  }
}
