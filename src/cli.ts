#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createServer as createNetServer } from 'node:net'
import { basename, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import packageJson from '../package.json'
import { createStarterDeck } from './demo/starter'
import { ensureDeckElements } from './domain/elements'
import { inspectPipeline } from './domain/pipeline'
import { parseDeck } from './domain/schema'
import { TEMPLATE_IDS, type DeckSpec, type PipelineStage, type QualityIssue } from './domain/types'
import type { QualityReport } from './domain/pipeline-types'
import { applyAssetChecksums, copyProjectAssets, inspectProjectAssets } from './cli-assets'
import { projectExists } from './server/handlers'
import { startCreatPptServer } from './server/server'
import { limitDeckSlides, normalizeSlides, normalizeVariants, parseCountOption, parsePortOption, parseTemplateOption, resolveConcreteTemplate, type CountOption, type PortOption } from './cli/options'
import { printResult, summarizeMedia, summarizePlan, summarizeShowcase } from './cli/output'
import { readDeckSource, type ReadDeckResult } from './cli/input'

interface MaterializeResult {
  deck: DeckSpec
  quality: QualityReport
  copiedFiles: string[]
  usedFallback: boolean
}

class PipelineFailure extends Error {
  constructor(message: string, readonly report: QualityReport, readonly stage: PipelineStage = 'validate') {
    super(message)
    this.name = 'PipelineFailure'
  }
}

const program = new Command()
  .name('creatppt')
  .description('Generate a finished Web deck and export PPTX only when the user clicks Export PPT.')
  .version(packageJson.version)

program
  .command('create')
  .argument('[title]', 'Deck title', 'Untitled presentation')
  .option('-o, --out <directory>', 'Output project directory', './creatppt-deck')
  .option('-f, --from <file>', 'Create from JSON, Markdown, HTML, plain text, or - for stdin')
  .option('--brief <file>', 'Alias for --from when the source is a brief')
  .option('-t, --template <id>', `Template: auto, ${TEMPLATE_IDS.join(', ')}`, 'auto')
  .option('-s, --slides <count>', 'Starter slide count or auto', parseCountOption, 'auto')
  .option('--variants <count>', 'Layout candidates per slide (1-3)', value => Number.parseInt(value, 10), 2)
  .option('--assets <directory>', 'Explicit input assets directory')
  .option('--strict', 'Treat warnings as blocking quality failures')
  .option('--explain', 'Include the semantic plan summary in JSON output')
  .option('--serve', 'Start the Web workspace after creation')
  .option('--background', 'Run the workspace server as a managed background process (implies --serve)')
  .option('--open', 'Open the Web workspace in the default browser (implies --serve)')
  .option('--foreground', 'Keep the workspace server in the current process')
  .option('--port <port>', 'Server port or auto', parsePortOption, 'auto')
  .option('--json', 'Print structured output')
  .action(async (title: string, options) => {
    const outputDir = resolve(options.out)
    await assertEmptyDestination(outputDir)
    const startedAt = Date.now()
    const template = parseTemplateOption(options.template)
    const variants = normalizeVariants(options.variants)
    const slides = normalizeSlides(options.slides)
    const sourceOption = options.brief ?? options.from

    const source = sourceOption
      ? await readDeckSource(sourceOption, template, variants, title)
      : {
          deck: createStarterDeck(title, resolveConcreteTemplate(template), slides === 'auto' ? 11 : slides),
          sourceKind: 'agent' as const,
        }
    const deck = limitDeckSlides(source.deck, slides)
    ensureDeckElements(deck)
    const initialQuality = inspectPipeline(deck, { strict: Boolean(options.strict), showcase: true })
    if (!initialQuality.ok) throw new PipelineFailure('Quality gate failed before materialization.', initialQuality, 'validate')

    const materialized = await materializeDeck({
      deck,
      outputDir,
      inputAssets: source.inputAssets,
      explicitAssets: options.assets ? resolve(options.assets) : undefined,
      strict: Boolean(options.strict),
      initialQuality,
    })
    const shouldServe = Boolean(options.serve || options.background || options.open)
    const server = shouldServe
      ? await serveProject(outputDir, options.port as PortOption, '127.0.0.1', { background: !options.foreground })
      : undefined
    if (options.open && server) openBrowser(server.url)

    printResult(options.json, {
      ok: true,
      stage: shouldServe ? 'serve' : 'materialize',
      projectDir: outputDir,
      deckPath: resolve(outputDir, 'deck.json'),
      assetsDir: resolve(outputDir, 'assets'),
      schemaVersion: materialized.deck.version,
      sourceKind: source.sourceKind,
      quality: materialized.quality,
      showcase: summarizeShowcase(materialized.deck),
      warnings: materialized.quality.issues.filter(issue => issue.severity === 'warning'),
      copiedFiles: materialized.copiedFiles,
      usedStarterAssets: materialized.usedFallback,
      media: summarizeMedia(materialized.deck),
      pptxGenerated: false,
      elapsedMs: Date.now() - startedAt,
      ...(server ? { url: server.url } : {}),
      ...(server?.pid ? { pid: server.pid, pidFile: server.pidFile } : {}),
      ...(options.explain ? { plan: summarizePlan(materialized.deck) } : {}),
      ...(server ? {} : { next: `creatppt serve ${JSON.stringify(outputDir)} --open` }),
    })
  })

program
  .command('import')
  .argument('<file>', 'JSON, Markdown, HTML, or plain-text source')
  .option('-o, --out <directory>', 'Output project directory', './creatppt-import')
  .option('-t, --template <id>', `Template: auto, ${TEMPLATE_IDS.join(', ')}`, 'auto')
  .option('--variants <count>', 'Layout candidates per slide (1-3)', value => Number.parseInt(value, 10), 2)
  .option('--assets <directory>', 'Explicit input assets directory')
  .option('--strict', 'Treat warnings as blocking quality failures')
  .option('--json', 'Print structured output')
  .action(async (file: string, options) => {
    const outputDir = resolve(options.out)
    await assertEmptyDestination(outputDir)
    const template = parseTemplateOption(options.template)
    const source = await readDeckSource(file, template, normalizeVariants(options.variants))
    source.deck.source = {
      ...(source.deck.source ?? {}),
      kind: 'imported',
      importedAt: new Date().toISOString(),
    }
    const initialQuality = inspectPipeline(source.deck, { strict: Boolean(options.strict), showcase: true })
    if (!initialQuality.ok) throw new PipelineFailure('Quality gate failed before materialization.', initialQuality, 'validate')
    const materialized = await materializeDeck({
      deck: source.deck,
      outputDir,
      inputAssets: source.inputAssets,
      explicitAssets: options.assets ? resolve(options.assets) : undefined,
      strict: Boolean(options.strict),
      initialQuality,
    })
    printResult(options.json, {
      ok: true,
      stage: 'materialize',
      projectDir: outputDir,
      deckPath: resolve(outputDir, 'deck.json'),
      assetsDir: resolve(outputDir, 'assets'),
      pptxGenerated: false,
      schemaVersion: materialized.deck.version,
      sourceKind: 'imported',
      quality: materialized.quality,
      showcase: summarizeShowcase(materialized.deck),
      warnings: materialized.quality.issues.filter(issue => issue.severity === 'warning'),
      copiedFiles: materialized.copiedFiles,
      usedStarterAssets: materialized.usedFallback,
      media: summarizeMedia(materialized.deck),
      next: `creatppt serve ${JSON.stringify(outputDir)} --open`,
    })
  })

program
  .command('serve')
  .argument('[project]', 'Deck project directory', '.')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--port <port>', 'Server port or auto', parsePortOption, 'auto')
  .option('--background', 'Run as a managed background process')
  .option('--foreground', 'Keep the server in the current process')
  .option('--pid-file <file>', 'PID metadata file (defaults to a system temp path)')
  .option('--open', 'Open in the default browser')
  .option('--json', 'Print structured output')
  .action(async (project: string, options) => {
    const projectDir = resolve(project)
    if (!(await projectExists(projectDir))) throw new Error(`No deck.json found in ${projectDir}.`)
    const server = await serveProject(projectDir, options.port as PortOption, options.host, {
      background: Boolean(options.background) && !options.foreground,
      pidFile: options.pidFile ? resolve(options.pidFile) : undefined,
    })
    if (options.open) openBrowser(server.url)
    printResult(options.json, { ok: true, stage: 'serve', projectDir, url: server.url, pid: server.pid, pidFile: server.pidFile, pptxGenerated: false })
  })

program
  .command('health')
  .argument('[project]', 'Deck project directory', '.')
  .option('--pid-file <file>', 'PID metadata file (defaults to a system temp path)')
  .option('--json', 'Print structured output')
  .action(async (project: string, options) => {
    const projectDir = resolve(project)
    const pidPath = options.pidFile ? resolve(options.pidFile) : undefined
    const record = await readPidRecord(projectDir, pidPath)
    if (!record) throw new Error(`No managed CreatPPT server found for ${projectDir}.`)
    const body = await fetchHealth(record)
    if (!body || body.ok !== true || body.projectDir !== projectDir) {
      throw new Error(`Managed CreatPPT server is not healthy for ${projectDir}.`)
    }
    printResult(options.json, { ok: true, stage: 'serve', projectDir, url: record.url, pid: record.pid, pidFile: pidPath ?? pidFileFor(projectDir), health: body })
  })

program
  .command('stop')
  .argument('[project]', 'Deck project directory', '.')
  .option('--pid-file <file>', 'PID metadata file (defaults to a system temp path)')
  .option('--json', 'Print structured output')
  .action(async (project: string, options) => {
    const projectDir = resolve(project)
    const pidPath = options.pidFile ? resolve(options.pidFile) : pidFileFor(projectDir)
    const record = await readPidRecord(projectDir, pidPath)
    if (!record) {
      await rm(pidPath, { force: true }).catch(() => undefined)
      throw new Error(`No managed CreatPPT server found for ${projectDir}.`)
    }
    if (record.pid === process.pid) {
      throw new Error('Refusing to stop the current CreatPPT CLI process.')
    }
    const body = await fetchHealth(record)
    if (!body || body.ok !== true || body.projectDir !== projectDir) {
      await rm(pidPath, { force: true }).catch(() => undefined)
      throw new Error(`Managed CreatPPT server is not healthy for ${projectDir}; refusing to signal PID ${record.pid}.`)
    }
    try {
      process.kill(record.pid, 'SIGTERM')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
    if (!(await waitForProcessExit(record.pid))) {
      throw new Error(`CreatPPT server PID ${record.pid} did not stop within the timeout.`)
    }
    await rm(pidPath, { force: true }).catch(() => undefined)
    printResult(options.json, { ok: true, stage: 'serve', projectDir, stopped: true, pid: record.pid, pidFile: pidPath })
  })

program
  .command('validate')
  .argument('[file]', 'DeckSpec JSON file', './deck.json')
  .option('--json', 'Print structured output')
  .option('--showcase', 'Run the internal two-page showcase gate')
  .option('--strict', 'Treat warnings as blocking quality failures')
  .action(async (file: string, options) => {
    const deck = parseDeck(JSON.parse(await readFile(resolve(file), 'utf8')))
    const quality = inspectPipeline(deck, { strict: Boolean(options.strict), showcase: Boolean(options.showcase) })
    printResult(options.json, {
      ok: quality.ok,
      stage: 'validate',
      deckId: deck.id,
      title: deck.title,
      slides: deck.slides.length,
      schemaVersion: deck.version,
      quality,
      issues: quality.issues,
      ...(options.showcase ? { showcase: summarizeShowcase(deck) } : {}),
    })
  })

program
  .command('plan')
  .argument('<file>', 'DeckSpec JSON, content JSON, or brief file')
  .option('-o, --out <file>', 'Write the planned DeckSpec to a file')
  .option('--variants <count>', 'Layout candidates per slide (1-3)', value => Number.parseInt(value, 10), 2)
  .option('-t, --template <id>', `Template: auto, ${TEMPLATE_IDS.join(', ')}`, 'auto')
  .option('--json', 'Print structured output')
  .action(async (file: string, options) => {
    const source = await readDeckSource(file, parseTemplateOption(options.template), normalizeVariants(options.variants))
    if (options.out) await writeFile(resolve(options.out), `${JSON.stringify(source.deck, null, 2)}\n`, 'utf8')
    printResult(options.json, {
      ok: true,
      stage: 'plan',
      deckId: source.deck.id,
      title: source.deck.title,
      slides: source.deck.slides.length,
      schemaVersion: source.deck.version,
      output: options.out ? resolve(options.out) : undefined,
      showcase: summarizeShowcase(source.deck),
      plan: summarizePlan(source.deck),
    })
  })

program.parseAsync().catch(error => {
  if (error instanceof PipelineFailure) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, stage: error.stage, quality: error.report })}\n`)
  }
  else {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`)
  }
  process.exitCode = 1
})

