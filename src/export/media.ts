import { resolveAssetUrl } from '@/utils/assets'

const imageCache = new Map<string, Promise<string>>()

export function clearImageCache(): void {
  imageCache.clear()
}

export function loadImageData(source: string): Promise<string> {
  const cached = imageCache.get(source)
  if (cached) return cached
  const promise = fetchImageData(source)
  imageCache.set(source, promise)
  return promise
}

async function fetchImageData(source: string): Promise<string> {
  const response = await fetch(resolveAssetUrl(source))
  if (!response.ok) throw new Error(`无法读取导出图片：${source}`)
  const blob = await response.blob()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
    throw new Error(`不支持的图片格式：${blob.type || 'unknown'}`)
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!isAllowedImage(bytes, blob.type)) throw new Error('图片内容与声明格式不一致。')
  return blobToDataUrl(new Blob([bytes], { type: blob.type }))
}

function isAllowedImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/webp') return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片。'))
    reader.readAsDataURL(blob)
  })
}
