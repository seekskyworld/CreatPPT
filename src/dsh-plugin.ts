import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'creatppt-dsh'
export const inject = ['tools']

type CreatePresentationArgs = {
  title?: string
  brief?: string
  template?: 'auto' | 'signal' | 'studio' | 'editorial'
  slides?: number
  outputDir?: string
  assetsDir?: string
}

type PresentationResult = {
  ok: boolean
  projectDir?: string
  deckPath?: string
  url?: string
  slideCount?: number
  media?: { total: number; automatic: number; manual: number; uniqueSources: number }
  warnings?: string[]
}

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'create_presentation',
    description: 'Create an editable CreatPPT web presentation from a title or brief. Returns the project directory, workspace URL, slide count, media summary, and warnings.',
    parameters: {
      title: { type: 'string', description: 'Presentation title. Defaults to Untitled presentation.' },
      brief: { type: 'string', description: 'Optional plain-text or Markdown brief. It is sent to CreatPPT through stdin.' },
      template: { type: 'string', enum: ['auto', 'signal', 'studio', 'editorial'], description: 'Optional visual template.' },
      slides: { type: 'integer', description: 'Optional slide count from 2 to 60.' },
      outputDir: { type: 'string', description: 'Optional output directory. Defaults to a unique folder in the current directory.' },
      assetsDir: { type: 'string', description: 'Optional directory containing local image assets.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs: 180000,
    async execute(args: CreatePresentationArgs, exec) {
      const result = await runCreatPpt(args, exec.signal)
      return result
    },
  }))
}

async function runCreatPpt(args: CreatePresentationArgs, signal: AbortSignal): Promise<PresentationResult> {
  const cliPath = resolve(dirname(fileURLToPath(import.meta.url)), 'cli.js')
  const outputDir = args.outputDir ?? `./creatppt-deck-${Date.now()}`
  const commandArgs = [cliPath, 'create', args.title ?? 'Untitled presentation', '--out', outputDir, '--json', '--serve', '--background']
  if (args.brief) commandArgs.push('--from', '-')
  if (args.template) commandArgs.push('--template', args.template)
  if (args.slides !== undefined) commandArgs.push('--slides', String(args.slides))
  if (args.assetsDir) commandArgs.push('--assets', args.assetsDir)

  return await new Promise<PresentationResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, commandArgs, { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      fn()
    }
    const abort = () => child.kill('SIGTERM')
    signal.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', error => finish(() => reject(error)))
    child.once('close', code => finish(() => {
      const line = stdout.trim().split(/\r?\n/).at(-1)
      if (code !== 0 || !line) {
        reject(new Error(`CreatPPT failed${stderr.trim() ? `: ${stderr.trim()}` : ` with exit code ${code}`}`))
        return
      }
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>
        const media = parsed.media && typeof parsed.media === 'object' ? parsed.media as PresentationResult['media'] : undefined
        const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(warning => String(warning)) : undefined
        const summary: PresentationResult = {
          ok: parsed.ok === true,
          projectDir: typeof parsed.projectDir === 'string' ? parsed.projectDir : undefined,
          deckPath: typeof parsed.deckPath === 'string' ? parsed.deckPath : undefined,
          url: typeof parsed.url === 'string' ? parsed.url : undefined,
          media,
          warnings,
        }
        if (summary.deckPath) {
          readFile(summary.deckPath, 'utf8')
            .then(content => {
              const deck = JSON.parse(content) as { slides?: unknown[] }
              resolveResult({ ...summary, slideCount: Array.isArray(deck.slides) ? deck.slides.length : undefined })
            })
            .catch(() => resolveResult(summary))
        }
        else resolveResult(summary)
      }
      catch {
        reject(new Error(`CreatPPT returned invalid JSON: ${line}`))
      }
    }))
    if (args.brief) child.stdin.write(args.brief)
    child.stdin.end()
  })
}