async function materializeDeck(options: {
  deck: DeckSpec
  outputDir: string
  inputAssets?: string
  explicitAssets?: string
  strict: boolean
  initialQuality: QualityReport
}): Promise<MaterializeResult> {
  const parent = dirname(options.outputDir)
  await mkdir(parent, { recursive: true })
  const stagingDir = await mkdtemp(resolve(parent, `.creatppt-${basename(options.outputDir)}-`))
  try {
    const starterDir = await findStarterAssets()
    const copied = await copyProjectAssets({
      derivedInputDir: options.inputAssets,
      explicitInputDir: options.explicitAssets,
      starterDir,
      outputDir: resolve(stagingDir, 'assets'),
      // Keep every bundled template image in the handoff workspace. The Web
      // editor can switch templates after generation, so a delivery that only
      // contains the initially selected image would create 404s on switch.
      includeFiles: [
        ...collectLocalAssetPaths(options.deck),
        ...await collectStarterAssetPaths(starterDir),
      ],
    })
    const assetInspection = await inspectProjectAssets(options.deck, stagingDir)
    const quality = mergeQualityReports(options.initialQuality, assetInspection.issues, options.strict)
    if (!quality.ok) throw new PipelineFailure('Quality gate failed during materialization.', quality, 'materialize')
    applyAssetChecksums(options.deck, assetInspection.checksums)
    await writeFile(resolve(stagingDir, 'deck.json'), `${JSON.stringify(options.deck, null, 2)}\n`, 'utf8')
    await rename(stagingDir, options.outputDir)
    return {
      deck: options.deck,
      quality,
      copiedFiles: copied.copiedFiles,
      usedFallback: copied.usedFallback,
    }
  }
  catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

/** Return the local image paths required by both semantic and freeform scenes. */
function collectLocalAssetPaths(deck: DeckSpec): string[] {
  const paths = deck.slides.flatMap(slide => [
    ...(slide.images ?? []).map(image => image.src),
    ...(slide.elements ?? [])
      .filter(element => element.type === 'image' && element.src)
      .map(element => element.src as string),
  ])
  return [...new Set(paths.filter(path => path.startsWith('assets/')))]
}

async function collectStarterAssetPaths(starterDir?: string): Promise<string[]> {
  if (!starterDir) return []
  const entries = await readdir(starterDir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && /\.(?:jpe?g|png|webp)$/i.test(entry.name))
    .map(entry => `assets/${entry.name}`)
}

function mergeQualityReports(base: QualityReport, extraIssues: QualityIssue[], strict: boolean): QualityReport {
  const issues = [...base.issues, ...extraIssues] as QualityReport['issues']
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return {
    ...base,
    strict,
    ok: errors === 0 && (!strict || warnings === 0),
    issues,
    summary: { ...base.summary, errors, warnings },
    stages: [
      ...(base.stages ?? []),
      { stage: 'materialize', ok: extraIssues.every(issue => issue.severity !== 'error'), issueCount: extraIssues.length },
    ],
  }
}

interface ServeOptions {
  background?: boolean
  pidFile?: string
}

interface ServeResult {
  url: string
  pid?: number
  pidFile?: string
  server?: import('node:http').Server
}

interface PidRecord {
  pid: number
  projectDir: string
  host: string
  port: number
  url: string
}

async function serveProject(projectDir: string, port: PortOption, host = '127.0.0.1', options: ServeOptions = {}): Promise<ServeResult> {
  if (options.background) {
    const pidFile = options.pidFile ?? pidFileFor(projectDir)
    const existing = await readPidRecord(projectDir, pidFile)
    if (existing && await isHealthy(existing)) return { ...existing, pidFile }
    const actualPort = port === 'auto' || port === 0 ? await findAvailablePort(host) : port
    const child = spawnServeChild(projectDir, host, actualPort, pidFile)
    try {
      await waitForHealth(`http://${host}:${actualPort}`)
    }
    catch (error) {
      if (child.pid) {
        try { process.kill(child.pid, 'SIGTERM') }
        catch (killError) {
          if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') throw killError
        }
        await waitForProcessExit(child.pid, 1000)
      }
      await rm(pidFile, { force: true }).catch(() => undefined)
      throw error
    }
    return { url: `http://${host}:${actualPort}`, pid: child.pid, pidFile }
  }

  const clientDir = await findClientDir()
  const { url, server } = await startCreatPptServer({ projectDir, clientDir, host, port: port === 'auto' ? 0 : port })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port === 'auto' ? 0 : port
  const pidFile = options.pidFile
  if (pidFile) await writePidRecord(pidFile, { pid: process.pid, projectDir, host, port: actualPort, url })
  const cleanup = async () => {
    await new Promise<void>(resolveClose => server.close(() => resolveClose()))
    if (pidFile) await rm(pidFile, { force: true }).catch(() => undefined)
  }
  process.once('SIGINT', () => { void cleanup().finally(() => process.exit(0)) })
  process.once('SIGTERM', () => { void cleanup().finally(() => process.exit(0)) })
  return { url, server, pid: pidFile ? process.pid : undefined, pidFile }
}

function spawnServeChild(projectDir: string, host: string, port: number, pidFile: string) {
  // `tsx` exposes the TypeScript entry as argv[1] and keeps its loader in
  // execArgv, so spawning argv[1] directly would make the daemon exit on
  // Node's unknown `.ts` extension. Preserve the loader when present.
  const runningWithTsx = process.execArgv.some(argument => argument.includes('tsx'))
  const invocation = runningWithTsx
    ? [...process.execArgv, process.argv[1]]
    : [process.argv[1]]
  const child = spawn(process.execPath, [
    ...invocation,
    'serve',
    projectDir,
    '--host', host,
    '--port', String(port),
    '--foreground',
    '--pid-file', pidFile,
  ], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CREATPPT_DAEMON: '1' },
  })
  child.unref()
  return child
}

