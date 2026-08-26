import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { inspectPipeline } from '@/domain/pipeline'

describe('pipeline quality report', () => {
  it('returns a machine-readable green report for the starter deck', () => {
    const report = inspectPipeline(createStarterDeck(), { strict: true })
    expect(report.ok).toBe(true)
    expect(report.summary.errors).toBe(0)
    expect(report.stages).toBeUndefined()
  })

  it('turns warnings into blocking failures only in strict mode', () => {
    const deck = createStarterDeck()
    deck.slides[1].title = '超长'.repeat(50)
    const relaxed = inspectPipeline(deck)
    const strict = inspectPipeline(deck, { strict: true })
    expect(relaxed.ok).toBe(true)
    expect(relaxed.summary.warnings).toBeGreaterThan(0)
    expect(strict.ok).toBe(false)
  })
})
