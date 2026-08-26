#!/usr/bin/env node

/**
 * Convert the bundled photographic starter PNGs to high-quality JPEGs.
 * This is a maintainer-only command; it is intentionally not part of
 * `prepack`, so publishing never depends on a local image tool or mutates
 * source files unexpectedly.
 */
import { access, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const assetsDir = resolve(root, 'starter/assets')
const quality = parseQuality(process.argv)

try {
  await access(assetsDir)
}
catch {
  throw new Error(`Starter asset directory does not exist: ${assetsDir}`)
}

const files = (await readdir(assetsDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.png')
  .map(entry => entry.name)
  .sort()

if (!files.length) {
  console.log('No starter PNG files found; nothing to compress.')
  process.exit(0)
}

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
console.log(`Compressing ${files.length} starter PNGs with ${ffmpeg} (quality ${quality})...`)

for (const file of files) {
  const source = resolve(assetsDir, file)
  const output = resolve(assetsDir, `${basename(file, extname(file))}.jpg`)
  const sourceBytes = await readFile(source)
  if (pngHasAlpha(sourceBytes)) {
    console.log(`  ${file} kept as PNG (alpha channel detected)`)
    continue
  }
  // Keep a .jpg suffix so ffmpeg can infer the output muxer.
  const temporary = `${output}.tmp.jpg`
  await unlink(temporary).catch(() => undefined)
  await runFfmpeg(ffmpeg, source, temporary, quality)
  const outputStat = await stat(temporary)
  if (!outputStat.isFile() || outputStat.size === 0) {
    throw new Error(`ffmpeg produced an empty output for ${file}`)
  }
  // Replace an existing JPEG on repeat runs (notably on Windows, where
  // rename does not always overwrite an open destination).
  await unlink(output).catch(() => undefined)
  await rename(temporary, output)
  await unlink(source)
  console.log(`  ${file} -> ${basename(output)} (${formatBytes(outputStat.size)})`)
}

function parseQuality(argv) {
  const index = argv.indexOf('--quality')
  const value = index >= 0 ? Number(argv[index + 1]) : 3
  if (!Number.isInteger(value) || value < 2 || value > 5) {
    throw new Error('--quality must be an integer from 2 (best) to 5 (smallest).')
  }
  return value
}

function runFfmpeg(command, source, output, q) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', source,
      '-q:v', String(q),
      '-pix_fmt', 'yuv420p',
      output,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', error => {
      reject(new Error(`Unable to run ${command}. Install ffmpeg or set FFMPEG. ${error.message}`))
    })
    child.once('exit', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`ffmpeg failed for ${basename(source)}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function pngHasAlpha(bytes) {
  // PNG color types 4 (grayscale + alpha) and 6 (RGBA) carry transparency.
  if (!(bytes.length >= 26
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes.toString('ascii', 12, 16) === 'IHDR')) return false
  if (bytes[25] === 4 || bytes[25] === 6) return true

  // Indexed-color PNGs can carry transparency in a tRNS chunk even without
  // an explicit alpha color type.
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const typeStart = offset + 4
    const next = offset + 12 + length
    if (next > bytes.length) break
    const type = bytes.toString('ascii', typeStart, typeStart + 4)
    if (type === 'tRNS') return true
    if (type === 'IEND') break
    offset = next
  }
  return false
}
