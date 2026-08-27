import { inspectShowcase } from './showcase'
import { inspectDeck } from './quality'
import type { DeckSpec, PipelineStage } from './types'
import type { QualityReport } from './pipeline-types'

export interface PipelineQualityOptions {
  strict?: boolean
  showcase?: boolean
}

/** Run the deterministic quality gates used by both Fast and Expert paths. */
export function inspectPipeline(deck: DeckSpec, options: PipelineQualityOptions = {}): QualityReport {
  const strict = options.strict ?? false
  const issues: QualityReport['issues'] = inspectDeck(deck).map(issue => ({
    ...issue,
    stage: issue.stage ?? 'validate' as PipelineStage,
  })) as QualityReport['issues']
  if (options.showcase !== false) {
    const showcase = inspectShowcase(deck)
    issues.push(...showcase.issues.map(issue => ({
      ...issue,
      stage: issue.stage ?? 'validate' as PipelineStage,
    })) as QualityReport['issues'])
  }

  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return {
    ok: errors === 0 && (!strict || warnings === 0),
    strict,
    issues,
    summary: {
      errors,
      warnings,
      slides: deck.slides.length,
      assets: deck.assetManifest?.length ?? 0,
    },
  }
}

export function qualityIssuesForStage(report: QualityReport, stage: PipelineStage): QualityReport['issues'] {
  return report.issues.filter(issue => issue.stage === stage)
}

/** 动画推断阶段：根据内容密度自动建议逐条出现动画 */
export function inferAnimations(deck: DeckSpec): DeckSpec {
  const cloned = structuredClone(deck)
  cloned.slides.forEach(slide => {
    const itemCount = Math.max(
      slide.bullets?.length ?? 0,
      slide.elements?.length ?? 0,
      slide.stats?.length ?? 0,
      slide.columns?.length ?? 0,
      slide.steps?.length ?? 0,
    )

    // High density / item count trigger automatic item appearance animations
    if (itemCount >= 3 && (!slide.animations || slide.animations.length === 0)) {
      slide.animations = Array.from({ length: itemCount }).map((_, index) => ({
        id: `anim-${slide.id}-${index + 1}`,
        trigger: index === 0 ? 'onClick' : 'afterPrevious',
        effect: 'fade',
        delay: index * 200,
        duration: 400,
      }))
    }
  })
  return cloned
}
