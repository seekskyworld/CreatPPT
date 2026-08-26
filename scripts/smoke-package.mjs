// 在隔离目录安装 npm tarball，并验证 npx 入口仍能创建无 PPTX 的 Web 工作区。
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const maxTarballBytes = 4_000_000
const allowedRuntimeDependencies = ['commander']

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      // npm.cmd and npx.cmd are Windows shell shims rather than native executables.
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', rejectRun)
    child.on('close', code => {
      if (code !== 0) {
        rejectRun(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr || stdout}`))
        return
      }
      resolveRun({ stdout, stderr })
    })
  })
}

function parseNpmJson(output) {
  const start = output.indexOf('[')
  if (start < 0) throw new Error(`npm did not return JSON metadata: ${output}`)
  return JSON.parse(output.slice(start))
}

function parseCliJson(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean)
  return JSON.parse(lines.at(-1))
}

async function assertFile(path, label) {
  try {
    await access(path)
  }
  catch {
    throw new Error(`Package smoke did not create ${label}: ${path}`)
  }
}

async function listJavaScriptFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path)
  }
  return files
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  await assertFile(resolve(root, 'dist/node/cli.js'), 'the built CLI')

  const tempRoot = await mkdtemp(join(tmpdir(), 'creatppt-package-smoke-'))
  try {
    const packDir = resolve(tempRoot, 'pack')
    const installDir = resolve(tempRoot, 'install')
    await mkdir(packDir, { recursive: true })
    await mkdir(installDir, { recursive: true })
    await writeFile(resolve(installDir, 'package.json'), JSON.stringify({
      name: 'creatppt-package-smoke',
      version: '0.0.0',
      private: true,
    }, null, 2))

    const packed = await run(npmCommand, [
      'pack',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      packDir,
    ], root)
    const metadata = parseNpmJson(packed.stdout)
    const packageMetadata = metadata[0]
    const filename = packageMetadata?.filename
    if (typeof filename !== 'string') throw new Error('npm pack did not report a tarball')
    if (typeof packageMetadata.size !== 'number' || packageMetadata.size > maxTarballBytes) {
      throw new Error(`Packed package exceeds ${maxTarballBytes} bytes: ${packageMetadata.size ?? 'unknown'}`)
    }
    const tarball = resolve(packDir, filename)

    await run(npmCommand, [
      'install',
      '--ignore-scripts',
      '--no-package-lock',
      tarball,
    ], installDir)

    const installedPackageDir = resolve(installDir, 'node_modules', packageJson.name)
    const installedPackageJson = JSON.parse(await readFile(resolve(installedPackageDir, 'package.json'), 'utf8'))
    for (const documentation of [
      'README.zh-CN.md',
      'CONTRIBUTING.md',
      'CONTRIBUTING.zh-CN.md',
      'SECURITY.md',
      'CODE_OF_CONDUCT.md',
    ]) {
      await assertFile(resolve(installedPackageDir, documentation), documentation)
    }
    const iconPath = resolve(installedPackageDir, 'dist', 'client', 'creatppt-icon.png')
    await assertFile(iconPath, 'the bundled project icon')
    const iconBytes = await readFile(iconPath)
    if (iconBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error('Bundled project icon is not a PNG')
    }
    const runtimeDependencies = Object.keys(installedPackageJson.dependencies ?? {}).sort()
    if (JSON.stringify(runtimeDependencies) !== JSON.stringify(allowedRuntimeDependencies)) {
      throw new Error(`Unexpected packed runtime dependencies: ${runtimeDependencies.join(', ') || '<empty>'}`)
    }

    const nodeFiles = await listJavaScriptFiles(resolve(installedPackageDir, 'dist', 'node'))
    const externalZodImports = []
    for (const file of nodeFiles) {
      const source = await readFile(file, 'utf8')
      if (/\bfrom\s+['"]zod['"]|\brequire\(['"]zod['"]\)/.test(source)) externalZodImports.push(file)
    }
    if (externalZodImports.length) {
      throw new Error(`Packed Node output still imports zod: ${externalZodImports.join(', ')}`)
    }

    const starterDir = resolve(installedPackageDir, 'starter', 'assets')
    const starterFiles = (await readdir(starterDir)).sort()
    const starterJpegs = starterFiles.filter(file => file.endsWith('.jpg'))
    if (starterJpegs.length !== 18 || starterFiles.some(file => file.endsWith('.png'))) {
      throw new Error(`Unexpected unpacked starter assets: ${starterFiles.join(', ')}`)
    }
    for (const file of starterJpegs) {
      const bytes = await readFile(resolve(starterDir, file))
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        throw new Error(`Starter asset is not a JPEG after npm unpack: ${file}`)
      }
    }

    const version = await run(npxCommand, ['--no-install', 'creatppt', '--version'], installDir)
    if (version.stdout.trim() !== packageJson.version) {
      throw new Error(`Unexpected npx version output: ${version.stdout.trim()}`)
    }

    const briefPath = resolve(tempRoot, 'brief.md')
    const deliveryPath = resolve(tempRoot, 'delivery')
    await writeFile(briefPath, '# Package smoke\n\nCreate a short launch brief with one measurable outcome.\n')
    const created = await run(npxCommand, [
      '--no-install',
      'creatppt',
      'create',
      '--from',
      briefPath,
      '--out',
      deliveryPath,
      '--json',
    ], installDir)
    const result = parseCliJson(created.stdout)
    if (result.pptxGenerated !== false || result.schemaVersion !== 2 || result.showcase?.ok !== true) {
      throw new Error(`Unexpected create result: ${JSON.stringify(result)}`)
    }
    await assertFile(resolve(deliveryPath, 'deck.json'), 'the generated deck')
    const deliveryEntries = await readdir(deliveryPath)
    if (deliveryEntries.some(entry => entry.endsWith('.pptx'))) {
      throw new Error('Package smoke found a pre-generated PPTX')
    }
    const deck = JSON.parse(await readFile(resolve(deliveryPath, 'deck.json'), 'utf8'))
    const referencedAssets = [...new Set(deck.slides.flatMap(slide => [
      ...(slide.images ?? []).map(image => image.src),
      ...(slide.elements ?? [])
        .filter(element => element.type === 'image' && element.src)
        .map(element => element.src),
    ]).filter(source => source.startsWith('assets/')).map(source => source.slice('assets/'.length)))]
    const deliveryAssets = (await readdir(resolve(deliveryPath, 'assets'))).sort()
    const missingAssets = referencedAssets.filter(file => !deliveryAssets.includes(file))
    const missingStarterAssets = starterJpegs.filter(file => !deliveryAssets.includes(file))
    if (missingAssets.length || missingStarterAssets.length) {
      throw new Error(`Package smoke asset mismatch: referencedMissing=${missingAssets.join(',')} starterMissing=${missingStarterAssets.join(',')}`)
    }

    console.log(`Package smoke passed for ${packageJson.name}@${packageJson.version} (${packageMetadata.size} byte tarball; runtime=commander; bundled zod; project icon; 18 unpacked JPEGs; ${deliveryAssets.length} delivery assets)`)
  }
  finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
