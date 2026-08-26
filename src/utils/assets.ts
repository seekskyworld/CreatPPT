export function resolveAssetUrl(source: string): string {
  if (!source) return ''
  if (/^(data:|blob:|https?:\/\/|\/\/)/.test(source)) return source
  const normalized = source.replace(/^\.\//, '').replace(/^assets\//, '')
  return `/deck-assets/${normalized.split('/').map(encodeURIComponent).join('/')}`
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image.'))
    reader.readAsDataURL(file)
  })
}
