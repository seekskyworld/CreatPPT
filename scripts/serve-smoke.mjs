// Verify the production CLI can hand off, inspect, and stop a managed workspace.
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cli = resolve(root, 'dist/node/cli.js')

function run(args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', rejectRun)
    child.on('close', code => resolveRun({ code: code ?? 1, stdout, stderr }))
  })
}

function parseJson(result, label) {
  if (result.code !== 0) throw new Error(`${label} failed (${result.code}): ${result.stderr || result.stdout}`)
  try {
    return JSON.parse(result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1))
  }
  catch (error) {
    throw new Error(`${label} did not return JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  await access(cli)
  const tempRoot = await mkdtemp(join(tmpdir(), 'creatppt-serve-smoke-'))
  const delivery = resolve(tempRoot, 'delivery')
  const pidFile = resolve(tempRoot, 'runtime', 'server.pid.json')
  let started
  try {
    parseJson(await run(['create', 'Built lifecycle smoke', '--out', delivery, '--json'], root), 'create')
    started = parseJson(await run(['serve', delivery, '--background', '--port', '0', '--pid-file', pidFile, '--json'], root), 'serve')
    if (started.pptxGenerated !== false || started.pidFile !== pidFile || !started.url) {
      throw new Error(`Unexpected serve result: ${JSON.stringify(started)}`)
    }
    const healthy = parseJson(await run(['health', delivery, '--pid-file', pidFile, '--json'], root), 'health')
    if (healthy.ok !== true || healthy.health?.projectDir !== delivery) {
      throw new Error(`Unexpected health result: ${JSON.stringify(healthy)}`)
    }
    const stopped = parseJson(await run(['stop', delivery, '--pid-file', pidFile, '--json'], root), 'stop')
    if (stopped.ok !== true || stopped.stopped !== true) throw new Error(`Unexpected stop result: ${JSON.stringify(stopped)}`)
    const entries = await readdir(delivery)
    if (entries.some(entry => entry.endsWith('.pptx'))) throw new Error('Serve smoke found a pre-generated PPTX')
    console.log('Built serve lifecycle smoke passed')
  }
  finally {
    if (started?.pid) {
      await run(['stop', delivery, '--pid-file', pidFile, '--json'], root).catch(() => undefined)
    }
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
