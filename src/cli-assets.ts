import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { classifyAssetSource } from './domain/assets'
import type { DeckSpec, ImageAsset, QualityIssue } from './domain/types'

const MAX_ASSET_BYTES = 25 * 1024 * 1024

export interface CopyAssetsOptions {
  derivedInputDir?: string
  explicitInputDir?: string
  starterDir?: string
  outputDir: string
  /** Relative paths under an assets directory. When set, only these files are copied. */
  includeFiles?: string[]
}

export interface CopyAssetsResult {
  sourceDir?: string
  usedFallback: boolean
  copiedFiles: string[]
}

export interface AssetInspectionResult {
  issues: QualityIssue[]
  checksums: Map<string, string>
}

/** Copy the first non-empty asset source, falling back to the package starter set. */
export async function copyProjectAssets(options: CopyAssetsOptions): Promise<CopyAssetsResult> {
  const explicit = options.explicitInputDir
  if (explicit && !(await isDirectory(explicit))) {
    throw new Error(`Assets directory does not exist: ${explicit}`)
  }

  const candidates = [explicit, options.derivedInputDir, options.starterDir].filter(Boolean) as string[]
  await mkdir(options.outputDir, { recursive: true })

  // A materialized deck should carry only the local files it references. Keep
  // the old whole-directory behavior when callers omit includeFiles so the
  // helper remains useful for demo/setup scripts and existing integrations.
  if (options.includeFiles !== undefined) {
    const requested = normalizeIncludeFiles(options.includeFiles)
    const sourceCandidates = candidates
    const copiedFrom = new Map<string, string>()
    for (const file of requested) {
      for (const candidate of sourceCandidates) {
        const source = resolve(candidate, file)
        if (!isWithin(resolve(candidate), source) || !(await isFile(source))) continue
        const target = resolve(options.outputDir, file)
        await mkdir(dirname(target), { recursive: true })
        await cp(source, target)
        copiedFrom.set(file, candidate)
        break
      }
    }

    const sourcesUsed = [...new Set(copiedFrom.values())]
    return {
      sourceDir: sourcesUsed[0],
      usedFallback: Boolean(options.starterDir && sourcesUsed.includes(options.starterDir)),
      copiedFiles: await listFiles(options.outputDir),
    }
  }

  let sourceDir: string | undefined
  let usedFallback = false
  for (const candidate of candidates) {
    if (await hasFiles(candidate)) {
      sourceDir = candidate
      usedFallback = Boolean(options.starterDir && candidate === options.starterDir && candidate !== explicit && candidate !== options.derivedInputDir)
      break
    }
  }

  if (!sourceDir) return { usedFallback: false, copiedFiles: [] }
  await cp(sourceDir, options.outputDir, { recursive: true })
  return {
    sourceDir,
    usedFallback,
    copiedFiles: await listFiles(options.outputDir),
  }
}

/** Validate materialized local images and calculate provenance checksums. */
export async function inspectProjectAssets(deck: DeckSpec, projectDir: string): Promise<AssetInspectionResult> {
  const issues: QualityIssue[] = []
  const checksums = new Map<string, string>()
  const seen = new Set<string>()

  for (const slide of deck.slides) {
    const images: ImageAsset[] = [
      ...(slide.images ?? []),
      ...(slide.elements ?? []).flatMap(element => element.type === 'image' && element.src
        ? [{ src: element.src, alt: element.alt ?? '画布图片' }]
        : []),
    ]
    for (const image of images) {
      // A semantic image and its generated scene element often share a source
      // but have different IDs. Inspect each physical file once to avoid
      // duplicate errors while still checking every distinct reference.
      const key = image.src
      if (seen.has(key)) continue
      seen.add(key)
      const sourceInfo = classifyAssetSource(image.src)
      if (sourceInfo.remote || /^data:/i.test(image.src) || /^blob:/i.test(image.src)) continue
      if (!image.src.startsWith('assets/')) {
        issues.push({
          code: 'ASSET_PATH_OUTSIDE_PROJECT',
          severity: 'error',
          stage: 'materialize',
          slideId: slide.id,
          field: 'images',
          message: `素材路径必须位于 assets/：${image.src}`,
          fix: '将素材复制到工作区 assets/ 并引用相对路径。',
        })
        continue
      }

      const assetsRoot = resolve(projectDir, 'assets')
      const target = resolve(projectDir, image.src)
      if (!isWithin(assetsRoot, target)) {
        issues.push({
          code: 'ASSET_PATH_OUTSIDE_PROJECT',
          severity: 'error',
          stage: 'materialize',
          slideId: slide.id,
          field: 'images',
          message: `素材路径越过 assets/ 边界：${image.src}`,
          fix: '使用 assets/<filename> 相对路径。',
        })
        continue
      }

      let bytes: Buffer
      try {
        const fileStat = await stat(target)
        if (!fileStat.isFile()) throw new Error('not a file')
        if (fileStat.size > MAX_ASSET_BYTES) {
          issues.push({
            code: 'ASSET_FILE_TOO_LARGE',
            severity: 'error',
            stage: 'materialize',
            slideId: slide.id,
            field: 'images',
            message: `素材超过 25 MB：${image.src}`,
            fix: '压缩图片后重新放入 assets/。',
          })
          continue
        }
        bytes = await readFile(target)
      }
      catch {
        issues.push({
          code: 'ASSET_FILE_MISSING',
          severity: 'error',
          stage: 'materialize',
          slideId: slide.id,
          field: 'images',
          message: `工作区找不到素材：${image.src}`,
          fix: '将图片放入输入目录 assets/ 后重试。',
        })
        continue
      }

      const detected = detectImageMime(bytes)
      if (!sourceInfo.supported || !detected || sourceInfo.mimeType !== detected) {
        issues.push({
          code: 'ASSET_MIME_MISMATCH',
          severity: 'error',
          stage: 'materialize',
          slideId: slide.id,
          field: 'images',
          message: `素材格式与文件内容不匹配：${image.src}`,
          fix: '使用真实的 JPEG、PNG 或 WebP 文件。',
        })
        continue
      }
      const checksum = createHash('sha256').update(bytes).digest('hex')
      checksums.set(image.src, checksum)
      if (image.assetId) checksums.set(image.assetId, checksum)
    }
  }

  return { issues, checksums }
}

export function applyAssetChecksums(deck: DeckSpec, checksums: Map<string, string>): void {
  deck.assetManifest = deck.assetManifest?.map(asset => {
    const checksum = checksums.get(asset.id) ?? checksums.get(asset.src)
    return checksum ? { ...asset, provenance: { ...(asset.provenance ?? {}), checksum } } : asset
  })
}

async function hasFiles(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git') continue
      if (entry.isFile()) return true
      if (entry.isDirectory() && await hasFiles(resolve(path, entry.name))) return true
    }
    return false
  }
  catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  }
  catch {
    return false
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  }
  catch {
    return false
  }
}

function normalizeIncludeFiles(files: string[]): string[] {
  const normalized = new Set<string>()
  for (const value of files) {
    const trimmed = value.trim().replaceAll('\\', '/')
    const relativePath = trimmed.startsWith('assets/') ? trimmed.slice('assets/'.length) : trimmed
    if (!relativePath || relativePath.startsWith('/') || relativePath.split('/').includes('..')) continue
    const target = relativePath.split('/').filter(Boolean).join('/')
    if (target) normalized.add(target)
  }
  return [...normalized].sort()
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = []
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const target = resolve(current, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile()) result.push(relative(root, target))
    }
  }
  await visit(root)
  return result.sort()
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith(sep))
}

function detectImageMime(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return undefined
}
