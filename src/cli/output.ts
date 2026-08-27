import { inspectPipeline } from '../domain/pipeline'
import type { DeckSpec } from '../domain/types'

export function printResult(json: boolean, result: Record<string, unknown>): void {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`)
  else if (result.url) process.stdout.write(`CreatPPT workspace: ${result.url}\n`)
  else if (result.stopped) process.stdout.write(`CreatPPT workspace stopped: ${result.projectDir}\n`)
  else if (result.health) process.stdout.write(`CreatPPT workspace healthy: ${result.projectDir}\n`)
  else process.stdout.write(`Web deck created: ${result.projectDir}\n${result.next ?? ''}\n`)
}

export function summarizeMedia(deck: DeckSpec): { total: number; automatic: number; manual: number; uniqueSources: number } {
  const images = deck.slides.flatMap(slide => slide.images ?? [])
  const automatic = images.filter(image => image.provenance?.source === 'CreatPPT starter asset').length
  return {
    total: images.length,
    automatic,
    manual: images.length - automatic,
    uniqueSources: new Set(images.map(image => image.src)).size,
  }
}

export function summarizeShowcase(deck: DeckSpec) {
  const report = inspectPipeline(deck, { showcase: true })
  const checkedSlideIds = deck.slides.slice(0, 2).map(slide => slide.id)
  return {
    ok: report.ok,
    checkedSlideIds,
    issueCount: report.issues.length,
    blockingIssues: report.issues.filter(issue => issue.severity === 'error').length,
  }
}

export function summarizePlan(deck: DeckSpec) {
  return deck.slides.map(slide => ({
    id: slide.id,
    layout: slide.layout,
    candidates: slide.layoutCandidates?.map(candidate => candidate.layout) ?? [],
    budget: slide.contentBudget,
  }))
}