async function findAvailablePort(host: string): Promise<number> {
  const probe = createNetServer()
  await new Promise<void>((resolveReady, reject) => {
    probe.once('error', reject)
    probe.listen(0, host, () => {
      probe.off('error', reject)
      resolveReady()
    })
  })
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>(resolveClose => probe.close(() => resolveClose()))
  if (!port) throw new Error('Could not allocate an available port.')
  return port
}

async function waitForHealth(url: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError = 'server did not become ready'
  while (Date.now() < deadline) {
    try {
      const body = await fetchHealthUrl(url)
      if (body?.ok === true) return
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
  }
  throw new Error(`CreatPPT server did not become ready: ${lastError}`)
}

async function isHealthy(record: PidRecord): Promise<boolean> {
  const body = await fetchHealth(record)
  return body?.ok === true && body.projectDir === record.projectDir
}

async function fetchHealth(record: PidRecord): Promise<Record<string, unknown> | undefined> {
  return fetchHealthUrl(record.url)
}

async function fetchHealthUrl(url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const response = await fetch(`${url}/api/health`)
    const body = await response.json().catch(() => undefined) as Record<string, unknown> | undefined
    return response.ok ? body : undefined
  }
  catch {
    return undefined
  }
}

function pidFileFor(projectDir: string): string {
  const key = createHash('sha1').update(resolve(projectDir)).digest('hex').slice(0, 16)
  return resolve(tmpdir(), `creatppt-${key}.pid.json`)
}

