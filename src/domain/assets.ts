import type { AssetKind } from './types'

export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
export type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]

export interface AssetSourceInfo {
  kind: AssetKind
  remote: boolean
  supported: boolean
  extension?: string
  mimeType?: string
  reason?: string
}

/** Classify an image reference without touching the filesystem or network. */
export function classifyAssetSource(source: string): AssetSourceInfo {
  const value = source.trim()
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value)) {
    const mimeType = value.slice(5, value.indexOf(';')).toLowerCase()
    return { kind: 'generated', remote: false, supported: true, mimeType }
  }
  if (/^blob:/i.test(value)) {
    return { kind: 'generated', remote: false, supported: false, reason: 'blob URLs only live in the current browser session.' }
  }

  const remote = /^(?:https?:)?\/\//i.test(value)
  const extension = extensionFromSource(value)
  const normalizedExtension = extension?.toLowerCase()
  const supported = !normalizedExtension || SUPPORTED_IMAGE_EXTENSIONS.includes(normalizedExtension as SupportedImageExtension)
  return {
    kind: remote ? 'remote' : value.startsWith('assets/') ? 'local' : 'user',
    remote,
    supported,
    extension: normalizedExtension,
    mimeType: normalizedExtension ? mimeTypeForExtension(normalizedExtension) : undefined,
    reason: supported ? undefined : `Unsupported image extension: ${normalizedExtension}`,
  }
}

export function isSupportedImageSource(source: string): boolean {
  return classifyAssetSource(source).supported
}

function extensionFromSource(source: string): string | undefined {
  try {
    const pathname = /^(?:https?:)?\/\//i.test(source) ? new URL(source, 'http://localhost').pathname : source.split(/[?#]/, 1)[0]
    const match = pathname.match(/\.([a-z0-9]+)$/i)
    return match ? `.${match[1]}` : undefined
  }
  catch {
    return undefined
  }
}

function mimeTypeForExtension(extension: string): string | undefined {
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  return undefined
}
