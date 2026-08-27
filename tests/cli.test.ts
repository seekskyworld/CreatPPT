import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import { parseDeck } from '@/domain/schema'

const tsxCommand = process.execPath
const tsxCli = resolve('node_modules/tsx/dist/cli.mjs')
const tsconfig = resolve('tsconfig.json')
const cliSource = resolve('src/cli.ts')

function runTsx(args: string[], input?: string, cwd = resolve('.')) {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' }
  delete env.FORCE_COLOR
  return spawnSync(tsxCommand, [tsxCli, '--tsconfig', tsconfig, ...args], { cwd, encoding: 'utf8', input, env })
}

describe('Agent CLI', () => {
  it('reports the package version instead of a stale hardcoded value', () => {
    const result = runTsx(['src/cli.ts', '--version'])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe(packageJson.version)
  })

  it('creates only a Web deck project and never pre-generates PPTX', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-cli-'))
    const output = resolve(root, 'deck')
    const result = runTsx([
      'src/cli.ts', 'create', 'Agent handoff', '--out', output, '--slides', '5', '--json',
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      pptxGenerated: false,
      showcase: { ok: true },
      media: { total: 2, automatic: 2, manual: 0, uniqueSources: 2 },
    })
    const entries = await readdir(output)
    expect(entries).toContain('deck.json')
    expect(entries).toContain('assets')
    expect(entries.some(entry => entry.endsWith('.pptx'))).toBe(false)
    expect(parseDeck(JSON.parse(await readFile(resolve(output, 'deck.json'), 'utf8'))).slides).toHaveLength(5)
  }, 20_000)

  it('bundles all template starter images so a later template switch stays local', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-template-assets-'))
    const output = resolve(root, 'delivery')
    const result = runTsx([
      'src/cli.ts', 'create', 'Template handoff', '--out', output, '--template', 'editorial', '--json',
    ])

    expect(result.status, result.stderr).toBe(0)
    const assets = await readdir(resolve(output, 'assets'))
    expect(assets).toEqual(expect.arrayContaining([
      'cover-banner.jpg',
      'cover-hero.jpg',
      'studio-wide-workspace.jpg',
      'signal-server-room.jpg',
    ]))
  }, 20_000)

  it('imports a Markdown brief and preserves planning metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-brief-'))
    const brief = resolve(root, 'brief.md')
    const output = resolve(root, 'delivery')
    await writeFile(brief, `---\ntemplate: editorial\naudience: 产品团队\n---\n# 发布计划\n> 一份可执行的计划\n\n## 重点\n- 统一入口\n- 自动排版\n- 点击导出\n`, 'utf8')
    const result = runTsx([
      'src/cli.ts', 'create', '--from', brief, '--out', output, '--variants', '2', '--json',
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, pptxGenerated: false, schemaVersion: 2 })
    const deck = parseDeck(JSON.parse(await readFile(resolve(output, 'deck.json'), 'utf8')))
    expect(deck.source?.kind).toBe('markdown')
    expect(deck.slides.every(slide => slide.layoutCandidates?.length === 2)).toBe(true)
  }, 20_000)

  it('creates a semantic content JSON through the one-command Fast path', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-content-'))
    const output = resolve(root, 'delivery')
    const result = runTsx([
      'src/cli.ts', 'create', '--from', 'tests/fixtures/fast-path-content.json', '--out', output, '--json', '--explain',
    ])

    expect(result.status, result.stderr).toBe(0)
    const outputJson = JSON.parse(result.stdout)
    expect(outputJson).toMatchObject({ ok: true, pptxGenerated: false, sourceKind: 'json', usedStarterAssets: true })
    expect(outputJson.quality.summary.errors).toBe(0)
    expect(outputJson.plan.some((slide: { layout: string }) => slide.layout === 'metrics')).toBe(true)
    const deck = parseDeck(JSON.parse(await readFile(resolve(output, 'deck.json'), 'utf8')))
    expect(deck.slides.some(slide => slide.layout === 'timeline')).toBe(true)
    expect(deck.assetManifest?.every(asset => asset.provenance?.checksum || asset.required === false)).toBe(true)
  }, 20_000)

  it('accepts a Markdown brief over stdin without an intermediate DeckSpec', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-stdin-'))
    const output = resolve(root, 'delivery')
    const result = runTsx([
      'src/cli.ts', 'create', '--from', '-', '--out', output, '--json',
    ], '# stdin brief\n\n## 重点\n- 研究\n- 验证\n- 发布\n')

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, sourceKind: 'markdown', pptxGenerated: false })
  }, 20_000)

  it('blocks strict mode on a soft density warning before creating output', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-strict-'))
    const brief = resolve(root, 'brief.md')
    const output = resolve(root, 'delivery')
    await writeFile(brief, `# ${'非常长的标题'.repeat(20)}\n\n## 内容\n说明。`, 'utf8')
    const result = runTsx([
      'src/cli.ts', 'create', '--from', brief, '--out', output, '--strict', '--json',
    ])

    expect(result.status).not.toBe(0)
    expect(JSON.parse(result.stderr)).toMatchObject({ ok: false, quality: { strict: true } })
    await expect(access(output)).rejects.toThrow()
  }, 20_000)

  it('imports the supported semantic Dashi shape without its runtime', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-dashi-'))
    const source = resolve(root, 'goal.json')
    const output = resolve(root, 'delivery')
    await writeFile(source, JSON.stringify({
      title: '迁移演示',
      goal: '说明迁移收益',
      slides: [
        { id: 'cover', content: { presentation: { title: '迁移演示', summary: '完成的结果', items: [] } } },
        { id: 'metrics', content: { presentation: { title: '收益', items: [
          { label: '速度', value: 90, displayValue: '90%' },
          { label: '稳定', value: 95, displayValue: '95%' },
        ] } } },
      ],
    }), 'utf8')
    const result = runTsx([
      'src/cli.ts', 'import', source, '--out', output, '--json',
    ])

    expect(result.status, result.stderr).toBe(0)
    const outputJson = JSON.parse(result.stdout)
    expect(outputJson).toMatchObject({ ok: true, pptxGenerated: false, sourceKind: 'imported' })
    const deck = parseDeck(JSON.parse(await readFile(resolve(output, 'deck.json'), 'utf8')))
    expect(deck.source?.kind).toBe('imported')
    expect(deck.slides[1].layout).toBe('metrics')
    expect(await readdir(output)).toContain('assets')
  }, 20_000)

  it('manages a background workspace through a custom PID file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-lifecycle-'))
    const output = resolve(root, 'delivery')
    const pidFile = resolve(root, 'runtime', 'server.pid.json')
    const clientDir = resolve(root, 'dist', 'client')
    await mkdir(clientDir, { recursive: true })
    await writeFile(resolve(clientDir, 'index.html'), '<!doctype html><title>CreatPPT lifecycle fixture</title>', 'utf8')

    const created = runTsx([
      cliSource, 'create', 'Lifecycle contract', '--out', output, '--json',
    ], undefined, root)
    expect(created.status, created.stderr).toBe(0)

    const started = runTsx([
      cliSource, 'serve', output, '--background', '--port', '0', '--pid-file', pidFile, '--json',
    ], undefined, root)
    expect(started.status, started.stderr).toBe(0)
    expect(JSON.parse(started.stdout)).toMatchObject({ ok: true, stage: 'serve', pptxGenerated: false, pidFile })
    await expect(access(pidFile)).resolves.toBeUndefined()

    const healthy = runTsx([
      cliSource, 'health', output, '--pid-file', pidFile, '--json',
    ], undefined, root)
    expect(healthy.status, healthy.stderr).toBe(0)
    expect(JSON.parse(healthy.stdout)).toMatchObject({ ok: true, health: { ok: true, projectDir: output } })

    const stopped = runTsx([
      cliSource, 'stop', output, '--pid-file', pidFile, '--json',
    ], undefined, root)
    expect(stopped.status, stopped.stderr).toBe(0)
    expect(JSON.parse(stopped.stdout)).toMatchObject({ ok: true, stopped: true })
    await expect(access(pidFile)).rejects.toThrow()
  }, 30_000)

})