async function writePidRecord(path: string, record: PidRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporary, `${JSON.stringify(record)}\n`, 'utf8')
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

async function readPidRecord(projectDir: string, pidPath = pidFileFor(projectDir)): Promise<PidRecord | undefined> {
  try {
    const record = JSON.parse(await readFile(pidPath, 'utf8')) as PidRecord
    if (record.projectDir !== resolve(projectDir)
      || !Number.isInteger(record.pid)
      || record.pid <= 0
      || !record.url
      || !Number.isInteger(record.port)
      || record.port < 0
      || record.port > 65535
      || !record.host) return undefined
    return record
  }
  catch {
    return undefined
  }
}

async function waitForProcessExit(pid: number, timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
  }
  return false
}

async function assertEmptyDestination(outputDir: string): Promise<void> {
  try {
    const targetStat = await stat(outputDir)
    if (!targetStat.isDirectory()) throw new Error(`Output exists and is not a directory: ${outputDir}`)
    const entries = await readdir(outputDir)
    if (entries.length) throw new Error(`Output directory is not empty: ${outputDir}`)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}

async function findStarterAssets(): Promise<string | undefined> {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(currentDir, '../../starter/assets'),
    resolve(currentDir, '../starter/assets'),
    resolve(process.cwd(), 'starter/assets'),
  ]
  for (const candidate of candidates) {
    if (await isDirectory(candidate)) return candidate
  }
  return undefined
}

async function findClientDir(): Promise<string> {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(currentDir, '../client'),
    resolve(currentDir, '../../dist/client'),
    resolve(process.cwd(), 'dist/client'),
  ]
  for (const candidate of candidates) {
    if (await isDirectory(candidate)) return candidate
  }
  throw new Error('Web client is not built. Run npm run build first.')
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  }
  catch {
    return false
  }
}

function openBrowser(url: string): void {
  const platformCommands: Record<string, [string, string[]]> = {
    darwin: ['open', [url]],
    win32: ['cmd', ['/c', 'start', '', url]],
    linux: ['xdg-open', [url]],
  }
  const [command, args] = platformCommands[process.platform] ?? platformCommands.linux
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}
