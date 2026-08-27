import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { adaptDashiGoal, looksLikeDashiGoal } from '../domain/adapters'
import { compileContentPlan, contentPlanFromInput } from '../domain/content-plan'
import { contentInputFromBrief, contentInputFromBriefFile } from '../domain/intake'
import { planDeck } from '../domain/planner'
import { upgradeDeck } from '../domain/schema'
import type { DeckSpec, DeckSourceKind } from '../domain/types'
import { looksLikeDeckSpec, resolveConcreteTemplate, type TemplateOption } from './options'

export interface ReadDeckResult {
  deck: DeckSpec
  inputAssets?: string
  sourceKind: DeckSourceKind
}

export async function readDeckSource(inputPath: string, template: TemplateOption, candidateCount: number, fallbackTitle?: string): Promise<ReadDeckResult> {
  if (inputPath === '-') return readDeckSourceText(await readStdin(), undefined, template, candidateCount, fallbackTitle)
  const absolutePath = resolve(inputPath)
  const extension = extname(absolutePath).toLowerCase()
  if (extension === '.json') return compileJsonSource(JSON.parse(await readFile(absolutePath, 'utf8')), absolutePath, template, candidateCount)
  const input = extension === '.html'
    ? await contentInputFromBriefFile(absolutePath, { title: fallbackTitle, templateId: template === 'auto' ? undefined : template })
    : contentInputFromBrief(await readFile(absolutePath, 'utf8'), { title: fallbackTitle, templateId: template === 'auto' ? undefined : template, sourcePath: absolutePath })
  const plan = contentPlanFromInput(input, { templateId: template === 'auto' ? undefined : template, sourceKind: input.source?.kind ?? 'markdown', sourcePath: absolutePath })
  return { deck: compileContentPlan(plan, candidateCount), inputAssets: resolve(dirname(absolutePath), 'assets'), sourceKind: plan.source.kind }
}

function readDeckSourceText(rawText: string, sourcePath: string | undefined, template: TemplateOption, candidateCount: number, fallbackTitle?: string): ReadDeckResult {
  const trimmed = rawText.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return compileJsonSource(JSON.parse(trimmed), sourcePath, template, candidateCount) }
    catch (error) { if (trimmed.startsWith('{')) throw error }
  }
  const input = contentInputFromBrief(rawText, { title: fallbackTitle, templateId: template === 'auto' ? undefined : template, sourcePath })
  const plan = contentPlanFromInput(input, { templateId: template === 'auto' ? undefined : template, sourceKind: 'markdown', sourcePath })
  return { deck: compileContentPlan(plan, candidateCount), sourceKind: plan.source.kind }
}

function compileJsonSource(raw: unknown, sourcePath: string | undefined, template: TemplateOption, candidateCount: number): ReadDeckResult {
  const sourceKind = sourcePath ? 'json' as const : 'agent' as const
  if (looksLikeDashiGoal(raw)) {
    const deck = planDeck(adaptDashiGoal(raw, { templateId: resolveConcreteTemplate(template), sourcePath }), { candidateCount, sourceKind: 'imported' })
    return { deck, inputAssets: sourcePath ? resolve(dirname(sourcePath), 'assets') : undefined, sourceKind: 'imported' }
  }
  if (looksLikeDeckSpec(raw)) {
    const deck = planDeck(upgradeDeck(raw), { candidateCount, sourceKind })
    return { deck, inputAssets: sourcePath ? resolve(dirname(sourcePath), 'assets') : undefined, sourceKind }
  }
  const plan = contentPlanFromInput(raw, { templateId: template === 'auto' ? undefined : template, sourceKind, sourcePath })
  return { deck: compileContentPlan(plan, candidateCount), inputAssets: sourcePath ? resolve(dirname(sourcePath), 'assets') : undefined, sourceKind: plan.source.kind }
}

function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return Promise.reject(new Error('No stdin input available; pipe a brief when using --from -.'))
  return new Promise((resolveInput, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', chunk => chunks.push(Buffer.from(chunk)))
    process.stdin.on('end', () => resolveInput(Buffer.concat(chunks).toString('utf8')))
    process.stdin.on('error', reject)
  })
}
